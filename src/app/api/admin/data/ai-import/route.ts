import { NextRequest, NextResponse } from 'next/server';
import { LLMClient, Config, HeaderUtils } from 'coze-coding-dev-sdk';
import { 
  db, teachers, venues, courseTemplates, normativeDocuments, 
  projects, projectCourses, satisfactionSurveys, sql,
  saveDatabaseImmediate, ensureDatabaseReady
} from '@/storage/database';
import { generateId, getTimestamp } from '@/storage/database';
import { getApiKey } from '@/lib/api-key';

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

// 表结构描述
const TABLE_SCHEMA: Record<string, string> = {
  teachers: `讲师信息表：
- name (必填): 姓名
- title: 职称，可选值：院士、正高、副高、中级、初级、其他
- expertise: 专业领域，多个用逗号分隔
- organization: 所属单位
- bio: 个人简介
- hourlyRate: 课时费（元），根据职称参考标准：院士5000+、正高2000-3000、副高1200-1800、中级800-1200、初级500-800、其他300-600
- rating: 评分（1-5）
- teachingCount: 授课次数
- isActive: 是否启用（默认true）

重要：当识别出讲师职称时，请根据上述标准自动推荐合适的课时费。例如：正高职称推荐课时费2000-3000元，副高职称推荐1200-1800元。`,

  venues: `场地信息表：
- name (必填): 场地名称
- location: 地址
- capacity: 容纳人数
- dailyRate: 日租金（元）
- facilities: 设施，多个用逗号分隔
- rating: 评分（1-5）
- usageCount: 使用次数
- isActive: 是否启用（默认true）`,

  course_templates: `课程模板表：
- name (必填): 课程名称
- category: 类别，可选值：管理技能、专业技能、职业素养、综合提升
- duration: 课时数
- targetAudience: 目标人群
- difficulty: 难度，可选值：初级、中级、高级
- description: 课程描述
- usageCount: 使用次数
- avgRating: 平均评分`,

  normative_documents: `规范性文件表：
- name (必填): 文件名称
- summary: 内容摘要（50字以内）
- issuer: 颁发部门
- issueDate: 颁发时间
- fileUrl: 文件下载链接
- isEffective: 是否有效（默认true）`,

  projects: `培训项目表：
- name (必填): 项目名称
- status: 状态
- trainingTarget: 培训目标
- targetAudience: 目标人群
- participantCount: 参训人数
- trainingDays: 培训天数
- totalBudget: 总预算`,

  project_courses: `项目课程表：
- projectId (必填): 项目ID
- name: 课程名称
- teacherId: 讲师ID
- duration: 课时
- order: 顺序`,

  satisfaction_surveys: `满意度调查表：
- projectId: 项目ID
- title: 标题
- questions: 问题列表(JSON)
- status: 状态`,
};

// POST /api/admin/data/ai-import - AI 智能导入
export async function POST(request: NextRequest) {
  try {
    await ensureDatabaseReady();
    
    const body = await request.json();
    const { table, text } = body;

    // 验证表名
    if (!table || !ALLOWED_TABLES.includes(table as typeof ALLOWED_TABLES[number])) {
      return NextResponse.json({ error: '无效的数据表' }, { status: 400 });
    }

    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return NextResponse.json({ error: '请输入要导入的文字内容' }, { status: 400 });
    }

    // 检查 API Key
    const apiKey = await getApiKey();
    if (!apiKey) {
      return NextResponse.json({ 
        error: '未配置 AI API Key，请在设置页面配置后再使用智能导入功能' 
      }, { status: 400 });
    }

    // 设置 API Key 到环境变量
    process.env.LLM_API_KEY = apiKey;
    process.env.COZE_API_KEY = apiKey;

    // 初始化客户端
    const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);
    const config = new Config();
    const client = new LLMClient(config, customHeaders);

    // 获取规范性文件作为参考
    const normativeDocsData = db
      .select()
      .from(normativeDocuments)
      .where(sql`${normativeDocuments.isEffective} = 1`)
      .all();

    // 构建规范性文件参考内容
    let normativeContext = '';
    if (normativeDocsData && normativeDocsData.length > 0) {
      const feeDocs = normativeDocsData.filter(d => 
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
    const prompt = `你是一个数据解析专家，负责从非结构化文本中提取结构化数据。

## 目标数据表
${TABLE_SCHEMA[table] || table}
${normativeContext ? `\n## 规范性文件参考\n${normativeContext}\n` : ''}

## 输入文本
${text}

## 任务要求
1. 从输入文本中提取所有相关的数据记录
2. 根据表结构字段，将信息映射到对应字段
3. 对于缺失的可选字段，不要生成该字段
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

    // 清理数据并插入
    const tableSchema = tableMap[table as keyof typeof tableMap];
    const now = getTimestamp();
    let successCount = 0;
    const insertedRecords: unknown[] = [];

    for (const record of records) {
      try {
        const cleaned: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(record)) {
          if (value === null || value === undefined || value === '') continue;
          if (key === 'id' || key === 'created_at' || key === 'updated_at' || key === 'createdAt' || key === 'updatedAt') continue;
          cleaned[key] = value;
        }

        const result = db
          .insert(tableSchema)
          .values({
            id: generateId(),
            ...cleaned,
            createdAt: now,
          })
          .returning()
          .get();
        
        insertedRecords.push(result);
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
      summary: parsedResult.summary || `成功导入 ${successCount} 条数据`,
      preview: insertedRecords,
    });

  } catch (error) {
    console.error('AI import error:', error);
    return NextResponse.json({ 
      error: 'AI 智能导入失败，请稍后重试' 
    }, { status: 500 });
  }
}
