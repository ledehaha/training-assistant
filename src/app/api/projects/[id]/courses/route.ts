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

    const coursesToInsert = coursesList.map((course: Record<string, unknown>, index: number) => ({
      id: generateId(),
      isTemplate: false, // 项目课程
      projectId: id,
      courseTemplateId: (course.courseTemplateId as string) || null,
      teacherId: (course.teacherId as string) || null,
      visitSiteId: (course.visitSiteId as string) || null,
      type: (course.type as string) || 'course',
      name: course.name as string,
      day: (course.day as number) || 1,
      startTime: (course.startTime as string) || '09:00',
      endTime: (course.endTime as string) || '12:00',
      duration: (course.duration as number) || 4,
      description: (course.description as string) || '',
      order: index,
      isActive: true,
      createdAt: now,
    }));

    const results = coursesToInsert.map(course => 
      db.insert(courses).values(course).returning().get()
    );

    // 保存数据库到文件
    saveDatabaseImmediate();

    return NextResponse.json({ data: results });
  } catch (error) {
    console.error('Add project courses error:', error);
    return NextResponse.json({ error: 'Failed to add project courses' }, { status: 500 });
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
    const { courseId, ...updateData } = body;

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
