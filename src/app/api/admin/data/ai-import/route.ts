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
- title: 职称，可选值：正高、副高、中级、初级
- expertise: 专业领域，多个用逗号分隔
- organization: 所属单位
- bio: 个人简介
- hourly_rate: 课时费（元）
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

    // 初始化 LLM 客户端
    const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);
    const config = new Config();
    const client = new LLMClient(config, customHeaders);

    // 构建提示词
    const prompt = `你是一个数据解析专家，负责从非结构化文本中提取结构化数据。

## 目标数据表
${TABLE_SCHEMA[table] || table}

## 输入文本
${text}

## 任务要求
1. 从输入文本中提取所有相关的数据记录
2. 根据表结构字段，将信息映射到对应字段
3. 对于缺失的可选字段，不要生成该字段（让其保持默认值）
4. 对于必填字段，如果缺失请根据上下文合理推断
5. 对于枚举类型字段，确保值在可选范围内

## 输出格式
请以JSON格式返回提取的数据，格式如下：
{
  "records": [
    {
      "field1": "value1",
      "field2": "value2"
    }
  ],
  "summary": "提取结果摘要说明"
}

请只返回JSON，不要包含其他解释文字。`;

    // 调用 LLM
    const response = await client.invoke([
      { role: 'user', content: prompt }
    ]);

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
        cleaned[key] = value;
      }
      return cleaned;
    });

    // 批量插入数据
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from(table)
      .insert(cleanedRecords)
      .select();

    if (error) {
      console.error('Insert error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      count: data?.length || 0,
      summary: parsedResult.summary || `成功导入 ${data?.length || 0} 条数据`,
      preview: data,
    });

  } catch (error) {
    console.error('AI import error:', error);
    return NextResponse.json({ 
      error: 'AI 智能导入失败，请稍后重试' 
    }, { status: 500 });
  }
}
