import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

// GET /api/teachers - 获取讲师列表
// POST /api/teachers - 创建新讲师
export async function GET(request: NextRequest) {
  try {
    const client = getSupabaseClient();
    const searchParams = request.nextUrl.searchParams;
    const title = searchParams.get('title');
    const expertise = searchParams.get('expertise');
    
    let query = client
      .from('teachers')
      .select('*')
      .eq('is_active', true)
      .order('rating', { ascending: false });

    if (title) {
      query = query.eq('title', title);
    }

    if (expertise) {
      query = query.ilike('expertise', `%${expertise}%`);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error('Get teachers error:', error);
    return NextResponse.json({ error: 'Failed to get teachers' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const client = getSupabaseClient();
    const body = await request.json();

    const { data, error } = await client
      .from('teachers')
      .insert({
        name: body.name,
        title: body.title,
        expertise: body.expertise,
        organization: body.organization,
        bio: body.bio,
        hourly_rate: body.hourlyRate,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error('Create teacher error:', error);
    return NextResponse.json({ error: 'Failed to create teacher' }, { status: 500 });
  }
}
