import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

// GET /api/venues - 获取场地列表
// POST /api/venues - 创建新场地
export async function GET(request: NextRequest) {
  try {
    const client = getSupabaseClient();
    const searchParams = request.nextUrl.searchParams;
    const minCapacity = searchParams.get('minCapacity');
    const location = searchParams.get('location');
    
    let query = client
      .from('venues')
      .select('*')
      .eq('is_active', true)
      .order('rating', { ascending: false });

    if (minCapacity) {
      query = query.gte('capacity', parseInt(minCapacity));
    }

    if (location) {
      query = query.ilike('location', `%${location}%`);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error('Get venues error:', error);
    return NextResponse.json({ error: 'Failed to get venues' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const client = getSupabaseClient();
    const body = await request.json();

    const { data, error } = await client
      .from('venues')
      .insert({
        name: body.name,
        location: body.location,
        capacity: body.capacity,
        daily_rate: body.dailyRate,
        facilities: body.facilities,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error('Create venue error:', error);
    return NextResponse.json({ error: 'Failed to create venue' }, { status: 500 });
  }
}
