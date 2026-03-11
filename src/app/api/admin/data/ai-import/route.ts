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
- title: 职称，标准值：院士、正高、副高、中级、初级、其他
- expertise: 专业领域，多个用逗号分隔
- organization: 所属单位
- bio: 个人简介
- hourlyRate: 课时费（元），**必须根据职称自动计算**
- rating: 评分（1-5）
- teachingCount: 授课次数
- isActive: 是否启用（默认true）

**职称识别与课时费计算规则（必须严格执行）**：

1. 职称映射规则：
   - **院士级（hourlyRate: 1500）**：院士、中国科学院院士、中国工程院院士
   
   - **正高（hourlyRate: 1000）**：教授、正教授、研究员、正高级工程师、正高级经济师、主任医师、主任药师、编审、译审、教授级高级工程师、国家级教练、特级教师（正高待遇）
   
   - **副高（hourlyRate: 500）**：副教授、副研究员、高级工程师、高级经济师、高级会计师、副主任医师、高级讲师、高级技师、特级教师（副高待遇）
   
   - **中级（hourlyRate: 500）**：讲师、助理研究员、工程师、经济师、会计师、主治医师、技师
   
   - **初级（hourlyRate: 500）**：助教、助理工程师、助理经济师、医师

2. 注意事项：
   - "高级工程师"通常是副高，"教授级高级工程师"才是正高
   - "高级技师"对应副高，"技师"对应中级
   - 如提到"享受国务院津贴"、"国家级专家"通常是正高

注意：即使原文没有提到课时费，也必须根据职称自动计算并填充hourlyRate字段！`,

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
    let titleLevelContext = ''; // 职称等级对照表内容
    
    if (normativeDocsData && normativeDocsData.length > 0) {
      // 查找职称等级对照表文件
      const titleLevelDoc = normativeDocsData.find(d => 
        d.name && (
          d.name.includes('专业技术岗位') || 
          d.name.includes('职称') || 
          d.name.includes('等级对照') ||
          d.name.includes('岗位名称')
        )
      );
      
      // 如果找到职称对照表文件，尝试读取内容
      if (titleLevelDoc?.filePath) {
        try {
          const fs = await import('fs');
          const path = await import('path');
          const filePath = path.join(process.cwd(), titleLevelDoc.filePath);
          
          if (fs.existsSync(filePath)) {
            const fileContent = fs.readFileSync(filePath, 'utf-8');
            // 截取前5000字符作为参考
            titleLevelContext = fileContent.substring(0, 5000);
          }
        } catch (e) {
          console.error('读取职称对照表文件失败:', e);
        }
      }
      
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
    let titleLevelPrompt = '';
    if (titleLevelContext) {
      titleLevelPrompt = `
## 职称等级对照表
以下是各类专业技术岗位名称及等级对照表，请根据此表识别讲师的实际职称等级：

${titleLevelContext}

**职称等级映射规则**：
- 根据上述对照表，将讲师的具体职称/岗位名称映射到标准等级：院士、正高、副高、中级、初级、其他
- 然后根据映射后的等级确定课时费：院士1500元、正高1000元、副高500元、中级500元、初级500元、其他500元

`;
    }

    const prompt = `你是一个数据解析专家，负责从非结构化文本中提取结构化数据。

## 目标数据表
${TABLE_SCHEMA[table] || table}
${normativeContext ? `\n## 规范性文件参考\n${normativeContext}\n` : ''}
${titleLevelPrompt}
## 输入文本
${text}

## 任务要求
1. 从输入文本中提取所有相关的数据记录
2. 根据表结构字段，将信息映射到对应字段
3. 对于缺失的可选字段，不要生成该字段
4. 对于必填字段，如果缺失请根据上下文合理推断
5. 对于枚举类型字段，确保值在可选范围内
6. **对于讲师信息，识别职称后必须自动计算并返回hourlyRate字段**：
   - 院士 → hourlyRate: 1500
   - 正高/教授 → hourlyRate: 1000
   - 副高/副教授 → hourlyRate: 500
   - 中级/讲师 → hourlyRate: 500
   - 初级/助教 → hourlyRate: 500
   - 其他 → hourlyRate: 500
7. 对于讲师职称，请先根据职称等级对照表识别实际等级，再映射到标准职称和课时费

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
