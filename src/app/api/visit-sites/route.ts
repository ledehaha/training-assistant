import { NextRequest, NextResponse } from 'next/server';
import { db, visitSites, eq, desc, sql, saveDatabaseImmediate, ensureDatabaseReady } from '@/storage/database';
import { generateId, getTimestamp } from '@/storage/database';

// GET /api/visit-sites - 获取参访基地列表
export async function GET(request: NextRequest) {
  try {
    await ensureDatabaseReady();
    
    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get('type');
    const industry = searchParams.get('industry');
    
    let results;
    
    if (type && industry) {
      results = db
        .select()
        .from(visitSites)
        .where(sql`${visitSites.isActive} = 1 AND ${visitSites.type} = ${type} AND ${visitSites.industry} LIKE ${'%' + industry + '%'}`)
        .orderBy(desc(visitSites.rating))
        .all();
    } else if (type) {
      results = db
        .select()
        .from(visitSites)
        .where(sql`${visitSites.isActive} = 1 AND ${visitSites.type} = ${type}`)
        .orderBy(desc(visitSites.rating))
        .all();
    } else if (industry) {
      results = db
        .select()
        .from(visitSites)
        .where(sql`${visitSites.isActive} = 1 AND ${visitSites.industry} LIKE ${'%' + industry + '%'}`)
        .orderBy(desc(visitSites.rating))
        .all();
    } else {
      results = db
        .select()
        .from(visitSites)
        .where(eq(visitSites.isActive, true))
        .orderBy(desc(visitSites.rating))
        .all();
    }

    return NextResponse.json({ data: results });
  } catch (error) {
    console.error('Get visit sites error:', error);
    return NextResponse.json({ error: 'Failed to get visit sites' }, { status: 500 });
  }
}

// POST /api/visit-sites - 创建参访基地
export async function POST(request: NextRequest) {
  try {
    await ensureDatabaseReady();
    
    const body = await request.json();
    const id = generateId();
    const now = getTimestamp();

    const result = db
      .insert(visitSites)
      .values({
        id,
        name: body.name,
        type: body.type,
        industry: body.industry,
        address: body.address,
        contactPerson: body.contactPerson,
        contactPhone: body.contactPhone,
        contactEmail: body.contactEmail,
        description: body.description,
        visitContent: body.visitContent,
        visitDuration: body.visitDuration,
        maxVisitors: body.maxVisitors,
        visitFee: body.visitFee,
        facilities: body.facilities,
        requirements: body.requirements,
        createdAt: now,
      })
      .returning()
      .get();

    // 保存数据库到文件
    saveDatabaseImmediate();

    return NextResponse.json({ data: result });
  } catch (error) {
    console.error('Create visit site error:', error);
    return NextResponse.json({ error: 'Failed to create visit site' }, { status: 500 });
  }
}

// PUT /api/visit-sites - 更新参访基地
export async function PUT(request: NextRequest) {
  try {
    await ensureDatabaseReady();
    
    const body = await request.json();
    const { id, ...updateData } = body;

    if (!id) {
      return NextResponse.json({ error: '缺少参访基地ID' }, { status: 400 });
    }

    // 检查参访基地是否存在
    const existing = db
      .select()
      .from(visitSites)
      .where(eq(visitSites.id, id))
      .limit(1)
      .all();

    if (existing.length === 0) {
      return NextResponse.json({ error: '参访基地不存在' }, { status: 404 });
    }

    // 更新参访基地
    const result = db
      .update(visitSites)
      .set({
        ...updateData,
        updatedAt: getTimestamp(),
      })
      .where(eq(visitSites.id, id))
      .returning()
      .get();

    // 保存数据库到文件
    saveDatabaseImmediate();

    return NextResponse.json({ data: result });
  } catch (error) {
    console.error('Update visit site error:', error);
    return NextResponse.json({ error: 'Failed to update visit site' }, { status: 500 });
  }
}
