import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

// GET /api/projects/[id] - 获取项目详情
// PUT /api/projects/[id] - 更新项目
// DELETE /api/projects/[id] - 删除项目
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const client = getSupabaseClient();
    const { id } = await params;

    // 获取项目信息
    const { data: project, error: projectError } = await client
      .from('projects')
      .select('*')
      .eq('id', id)
      .single();

    if (projectError) {
      return NextResponse.json({ error: projectError.message }, { status: 500 });
    }

    // 获取项目课程
    const { data: courses, error: coursesError } = await client
      .from('project_courses')
      .select('*')
      .eq('project_id', id)
      .order('order', { ascending: true });

    if (coursesError) {
      return NextResponse.json({ error: coursesError.message }, { status: 500 });
    }

    // 获取项目文档
    const { data: documents, error: documentsError } = await client
      .from('project_documents')
      .select('*')
      .eq('project_id', id)
      .order('created_at', { ascending: false });

    if (documentsError) {
      return NextResponse.json({ error: documentsError.message }, { status: 500 });
    }

    return NextResponse.json({
      data: {
        ...project,
        courses: courses || [],
        documents: documents || [],
      },
    });
  } catch (error) {
    console.error('Get project error:', error);
    return NextResponse.json({ error: 'Failed to get project' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const client = getSupabaseClient();
    const { id } = await params;
    const body = await request.json();

    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    // 只更新提供的字段
    const fields = [
      'name', 'status', 'training_target', 'target_audience', 'participant_count',
      'training_days', 'training_hours', 'training_period', 'budget_min', 'budget_max',
      'location', 'special_requirements', 'start_date', 'end_date', 'venue_id',
      'teacher_fee', 'venue_fee', 'catering_fee', 'tea_break_fee', 'material_fee',
      'labor_fee', 'other_fee', 'management_fee', 'total_budget', 'actual_cost',
      'avg_satisfaction', 'survey_response_rate', 'completed_at', 'archived_at'
    ];

    fields.forEach(field => {
      const camelCase = field.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
      if (body[camelCase] !== undefined) {
        updateData[field] = body[camelCase];
      }
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    });

    const { data, error } = await client
      .from('projects')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error('Update project error:', error);
    return NextResponse.json({ error: 'Failed to update project' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const client = getSupabaseClient();
    const { id } = await params;

    // 删除关联的课程
    await client.from('project_courses').delete().eq('project_id', id);
    
    // 删除关联的文档
    await client.from('project_documents').delete().eq('project_id', id);

    // 删除项目
    const { error } = await client.from('projects').delete().eq('id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete project error:', error);
    return NextResponse.json({ error: 'Failed to delete project' }, { status: 500 });
  }
}
