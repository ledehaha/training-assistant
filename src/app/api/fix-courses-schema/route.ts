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
    const columns = sqlite.prepare("PRAGMA table_info(courses)").all();
    
    return NextResponse.json({ 
      success: true, 
      columns: columns.map((col: any) => ({
        cid: col.cid,
        name: col.name,
        type: col.type,
        notnull: col.notnull,
        dflt_value: col.dflt_value,
        pk: col.pk
      }))
    });
  } catch (error) {
    console.error('Check courses schema error:', error);
    return NextResponse.json({ error: 'Failed to check courses schema' }, { status: 500 });
  }
}
