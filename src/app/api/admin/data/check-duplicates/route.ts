import { NextRequest, NextResponse } from 'next/server';
import { 
  db, teachers, venues, courseTemplates, normativeDocuments, 
  projects, projectCourses, satisfactionSurveys, sql,
  ensureDatabaseReady
} from '@/storage/database';
import type { SQL } from 'drizzle-orm';

// 定义重复检测字段
const DUPLICATE_CHECK_FIELDS: Record<string, string[]> = {
  teachers: ['name'],
  venues: ['name', 'location'],
  course_templates: ['name'],
  normative_documents: ['name', 'issuer'],
  projects: ['name'],
  project_courses: ['project_id', 'course_name'],
  satisfaction_surveys: ['project_id'],
};

// 表映射
const tableMap = {
  teachers,
  venues,
  course_templates: courseTemplates,
  normative_documents: normativeDocuments,
  projects,
  project_courses: projectCourses,
  satisfaction_surveys: satisfactionSurveys,
} as const;

type TableName = keyof typeof tableMap;

// 验证表名
function isValidTable(table: string): table is TableName {
  return table in tableMap;
}

// POST /api/admin/data/check-duplicates - 检测重复数据
export async function POST(request: NextRequest) {
  try {
    await ensureDatabaseReady();
    
    const body = await request.json();
    const { table, records } = body;

    // 验证表名
    if (!table || !isValidTable(table)) {
      return NextResponse.json({ error: '无效的数据表' }, { status: 400 });
    }

    if (!records || !Array.isArray(records)) {
      return NextResponse.json({ error: '无效的数据' }, { status: 400 });
    }

    const tableSchema = tableMap[table];
    const checkFields = DUPLICATE_CHECK_FIELDS[table] || [];
    const duplicates: Array<{
      index: number;
      record: Record<string, unknown>;
      existing: Record<string, unknown> | null;
      matchFields: string[];
    }> = [];

    // 对每条记录检测重复
    for (let i = 0; i < records.length; i++) {
      const record = records[i];

      // 构建 WHERE 条件
      const conditions: SQL<unknown>[] = [];
      for (const field of checkFields) {
        const value = record[field];
        if (value !== undefined && value !== null && value !== '') {
          conditions.push(sql`${sql.identifier(field)} = ${value}` as SQL<unknown>);
        }
      }

      // 如果有条件，查询是否存在重复
      if (conditions.length > 0) {
        // 构建 OR 条件（任一字段匹配即视为可能重复）
        const whereCondition = conditions.length === 1 
          ? conditions[0] 
          : sql.join(conditions, sql` OR `);

        const existing = db
          .select()
          .from(tableSchema)
          .where(whereCondition)
          .limit(1)
          .get();

        if (existing) {
          // 找出匹配的字段
          const matchFields: string[] = [];
          for (const field of checkFields) {
            const recordValue = record[field];
            const existingValue = existing[field as keyof typeof existing];
            if (recordValue && existingValue && String(recordValue) === String(existingValue)) {
              matchFields.push(field);
            }
          }

          duplicates.push({
            index: i,
            record,
            existing: existing as Record<string, unknown>,
            matchFields,
          });
        }
      }
    }

    return NextResponse.json({ 
      success: true, 
      duplicates,
      totalRecords: records.length,
      duplicateCount: duplicates.length,
    });
  } catch (error) {
    console.error('Check duplicates error:', error);
    return NextResponse.json({ error: '检测失败' }, { status: 500 });
  }
}
