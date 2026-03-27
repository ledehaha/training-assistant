import { NextResponse } from 'next/server';
import { db, ensureDatabaseReady, getSqlite } from '@/storage/database';

// GET /api/fix-courses-schema - 检查 courses 表结构
export async function GET() {
  try {
    await ensureDatabaseReady();
    
    const sqlite = getSqlite();
    if (!sqlite) {
      return NextResponse.json({ error: 'Database not available' }, { status: 500 });
    }

    // 查询 courses 表结构
    const result = sqlite.exec("PRAGMA table_info(courses)");
    const columns = result.length > 0 ? result[0].values.map((row: any) => ({
      cid: row[0],
      name: row[1],
      type: row[2],
      notnull: row[3],
      dflt_value: row[4],
      pk: row[5]
    })) : [];
    
    return NextResponse.json({ 
      success: true, 
      columns
    });
  } catch (error) {
    console.error('Check courses schema error:', error);
    return NextResponse.json({ error: 'Failed to check courses schema' }, { status: 500 });
  }
}
