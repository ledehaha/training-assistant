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

// GET /api/admin/data - 查询数据
export async function GET(request: NextRequest) {
  try {
    const client = getSupabaseClient();
    const searchParams = request.nextUrl.searchParams;
    const table = searchParams.get('table');
    const id = searchParams.get('id');

    // 验证表名
    if (!table || !ALLOWED_TABLES.includes(table)) {
      return NextResponse.json({ error: '无效的数据表' }, { status: 400 });
    }

    // 查询单条记录
    if (id) {
      const { data, error } = await client
        .from(table)
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ data });
    }

    // 查询全部记录
    const { data, error } = await client
      .from(table)
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1000);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error('Get data error:', error);
    return NextResponse.json({ error: '查询失败' }, { status: 500 });
  }
}

// POST /api/admin/data - 新增数据
export async function POST(request: NextRequest) {
  try {
    const client = getSupabaseClient();
    const body = await request.json();
    const { table, data } = body;

    // 验证表名
    if (!table || !ALLOWED_TABLES.includes(table)) {
      return NextResponse.json({ error: '无效的数据表' }, { status: 400 });
    }

    if (!data || typeof data !== 'object') {
      return NextResponse.json({ error: '无效的数据' }, { status: 400 });
    }

    // 移除 id 字段（新增时不需要）
    const insertData = { ...data };
    delete insertData.id;
    delete insertData.created_at;
    delete insertData.updated_at;

    const { data: result, error } = await client
      .from(table)
      .insert(insertData)
      .select()
      .single();

    if (error) {
      console.error('Insert error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error('Create data error:', error);
    return NextResponse.json({ error: '创建失败' }, { status: 500 });
  }
}

// PUT /api/admin/data - 更新数据
export async function PUT(request: NextRequest) {
  try {
    const client = getSupabaseClient();
    const body = await request.json();
    const { table, data, id } = body;

    // 验证表名
    if (!table || !ALLOWED_TABLES.includes(table)) {
      return NextResponse.json({ error: '无效的数据表' }, { status: 400 });
    }

    if (!id) {
      return NextResponse.json({ error: '缺少记录ID' }, { status: 400 });
    }

    if (!data || typeof data !== 'object') {
      return NextResponse.json({ error: '无效的数据' }, { status: 400 });
    }

    // 移除不应更新的字段
    const updateData = { ...data };
    delete updateData.id;
    delete updateData.created_at;

    const { data: result, error } = await client
      .from(table)
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Update error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error('Update data error:', error);
    return NextResponse.json({ error: '更新失败' }, { status: 500 });
  }
}

// DELETE /api/admin/data - 删除数据
export async function DELETE(request: NextRequest) {
  try {
    const client = getSupabaseClient();
    const searchParams = request.nextUrl.searchParams;
    const table = searchParams.get('table');
    const id = searchParams.get('id');

    // 验证表名
    if (!table || !ALLOWED_TABLES.includes(table)) {
      return NextResponse.json({ error: '无效的数据表' }, { status: 400 });
    }

    if (!id) {
      return NextResponse.json({ error: '缺少记录ID' }, { status: 400 });
    }

    const { error } = await client
      .from(table)
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Delete error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete data error:', error);
    return NextResponse.json({ error: '删除失败' }, { status: 500 });
  }
}
