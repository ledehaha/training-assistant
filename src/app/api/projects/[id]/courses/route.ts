import { NextRequest, NextResponse } from 'next/server';
import { db, projectCourses, eq, asc } from '@/storage/database';
import { generateId, getTimestamp } from '@/storage/database';

// POST /api/projects/[id]/courses - 添加课程到项目
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const courses = Array.isArray(body) ? body : [body];
    const now = getTimestamp();

    const coursesToInsert = courses.map((course: Record<string, unknown>, index: number) => ({
      id: generateId(),
      projectId: id,
      courseTemplateId: (course.courseTemplateId as string) || null,
      teacherId: (course.teacherId as string) || null,
      name: course.name as string,
      day: (course.day as number) || 1,
      startTime: (course.startTime as string) || '09:00',
      endTime: (course.endTime as string) || '12:00',
      duration: (course.duration as number) || 4,
      description: (course.description as string) || '',
      order: index,
      createdAt: now,
    }));

    const results = coursesToInsert.map(course => 
      db.insert(projectCourses).values(course).returning().get()
    );

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
    const { id } = await params;

    const results = db
      .select()
      .from(projectCourses)
      .where(eq(projectCourses.projectId, id))
      .orderBy(asc(projectCourses.order))
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
    const { id } = await params;

    db.delete(projectCourses).where(eq(projectCourses.projectId, id)).run();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete project courses error:', error);
    return NextResponse.json({ error: 'Failed to delete project courses' }, { status: 500 });
  }
}
