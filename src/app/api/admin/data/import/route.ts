import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

// 允许操作的表（白名单）
const ALLOWED_TABLES = [
  'teachers',
  'venues',
  'course_templates',
  'normative_documents',
  'projects',
  'project_courses',
  'satisfaction_surveys',
];

// POST /api/admin/data/import - 批量导入数据
export async function POST(request: NextRequest) {
  try {
    const client = getSupabaseClient();
    const body = await request.json();
    const { table, records } = body;

    // 验证表名
    if (!table || !ALLOWED_TABLES.includes(table)) {
      return NextResponse.json({ error: '无效的数据表' }, { status: 400 });
    }

    if (!records || !Array.isArray(records) || records.length === 0) {
      return NextResponse.json({ error: '无效的导入数据' }, { status: 400 });
    }

    // 清理数据：移除不应导入的字段
    const cleanedRecords = records.map(record => {
      const cleaned = { ...record };
      delete cleaned.id;
      delete cleaned.created_at;
      delete cleaned.updated_at;
      return cleaned;
    });

    // 批量插入
    const { data, error } = await client
      .from(table)
      .insert(cleanedRecords)
      .select();

    if (error) {
      console.error('Import error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      count: data?.length || 0,
      message: `成功导入 ${data?.length || 0} 条数据`
    });
  } catch (error) {
    console.error('Import data error:', error);
    return NextResponse.json({ error: '导入失败' }, { status: 500 });
  }
}
