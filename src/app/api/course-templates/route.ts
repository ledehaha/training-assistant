import { NextRequest, NextResponse } from 'next/server';
import { db, courseTemplates, eq, desc, sql } from '@/storage/database';
import { generateId, getTimestamp } from '@/storage/database';

// GET /api/course-templates - 获取课程模板列表
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const category = searchParams.get('category');
    const targetAudience = searchParams.get('targetAudience');
    
    let results;
    
    if (category && targetAudience) {
      results = db
        .select()
        .from(courseTemplates)
        .where(sql`${courseTemplates.isActive} = 1 AND ${courseTemplates.category} = ${category} AND ${courseTemplates.targetAudience} LIKE ${'%' + targetAudience + '%'}`)
        .orderBy(desc(courseTemplates.usageCount))
        .all();
    } else if (category) {
      results = db
        .select()
        .from(courseTemplates)
        .where(sql`${courseTemplates.isActive} = 1 AND ${courseTemplates.category} = ${category}`)
        .orderBy(desc(courseTemplates.usageCount))
        .all();
    } else if (targetAudience) {
      results = db
        .select()
        .from(courseTemplates)
        .where(sql`${courseTemplates.isActive} = 1 AND ${courseTemplates.targetAudience} LIKE ${'%' + targetAudience + '%'}`)
        .orderBy(desc(courseTemplates.usageCount))
        .all();
    } else {
      results = db
        .select()
        .from(courseTemplates)
        .where(eq(courseTemplates.isActive, true))
        .orderBy(desc(courseTemplates.usageCount))
        .all();
    }

    return NextResponse.json({ data: results });
  } catch (error) {
    console.error('Get course templates error:', error);
    return NextResponse.json({ error: 'Failed to get course templates' }, { status: 500 });
  }
}

// POST /api/course-templates - 创建新课程模板
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const id = generateId();
    const now = getTimestamp();

    const result = db
      .insert(courseTemplates)
      .values({
        id,
        name: body.name,
        category: body.category,
        description: body.description,
        duration: body.duration,
        targetAudience: body.targetAudience,
        content: body.content,
        difficulty: body.difficulty,
        createdAt: now,
      })
      .returning()
      .get();

    return NextResponse.json({ data: result });
  } catch (error) {
    console.error('Create course template error:', error);
    return NextResponse.json({ error: 'Failed to create course template' }, { status: 500 });
  }
}
