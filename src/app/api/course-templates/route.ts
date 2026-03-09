import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

// GET /api/course-templates - 获取课程模板列表
// POST /api/course-templates - 创建新课程模板
export async function GET(request: NextRequest) {
  try {
    const client = getSupabaseClient();
    const searchParams = request.nextUrl.searchParams;
    const category = searchParams.get('category');
    const targetAudience = searchParams.get('targetAudience');
    
    let query = client
      .from('course_templates')
      .select('*')
      .eq('is_active', true)
      .order('usage_count', { ascending: false });

    if (category) {
      query = query.eq('category', category);
    }

    if (targetAudience) {
      query = query.ilike('target_audience', `%${targetAudience}%`);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error('Get course templates error:', error);
    return NextResponse.json({ error: 'Failed to get course templates' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const client = getSupabaseClient();
    const body = await request.json();

    const { data, error } = await client
      .from('course_templates')
      .insert({
        name: body.name,
        category: body.category,
        description: body.description,
        duration: body.duration,
        target_audience: body.targetAudience,
        content: body.content,
        difficulty: body.difficulty,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error('Create course template error:', error);
    return NextResponse.json({ error: 'Failed to create course template' }, { status: 500 });
  }
}
