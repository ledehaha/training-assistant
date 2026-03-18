import { NextRequest, NextResponse } from 'next/server';
import { db, projects, courses, eq, desc, sql, saveDatabaseImmediate, ensureDatabaseReady, getSqlite } from '@/storage/database';
import { generateId, getTimestamp } from '@/storage/database';

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
    
    let results;
    
    // 解析状态参数（支持逗号分隔的多状态）
    const statuses = statusParam && statusParam !== 'all' 
      ? statusParam.split(',').map(s => s.trim()).filter(Boolean)
      : [];
    
    if (statuses.length > 1 && search) {
      // 多状态 + 搜索
      results = db
        .select()
        .from(projects)
        .where(sql`${projects.status} IN (${sql.raw(statuses.map(s => `'${s}'`).join(', '))}) AND ${projects.name} LIKE ${'%' + search + '%'}`)
        .orderBy(desc(projects.createdAt))
        .all();
    } else if (statuses.length > 1) {
      // 多状态
      results = db
        .select()
        .from(projects)
        .where(sql`${projects.status} IN (${sql.raw(statuses.map(s => `'${s}'`).join(', '))})`)
        .orderBy(desc(projects.createdAt))
        .all();
    } else if (statuses.length === 1 && search) {
      // 单状态 + 搜索
      results = db
        .select()
        .from(projects)
        .where(sql`${projects.status} = ${statuses[0]} AND ${projects.name} LIKE ${'%' + search + '%'}`)
        .orderBy(desc(projects.createdAt))
        .all();
    } else if (statuses.length === 1) {
      // 单状态
      results = db
        .select()
        .from(projects)
        .where(eq(projects.status, statuses[0]))
        .orderBy(desc(projects.createdAt))
        .all();
    } else if (search) {
      // 仅搜索
      results = db
        .select()
        .from(projects)
        .where(sql`${projects.name} LIKE ${'%' + search + '%'}`)
        .orderBy(desc(projects.createdAt))
        .all();
    } else {
      // 全部
      results = db
        .select()
        .from(projects)
        .orderBy(desc(projects.createdAt))
        .all();
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
        // 临时使用默认值，认证系统完成后从session获取
        departmentId: body.departmentId || 'dept_labor',
        createdById: body.createdById || 'user_admin',
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
