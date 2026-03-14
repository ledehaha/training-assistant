import { NextResponse } from 'next/server';
import { db, departments, ensureDatabaseReady } from '@/storage/database';
import { asc } from 'drizzle-orm';

// GET /api/departments - 获取部门列表
export async function GET() {
  try {
    await ensureDatabaseReady();
    
    const deptList = await db.select()
      .from(departments)
      .orderBy(asc(departments.sortOrder))
      .all();
    
    return NextResponse.json({ data: deptList });
  } catch (error) {
    console.error('Get departments error:', error);
    return NextResponse.json({ error: '获取部门列表失败' }, { status: 500 });
  }
}
