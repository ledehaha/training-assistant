import { NextResponse } from 'next/server';
import { db, ensureDatabaseReady, saveDatabaseImmediate, getSqlite } from '@/storage/database';

// GET /api/check-courses-schema - 检查 courses 表结构
export async function GET() {
  try {
    await ensureDatabaseReady();
    
    const sqlite = getSqlite();
    if (!sqlite) {
      return NextResponse.json({ error: 'Database not available' }, { status: 500 });
    }

    // 执行 PRAGMA table_info
    const result = sqlite.exec("PRAGMA table_info(courses)");
    console.log('PRAGMA result:', JSON.stringify(result));
    
    return NextResponse.json({ 
      success: true, 
      result
    });
  } catch (error) {
    console.error('Check courses schema error:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

// POST /api/fix-courses-schema - 修复 courses 表结构
export async function POST() {
  try {
    await ensureDatabaseReady();
    
    const sqlite = getSqlite();
    if (!sqlite) {
      return NextResponse.json({ error: 'Database not available' }, { status: 500 });
    }

    const results: string[] = [];

    // 添加 teacherTitle 字段
    try {
      sqlite.run(`ALTER TABLE courses ADD COLUMN teacherTitle TEXT`);
      results.push('✓ teacherTitle column added');
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      if (errorMsg.includes('duplicate column')) {
        results.push('- teacherTitle column already exists');
      } else {
        results.push(`✗ teacherTitle error: ${errorMsg}`);
      }
    }

    // 添加 location 字段
    try {
      sqlite.run(`ALTER TABLE courses ADD COLUMN location TEXT`);
      results.push('✓ location column added');
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      if (errorMsg.includes('duplicate column')) {
        results.push('- location column already exists');
      } else {
        results.push(`✗ location error: ${errorMsg}`);
      }
    }

    // 添加 updatedAt 字段
    try {
      sqlite.run(`ALTER TABLE courses ADD COLUMN updatedAt TEXT`);
      results.push('✓ updatedAt column added');
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      if (errorMsg.includes('duplicate column')) {
        results.push('- updatedAt column already exists');
      } else {
        results.push(`✗ updatedAt error: ${errorMsg}`);
      }
    }

    saveDatabaseImmediate();

    return NextResponse.json({ 
      success: true, 
      results,
      message: 'Courses schema fix completed'
    });
  } catch (error) {
    console.error('Fix courses schema error:', error);
    return NextResponse.json({ error: 'Failed to fix courses schema' }, { status: 500 });
  }
}
