import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { 
  db, teachers, venues, courseTemplates, normativeDocuments, 
  projects, projectCourses, satisfactionSurveys, visitSites,
  eq, desc, sql,
  saveDatabaseImmediate, ensureDatabaseReady
} from '@/storage/database';
import { generateId, getTimestamp } from '@/storage/database';

// 表映射
const tableMap = {
  teachers,
  venues,
  course_templates: courseTemplates,
  normative_documents: normativeDocuments,
  projects,
  project_courses: projectCourses,
  satisfaction_surveys: satisfactionSurveys,
  visit_sites: visitSites,
} as const;

type TableName = keyof typeof tableMap;

// 验证表名
function isValidTable(table: string): table is TableName {
  return table in tableMap;
}

// GET /api/admin/data - 查询数据
export async function GET(request: NextRequest) {
  try {
    await ensureDatabaseReady();
    
    const searchParams = request.nextUrl.searchParams;
    const table = searchParams.get('table') as string;
    const id = searchParams.get('id');

    // 验证表名
    if (!table || !isValidTable(table)) {
      return NextResponse.json({ error: '无效的数据表' }, { status: 400 });
    }

    const tableSchema = tableMap[table];

    // 查询单条记录
    if (id) {
      const result = db
        .select()
        .from(tableSchema)
        .where(sql`id = ${id}`)
        .get();

      return NextResponse.json({ data: result });
    }

    // 查询全部记录
    const results = db
      .select()
      .from(tableSchema)
      .orderBy(desc(sql`created_at`))
      .limit(1000)
      .all();

    return NextResponse.json({ data: results });
  } catch (error) {
    console.error('Get data error:', error);
    return NextResponse.json({ error: '查询失败' }, { status: 500 });
  }
}

// POST /api/admin/data - 新增数据
export async function POST(request: NextRequest) {
  try {
    await ensureDatabaseReady();
    
    const body = await request.json();
    const { table, data } = body;

    // 验证表名
    if (!table || !isValidTable(table)) {
      return NextResponse.json({ error: '无效的数据表' }, { status: 400 });
    }

    if (!data || typeof data !== 'object') {
      return NextResponse.json({ error: '无效的数据' }, { status: 400 });
    }

    // 获取当前用户信息（从 Authorization header 或 Cookie）
    const authHeader = request.headers.get('authorization');
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('session');
    
    let currentUser: { userId: string; departmentId?: string } | null = null;
    
    // 从 Authorization header 解析
    if (authHeader?.startsWith('Bearer ')) {
      try {
        const token = authHeader.substring(7);
        const decoded = Buffer.from(token, 'base64').toString('utf-8');
        currentUser = JSON.parse(decoded);
      } catch (e) {
        console.error('Failed to parse auth token:', e);
      }
    }
    
    // 或从 Cookie 解析
    if (!currentUser && sessionCookie?.value) {
      try {
        currentUser = JSON.parse(sessionCookie.value);
      } catch (e) {
        console.error('Failed to parse session cookie:', e);
      }
    }

    // 调试日志
    console.log('[API /admin/data POST] table:', table);
    console.log('[API /admin/data POST] data:', JSON.stringify(data, null, 2));
    console.log('[API /admin/data POST] currentUser:', currentUser?.userId);

    // 准备插入数据，添加创建人信息
    const now = getTimestamp();
    const insertData = {
      id: generateId(),
      ...data,
      // 添加创建人信息（如果当前用户已登录）
      ...(currentUser && {
        createdBy: currentUser.userId,
        createdByDepartment: currentUser.departmentId,
      }),
      createdAt: now,
    };

    console.log('[API /admin/data POST] insertData:', JSON.stringify(insertData, null, 2));

    // 根据表执行插入
    const tableSchema = tableMap[table];
    const result = db.insert(tableSchema).values(insertData).returning().get();

    console.log('[API /admin/data POST] result:', JSON.stringify(result, null, 2));

    // 保存数据库到文件
    saveDatabaseImmediate();

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error('Create data error:', error);
    return NextResponse.json({ error: '创建失败' }, { status: 500 });
  }
}

// PUT /api/admin/data - 更新数据
export async function PUT(request: NextRequest) {
  try {
    await ensureDatabaseReady();
    
    const body = await request.json();
    const { table, data, id } = body;

    // 验证表名
    if (!table || !isValidTable(table)) {
      return NextResponse.json({ error: '无效的数据表' }, { status: 400 });
    }

    if (!id) {
      return NextResponse.json({ error: '缺少记录ID' }, { status: 400 });
    }

    if (!data || typeof data !== 'object') {
      return NextResponse.json({ error: '无效的数据' }, { status: 400 });
    }

    // 准备更新数据
    const now = getTimestamp();
    const updateData = {
      ...data,
      updatedAt: now,
    };

    // 根据表执行更新
    const tableSchema = tableMap[table];
    const result = db
      .update(tableSchema)
      .set(updateData)
      .where(sql`id = ${id}`)
      .returning()
      .get();

    // 保存数据库到文件
    saveDatabaseImmediate();

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error('Update data error:', error);
    return NextResponse.json({ error: '更新失败' }, { status: 500 });
  }
}

// DELETE /api/admin/data - 删除数据
export async function DELETE(request: NextRequest) {
  try {
    await ensureDatabaseReady();
    
    const searchParams = request.nextUrl.searchParams;
    const table = searchParams.get('table') as string;
    const id = searchParams.get('id');

    // 验证表名
    if (!table || !isValidTable(table)) {
      return NextResponse.json({ error: '无效的数据表' }, { status: 400 });
    }

    if (!id) {
      return NextResponse.json({ error: '缺少记录ID' }, { status: 400 });
    }

    // 根据表执行删除
    const tableSchema = tableMap[table];
    db.delete(tableSchema).where(sql`id = ${id}`).run();

    // 保存数据库到文件
    saveDatabaseImmediate();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete data error:', error);
    return NextResponse.json({ error: '删除失败' }, { status: 500 });
  }
}
