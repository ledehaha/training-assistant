import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { 
  db, teachers, venues, courseTemplates, normativeDocuments, 
  projects, projectCourses, satisfactionSurveys, userProfiles, userTrainingRecords, desc, sql 
} from '@/storage/database';

// 允许操作的表（白名单）
const ALLOWED_TABLES = [
  'teachers',
  'venues',
  'course_templates',
  'normative_documents',
  'projects',
  'project_courses',
  'satisfaction_surveys',
  'user_profiles',
  'user_training_records',
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
  user_profiles: userProfiles,
  user_training_records: userTrainingRecords,
};

// 表配置
const TABLE_CONFIG: Record<string, { label: string; columns: { key: string; label: string }[] }> = {
  teachers: {
    label: '讲师信息',
    columns: [
      { key: 'name', label: '姓名' },
      { key: 'title', label: '职称' },
      { key: 'expertise', label: '专业领域' },
      { key: 'organization', label: '所属单位' },
      { key: 'bio', label: '简介' },
      { key: 'hourlyRate', label: '课时费(元)' },
      { key: 'rating', label: '评分' },
      { key: 'teachingCount', label: '授课次数' },
      { key: 'isActive', label: '是否启用' },
    ],
  },
  venues: {
    label: '场地信息',
    columns: [
      { key: 'name', label: '名称' },
      { key: 'location', label: '地址' },
      { key: 'capacity', label: '容纳人数' },
      { key: 'dailyRate', label: '日租金(元)' },
      { key: 'facilities', label: '设施' },
      { key: 'rating', label: '评分' },
      { key: 'usageCount', label: '使用次数' },
      { key: 'isActive', label: '是否启用' },
    ],
  },
  course_templates: {
    label: '课程模板',
    columns: [
      { key: 'name', label: '课程名称' },
      { key: 'category', label: '类别' },
      { key: 'duration', label: '课时' },
      { key: 'targetAudience', label: '目标人群' },
      { key: 'difficulty', label: '难度' },
      { key: 'description', label: '描述' },
      { key: 'usageCount', label: '使用次数' },
      { key: 'avgRating', label: '平均评分' },
    ],
  },
  normative_documents: {
    label: '规范性文件',
    columns: [
      { key: 'name', label: '文件名称' },
      { key: 'summary', label: '内容摘要' },
      { key: 'issuer', label: '颁发部门' },
      { key: 'issueDate', label: '颁发时间' },
      { key: 'isEffective', label: '是否有效' },
    ],
  },
  projects: {
    label: '培训项目',
    columns: [
      { key: 'name', label: '项目名称' },
      { key: 'status', label: '状态' },
      { key: 'trainingTarget', label: '培训目标' },
      { key: 'targetAudience', label: '目标人群' },
      { key: 'participantCount', label: '参训人数' },
      { key: 'trainingDays', label: '培训天数' },
      { key: 'totalBudget', label: '总预算' },
    ],
  },
  project_courses: {
    label: '项目课程',
    columns: [
      { key: 'projectId', label: '项目ID' },
      { key: 'name', label: '课程名称' },
      { key: 'teacherId', label: '讲师ID' },
      { key: 'duration', label: '课时' },
      { key: 'order', label: '顺序' },
    ],
  },
  satisfaction_surveys: {
    label: '满意度调查',
    columns: [
      { key: 'projectId', label: '项目ID' },
      { key: 'title', label: '标题' },
      { key: 'status', label: '状态' },
      { key: 'responseCount', label: '响应数' },
    ],
  },
  user_profiles: {
    label: '用户特征',
    columns: [
      { key: 'name', label: '姓名' },
      { key: 'department', label: '部门' },
      { key: 'position', label: '职位' },
      { key: 'employeeId', label: '工号' },
      { key: 'email', label: '邮箱' },
      { key: 'phone', label: '电话' },
      { key: 'completedTrainings', label: '已完成培训数' },
      { key: 'totalTrainingHours', label: '累计培训学时' },
      { key: 'avgSatisfactionScore', label: '平均满意度' },
      { key: 'lastTrainingDate', label: '最近培训日期' },
      { key: 'learningStyle', label: '学习风格' },
      { key: 'isActive', label: '是否启用' },
      { key: 'notes', label: '备注' },
    ],
  },
  user_training_records: {
    label: '用户培训记录',
    columns: [
      { key: 'userProfileId', label: '用户ID' },
      { key: 'projectId', label: '项目ID' },
      { key: 'trainingName', label: '培训名称' },
      { key: 'trainingTarget', label: '培训目标' },
      { key: 'trainingDays', label: '培训天数' },
      { key: 'trainingHours', label: '培训学时' },
      { key: 'completionDate', label: '完成日期' },
      { key: 'satisfactionScore', label: '满意度评分' },
      { key: 'feedback', label: '反馈' },
    ],
  },
};

// GET /api/admin/data/export - 导出 Excel
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const table = searchParams.get('table');

    if (!table || !ALLOWED_TABLES.includes(table as typeof ALLOWED_TABLES[number])) {
      return NextResponse.json({ error: '无效的数据表' }, { status: 400 });
    }

    const config = TABLE_CONFIG[table];
    if (!config) {
      return NextResponse.json({ error: '未找到表配置' }, { status: 400 });
    }

    // 查询数据
    const tableSchema = tableMap[table as keyof typeof tableMap];
    const data = db
      .select()
      .from(tableSchema)
      .orderBy(desc(sql`created_at`))
      .all();

    // 转换数据格式
    const rows = (data || []).map(item => {
      const row: Record<string, unknown> = {};
      config.columns.forEach(col => {
        let value = (item as Record<string, unknown>)[col.key];
        // 处理布尔值
        if (typeof value === 'boolean') {
          value = value ? '是' : '否';
        }
        // 处理状态字段（英文转中文）
        if (col.key === 'status') {
          const statusMap: Record<string, string> = {
            'draft': '草稿',
            'designing': '设计阶段',
            'executing': '执行阶段',
            'completed': '已完成',
            'archived': '已归档',
          };
          value = statusMap[String(value)] || value;
        }
        // 处理 null/undefined
        if (value === null || value === undefined) {
          value = '';
        }
        row[col.label] = value;
      });
      return row;
    });

    // 创建工作簿
    const workbook = XLSX.utils.book_new();

    // 表头
    const headers = config.columns.map(col => col.label);

    // 数据行
    const sheetData = [
      headers,
      ...rows.map(row => headers.map(h => row[h] ?? ''))
    ];

    // 创建工作表
    const worksheet = XLSX.utils.aoa_to_sheet(sheetData);

    // 设置列宽
    worksheet['!cols'] = config.columns.map(col => ({
      wch: Math.max(col.label.length * 2, 12)
    }));

    // 添加工作表
    XLSX.utils.book_append_sheet(workbook, worksheet, config.label);

    // 生成 Excel 文件
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    // 返回文件
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${table}_${new Date().toISOString().split('T')[0]}.xlsx"`,
      },
    });
  } catch (error) {
    console.error('Export error:', error);
    return NextResponse.json({ error: '导出失败' }, { status: 500 });
  }
}

// POST /api/admin/data/export - 批量导出选中数据
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { table, ids } = body;

    if (!table || !ALLOWED_TABLES.includes(table as typeof ALLOWED_TABLES[number])) {
      return NextResponse.json({ error: '无效的数据表' }, { status: 400 });
    }

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: '请选择要导出的数据' }, { status: 400 });
    }

    const config = TABLE_CONFIG[table];
    if (!config) {
      return NextResponse.json({ error: '未找到表配置' }, { status: 400 });
    }

    // 查询选中的数据
    const tableSchema = tableMap[table as keyof typeof tableMap];
    const data = db
      .select()
      .from(tableSchema)
      .all()
      .filter(item => ids.includes((item as Record<string, unknown>).id));

    // 转换数据格式
    const rows = (data || []).map(item => {
      const row: Record<string, unknown> = {};
      config.columns.forEach(col => {
        let value = (item as Record<string, unknown>)[col.key];
        // 处理布尔值
        if (typeof value === 'boolean') {
          value = value ? '是' : '否';
        }
        // 处理状态字段（英文转中文）
        if (col.key === 'status') {
          const statusMap: Record<string, string> = {
            'draft': '草稿',
            'designing': '设计阶段',
            'executing': '执行阶段',
            'completed': '已完成',
            'archived': '已归档',
          };
          value = statusMap[String(value)] || value;
        }
        // 处理 null/undefined
        if (value === null || value === undefined) {
          value = '';
        }
        row[col.label] = value;
      });
      return row;
    });

    // 创建工作簿
    const workbook = XLSX.utils.book_new();

    // 表头
    const headers = config.columns.map(col => col.label);

    // 数据行
    const sheetData = [
      headers,
      ...rows.map(row => headers.map(h => row[h] ?? ''))
    ];

    // 创建工作表
    const worksheet = XLSX.utils.aoa_to_sheet(sheetData);

    // 设置列宽
    worksheet['!cols'] = config.columns.map(col => ({
      wch: Math.max(col.label.length * 2, 12)
    }));

    // 添加工作表
    XLSX.utils.book_append_sheet(workbook, worksheet, config.label);

    // 生成 Excel 文件
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    // 返回文件
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${table}_selected_${new Date().toISOString().split('T')[0]}.xlsx"`,
      },
    });
  } catch (error) {
    console.error('Batch export error:', error);
    return NextResponse.json({ error: '导出失败' }, { status: 500 });
  }
}
