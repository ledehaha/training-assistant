import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
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
      { key: 'hourly_rate', label: '课时费(元)' },
      { key: 'rating', label: '评分' },
      { key: 'teaching_count', label: '授课次数' },
      { key: 'is_active', label: '是否启用' },
    ],
  },
  venues: {
    label: '场地信息',
    columns: [
      { key: 'name', label: '名称' },
      { key: 'location', label: '地址' },
      { key: 'capacity', label: '容纳人数' },
      { key: 'daily_rate', label: '日租金(元)' },
      { key: 'facilities', label: '设施' },
      { key: 'rating', label: '评分' },
      { key: 'usage_count', label: '使用次数' },
      { key: 'is_active', label: '是否启用' },
    ],
  },
  course_templates: {
    label: '课程模板',
    columns: [
      { key: 'name', label: '课程名称' },
      { key: 'category', label: '类别' },
      { key: 'duration', label: '课时' },
      { key: 'target_audience', label: '目标人群' },
      { key: 'difficulty', label: '难度' },
      { key: 'description', label: '描述' },
      { key: 'usage_count', label: '使用次数' },
      { key: 'avg_rating', label: '平均评分' },
    ],
  },
  normative_documents: {
    label: '规范性文件',
    columns: [
      { key: 'name', label: '文件名称' },
      { key: 'type', label: '类型' },
      { key: 'content', label: '内容' },
      { key: 'is_effective', label: '是否有效' },
    ],
  },
  projects: {
    label: '培训项目',
    columns: [
      { key: 'name', label: '项目名称' },
      { key: 'status', label: '状态' },
      { key: 'training_target', label: '培训目标' },
      { key: 'target_audience', label: '目标人群' },
      { key: 'participant_count', label: '参训人数' },
      { key: 'training_days', label: '培训天数' },
      { key: 'total_budget', label: '总预算' },
    ],
  },
  project_courses: {
    label: '项目课程',
    columns: [
      { key: 'project_id', label: '项目ID' },
      { key: 'course_name', label: '课程名称' },
      { key: 'teacher_id', label: '讲师ID' },
      { key: 'venue_id', label: '场地ID' },
      { key: 'duration', label: '课时' },
      { key: 'sequence', label: '顺序' },
    ],
  },
  satisfaction_surveys: {
    label: '满意度调查',
    columns: [
      { key: 'project_id', label: '项目ID' },
      { key: 'overall_score', label: '总体评分' },
      { key: 'content_score', label: '内容评分' },
      { key: 'teacher_score', label: '讲师评分' },
      { key: 'venue_score', label: '场地评分' },
      { key: 'suggestions', label: '建议' },
    ],
  },
};

// GET /api/admin/data/export - 导出 Excel
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const table = searchParams.get('table');

    if (!table || !ALLOWED_TABLES.includes(table)) {
      return NextResponse.json({ error: '无效的数据表' }, { status: 400 });
    }

    const config = TABLE_CONFIG[table];
    if (!config) {
      return NextResponse.json({ error: '未找到表配置' }, { status: 400 });
    }

    // 查询数据
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // 转换数据格式
    const rows = (data || []).map(item => {
      const row: Record<string, unknown> = {};
      config.columns.forEach(col => {
        let value = item[col.key];
        // 处理布尔值
        if (typeof value === 'boolean') {
          value = value ? '是' : '否';
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
