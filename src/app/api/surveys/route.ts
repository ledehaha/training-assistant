import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

// GET /api/surveys - 获取满意度调查列表
// POST /api/surveys - 创建满意度调查
export async function GET(request: NextRequest) {
  try {
    const client = getSupabaseClient();
    const searchParams = request.nextUrl.searchParams;
    const projectId = searchParams.get('projectId');
    
    let query = client
      .from('satisfaction_surveys')
      .select('*')
      .order('created_at', { ascending: false });

    if (projectId) {
      query = query.eq('project_id', projectId);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error('Get surveys error:', error);
    return NextResponse.json({ error: 'Failed to get surveys' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const client = getSupabaseClient();
    const body = await request.json();

    const { data, error } = await client
      .from('satisfaction_surveys')
      .insert({
        project_id: body.projectId,
        title: body.title,
        description: body.description,
        questions: body.questions,
        status: 'active',
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error('Create survey error:', error);
    return NextResponse.json({ error: 'Failed to create survey' }, { status: 500 });
  }
}
