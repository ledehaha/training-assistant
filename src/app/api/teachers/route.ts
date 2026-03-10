import { NextRequest, NextResponse } from 'next/server';
import { db, teachers, eq, desc, sql, saveDatabaseImmediate, ensureDatabaseReady } from '@/storage/database';
import { generateId, getTimestamp } from '@/storage/database';

// GET /api/teachers - 获取讲师列表
export async function GET(request: NextRequest) {
  try {
    // 确保数据库已初始化
    await ensureDatabaseReady();
    
    const searchParams = request.nextUrl.searchParams;
    const title = searchParams.get('title');
    const expertise = searchParams.get('expertise');
    
    let results;
    
    if (title && expertise) {
      results = db
        .select()
        .from(teachers)
        .where(sql`${teachers.isActive} = 1 AND ${teachers.title} = ${title} AND ${teachers.expertise} LIKE ${'%' + expertise + '%'}`)
        .orderBy(desc(teachers.rating))
        .all();
    } else if (title) {
      results = db
        .select()
        .from(teachers)
        .where(sql`${teachers.isActive} = 1 AND ${teachers.title} = ${title}`)
        .orderBy(desc(teachers.rating))
        .all();
    } else if (expertise) {
      results = db
        .select()
        .from(teachers)
        .where(sql`${teachers.isActive} = 1 AND ${teachers.expertise} LIKE ${'%' + expertise + '%'}`)
        .orderBy(desc(teachers.rating))
        .all();
    } else {
      results = db
        .select()
        .from(teachers)
        .where(eq(teachers.isActive, true))
        .orderBy(desc(teachers.rating))
        .all();
    }

    return NextResponse.json({ data: results });
  } catch (error) {
    console.error('Get teachers error:', error);
    return NextResponse.json({ error: 'Failed to get teachers' }, { status: 500 });
  }
}

// POST /api/teachers - 创建新讲师
export async function POST(request: NextRequest) {
  try {
    // 确保数据库已初始化
    await ensureDatabaseReady();
    
    const body = await request.json();
    const id = generateId();
    const now = getTimestamp();

    const result = db
      .insert(teachers)
      .values({
        id,
        name: body.name,
        title: body.title,
        expertise: body.expertise,
        organization: body.organization,
        bio: body.bio,
        hourlyRate: body.hourlyRate,
        createdAt: now,
      })
      .returning()
      .get();

    // 保存数据库到文件
    saveDatabaseImmediate();

    return NextResponse.json({ data: result });
  } catch (error) {
    console.error('Create teacher error:', error);
    return NextResponse.json({ error: 'Failed to create teacher' }, { status: 500 });
  }
}
