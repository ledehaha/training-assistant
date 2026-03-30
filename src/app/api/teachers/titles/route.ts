import { NextRequest, NextResponse } from 'next/server';
import { db, teachers, eq, ensureDatabaseReady } from '@/storage/database';

/**
 * 获取讲师职称信息（无需权限）
 * 只返回讲师的 id、name、title 等基本信息，用于师资费计算
 */
export async function GET(request: NextRequest) {
  try {
    await ensureDatabaseReady();
    
    const results = db
      .select({
        id: teachers.id,
        name: teachers.name,
        title: teachers.title,
      })
      .from(teachers)
      .where(eq(teachers.isActive, true))
      .all();

    return NextResponse.json({ data: results });
  } catch (error) {
    console.error('Get teacher titles error:', error);
    return NextResponse.json({ error: 'Failed to get teacher titles' }, { status: 500 });
  }
}
