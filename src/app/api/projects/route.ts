import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { db, projects, courses, eq, desc, sql, and, saveDatabaseImmediate, ensureDatabaseReady, getSqlite } from '@/storage/database';
import { generateId, getTimestamp } from '@/storage/database';
import type { SQLWrapper } from 'drizzle-orm';

// 用户信息类型
interface UserInfo {
  userId: string;
  roleCode?: string;
  departmentId?: string;
}

// 获取当前用户信息
async function getCurrentUser(request: NextRequest): Promise<UserInfo | null> {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('session');
    const authHeader = request.headers.get('authorization');
    
    let session: { userId?: string; roleCode?: string; departmentId?: string } | null = null;
    
    // 从 Cookie 获取
    if (sessionCookie?.value) {
      try {
        session = JSON.parse(sessionCookie.value);
      } catch {
        // 忽略解析错误
      }
    }
    
    // 从 Authorization header 获取
    if (!session && authHeader?.startsWith('Bearer ')) {
      try {
        const token = authHeader.substring(7);
        const decoded = Buffer.from(token, 'base64').toString('utf-8');
        session = JSON.parse(decoded);
      } catch {
        // 忽略解析错误
      }
    }
    
    if (session?.userId) {
      return {
        userId: session.userId,
        roleCode: session.roleCode,
        departmentId: session.departmentId,
      };
    }
    
    return null;
  } catch {
    return null;
  }
}

// 检查用户是否是管理员
function isAdmin(user: UserInfo | null): boolean {
  return user?.roleCode === 'admin';
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
    // 即使失败也标记为已尝试，避免重复报错
    dataCleaned = true;
  }
}

// GET /api/projects - 获取项目列表
export async function GET(request: NextRequest) {
  try {
    await ensureDatabaseReady();
    
    // 清理错误数据
    cleanupInvalidData();
    
    const searchParams = request.nextUrl.searchParams;
    const statusParam = searchParams.get('status');
    const search = searchParams.get('search');
    
    // 获取当前用户信息
    const currentUser = await getCurrentUser(request);
    const currentUserId = currentUser?.userId || null;
    const userIsAdmin = isAdmin(currentUser);
    
    let results: typeof projects.$inferSelect[];
    
    // 解析状态参数（支持逗号分隔的多状态）
    const statuses = statusParam && statusParam !== 'all' 
      ? statusParam.split(',').map(s => s.trim()).filter(Boolean)
      : [];
    
    // 草稿项目：严格按用户隔离，只显示当前用户创建的（管理员可以看到所有）
    const isDraftOnly = statuses.length === 1 && statuses[0] === 'draft';
    
    // 构建基础查询条件
    const buildWhereConditions = (additionalConditions: unknown[] = []) => {
      const conditions = [];
      
      // 非管理员只能看到自己创建的项目
      if (!userIsAdmin && currentUserId) {
        conditions.push(eq(projects.createdById, currentUserId));
      }
      
      // 添加其他条件
      additionalConditions.forEach(cond => {
        if (cond) conditions.push(cond);
      });
      
      return conditions.length > 0 ? and(...conditions) : undefined;
    };
    
    // 未登录且不是查询草稿：返回空（草稿未登录也需要返回空）
    if (!currentUserId && !userIsAdmin) {
      return NextResponse.json({ data: [] });
    }
    
    if (isDraftOnly) {
      // 草稿项目：严格按用户隔离
      if (currentUserId) {
        const conditions = [eq(projects.status, 'draft')];
        if (!userIsAdmin) {
          conditions.push(eq(projects.createdById, currentUserId));
        }
        if (search) {
          conditions.push(sql`${projects.name} LIKE ${'%' + search + '%'}`);
        }
        results = db
          .select()
          .from(projects)
          .where(and(...conditions))
          .orderBy(desc(projects.createdAt))
          .all();
      } else {
        results = [];
      }
    } else if (statuses.length > 1 && search) {
      // 多状态 + 搜索
      const statusCondition = sql`${projects.status} IN (${sql.raw(statuses.map(s => `'${s}'`).join(', '))})`;
      const searchCondition = sql`${projects.name} LIKE ${'%' + search + '%'}`;
      const conditions: (SQLWrapper | undefined)[] = [statusCondition, searchCondition];
      if (!userIsAdmin && currentUserId) {
        conditions.push(eq(projects.createdById, currentUserId));
      }
      results = db
        .select()
        .from(projects)
        .where(and(...conditions))
        .orderBy(desc(projects.createdAt))
        .all();
    } else if (statuses.length > 1) {
      // 多状态
      const statusCondition = sql`${projects.status} IN (${sql.raw(statuses.map(s => `'${s}'`).join(', '))})`;
      const conditions: (SQLWrapper | undefined)[] = [statusCondition];
      if (!userIsAdmin && currentUserId) {
        conditions.push(eq(projects.createdById, currentUserId));
      }
      results = db
        .select()
        .from(projects)
        .where(and(...conditions))
        .orderBy(desc(projects.createdAt))
        .all();
    } else if (statuses.length === 1 && search) {
      // 单状态 + 搜索
      const conditions: (SQLWrapper | undefined)[] = [
        eq(projects.status, statuses[0]),
        sql`${projects.name} LIKE ${'%' + search + '%'}`
      ];
      if (!userIsAdmin && currentUserId) {
        conditions.push(eq(projects.createdById, currentUserId));
      }
      results = db
        .select()
        .from(projects)
        .where(and(...conditions))
        .orderBy(desc(projects.createdAt))
        .all();
    } else if (statuses.length === 1) {
      // 单状态
      const conditions: (SQLWrapper | undefined)[] = [eq(projects.status, statuses[0])];
      if (!userIsAdmin && currentUserId) {
        conditions.push(eq(projects.createdById, currentUserId));
      }
      results = db
        .select()
        .from(projects)
        .where(and(...conditions))
        .orderBy(desc(projects.createdAt))
        .all();
    } else if (search) {
      // 仅搜索
      const conditions: (SQLWrapper | undefined)[] = [sql`${projects.name} LIKE ${'%' + search + '%'}`];
      if (!userIsAdmin && currentUserId) {
        conditions.push(eq(projects.createdById, currentUserId));
      }
      results = db
        .select()
        .from(projects)
        .where(and(...conditions))
        .orderBy(desc(projects.createdAt))
        .all();
    } else {
      // 全部
      if (!userIsAdmin && currentUserId) {
        results = db
          .select()
          .from(projects)
          .where(eq(projects.createdById, currentUserId))
          .orderBy(desc(projects.createdAt))
          .all();
      } else {
        results = db
          .select()
          .from(projects)
          .orderBy(desc(projects.createdAt))
          .all();
      }
    }

    return NextResponse.json({ data: results });
  } catch (error) {
    console.error('Get projects error:', error);
    return NextResponse.json({ error: 'Failed to get projects' }, { status: 500 });
  }
}

// POST /api/projects - 创建新项目
export async function POST(request: NextRequest) {
  try {
    await ensureDatabaseReady();
    
    // 获取当前用户信息
    const currentUser = await getCurrentUser(request);
    
    // 必须登录才能创建项目
    if (!currentUser?.userId) {
      return NextResponse.json({ error: '请先登录后再创建项目' }, { status: 401 });
    }
    
    const currentUserId = currentUser.userId;
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
        // 使用当前用户信息
        departmentId: body.departmentId || 'dept_labor',
        createdById: currentUserId,
        createdAt: now,
      })
      .returning()
      .get();

    // 保存课程数据
    if (body.courses && Array.isArray(body.courses) && body.courses.length > 0) {
      for (let i = 0; i < body.courses.length; i++) {
        const course = body.courses[i];
        db.insert(courses)
          .values({
            id: generateId(),
            isTemplate: false,
            projectId: id,
            name: course.name,
            day: course.day,
            duration: course.duration,
            description: course.description,
            teacherId: course.teacherId,
            visitSiteId: course.visitSiteId,
            type: course.type || 'course',
            order: i,
            isActive: true,
            createdAt: now,
          })
          .run();
      }
    }

    // 保存数据库到文件
    saveDatabaseImmediate();

    return NextResponse.json({ data: result });
  } catch (error) {
    console.error('Create project error:', error);
    return NextResponse.json({ error: 'Failed to create project' }, { status: 500 });
  }
}
