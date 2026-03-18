import { NextRequest } from 'next/server';
import { LLMClient, FetchClient, Config, HeaderUtils, Message } from 'coze-coding-dev-sdk';
import { S3Storage } from 'coze-coding-dev-sdk';
import { getDb, ensureDatabaseReady } from '@/storage/database';
import {
  projects,
  projectCourses,
  teachers,
  venues,
  courseTemplates,
  visitSites,
} from '@/storage/database/schema';
import { eq } from 'drizzle-orm';
import {
  dbSchemaConfig,
  generateAIFieldDescription,
  validateAIData,
  processDurationField,
  getComparisonFields,
  type TableSchemaConfig,
} from '@/config/db-schema-config';

// 初始化对象存储
const storage = new S3Storage({
  endpointUrl: process.env.COZE_BUCKET_ENDPOINT_URL,
  accessKey: '',
  secretKey: '',
  bucketName: process.env.COZE_BUCKET_NAME,
  region: 'cn-beijing',
});

// 进度事件类型
interface ProgressEvent {
  type: 'progress' | 'result' | 'error';
  step: string;
  stepName: string;
  progress: number;
  total: number;
  data?: unknown;
}

// AI检查结果类型 - 动态根据schema定义
interface CheckResultItem {
  action: 'add' | 'update';
  data: Record<string, unknown>;
  existingId?: string;
  reason: string;
  source: string;
  confidence: 'high' | 'medium' | 'low';
  validationErrors?: string[];
}

interface CheckResult {
  projectInfo: {
    field: string;
    fieldName: string;
    currentValue: string | number | null;
    extractedValue: string | number;
    source: string;
    reason: string;
  }[];
  teachers: CheckResultItem[];
  venues: CheckResultItem[];
  courseTemplates: CheckResultItem[];
  visitSites: CheckResultItem[];
  projectCourses: CheckResultItem[];
}

// 进度步骤定义（动态）
const BASE_STEPS = [
  { step: 'init', name: '初始化数据库连接' },
  { step: 'project', name: '获取项目信息' },
  { step: 'contract', name: '解析合同文件' },
  { step: 'cost', name: '解析成本测算表' },
  { step: 'declaration', name: '解析项目申报书' },
  { step: 'studentList', name: '解析学员名单' },
  { step: 'satisfaction', name: '解析满意度调查' },
  { step: 'otherMaterials', name: '解析其它附件' },
  { step: 'database', name: '获取数据库数据' },
  { step: 'ai', name: 'AI智能分析与整合' },
  { step: 'complete', name: '分析完成' },
];

// 读取并解析文件内容
async function readFileContent(fileKey: string, customHeaders: Record<string, string>): Promise<string> {
  try {
    const signedUrl = await storage.generatePresignedUrl({ key: fileKey, expireTime: 3600 });
    const config = new Config();
    const fetchClient = new FetchClient(config, customHeaders);
    const response = await fetchClient.fetch(signedUrl);
    
    if (response.status_code !== 0) {
      console.error('FetchClient解析文件失败:', response.status_message);
      return '';
    }
    
    const textContent = response.content
      .filter(item => item.type === 'text' && item.text)
      .map(item => item.text)
      .join('\n');
    
    return textContent.substring(0, 10000);
  } catch (error) {
    console.error('读取文件失败:', error);
    return '';
  }
}

/**
 * 动态生成AI系统提示词
 * 从配置文件读取所有表的字段定义
 */
function generateSystemPrompt(): string {
  const tableDescriptions = Object.keys(dbSchemaConfig)
    .filter(key => key !== 'projectInfo') // projectInfo单独处理
    .map(key => generateAIFieldDescription(key))
    .join('\n\n');

  return `你是一个专业的培训项目数据分析师。你的任务是：
1. 分析所有上传文件的内容
2. 整合多个文件中提取的信息，对于同一实体，找出最完整、最准确的信息
3. 与数据库中已有的数据进行比对
4. 返回需要新增或更新的数据

## 重要原则

### 数据处理原则
- 同一实体可能在多个文件中出现，需要整合所有信息
- 优先选择信息最完整的来源（如：专家介绍文件通常比合同文件更详细）
- 对于冲突的信息，优先采用专业文档中的信息

### 数据来源标注
- 每条数据必须标注source字段，说明数据来自哪个文件
- confidence字段表示数据置信度：
  - high: 来源文件专门描述该数据
  - medium: 来源文件明确提及但信息不完整
  - low: 来源文件只是间接提及

## 数据库字段定义（严格按照此定义输出）

${tableDescriptions}

${generateAIFieldDescription('projectInfo')}

## 输出格式要求

返回严格的JSON格式，每个表的数据项结构如下：

\`\`\`json
{
  "projectInfo": [{
    "field": "字段名",
    "fieldName": "字段中文名",
    "currentValue": "当前值",
    "extractedValue": "提取值",
    "source": "来源文件名",
    "reason": "更新理由"
  }],
  "teachers": [{
    "action": "add或update",
    "data": { ...严格按字段定义... },
    "existingId": "如果是更新，填写已有记录的ID",
    "reason": "判断理由",
    "source": "数据来源文件名",
    "confidence": "high或medium或low"
  }],
  "venues": [...],
  "courseTemplates": [...],
  "visitSites": [...],
  "projectCourses": [...]
}
\`\`\`

## 重要提醒

1. **字段映射必须正确**：严格按照上面定义的字段含义填写，不要混淆
2. **不要臆造字段**：只输出上面定义的字段，不要添加其他字段
3. **类型必须正确**：数字字段填数字，枚举字段从可选值中选择
4. **只有真正有价值的新增或更新才返回**，避免返回重复或无效数据
5. 如果数据库中已有同名记录，检查是否需要补充缺失字段的信息`;
}

/**
 * 格式化数据库数据用于AI对比
 */
function formatDbDataForAI(
  schemaKey: string,
  data: Record<string, unknown>[]
): string {
  const schema = dbSchemaConfig[schemaKey];
  if (!schema || data.length === 0) return '暂无数据';

  const comparisonFields = getComparisonFields(schemaKey);
  
  return data.map((item, index) => {
    const fieldValues = comparisonFields
      .map(f => `${schema.fields.find(sf => sf.name === f)?.displayName || f}:${item[f] ?? '未填写'}`)
      .join(' ');
    return `${index + 1}. ID:${item.id} ${fieldValues}`;
  }).join('\n');
}

export async function POST(request: NextRequest) {
  const encoder = new TextEncoder();
  let currentStepIndex = 0;
  
  const sendProgress = (stepName: string, totalSteps: number): ProgressEvent => ({
    type: 'progress',
    step: BASE_STEPS[currentStepIndex]?.step || 'unknown',
    stepName,
    progress: Math.round(((currentStepIndex + 1) / totalSteps) * 100),
    total: totalSteps,
  });

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const sendEvent = (event: ProgressEvent) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        };
        
        const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);
        const { projectId } = await request.json();

        if (!projectId) {
          sendEvent({ type: 'error', step: 'init', stepName: '参数错误', progress: 0, total: BASE_STEPS.length, data: { error: '缺少项目ID' } });
          controller.close();
          return;
        }

        // Step 1: 初始化数据库
        sendEvent(sendProgress('正在初始化数据库连接...', BASE_STEPS.length));
        await ensureDatabaseReady();
        currentStepIndex++;

        // Step 2: 获取项目信息
        sendEvent(sendProgress('正在获取项目信息...', BASE_STEPS.length));
        const db = getDb();
        const projectList = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);

        if (!projectList[0]) {
          sendEvent({ type: 'error', step: 'project', stepName: '项目不存在', progress: 10, total: BASE_STEPS.length, data: { error: '项目不存在' } });
          controller.close();
          return;
        }
        const project = projectList[0];
        currentStepIndex++;

        // 收集文件内容（包含来源信息）
        const fileData: { name: string; content: string; type: string }[] = [];

        // Step 3: 解析合同文件
        sendEvent(sendProgress('正在解析合同文件...', BASE_STEPS.length));
        if (project.contractFilePdf) {
          const content = await readFileContent(project.contractFilePdf, customHeaders);
          if (content) fileData.push({ name: '合同文件', content, type: 'contract' });
        }
        currentStepIndex++;

        // Step 4: 解析成本测算表
        sendEvent(sendProgress('正在解析成本测算表...', BASE_STEPS.length));
        if (project.costFilePdf) {
          const content = await readFileContent(project.costFilePdf, customHeaders);
          if (content) fileData.push({ name: '成本测算表PDF', content, type: 'cost' });
        } else if (project.costFileExcel) {
          const content = await readFileContent(project.costFileExcel, customHeaders);
          if (content) fileData.push({ name: '成本测算表Excel', content, type: 'cost' });
        }
        currentStepIndex++;

        // Step 5: 解析项目申报书
        sendEvent(sendProgress('正在解析项目申报书...', BASE_STEPS.length));
        if (project.declarationFilePdf) {
          const content = await readFileContent(project.declarationFilePdf, customHeaders);
          if (content) fileData.push({ name: '项目申报书', content, type: 'declaration' });
        }
        currentStepIndex++;

        // Step 6: 解析学员名单
        sendEvent(sendProgress('正在解析学员名单...', BASE_STEPS.length));
        if (project.studentListFile) {
          const content = await readFileContent(project.studentListFile, customHeaders);
          if (content) fileData.push({ name: '学员名单', content, type: 'studentList' });
        }
        currentStepIndex++;

        // Step 7: 解析满意度调查
        sendEvent(sendProgress('正在解析满意度调查...', BASE_STEPS.length));
        if (project.satisfactionSurveyFile) {
          const content = await readFileContent(project.satisfactionSurveyFile, customHeaders);
          if (content) fileData.push({ name: '满意度调查', content, type: 'satisfaction' });
        }
        currentStepIndex++;

        // Step 8: 解析其它附件
        sendEvent(sendProgress('正在解析其它附件...', BASE_STEPS.length));
        const otherMaterials: { key: string; name: string }[] = project.otherMaterials 
          ? JSON.parse(project.otherMaterials) 
          : [];
        
        for (const material of otherMaterials) {
          const content = await readFileContent(material.key, customHeaders);
          if (content) {
            fileData.push({ 
              name: material.name, 
              content, 
              type: 'other' 
            });
          }
        }
        currentStepIndex++;

        // Step 9: 获取数据库数据
        sendEvent(sendProgress('正在获取数据库数据...', BASE_STEPS.length));
        const [allTeachers, allVenues, allCourseTemplates, allVisitSites, projectCoursesList] = await Promise.all([
          db.select().from(teachers),
          db.select().from(venues),
          db.select().from(courseTemplates),
          db.select().from(visitSites),
          db.select().from(projectCourses).where(eq(projectCourses.projectId, projectId)),
        ]);
        currentStepIndex++;

        // 构建用户提示词
        const systemPrompt = generateSystemPrompt();

        const userPrompt = `## 项目基本信息
- 项目名称：${project.name}
- 参训人数：${project.participantCount ?? '未填写'}
- 培训天数：${project.trainingDays ?? '未填写'}
- 培训课时：${project.trainingHours ?? '未填写'}
- 培训地点：${project.location || '未填写'}
- 开始日期：${project.startDate || '未填写'}
- 结束日期：${project.endDate || '未填写'}

## 数据库已有数据

### 讲师信息（共${allTeachers.length}条）
${formatDbDataForAI('teachers', allTeachers)}

### 场地信息（共${allVenues.length}条）
${formatDbDataForAI('venues', allVenues)}

### 课程模板（共${allCourseTemplates.length}条）
${formatDbDataForAI('courseTemplates', allCourseTemplates)}

### 参访基地（共${allVisitSites.length}条）
${formatDbDataForAI('visitSites', allVisitSites)}

### 本项目已有课程（共${projectCoursesList.length}条）
${formatDbDataForAI('projectCourses', projectCoursesList)}

## 上传的文件内容（共${fileData.length}个文件）

${fileData.map((file, index) => `### 文件${index + 1}：${file.name}\n\`\`\`\n${file.content}\n\`\`\`\n`).join('\n')}

${fileData.length === 0 ? '注意：该项目暂未上传任何文件材料。' : ''}

请分析以上文件内容，提取数据并返回JSON格式的结果。`;

        // Step 10: AI分析
        sendEvent(sendProgress('正在进行AI智能分析与整合...', BASE_STEPS.length));
        const config = new Config();
        const client = new LLMClient(config, customHeaders);
        const messages: Message[] = [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ];

        const response = await client.invoke(messages, {
          model: 'doubao-seed-1-6-251015',
          temperature: 0.2,
        });
        currentStepIndex++;

        // 解析AI响应
        let rawResult: Record<string, unknown> = {};
        try {
          const jsonMatch = response.content.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            rawResult = JSON.parse(jsonMatch[0]);
          }
        } catch (parseError) {
          console.error('解析AI响应失败:', parseError);
        }

        // 验证并清理AI结果
        const checkResult: CheckResult = {
          projectInfo: [],
          teachers: [],
          venues: [],
          courseTemplates: [],
          visitSites: [],
          projectCourses: [],
        };

        // 验证项目信息
        if (Array.isArray(rawResult.projectInfo)) {
          checkResult.projectInfo = rawResult.projectInfo.filter(
            (item: { field?: string; extractedValue?: unknown }) => 
              item.field && item.extractedValue !== undefined && item.extractedValue !== null
          );
        }

        // 验证各表数据
        type TableKey = 'teachers' | 'venues' | 'courseTemplates' | 'visitSites' | 'projectCourses';
        const tableKeys: TableKey[] = ['teachers', 'venues', 'courseTemplates', 'visitSites', 'projectCourses'];
        
        for (const key of tableKeys) {
          const rawItems = rawResult[key];
          if (Array.isArray(rawItems)) {
            const validatedItems: CheckResultItem[] = [];
            for (const item of rawItems) {
              const typedItem = item as {
                action?: string;
                data?: Record<string, unknown>;
                existingId?: string;
                reason?: string;
                source?: string;
                confidence?: string;
              };
              
              if (!typedItem.data || Object.keys(typedItem.data).length === 0 || !typedItem.data.name) {
                continue;
              }
              
              // 使用配置验证数据
              const validation = validateAIData(key, typedItem.data);
              
              // 对duration字段进行课时折算
              const processedData = processDurationField(key, validation.cleanedData) as Record<string, unknown>;
              
              const action: 'add' | 'update' = typedItem.action === 'update' ? 'update' : 'add';
              
              validatedItems.push({
                action,
                data: processedData,
                existingId: typedItem.existingId,
                reason: typedItem.reason || '',
                source: typedItem.source || '',
                confidence: (['high', 'medium', 'low'].includes(typedItem.confidence || '') ? typedItem.confidence : 'medium') as 'high' | 'medium' | 'low',
                validationErrors: validation.errors.length > 0 ? validation.errors : undefined,
              });
            }
            checkResult[key] = validatedItems;
          }
        }

        const totalChanges = 
          (checkResult.projectInfo?.length || 0) +
          checkResult.teachers.length + 
          checkResult.venues.length + 
          checkResult.courseTemplates.length + 
          checkResult.visitSites.length + 
          checkResult.projectCourses.length;

        // Step 11: 完成
        sendEvent(sendProgress('分析完成', BASE_STEPS.length));
        currentStepIndex++;

        // 发送最终结果
        sendEvent({
          type: 'result',
          step: 'complete',
          stepName: '分析完成',
          progress: 100,
          total: BASE_STEPS.length,
          data: {
            success: true,
            projectId,
            projectName: project.name,
            checkResult,
            totalChanges,
            hasChanges: totalChanges > 0,
            filesAnalyzed: fileData.length,
            schemaVersion: '1.0', // 标记使用的schema版本，便于后续升级
          },
        });

        controller.close();
      } catch (error) {
        console.error('AI归档检查失败:', error);
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({
          type: 'error',
          step: 'error',
          stepName: '分析失败',
          progress: 0,
          total: BASE_STEPS.length,
          data: { error: error instanceof Error ? error.message : '未知错误' },
        })}\n\n`));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
