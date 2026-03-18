import { NextRequest, NextResponse } from 'next/server';
import { db, venues, eq, desc, sql, saveDatabaseImmediate, ensureDatabaseReady } from '@/storage/database';
import { generateId, getTimestamp } from '@/storage/database';

// GET /api/venues - 获取场地列表
export async function GET(request: NextRequest) {
  try {
    await ensureDatabaseReady();
    
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
    await ensureDatabaseReady();
    
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

    // 保存数据库到文件
    saveDatabaseImmediate();

    return NextResponse.json({ data: result });
  } catch (error) {
    console.error('Create venue error:', error);
    return NextResponse.json({ error: 'Failed to create venue' }, { status: 500 });
  }
}

// PUT /api/venues - 更新场地
export async function PUT(request: NextRequest) {
  try {
    await ensureDatabaseReady();
    
    const body = await request.json();
    const { id, ...updateData } = body;

    if (!id) {
      return NextResponse.json({ error: '缺少场地ID' }, { status: 400 });
    }

    // 检查场地是否存在
    const existing = db
      .select()
      .from(venues)
      .where(eq(venues.id, id))
      .limit(1)
      .all();

    if (existing.length === 0) {
      return NextResponse.json({ error: '场地不存在' }, { status: 404 });
    }

    // 更新场地
    const result = db
      .update(venues)
      .set({
        ...updateData,
        updatedAt: getTimestamp(),
      })
      .where(eq(venues.id, id))
      .returning()
      .get();

    // 保存数据库到文件
    saveDatabaseImmediate();

    return NextResponse.json({ data: result });
  } catch (error) {
    console.error('Update venue error:', error);
    return NextResponse.json({ error: 'Failed to update venue' }, { status: 500 });
  }
}
