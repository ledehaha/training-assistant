import { NextRequest, NextResponse } from 'next/server';
import { db, courses, eq, asc, and, saveDatabaseImmediate, ensureDatabaseReady } from '@/storage/database';
import { generateId, getTimestamp } from '@/storage/database';

// POST /api/projects/[id]/courses - 添加课程到项目
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await ensureDatabaseReady();
    
    const { id } = await params;
    const body = await request.json();
    const coursesList = Array.isArray(body) ? body : [body];
    const now = getTimestamp();

    console.log('添加项目课程, projectId:', id, '课程数量:', coursesList.length);
    console.log('课程数据示例:', JSON.stringify(coursesList[0], null, 2));

    const coursesToInsert = coursesList.map((course: Record<string, unknown>, index: number) => {
      const courseData = {
        id: generateId(),
        isTemplate: false, // 项目课程
        projectId: id,
        teacherId: (course.teacherId as string) || null,
        visitSiteId: (course.visitSiteId as string) || null,
        type: (course.type as string) || 'course',
        name: course.name as string,
        category: (course.category as string) || null,
        content: (course.content as string) || (course.description as string) || null,
        day: typeof course.day === 'number' ? course.day : parseInt(String(course.day)) || 1,
        startTime: (course.startTime as string) || '09:00',
        endTime: (course.endTime as string) || '12:00',
        duration: typeof course.duration === 'number' ? course.duration : parseFloat(String(course.duration)) || null,
        description: (course.description as string) || null,
        order: typeof course.order === 'number' ? course.order : index,
        isActive: true,
        createdAt: now,
      };
      console.log('准备插入课程:', courseData.name, 'day:', courseData.day, 'time:', courseData.startTime, '-', courseData.endTime);
      return courseData;
    });

    const results = [];
    for (const course of coursesToInsert) {
      try {
        const result = db.insert(courses).values(course).returning().get();
        results.push(result);
        console.log('课程插入成功:', result.id, result.name);
      } catch (insertError) {
        console.error('课程插入失败:', course.name, insertError);
      }
    }

    // 保存数据库到文件
    saveDatabaseImmediate();

    console.log('项目课程添加完成, 成功:', results.length);

    return NextResponse.json({ data: results, count: results.length });
  } catch (error) {
    console.error('Add project courses error:', error);
    return NextResponse.json({ error: 'Failed to add project courses', details: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}

// GET /api/projects/[id]/courses - 获取项目课程
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await ensureDatabaseReady();
    
    const { id } = await params;

    const results = db
      .select()
      .from(courses)
      .where(and(eq(courses.projectId, id), eq(courses.isTemplate, false)))
      .orderBy(asc(courses.order))
      .all();

    return NextResponse.json({ data: results });
  } catch (error) {
    console.error('Get project courses error:', error);
    return NextResponse.json({ error: 'Failed to get project courses' }, { status: 500 });
  }
}

// DELETE /api/projects/[id]/courses - 删除项目所有课程
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await ensureDatabaseReady();
    
    const { id } = await params;

    db.delete(courses).where(and(eq(courses.projectId, id), eq(courses.isTemplate, false))).run();

    // 保存数据库到文件
    saveDatabaseImmediate();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete project courses error:', error);
    return NextResponse.json({ error: 'Failed to delete project courses' }, { status: 500 });
  }
}

// PUT /api/projects/[id]/courses - 更新单个课程
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await ensureDatabaseReady();
    
    const { id } = await params;
    const body = await request.json();
    // 支持两种参数名：courseId 或 id
    const courseId = body.courseId || body.id;
    const { ...updateData } = body;
    delete updateData.courseId;
    delete updateData.id;

    if (!courseId) {
      return NextResponse.json({ error: '缺少课程ID' }, { status: 400 });
    }

    // 检查课程是否存在且属于该项目
    const existing = db
      .select()
      .from(courses)
      .where(and(eq(courses.id, courseId), eq(courses.projectId, id), eq(courses.isTemplate, false)))
      .limit(1)
      .all();

    if (existing.length === 0) {
      return NextResponse.json({ error: '课程不存在或不属于该项目' }, { status: 404 });
    }

    // 更新课程
    const result = db
      .update(courses)
      .set({
        ...updateData,
        updatedAt: getTimestamp(),
      })
      .where(eq(courses.id, courseId))
      .returning()
      .get();

    // 保存数据库到文件
    saveDatabaseImmediate();

    return NextResponse.json({ data: result });
  } catch (error) {
    console.error('Update project course error:', error);
    return NextResponse.json({ error: 'Failed to update project course' }, { status: 500 });
  }
}
