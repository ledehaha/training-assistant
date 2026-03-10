import { NextRequest, NextResponse } from 'next/server';
import { 
  db, teachers, venues, courseTemplates, normativeDocuments, 
  projects, projectCourses, satisfactionSurveys,
  saveDatabaseImmediate, ensureDatabaseReady
} from '@/storage/database';
import { generateId, getTimestamp } from '@/storage/database';

// 允许操作的表（白名单）
const ALLOWED_TABLES = [
  'teachers',
  'venues',
  'course_templates',
  'normative_documents',
  'projects',
  'project_courses',
  'satisfaction_surveys',
] as const;

// 表映射
const tableMap = {
  teachers,
  venues,
  course_templates: courseTemplates,
  normative_documents: normativeDocuments,
  projects,
  project_courses: projectCourses,
  satisfaction_surveys: satisfactionSurveys,
};

// POST /api/admin/data/import - 批量导入数据
export async function POST(request: NextRequest) {
  try {
    await ensureDatabaseReady();
    
    const body = await request.json();
    const { table, records } = body;

    // 验证表名
    if (!table || !ALLOWED_TABLES.includes(table as typeof ALLOWED_TABLES[number])) {
      return NextResponse.json({ error: '无效的数据表' }, { status: 400 });
    }

    if (!records || !Array.isArray(records) || records.length === 0) {
      return NextResponse.json({ error: '无效的导入数据' }, { status: 400 });
    }

    const tableSchema = tableMap[table as keyof typeof tableMap];
    const now = getTimestamp();
    let successCount = 0;

    // 批量插入
    for (const record of records) {
      try {
        const cleaned = { ...record };
        delete cleaned.id;
        delete cleaned.created_at;
        delete cleaned.updated_at;
        delete cleaned.createdAt;
        delete cleaned.updatedAt;

        db.insert(tableSchema)
          .values({
            id: generateId(),
            ...cleaned,
            createdAt: now,
          })
          .run();
        successCount++;
      } catch (e) {
        console.error('Insert record error:', e);
      }
    }

    // 保存数据库到文件
    saveDatabaseImmediate();

    return NextResponse.json({ 
      success: true, 
      count: successCount,
      message: `成功导入 ${successCount} 条数据`
    });
  } catch (error) {
    console.error('Import data error:', error);
    return NextResponse.json({ error: '导入失败' }, { status: 500 });
  }
}
