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

// AI检查结果类型
interface CheckResult {
  teachers: {
    action: 'add' | 'update';
    data: {
      name: string;
      title?: string;
      expertise?: string;
      organization?: string;
      bio?: string;
      hourlyRate?: number;
    };
    existingId?: string;
    reason: string;
    source: string; // 数据来源文件
    confidence: 'high' | 'medium' | 'low'; // 数据置信度
  }[];
  venues: {
    action: 'add' | 'update';
    data: {
      name: string;
      location?: string;
      capacity?: number;
      facilities?: string;
    };
    existingId?: string;
    reason: string;
    source: string;
    confidence: 'high' | 'medium' | 'low';
  }[];
  courseTemplates: {
    action: 'add' | 'update';
    data: {
      name: string;
      category?: string;
      description?: string;
      duration?: number;
      targetAudience?: string;
      content?: string;
    };
    existingId?: string;
    reason: string;
    source: string;
    confidence: 'high' | 'medium' | 'low';
  }[];
  visitSites: {
    action: 'add' | 'update';
    data: {
      name: string;
      type?: string;
      industry?: string;
      address?: string;
      contactPerson?: string;
      contactPhone?: string;
      description?: string;
      visitContent?: string;
    };
    existingId?: string;
    reason: string;
    source: string;
    confidence: 'high' | 'medium' | 'low';
  }[];
  projectCourses: {
    action: 'add' | 'update';
    data: {
      name: string;
      type: string;
      day?: number;
      startTime?: string;
      endTime?: string;
      duration?: number;
      description?: string;
      teacherName?: string;
      visitSiteName?: string;
    };
    existingId?: string;
    reason: string;
    source: string;
    confidence: 'high' | 'medium' | 'low';
  }[];
  projectInfo: {
    field: string;
    fieldName: string;
    currentValue: string | number | null;
    extractedValue: string | number;
    source: string;
    reason: string;
  }[];
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
    
    return textContent.substring(0, 10000); // 增加到10000字符
  } catch (error) {
    console.error('读取文件失败:', error);
    return '';
  }
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

        // 构建数据库数据摘要（包含完整信息用于AI比对）
        const dbDataSummary = {
          teachers: allTeachers.map(t => ({
            id: t.id,
            name: t.name,
            title: t.title || '',
            expertise: t.expertise || '',
            organization: t.organization || '',
            bio: t.bio || '',
            hourlyRate: t.hourlyRate,
          })),
          venues: allVenues.map(v => ({
            id: v.id,
            name: v.name,
            location: v.location || '',
            capacity: v.capacity,
            facilities: v.facilities || '',
          })),
          courseTemplates: allCourseTemplates.map(c => ({
            id: c.id,
            name: c.name,
            category: c.category || '',
            description: c.description || '',
            duration: c.duration,
            targetAudience: c.targetAudience || '',
          })),
          visitSites: allVisitSites.map(s => ({
            id: s.id,
            name: s.name,
            type: s.type || '',
            industry: s.industry || '',
            address: s.address || '',
            contactPerson: s.contactPerson || '',
            contactPhone: s.contactPhone || '',
          })),
          projectCourses: projectCoursesList.map(c => ({
            id: c.id,
            name: c.name,
            type: c.type,
            day: c.day,
            duration: c.duration,
            description: c.description || '',
          })),
        };

        // 构建AI提示词（优化版：整合多文件信息）
        const systemPrompt = `你是一个专业的培训项目数据分析师。你的任务是：
1. 分析所有上传文件的内容
2. **整合多个文件中提取的信息**，对于同一实体（如同一专家、同一场地），找出最完整、最准确的信息
3. 与数据库中已有的数据进行比对
4. 返回需要新增或更新的数据

## 数据处理原则（非常重要）

### 信息整合原则
- 同一专家/场地/课程可能在多个文件中出现，需要**整合所有信息**
- 优先选择信息最完整的来源（如：专家介绍文件通常比合同文件更详细）
- 对于冲突的信息，优先采用专业文档（专家介绍、项目申报书）中的信息

### 数据来源标注
- 每条数据必须标注source字段，说明数据来自哪个文件
- confidence字段表示数据置信度：
  - high: 来源文件专门描述该数据（如专家介绍文件中的专家信息）
  - medium: 来源文件明确提及但信息不完整
  - low: 来源文件只是间接提及

### 匹配判断标准
- 讲师匹配：姓名相同即为同一人，需要比对职称、专业、单位等信息是否需要更新
- 场地匹配：名称相同即为同一场地
- 课程模板匹配：名称相似度>80%视为同一课程
- 参访基地匹配：名称相同即为同一基地

## 需要提取的数据类型

### 0. 项目基本信息（projectInfo）
从文件中提取：参训人数、培训天数、培训课时、培训时段、培训地点、开始日期、结束日期
注意：学员名单可以统计出准确的参训人数

### 1. 讲师信息（teachers）
重点关注：专家介绍文件、项目申报书、合同文件
提取：姓名、职称、专业领域、所属单位、简介、课时费

### 2. 场地信息（venues）
重点关注：合同文件、项目申报书
提取：名称、位置、容纳人数、配套设施

### 3. 课程模板（courseTemplates）
重点关注：项目申报书、课程安排文件
提取：名称、类别、描述、时长、目标受众

### 4. 参访基地（visitSites）
重点关注：项目申报书、参访安排文件
提取：名称、类型、行业、地址、联系人、联系电话

### 5. 项目课程（projectCourses）
重点关注：课程安排文件、项目申报书
提取：课程名称、类型、天次、时间、时长、讲师、参访地点

## 输出格式
返回JSON格式：
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
    "action": "add/update", 
    "data": { "name": "xxx", "title": "xxx", ... }, 
    "existingId": "如果是更新，填写已有记录的ID",
    "reason": "判断理由", 
    "source": "数据来源文件名",
    "confidence": "high/medium/low"
  }],
  "venues": [...],
  "courseTemplates": [...],
  "visitSites": [...],
  "projectCourses": [...]
}

**重要提醒**：
- 专家介绍文件中的专家信息通常是最完整的，要充分利用
- 如果数据库中已有同名专家，检查是否需要补充职称、专业领域、简介等信息
- 只有真正有价值的新增或更新才返回，避免返回重复或无效数据`;

        let userPrompt = `## 项目基本信息
- 项目名称：${project.name}
- 参训人数：${project.participantCount ?? '未填写'}
- 培训天数：${project.trainingDays ?? '未填写'}
- 培训课时：${project.trainingHours ?? '未填写'}
- 培训地点：${project.location || '未填写'}
- 开始日期：${project.startDate || '未填写'}
- 结束日期：${project.endDate || '未填写'}

## 数据库已有数据

### 讲师信息（共${dbDataSummary.teachers.length}条）
${dbDataSummary.teachers.map((t, i) => `${i + 1}. ID:${t.id} 姓名:${t.name} 职称:${t.title || '未填写'} 专业:${t.expertise || '未填写'} 单位:${t.organization || '未填写'} 简介:${(t.bio || '').substring(0, 50)}...`).join('\n')}

### 场地信息（共${dbDataSummary.venues.length}条）
${dbDataSummary.venues.map((v, i) => `${i + 1}. ID:${v.id} 名称:${v.name} 位置:${v.location || '未填写'} 容量:${v.capacity || '未填写'}`).join('\n')}

### 课程模板（共${dbDataSummary.courseTemplates.length}条）
${dbDataSummary.courseTemplates.map((c, i) => `${i + 1}. ID:${c.id} 名称:${c.name} 类别:${c.category || '未填写'} 时长:${c.duration || '未填写'}课时`).join('\n')}

### 参访基地（共${dbDataSummary.visitSites.length}条）
${dbDataSummary.visitSites.map((s, i) => `${i + 1}. ID:${s.id} 名称:${s.name} 类型:${s.type} 行业:${s.industry || '未填写'}`).join('\n')}

### 本项目已有课程（共${dbDataSummary.projectCourses.length}条）
${dbDataSummary.projectCourses.map((c, i) => `${i + 1}. ID:${c.id} 名称:${c.name} 类型:${c.type} 第${c.day || '?'}天`).join('\n')}

## 上传的文件内容（共${fileData.length}个文件）

`;

        // 添加所有文件内容
        fileData.forEach((file, index) => {
          userPrompt += `\n### 文件${index + 1}：${file.name}\n\`\`\`\n${file.content}\n\`\`\`\n`;
        });

        if (fileData.length === 0) {
          userPrompt += `\n注意：该项目暂未上传任何文件材料。`;
        }

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
          temperature: 0.2, // 降低温度以提高准确性
        });
        currentStepIndex++;

        // 解析AI响应
        let checkResult: CheckResult = {
          projectInfo: [],
          teachers: [],
          venues: [],
          courseTemplates: [],
          visitSites: [],
          projectCourses: [],
        };

        try {
          const jsonMatch = response.content.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            checkResult = JSON.parse(jsonMatch[0]);
          }
        } catch (parseError) {
          console.error('解析AI响应失败:', parseError);
        }

        // 过滤无效结果
        const filterValidResults = <T extends { data: Record<string, unknown>; confidence?: string }>(items: T[]): T[] => 
          items.filter(item => item.data && Object.keys(item.data).length > 0 && item.data.name);

        if (checkResult.projectInfo) {
          checkResult.projectInfo = checkResult.projectInfo.filter(item => 
            item.field && item.extractedValue !== undefined && item.extractedValue !== null
          );
        } else {
          checkResult.projectInfo = [];
        }

        checkResult.teachers = filterValidResults(checkResult.teachers || []);
        checkResult.venues = filterValidResults(checkResult.venues || []);
        checkResult.courseTemplates = filterValidResults(checkResult.courseTemplates || []);
        checkResult.visitSites = filterValidResults(checkResult.visitSites || []);
        checkResult.projectCourses = filterValidResults(checkResult.projectCourses || []);

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
