import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

// POST /api/projects/[id]/courses - 添加课程到项目
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const client = getSupabaseClient();
    const { id } = await params;
    const body = await request.json();
    const courses = Array.isArray(body) ? body : [body];

    const coursesToInsert = courses.map((course: Record<string, unknown>, index: number) => ({
      project_id: id,
      course_template_id: course.courseTemplateId || null,
      teacher_id: course.teacherId || null,
      name: course.name,
      day: course.day || 1,
      start_time: course.startTime || '09:00',
      end_time: course.endTime || '12:00',
      duration: course.duration || 4,
      description: course.description || '',
      order: index,
    }));

    const { data, error } = await client
      .from('project_courses')
      .insert(coursesToInsert)
      .select();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data });
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
    const client = getSupabaseClient();
    const { id } = await params;

    const { data, error } = await client
      .from('project_courses')
      .select('*')
      .eq('project_id', id)
      .order('order', { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data });
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
    const client = getSupabaseClient();
    const { id } = await params;

    const { error } = await client
      .from('project_courses')
      .delete()
      .eq('project_id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete project courses error:', error);
    return NextResponse.json({ error: 'Failed to delete project courses' }, { status: 500 });
  }
}
