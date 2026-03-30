import { NextRequest, NextResponse } from 'next/server';
import { db, saveDatabaseImmediate, ensureDatabaseReady } from '@/storage/database';
import { sql } from 'drizzle-orm';

/**
 * 数据库迁移：添加参访基地收费方式字段
 * 
 * 迁移内容：
 * 1. 为 visit_sites 表添加 fee_type 字段（默认值：'per_person'）
 * 2. fee_type 说明：
 *    - 'per_person': 按人头收费（每人多少钱）
 *    - 'per_visit': 按次收费（每次多少钱，固定费用）
 */
export async function POST(request: NextRequest) {
  try {
    await ensureDatabaseReady();
    
    // 检查 fee_type 列是否已存在
    const pragmaResult = db.all(sql`PRAGMA table_info(visit_sites)`);
    const hasFeeTypeColumn = pragmaResult.some((col: any) => col.name === 'fee_type');
    
    if (hasFeeTypeColumn) {
      console.log('fee_type 列已存在，跳过迁移');
      return NextResponse.json({ 
        success: true, 
        message: 'fee_type 列已存在，无需迁移' 
      });
    }
    
    console.log('开始迁移：添加 fee_type 列到 visit_sites 表');
    
    // 添加 fee_type 列
    db.run(sql`ALTER TABLE visit_sites ADD COLUMN fee_type TEXT DEFAULT 'per_person'`);
    
    // 更新现有数据，根据 visitFee 的值判断收费方式
    // 如果 visitFee 为 null 或 0，设置为按次收费（因为不按人头）
    db.run(sql`
      UPDATE visit_sites 
      SET fee_type = CASE 
        WHEN visit_fee IS NULL OR visit_fee = 0 THEN 'per_visit'
        ELSE 'per_person'
      END
    `);
    
    // 保存数据库
    saveDatabaseImmediate();
    
    console.log('迁移完成：fee_type 列已添加');
    
    // 统计结果
    const perPersonResult = db.all(sql`SELECT COUNT(*) as count FROM visit_sites WHERE fee_type = 'per_person'`) as any[];
    const perVisitResult = db.all(sql`SELECT COUNT(*) as count FROM visit_sites WHERE fee_type = 'per_visit'`) as any[];
    const perPersonCount = perPersonResult[0]?.count || 0;
    const perVisitCount = perVisitResult[0]?.count || 0;
    
    return NextResponse.json({ 
      success: true, 
      message: '数据库迁移成功',
      stats: {
        perPersonCount: perPersonCount.count,
        perVisitCount: perVisitCount.count
      }
    });
  } catch (error) {
    console.error('数据库迁移失败:', error);
    return NextResponse.json({ 
      success: false, 
      error: '数据库迁移失败',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
