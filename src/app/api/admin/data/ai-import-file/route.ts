import { NextRequest, NextResponse } from 'next/server';
import { LLMClient, Config, HeaderUtils } from 'coze-coding-dev-sdk';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import * as XLSX from 'xlsx';

// 动态导入 pdf-parse 和 mammoth（避免构建问题）
async function parsePDF(buffer: Buffer): Promise<string> {
  try {
    // @ts-expect-error - pdf-parse dynamic import
    const pdfParse = (await import('pdf-parse')).default || (await import('pdf-parse'));
    const data = await pdfParse(buffer);
    return data.text || '';
  } catch (error) {
    console.error('PDF parse error:', error);
    return '';
  }
}

async function parseWord(buffer: Buffer): Promise<string> {
  try {
    const mammoth = await import('mammoth');
    const result = await mammoth.extractRawText({ buffer });
    return result.value || '';
  } catch (error) {
    console.error('Word parse error:', error);
    return '';
  }
}

function parseExcel(buffer: Buffer): string {
  try {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const results: string[] = [];
    
    workbook.SheetNames.forEach(sheetName => {
      const sheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);
      
      if (jsonData.length > 0) {
        results.push(`\n【工作表: ${sheetName}】`);
        jsonData.forEach((row, idx) => {
          const rowStr = Object.entries(row)
            .map(([key, val]) => `${key}: ${val}`)
            .join(', ');
          results.push(`${idx + 1}. ${rowStr}`);
        });
      }
    });
    
    return results.join('\n');
  } catch (error) {
    console.error('Excel parse error:', error);
    return '';
  }
}

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

// 表结构描述
const TABLE_SCHEMA: Record<string, string> = {
  teachers: `讲师信息表：
- name (必填): 姓名
- title: 职称，可选值：正高、副高、中级、初级
- expertise: 专业领域，多个用逗号分隔
- organization: 所属单位
- bio: 个人简介
- hourly_rate: 课时费（元），【重要】根据规范性文件中的费用标准自动设置
- rating: 评分（1-5）
- teaching_count: 授课次数
- is_active: 是否启用（默认true）`,

  venues: `场地信息表：
- name (必填): 场地名称
- location: 地址
- capacity: 容纳人数
- daily_rate: 日租金（元）
- facilities: 设施，多个用逗号分隔
- rating: 评分（1-5）
- usage_count: 使用次数
- is_active: 是否启用（默认true）`,

  course_templates: `课程模板表：
- name (必填): 课程名称
- category: 类别，可选值：管理技能、专业技能、职业素养、综合提升
- duration: 课时数
- target_audience: 目标人群
- difficulty: 难度，可选值：初级、中级、高级
- description: 课程描述
- usage_count: 使用次数
- avg_rating: 平均评分`,

  normative_documents: `规范性文件表：
- name (必填): 文件名称
- type: 类型，可选值：费用标准、合规条款、政策文件、其他
- content: 文件内容
- is_effective: 是否有效（默认true）`,

  projects: `培训项目表：
- name (必填): 项目名称
- status: 状态，可选值：draft、designing、pending_approval、approved、executing、completed、archived
- training_target: 培训目标
- target_audience: 目标人群
- participant_count: 参训人数
- training_days: 培训天数
- total_budget: 总预算`,

  project_courses: `项目课程表：
- project_id (必填): 项目ID
- course_name: 课程名称
- teacher_id: 讲师ID
- venue_id: 场地ID
- duration: 课时
- sequence: 顺序`,

  satisfaction_surveys: `满意度调查表：
- project_id: 项目ID
- overall_score: 总体评分
- content_score: 内容评分
- teacher_score: 讲师评分
- venue_score: 场地评分
- suggestions: 建议`,
};

// POST /api/admin/data/ai-import-file - 文件上传 AI 智能导入
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const table = formData.get('table') as string;

    // 验证
    if (!file) {
      return NextResponse.json({ error: '请上传文件' }, { status: 400 });
    }

    if (!table || !ALLOWED_TABLES.includes(table)) {
      return NextResponse.json({ error: '无效的数据表' }, { status: 400 });
    }

    // 获取文件内容
    const buffer = Buffer.from(await file.arrayBuffer());
    const fileName = file.name.toLowerCase();
    const fileType = fileName.split('.').pop() || '';

    // 解析文件内容
    let extractedText = '';
    
    if (fileType === 'pdf') {
      extractedText = await parsePDF(buffer);
    } else if (fileType === 'docx' || fileType === 'doc') {
      extractedText = await parseWord(buffer);
    } else if (fileType === 'xlsx' || fileType === 'xls') {
      extractedText = parseExcel(buffer);
    } else {
      return NextResponse.json({ 
        error: '不支持的文件格式，请上传 PDF、Word 或 Excel 文件' 
      }, { status: 400 });
    }

    if (!extractedText.trim()) {
      return NextResponse.json({ error: '无法从文件中提取文本内容' }, { status: 400 });
    }

    // 初始化客户端
    const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);
    const config = new Config();
    const client = new LLMClient(config, customHeaders);
    const supabase = getSupabaseClient();

    // 获取规范性文件作为参考
    const { data: normativeDocs } = await supabase
      .from('normative_documents')
      .select('*')
      .eq('is_effective', true);

    // 构建规范性文件参考内容
    let normativeContext = '';
    if (normativeDocs && normativeDocs.length > 0) {
      const feeStandards = normativeDocs.filter(d => d.type === '费用标准');
      const complianceRules = normativeDocs.filter(d => d.type === '合规条款');
      const policyDocs = normativeDocs.filter(d => d.type === '政策文件');

      if (feeStandards.length > 0) {
        normativeContext += `\n### 费用标准（必须严格遵守）\n`;
        feeStandards.forEach(doc => {
          normativeContext += `- **${doc.name}**: ${doc.content}\n`;
        });
      }

      if (complianceRules.length > 0) {
        normativeContext += `\n### 合规条款（必须满足）\n`;
        complianceRules.forEach(doc => {
          normativeContext += `- **${doc.name}**: ${doc.content}\n`;
        });
      }

      if (policyDocs.length > 0) {
        normativeContext += `\n### 政策文件（参考依据）\n`;
        policyDocs.forEach(doc => {
          normativeContext += `- **${doc.name}**: ${doc.content}\n`;
        });
      }
    }

    // 构建 AI 提示词
    const prompt = `你是一个数据解析专家，负责从文件内容中提取结构化数据，并根据规范标准进行验证和补全。

## 文件信息
- 文件名: ${file.name}
- 文件类型: ${fileType.toUpperCase()}

## 目标数据表
${TABLE_SCHEMA[table] || table}
${normativeContext ? `\n## 规范性文件参考\n${normativeContext}\n**重要**: 提取数据时必须参考上述规范性文件，自动填充符合标准的字段值。` : ''}

## 文件内容
${extractedText.substring(0, 8000)} ${extractedText.length > 8000 ? '...(内容过长已截断)' : ''}

## 任务要求
1. 从文件内容中提取所有相关的数据记录
2. 根据表结构字段，将信息映射到对应字段
3. **重要**: 根据规范性文件自动补全字段（如根据职称设置课时费）
4. 对于缺失的可选字段，不要生成该字段
5. 对于必填字段，如果缺失请根据上下文合理推断
6. 对于枚举类型字段，确保值在可选范围内

## 输出格式
请以JSON格式返回提取的数据，格式如下：
{
  "records": [
    {
      "field1": "value1",
      "field2": "value2"
    }
  ],
  "summary": "提取结果摘要说明",
  "appliedStandards": ["应用的标准名称列表"]
}

请只返回JSON，不要包含其他解释文字。`;

    // 调用 LLM
    const response = await client.invoke([
      { role: 'user', content: prompt }
    ], { temperature: 0.3 });

    const content = response.content || '';
    
    // 解析 JSON 响应
    let parsedResult;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsedResult = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('未找到有效的 JSON 数据');
      }
    } catch (parseError) {
      console.error('Parse LLM response error:', parseError);
      return NextResponse.json({ 
        error: 'AI 解析失败，请检查文件内容格式',
        extractedText: extractedText.substring(0, 1000),
        rawResponse: content 
      }, { status: 400 });
    }

    const records = parsedResult.records || [];
    
    if (records.length === 0) {
      return NextResponse.json({ 
        error: '未能从文件中提取到有效数据',
        summary: parsedResult.summary || '',
        extractedText: extractedText.substring(0, 500)
      }, { status: 400 });
    }

    // 清理数据
    const cleanedRecords = records.map((record: Record<string, unknown>) => {
      const cleaned: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(record)) {
        if (value === null || value === undefined || value === '') continue;
        if (key === 'id' || key === 'created_at' || key === 'updated_at') continue;
        cleaned[key] = value;
      }
      return cleaned;
    });

    // 批量插入数据
    const { data, error } = await supabase
      .from(table)
      .insert(cleanedRecords)
      .select();

    if (error) {
      console.error('Insert error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    let summary = parsedResult.summary || `从文件 "${file.name}" 成功导入 ${data?.length || 0} 条数据`;
    if (parsedResult.appliedStandards && parsedResult.appliedStandards.length > 0) {
      summary += `\n已应用规范标准: ${parsedResult.appliedStandards.join(', ')}`;
    }

    return NextResponse.json({
      success: true,
      count: data?.length || 0,
      summary,
      appliedStandards: parsedResult.appliedStandards || [],
      fileName: file.name,
      preview: data,
    });

  } catch (error) {
    console.error('File import error:', error);
    return NextResponse.json({ 
      error: '文件导入失败，请稍后重试' 
    }, { status: 500 });
  }
}
