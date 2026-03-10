import { NextRequest, NextResponse } from 'next/server';
import { LLMClient, Config, HeaderUtils } from 'coze-coding-dev-sdk';
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

// 表结构描述
const TABLE_SCHEMA: Record<string, string> = {
  teachers: `讲师信息表：
- name (必填): 姓名
- title: 职称，可选值：院士、正高、副高、中级、初级、其他
- expertise: 专业领域，多个用逗号分隔
- organization: 所属单位
- bio: 个人简介
- hourly_rate: 课时费（元），【重要】根据规范性文件中的费用标准自动设置（院士1500元、正高1000元、其他500元）
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
- summary: 内容摘要（50字以内，概括文件核心内容）
- issuer: 颁发部门
- issue_date: 颁发时间
- file_url: 文件下载链接
- is_effective: 是否有效（默认true）`,

  projects: `培训项目表：
- name (必填): 项目名称
- status: 状态，可选值：draft、designing、executing、completed、archived
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

// POST /api/admin/data/ai-import - AI 智能导入
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { table, text } = body;

    // 验证表名
    if (!table || !ALLOWED_TABLES.includes(table)) {
      return NextResponse.json({ error: '无效的数据表' }, { status: 400 });
    }

    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return NextResponse.json({ error: '请输入要导入的文字内容' }, { status: 400 });
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

    // 构建规范性文件参考内容（用于讲师导入时的费用标准参考）
    let normativeContext = '';
    if (normativeDocs && normativeDocs.length > 0) {
      // 筛选包含费用标准的文件
      const feeDocs = normativeDocs.filter(d => 
        d.summary && (d.summary.includes('费') || d.summary.includes('标准') || d.summary.includes('讲师'))
      );
      
      if (feeDocs.length > 0) {
        normativeContext += `\n### 规范性文件参考（必须严格遵守）\n`;
        feeDocs.forEach(doc => {
          normativeContext += `- **${doc.name}**（${doc.issuer || '未知'}）: ${doc.summary}\n`;
        });
      }
    }

    // 构建提示词
    const prompt = `你是一个数据解析专家，负责从非结构化文本中提取结构化数据，并根据规范标准进行验证和补全。

## 目标数据表
${TABLE_SCHEMA[table] || table}
${normativeContext ? `\n## 规范性文件参考\n${normativeContext}\n**重要**: 提取数据时必须参考上述规范性文件，自动填充符合标准的字段值。例如：根据讲师职称自动设置课时费。` : ''}

## 输入文本
${text}

## 任务要求
1. 从输入文本中提取所有相关的数据记录
2. 根据表结构字段，将信息映射到对应字段
3. **重要**: 根据规范性文件自动补全字段：
   - 导入讲师时，根据职称自动设置课时费（hourly_rate）
   - 导入场地时，验证租金是否符合标准
   - 导入项目时，确保符合合规条款
4. 对于缺失的可选字段，不要生成该字段（让其保持默认值）
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
  "summary": "提取结果摘要说明，包括应用了哪些规范性标准",
  "appliedStandards": ["应用的标准名称列表"]
}

请只返回JSON，不要包含其他解释文字。`;

    // 调用 LLM
    const response = await client.invoke([
      { role: 'user', content: prompt }
    ], { temperature: 0.3 }); // 使用较低温度确保准确解析

    const content = response.content || '';
    
    // 解析 JSON 响应
    let parsedResult;
    try {
      // 尝试提取 JSON 部分
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsedResult = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('未找到有效的 JSON 数据');
      }
    } catch (parseError) {
      console.error('Parse LLM response error:', parseError);
      return NextResponse.json({ 
        error: 'AI 解析失败，请检查输入内容格式',
        rawResponse: content 
      }, { status: 400 });
    }

    const records = parsedResult.records || [];
    
    if (records.length === 0) {
      return NextResponse.json({ 
        error: '未能从文本中提取到有效数据',
        summary: parsedResult.summary || ''
      }, { status: 400 });
    }

    // 清理数据
    const cleanedRecords = records.map((record: Record<string, unknown>) => {
      const cleaned: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(record)) {
        // 跳过空值
        if (value === null || value === undefined || value === '') continue;
        // 跳过不应导入的字段
        if (key === 'id' || key === 'created_at' || key === 'updated_at') continue;
        
        // 处理日期格式转换
        if (key === 'issue_date' || key === 'effective_date' || key === 'expiry_date') {
          const dateStr = String(value);
          // 转换 "2017年" -> "2017-01-01"
          const yearMatch = dateStr.match(/(\d{4})年/);
          if (yearMatch) {
            const year = yearMatch[1];
            const monthMatch = dateStr.match(/(\d{1,2})月/);
            const month = monthMatch ? monthMatch[1].padStart(2, '0') : '01';
            const dayMatch = dateStr.match(/(\d{1,2})日/);
            const day = dayMatch ? dayMatch[1].padStart(2, '0') : '01';
            cleaned[key] = `${year}-${month}-${day}`;
            continue;
          }
          // 尝试解析其他日期格式
          const dateMatch = dateStr.match(/(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/);
          if (dateMatch) {
            cleaned[key] = `${dateMatch[1]}-${dateMatch[2].padStart(2, '0')}-${dateMatch[3].padStart(2, '0')}`;
            continue;
          }
        }
        
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

    // 构建摘要信息
    let summary = parsedResult.summary || `成功导入 ${data?.length || 0} 条数据`;
    if (parsedResult.appliedStandards && parsedResult.appliedStandards.length > 0) {
      summary += `\n已应用规范标准: ${parsedResult.appliedStandards.join(', ')}`;
    }

    return NextResponse.json({
      success: true,
      count: data?.length || 0,
      summary,
      appliedStandards: parsedResult.appliedStandards || [],
      preview: data,
    });

  } catch (error) {
    console.error('AI import error:', error);
    return NextResponse.json({ 
      error: 'AI 智能导入失败，请稍后重试' 
    }, { status: 500 });
  }
}
