import { NextRequest, NextResponse } from 'next/server';
import { db, projects, eq, desc, sql, saveDatabaseImmediate, ensureDatabaseReady } from '@/storage/database';
import { generateId, getTimestamp } from '@/storage/database';

// GET /api/projects - 获取项目列表
export async function GET(request: NextRequest) {
  try {
    await ensureDatabaseReady();
    
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status');
    const search = searchParams.get('search');
    
    let results;
    
    if (status && status !== 'all' && search) {
      results = db
        .select()
        .from(projects)
        .where(sql`${projects.status} = ${status} AND ${projects.name} LIKE ${'%' + search + '%'}`)
        .orderBy(desc(projects.createdAt))
        .all();
    } else if (status && status !== 'all') {
      results = db
        .select()
        .from(projects)
        .where(eq(projects.status, status))
        .orderBy(desc(projects.createdAt))
        .all();
    } else if (search) {
      results = db
        .select()
        .from(projects)
        .where(sql`${projects.name} LIKE ${'%' + search + '%'}`)
        .orderBy(desc(projects.createdAt))
        .all();
    } else {
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
        status: 'draft',
        createdAt: now,
      })
      .returning()
      .get();

    // 保存数据库到文件
    saveDatabaseImmediate();

    return NextResponse.json({ data: result });
  } catch (error) {
    console.error('Create project error:', error);
    return NextResponse.json({ error: 'Failed to create project' }, { status: 500 });
  }
}
