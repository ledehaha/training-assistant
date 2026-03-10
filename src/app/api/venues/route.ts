import { NextRequest, NextResponse } from 'next/server';
import { db, venues, eq, desc, sql } from '@/storage/database';
import { generateId, getTimestamp } from '@/storage/database';

// GET /api/venues - 获取场地列表
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const minCapacity = searchParams.get('minCapacity');
    const location = searchParams.get('location');
    
    let results;
    
    if (minCapacity && location) {
      results = db
        .select()
        .from(venues)
        .where(sql`${venues.isActive} = 1 AND ${venues.capacity} >= ${parseInt(minCapacity)} AND ${venues.location} LIKE ${'%' + location + '%'}`)
        .orderBy(desc(venues.rating))
        .all();
    } else if (minCapacity) {
      results = db
        .select()
        .from(venues)
        .where(sql`${venues.isActive} = 1 AND ${venues.capacity} >= ${parseInt(minCapacity)}`)
        .orderBy(desc(venues.rating))
        .all();
    } else if (location) {
      results = db
        .select()
        .from(venues)
        .where(sql`${venues.isActive} = 1 AND ${venues.location} LIKE ${'%' + location + '%'}`)
        .orderBy(desc(venues.rating))
        .all();
    } else {
      results = db
        .select()
        .from(venues)
        .where(eq(venues.isActive, true))
        .orderBy(desc(venues.rating))
        .all();
    }

    return NextResponse.json({ data: results });
  } catch (error) {
    console.error('Get venues error:', error);
    return NextResponse.json({ error: 'Failed to get venues' }, { status: 500 });
  }
}

// POST /api/venues - 创建新场地
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const id = generateId();
    const now = getTimestamp();

    const result = db
      .insert(venues)
      .values({
        id,
        name: body.name,
        location: body.location,
        capacity: body.capacity,
        dailyRate: body.dailyRate,
        facilities: body.facilities,
        createdAt: now,
      })
      .returning()
      .get();

    return NextResponse.json({ data: result });
  } catch (error) {
    console.error('Create venue error:', error);
    return NextResponse.json({ error: 'Failed to create venue' }, { status: 500 });
  }
}
