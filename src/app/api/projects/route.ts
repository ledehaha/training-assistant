import { NextRequest, NextResponse } from 'next/server';
import { db, projects, courses, departments, eq, desc, sql, and, or, saveDatabaseImmediate, ensureDatabaseReady, getSqlite } from '@/storage/database';
import { generateId, getTimestamp } from '@/storage/database';
import type { SQLWrapper } from 'drizzle-orm';
import { 
  getCurrentUser, 
  isAdmin, 
  isCollegeAdmin, 
  isDeptHead,
  isManagementUser,
  canDeleteProject,
  type UserInfo 
} from '@/lib/access-control';

// 确保courses表有teacherTitle和location字段（兼容性处理）
function ensureCoursesTableSchema() {
  try {
    // 检查并添加 teacherTitle 字段
    db.run(`ALTER TABLE courses ADD COLUMN teacherTitle TEXT`);
  } catch (error) {
    // 字段已存在，忽略错误
  }
  
  try {
    // 检查并添加 location 字段
    db.run(`ALTER TABLE courses ADD COLUMN location TEXT`);
  } catch (error) {
    // 字段已存在，忽略错误
  }
}

// 一次性数据清理标志
let dataCleaned = false;

// 清理错误的默认数据
function cleanupInvalidData() {
  if (dataCleaned) return;
  
  try {
    const sqlite = getSqlite();
    if (sqlite) {
      // 先检查并添加缺失的列
      try {
        sqlite.run('ALTER TABLE projects ADD COLUMN countersign_file TEXT');
        sqlite.run('ALTER TABLE projects ADD COLUMN countersign_file_name TEXT');
      } catch {
        // 列已存在，忽略错误
      }
      
      // 清理会签单字段的错误默认值
      sqlite.run(`UPDATE projects SET countersign_file = NULL, countersign_file_name = NULL WHERE countersign_file = 'countersign_file'`);
      saveDatabaseImmediate();
      console.log('Cleaned up invalid countersign_file data');
    }
    dataCleaned = true;
  } catch (err) {
    console.warn('Failed to clean countersign data:', err);
    dataCleaned = true;
  }
}

// 获取部门类型
async function getDepartmentType(deptId: string | null): Promise<string | null> {
  if (!deptId) return null;
  try {
    const dept = await db.select()
      .from(departments)
      .where(eq(departments.id, deptId))
      .limit(1);
    return dept[0]?.type || null;
  } catch {
    return null;
  }
}

// GET /api/projects - 获取项目列表（实现新的访问规则）
export async function GET(request: NextRequest) {
  try {
    await ensureDatabaseReady();
    cleanupInvalidData();
    
    const searchParams = request.nextUrl.searchParams;
    const statusParam = searchParams.get('status');
    const search = searchParams.get('search');
    
    // 获取当前用户信息
    const currentUser = await getCurrentUser(request);
    
    // 解析状态参数
    const statuses = statusParam && statusParam !== 'all' 
      ? statusParam.split(',').map(s => s.trim()).filter(Boolean)
      : [];
    
    // 管理员：可以看到所有项目
    if (isAdmin(currentUser)) {
      return queryProjects(statuses, search, null, null, true);
    }
    
    // 未登录用户：只能看归档项目
    if (!currentUser?.userId) {
      if (statuses.length === 1 && statuses[0] === 'archived') {
        return queryProjects(['archived'], search, null, null, false);
      }
      return NextResponse.json({ data: [] });
    }
    
    const userId = currentUser.userId;
    const userDeptId = currentUser.departmentId || null;
    const userDeptType = await getDepartmentType(userDeptId);
    
    // 判断是否只查询归档项目
    const isArchivedOnly = statuses.length === 1 && statuses[0] === 'archived';
    
    // 归档项目：所有人可见
    if (isArchivedOnly) {
      return queryProjects(['archived'], search, null, null, false);
    }
    
    // 学院负责人：可看本学院项目 + 自己创建的所有项目 + 所有归档项目
    if (isCollegeAdmin(currentUser)) {
      // 如果没有指定状态，返回所有符合条件的项目
      if (statuses.length === 0) {
        // 本学院项目 或 自己创建的项目 或 归档项目
        const results = db
          .select()
          .from(projects)
          .where(or(
            eq(projects.departmentId, userDeptId!),
            eq(projects.createdById, userId),
            eq(projects.status, 'archived')
          ))
          .orderBy(desc(projects.createdAt))
          .all();
        
        // 搜索过滤
        let filtered = results;
        if (search) {
          filtered = results.filter(p => p.name?.includes(search));
        }
        return NextResponse.json({ data: filtered });
      }
      
      // 指定状态查询
      return queryProjectsWithCollegeAdmin(statuses, search, userId, userDeptId!);
    }
    
    // 部门负责人：可看所有非草稿/设计中的项目
    if (isDeptHead(currentUser)) {
      const allowedStatuses = statuses.filter(s => 
        ['pending_approval', 'approved', 'executing', 'completed', 'archived'].includes(s)
      );
      if (allowedStatuses.length === 0 && statuses.length > 0) {
        return NextResponse.json({ data: [] });
      }
      return queryProjects(allowedStatuses.length > 0 ? allowedStatuses : ['pending_approval', 'approved', 'executing', 'completed', 'archived'], search, null, null, false);
    }
    
    // 管理部门普通员工：可看待审批和归档项目
    if (userDeptType === 'management') {
      const allowedStatuses = statuses.filter(s => 
        ['pending_approval', 'archived'].includes(s)
      );
      if (allowedStatuses.length === 0 && statuses.length > 0) {
        return NextResponse.json({ data: [] });
      }
      return queryProjects(allowedStatuses.length > 0 ? allowedStatuses : ['pending_approval', 'archived'], search, null, null, false);
    }
    
    // 普通学院员工：只能看自己的项目 + 所有归档项目
    if (statuses.length === 0) {
      // 返回自己的项目 + 归档项目
      const results = db
        .select()
        .from(projects)
        .where(or(
          eq(projects.createdById, userId),
          eq(projects.status, 'archived')
        ))
        .orderBy(desc(projects.createdAt))
        .all();
      
      let filtered = results;
      if (search) {
        filtered = results.filter(p => p.name?.includes(search));
      }
      return NextResponse.json({ data: filtered });
    }
    
    // 指定状态查询：自己的项目 + 如果是归档则全部
    return queryProjectsForCollegeStaff(statuses, search, userId);
    
  } catch (error) {
    console.error('Get projects error:', error);
    return NextResponse.json({ error: 'Failed to get projects' }, { status: 500 });
  }
}

// 查询项目（管理员）
function queryProjects(
  statuses: string[],
  search: string | null,
  _userId: string | null,
  _deptId: string | null,
  _isAdmin: boolean
) {
  const conditions: (SQLWrapper | undefined)[] = [];
  
  if (statuses.length > 0) {
    conditions.push(sql`${projects.status} IN (${sql.raw(statuses.map(s => `'${s}'`).join(', '))})`);
  }
  
  if (search) {
    conditions.push(sql`${projects.name} LIKE ${'%' + search + '%'}`);
  }
  
  if (conditions.length > 0) {
    const results = db
      .select()
      .from(projects)
      .where(and(...conditions))
      .orderBy(desc(projects.createdAt))
      .all();
    return NextResponse.json({ data: results });
  } else {
    const results = db
      .select()
      .from(projects)
      .orderBy(desc(projects.createdAt))
      .all();
    return NextResponse.json({ data: results });
  }
}

// 查询项目（学院负责人）
function queryProjectsWithCollegeAdmin(
  statuses: string[],
  search: string | null,
  userId: string,
  deptId: string
) {
  // 本学院项目 或 自己创建的项目
  const statusCondition = sql`${projects.status} IN (${sql.raw(statuses.map(s => `'${s}'`).join(', '))})`;
  
  const results = db
    .select()
    .from(projects)
    .where(and(
      statusCondition,
      or(
        eq(projects.departmentId, deptId),
        eq(projects.createdById, userId)
      )
    ))
    .orderBy(desc(projects.createdAt))
    .all();
  
  let filtered = results;
  if (search) {
    filtered = results.filter(p => p.name?.includes(search));
  }
  return NextResponse.json({ data: filtered });
}

// 查询项目（普通学院员工）
function queryProjectsForCollegeStaff(
  statuses: string[],
  search: string | null,
  userId: string
) {
  // 如果包含归档，需要特殊处理
  const hasArchived = statuses.includes('archived');
  const nonArchivedStatuses = statuses.filter(s => s !== 'archived');
  
  let results: typeof projects.$inferSelect[] = [];
  
  // 查询归档项目（全部可见）
  if (hasArchived) {
    const archived = db
      .select()
      .from(projects)
      .where(eq(projects.status, 'archived'))
      .orderBy(desc(projects.createdAt))
      .all();
    results = [...results, ...archived];
  }
  
  // 查询其他状态的项目（仅自己的）
  if (nonArchivedStatuses.length > 0) {
    const statusCondition = sql`${projects.status} IN (${sql.raw(nonArchivedStatuses.map(s => `'${s}'`).join(', '))})`;
    const own = db
      .select()
      .from(projects)
      .where(and(
        statusCondition,
        eq(projects.createdById, userId)
      ))
      .orderBy(desc(projects.createdAt))
      .all();
    results = [...results, ...own];
  }
  
  // 搜索过滤
  if (search) {
    results = results.filter(p => p.name?.includes(search));
  }
  
  // 按时间排序
  results.sort((a, b) => {
    const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return timeB - timeA;
  });
  
  return NextResponse.json({ data: results });
}

// POST /api/projects - 创建新项目
export async function POST(request: NextRequest) {
  try {
    await ensureDatabaseReady();
    ensureCoursesTableSchema(); // 确保表结构包含teacherTitle和location字段
    
    const currentUser = await getCurrentUser(request);
    
    // 必须登录才能创建项目
    if (!currentUser?.userId) {
      return NextResponse.json({ error: '请先登录后再创建项目' }, { status: 401 });
    }
    
    const body = await request.json();
    const id = generateId();
    const now = getTimestamp();

    const result = db
      .insert(projects)
      .values({
        id,
        name: body.name,
        trainingTarget: body.trainingTarget,
        targetAudience: body.targetAudience,
        participantCount: body.participantCount,
        trainingDays: body.trainingDays,
        trainingHours: body.trainingHours,
        trainingPeriod: body.trainingPeriod,
        budgetMin: body.budgetMin,
        budgetMax: body.budgetMax,
        location: body.location,
        specialRequirements: body.specialRequirements,
        status: body.status || 'draft',
        departmentId: body.departmentId || currentUser.departmentId || 'dept_labor',
        createdById: currentUser.userId,
        createdAt: now,
      })
      .returning()
      .get();

    // 保存课程数据
    if (body.courses && Array.isArray(body.courses) && body.courses.length > 0) {
      const sqlite = getSqlite();
      if (sqlite) {
        for (let i = 0; i < body.courses.length; i++) {
          const course = body.courses[i];
          const courseId = generateId();
          
          // 直接使用 SQL 插入，避免 Drizzle ORM schema 问题
          sqlite.run(
            `INSERT INTO courses (id, is_template, project_id, name, day, duration, description, category, teacher_id, teacherTitle, location, type, visit_site_id, "order", is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              courseId,
              0, // is_template
              id, // project_id
              course.name,
              course.day,
              course.duration,
              course.description || null,
              course.category || null,
              course.teacherId || null,
              course.teacherTitle || null,
              course.location || null,
              course.type || 'course',
              course.visitSiteId || null,
              i, // order
              1, // is_active
              now,
              null
            ]
          );
        }
      }
    }

    saveDatabaseImmediate();

    return NextResponse.json({ data: result });
  } catch (error) {
    console.error('Create project error:', error);
    return NextResponse.json({ error: 'Failed to create project' }, { status: 500 });
  }
}
