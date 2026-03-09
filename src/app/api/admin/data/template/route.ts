import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';

// 数据表配置（与前端保持一致）
const TABLES_CONFIG: Record<string, { label: string; columns: { key: string; label: string; type: string; required?: boolean; options?: string[] }[] }> = {
  teachers: {
    label: '讲师信息',
    columns: [
      { key: 'name', label: '姓名', type: 'text', required: true },
      { key: 'title', label: '职称', type: 'select', options: ['正高', '副高', '中级', '初级'] },
      { key: 'expertise', label: '专业领域', type: 'text' },
      { key: 'organization', label: '所属单位', type: 'text' },
      { key: 'bio', label: '简介', type: 'text' },
      { key: 'hourly_rate', label: '课时费(元)', type: 'number' },
      { key: 'rating', label: '评分(1-5)', type: 'number' },
      { key: 'teaching_count', label: '授课次数', type: 'number' },
      { key: 'is_active', label: '是否启用(是/否)', type: 'boolean' },
    ],
  },
  venues: {
    label: '场地信息',
    columns: [
      { key: 'name', label: '名称', type: 'text', required: true },
      { key: 'location', label: '地址', type: 'text' },
      { key: 'capacity', label: '容纳人数', type: 'number' },
      { key: 'daily_rate', label: '日租金(元)', type: 'number' },
      { key: 'facilities', label: '设施', type: 'text' },
      { key: 'rating', label: '评分(1-5)', type: 'number' },
      { key: 'usage_count', label: '使用次数', type: 'number' },
      { key: 'is_active', label: '是否启用(是/否)', type: 'boolean' },
    ],
  },
  course_templates: {
    label: '课程模板',
    columns: [
      { key: 'name', label: '课程名称', type: 'text', required: true },
      { key: 'category', label: '类别', type: 'select', options: ['管理技能', '专业技能', '职业素养', '综合提升'] },
      { key: 'duration', label: '课时', type: 'number' },
      { key: 'target_audience', label: '目标人群', type: 'text' },
      { key: 'difficulty', label: '难度', type: 'select', options: ['初级', '中级', '高级'] },
      { key: 'description', label: '描述', type: 'text' },
      { key: 'usage_count', label: '使用次数', type: 'number' },
      { key: 'avg_rating', label: '平均评分', type: 'number' },
    ],
  },
  normative_documents: {
    label: '规范性文件',
    columns: [
      { key: 'name', label: '文件名称', type: 'text', required: true },
      { key: 'type', label: '类型', type: 'select', options: ['费用标准', '合规条款', '政策文件', '其他'] },
      { key: 'content', label: '内容', type: 'text' },
      { key: 'is_effective', label: '是否有效(是/否)', type: 'boolean' },
    ],
  },
  projects: {
    label: '培训项目',
    columns: [
      { key: 'name', label: '项目名称', type: 'text', required: true },
      { key: 'status', label: '状态', type: 'select', options: ['draft', 'designing', 'pending_approval', 'approved', 'executing', 'completed', 'archived'] },
      { key: 'training_target', label: '培训目标', type: 'text' },
      { key: 'target_audience', label: '目标人群', type: 'text' },
      { key: 'participant_count', label: '参训人数', type: 'number' },
      { key: 'training_days', label: '培训天数', type: 'number' },
      { key: 'total_budget', label: '总预算', type: 'number' },
    ],
  },
  project_courses: {
    label: '项目课程',
    columns: [
      { key: 'project_id', label: '项目ID', type: 'text', required: true },
      { key: 'course_name', label: '课程名称', type: 'text' },
      { key: 'teacher_id', label: '讲师ID', type: 'text' },
      { key: 'venue_id', label: '场地ID', type: 'text' },
      { key: 'duration', label: '课时', type: 'number' },
      { key: 'sequence', label: '顺序', type: 'number' },
    ],
  },
  satisfaction_surveys: {
    label: '满意度调查',
    columns: [
      { key: 'project_id', label: '项目ID', type: 'text' },
      { key: 'overall_score', label: '总体评分', type: 'number' },
      { key: 'content_score', label: '内容评分', type: 'number' },
      { key: 'teacher_score', label: '讲师评分', type: 'number' },
      { key: 'venue_score', label: '场地评分', type: 'number' },
      { key: 'suggestions', label: '建议', type: 'text' },
    ],
  },
};

// 示例数据
const SAMPLE_DATA: Record<string, Record<string, unknown>[]> = {
  teachers: [
    { name: '张明', title: '正高', expertise: '管理培训,领导力', organization: '某大学商学院', bio: '资深管理培训专家', hourly_rate: 2000, rating: 4.9, teaching_count: 45, is_active: '是' },
    { name: '李华', title: '副高', expertise: '安全生产', organization: '某安全研究院', bio: '安全生产专家', hourly_rate: 1500, rating: 4.8, teaching_count: 38, is_active: '是' },
  ],
  venues: [
    { name: '阳光培训中心', location: '上海市浦东新区', capacity: 100, daily_rate: 5000, facilities: '投影仪、音响、白板', rating: 4.7, usage_count: 28, is_active: '是' },
  ],
  course_templates: [
    { name: '班组长管理技能提升', category: '管理技能', duration: 8, target_audience: '班组长', difficulty: '中级', description: '提升班组长的管理能力', usage_count: 45, avg_rating: 4.7 },
  ],
  normative_documents: [
    { name: '培训费用管理办法', type: '费用标准', content: '讲师费标准：正高2000元/课时', is_effective: '是' },
  ],
  projects: [
    { name: '2024年度班组长培训', status: 'draft', training_target: '提升管理能力', target_audience: '班组长', participant_count: 50, training_days: 3, total_budget: 100000 },
  ],
  project_courses: [
    { project_id: '项目ID', course_name: '管理基础', teacher_id: '讲师ID', venue_id: '场地ID', duration: 4, sequence: 1 },
  ],
  satisfaction_surveys: [
    { project_id: '项目ID', overall_score: 4.5, content_score: 4.6, teacher_score: 4.7, venue_score: 4.3, suggestions: '课程内容丰富' },
  ],
};

// GET /api/admin/data/template - 导出 Excel 模板
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const table = searchParams.get('table');

    if (!table || !TABLES_CONFIG[table]) {
      return NextResponse.json({ error: '无效的数据表' }, { status: 400 });
    }

    const config = TABLES_CONFIG[table];
    const columns = config.columns;

    // 创建工作簿
    const workbook = XLSX.utils.book_new();

    // 第一行：字段说明（带必填标记）
    const headerRow = columns.map(col => {
      let label = col.label;
      if (col.required) {
        label = `${label}(必填)`;
      }
      return label;
    });

    // 第二行：字段名（方便开发人员理解）
    const fieldRow = columns.map(col => `[${col.key}]`);

    // 第三行：字段类型说明
    const typeRow = columns.map(col => {
      if (col.options) {
        return `可选值: ${col.options.join('/')}`;
      }
      if (col.type === 'number') {
        return '数字';
      }
      if (col.type === 'boolean') {
        return '是/否';
      }
      return '文本';
    });

    // 示例数据
    const samples = SAMPLE_DATA[table] || [];
    const sampleRows = samples.map(sample => 
      columns.map(col => {
        const value = sample[col.key];
        return value !== undefined ? String(value) : '';
      })
    );

    // 组合所有数据
    const sheetData = [headerRow, fieldRow, typeRow, ...sampleRows];

    // 创建工作表
    const worksheet = XLSX.utils.aoa_to_sheet(sheetData);

    // 设置列宽
    const colWidths = columns.map(col => ({ wch: Math.max(col.label.length * 2 + 4, 15) }));
    worksheet['!cols'] = colWidths;

    // 添加工作表
    XLSX.utils.book_append_sheet(workbook, worksheet, '数据模板');

    // 添加说明工作表
    const instructionsData = [
      ['数据导入模板说明'],
      [''],
      ['表名：', config.label],
      [''],
      ['字段说明：'],
      ...columns.map(col => [
        col.label,
        col.required ? '(必填)' : '',
        col.type === 'select' && col.options ? `可选值: ${col.options.join('/')}` : '',
        col.type === 'number' ? '请填写数字' : '',
        col.type === 'boolean' ? '填写"是"或"否"' : '',
      ]),
      [''],
      ['注意事项：'],
      ['1. 请勿修改表头行'],
      ['2. 第2行和第3行为说明，请在第4行开始填写数据'],
      ['3. 必填字段不能为空'],
      ['4. 日期格式请使用: YYYY-MM-DD'],
      ['5. 布尔值请填写"是"或"否"'],
    ];
    const instructionsSheet = XLSX.utils.aoa_to_sheet(instructionsData);
    instructionsSheet['!cols'] = [{ wch: 30 }, { wch: 10 }, { wch: 30 }, { wch: 20 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(workbook, instructionsSheet, '填写说明');

    // 生成 Excel 文件
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    // 返回文件
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${table}_template.xlsx"`,
      },
    });
  } catch (error) {
    console.error('Export template error:', error);
    return NextResponse.json({ error: '导出模板失败' }, { status: 500 });
  }
}
