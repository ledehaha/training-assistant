import { NextRequest, NextResponse } from 'next/server';
import { db, courses, eq, desc, sql, and, saveDatabaseImmediate, ensureDatabaseReady } from '@/storage/database';
import { generateId, getTimestamp } from '@/storage/database';

// GET /api/course-templates - 获取课程模板列表
// 现在从 courses 表中查询 isTemplate = true 的记录
export async function GET(request: NextRequest) {
  try {
    await ensureDatabaseReady();
    
    const searchParams = request.nextUrl.searchParams;
    const category = searchParams.get('category');
    const targetAudience = searchParams.get('targetAudience');
    
    let results;
    
    // 构建基础条件：isTemplate = true 且 isActive = true
    const baseConditions = [eq(courses.isTemplate, true), eq(courses.isActive, true)];
    
    if (category && targetAudience) {
      results = db
        .select()
        .from(courses)
        .where(and(...baseConditions, eq(courses.category, category), sql`${courses.targetAudience} LIKE ${'%' + targetAudience + '%'}`))
        .orderBy(desc(courses.usageCount))
        .all();
    } else if (category) {
      results = db
        .select()
        .from(courses)
        .where(and(...baseConditions, eq(courses.category, category)))
        .orderBy(desc(courses.usageCount))
        .all();
    } else if (targetAudience) {
      results = db
        .select()
        .from(courses)
        .where(and(...baseConditions, sql`${courses.targetAudience} LIKE ${'%' + targetAudience + '%'}`))
        .orderBy(desc(courses.usageCount))
        .all();
    } else {
      results = db
        .select()
        .from(courses)
        .where(and(...baseConditions))
        .orderBy(desc(courses.usageCount))
        .all();
    }

    return NextResponse.json({ data: results });
  } catch (error) {
    console.error('Get course templates error:', error);
    return NextResponse.json({ error: 'Failed to get course templates' }, { status: 500 });
  }
}

// POST /api/course-templates - 创建新课程模板
// 现在写入 courses 表，设置 isTemplate = true
export async function POST(request: NextRequest) {
  try {
    await ensureDatabaseReady();
    
    const body = await request.json();
    const id = generateId();
    const now = getTimestamp();

    const result = db
      .insert(courses)
      .values({
        id,
        isTemplate: true, // 标记为模板
        projectId: null, // 模板不关联项目
        name: body.name,
        category: body.category,
        description: body.description,
        duration: body.duration,
        targetAudience: body.targetAudience,
        content: body.content,
        difficulty: body.difficulty,
        type: 'course', // 默认类型
        isActive: true,
        createdAt: now,
        createdBy: body.createdBy,
        createdByDepartment: body.createdByDepartment,
      })
      .returning()
      .get();

    // 保存数据库到文件
    saveDatabaseImmediate();

    return NextResponse.json({ data: result });
  } catch (error) {
    console.error('Create course template error:', error);
    return NextResponse.json({ error: 'Failed to create course template' }, { status: 500 });
  }
}

// PUT /api/course-templates - 更新课程模板
export async function PUT(request: NextRequest) {
  try {
    await ensureDatabaseReady();
    
    const body = await request.json();
    const { id, ...updateData } = body;

    if (!id) {
      return NextResponse.json({ error: '缺少课程模板ID' }, { status: 400 });
    }

    // 检查课程模板是否存在（从 courses 表查询 isTemplate = true 的记录）
    const existing = db
      .select()
      .from(courses)
      .where(and(eq(courses.id, id), eq(courses.isTemplate, true)))
      .limit(1)
      .all();

    if (existing.length === 0) {
      return NextResponse.json({ error: '课程模板不存在' }, { status: 404 });
    }

    // 更新课程模板
    const result = db
      .update(courses)
      .set({
        ...updateData,
        updatedAt: getTimestamp(),
      })
      .where(eq(courses.id, id))
      .returning()
      .get();

    // 保存数据库到文件
    saveDatabaseImmediate();

    return NextResponse.json({ data: result });
  } catch (error) {
    console.error('Update course template error:', error);
    return NextResponse.json({ error: 'Failed to update course template' }, { status: 500 });
  }
}
