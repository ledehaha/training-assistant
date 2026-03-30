import { NextRequest, NextResponse } from 'next/server';
import { db, getSqlite, saveDatabaseImmediate, ensureDatabaseReady } from '@/storage/database';

// POST /api/migrate - 执行数据库迁移
export async function POST(request: NextRequest) {
  try {
    await ensureDatabaseReady();
    
    const sqlite = getSqlite();
    if (!sqlite) {
      return NextResponse.json({ error: 'Database not available' }, { status: 500 });
    }
    
    const results: { table: string; column: string; success: boolean; message?: string }[] = [];
    
    // 添加 budget_data 列到 projects 表
    try {
      const columns = sqlite.exec(`PRAGMA table_info(projects)`);
      const existingColumns = columns[0]?.values.map((row) => row[1] as string) || [];
      
      if (!existingColumns.includes('budget_data')) {
        sqlite.run(`ALTER TABLE projects ADD COLUMN budget_data TEXT`);
        results.push({ table: 'projects', column: 'budget_data', success: true });
        console.log('Migration: Added budget_data column to projects table');
      } else {
        results.push({ table: 'projects', column: 'budget_data', success: true, message: 'Already exists' });
      }
    } catch (err) {
      console.error('Failed to add budget_data column:', err);
      results.push({ table: 'projects', column: 'budget_data', success: false, message: String(err) });
    }
    
    saveDatabaseImmediate();
    
    return NextResponse.json({ 
      success: true, 
      message: 'Migration completed',
      results 
    });
  } catch (error) {
    console.error('Migration error:', error);
    return NextResponse.json({ error: 'Migration failed' }, { status: 500 });
  }
}

// GET /api/migrate - 检查数据库状态
export async function GET() {
  try {
    await ensureDatabaseReady();
    
    const sqlite = getSqlite();
    if (!sqlite) {
      return NextResponse.json({ error: 'Database not available' }, { status: 500 });
    }
    
    const columns = sqlite.exec(`PRAGMA table_info(projects)`);
    const existingColumns = columns[0]?.values.map((row) => row[1] as string) || [];
    
    const hasBudgetData = existingColumns.includes('budget_data');
    
    return NextResponse.json({ 
      hasBudgetData,
      columns: existingColumns
    });
  } catch (error) {
    console.error('Check database error:', error);
    return NextResponse.json({ error: 'Check failed' }, { status: 500 });
  }
}
