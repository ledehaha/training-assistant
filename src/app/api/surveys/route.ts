import { NextRequest, NextResponse } from 'next/server';
import { db, satisfactionSurveys, eq, desc, saveDatabaseImmediate, ensureDatabaseReady } from '@/storage/database';
import { generateId, getTimestamp } from '@/storage/database';

// GET /api/surveys - 获取满意度调查列表
export async function GET(request: NextRequest) {
  try {
    await ensureDatabaseReady();
    
    const searchParams = request.nextUrl.searchParams;
    const projectId = searchParams.get('projectId');
    
    let results;
    
    if (projectId) {
      results = db
        .select()
        .from(satisfactionSurveys)
        .where(eq(satisfactionSurveys.projectId, projectId))
        .orderBy(desc(satisfactionSurveys.createdAt))
        .all();
    } else {
      results = db
        .select()
        .from(satisfactionSurveys)
        .orderBy(desc(satisfactionSurveys.createdAt))
        .all();
    }

    return NextResponse.json({ data: results });
  } catch (error) {
    console.error('Get surveys error:', error);
    return NextResponse.json({ error: 'Failed to get surveys' }, { status: 500 });
  }
}

// POST /api/surveys - 创建满意度调查
export async function POST(request: NextRequest) {
  try {
    await ensureDatabaseReady();
    
    const body = await request.json();
    const id = generateId();
    const now = getTimestamp();

    const result = db
      .insert(satisfactionSurveys)
      .values({
        id,
        projectId: body.projectId,
        title: body.title,
        description: body.description,
        questions: JSON.stringify(body.questions),
        status: 'active',
        createdAt: now,
      })
      .returning()
      .get();

    // 保存数据库到文件
    saveDatabaseImmediate();

    return NextResponse.json({ data: result });
  } catch (error) {
    console.error('Create survey error:', error);
    return NextResponse.json({ error: 'Failed to create survey' }, { status: 500 });
  }
}
