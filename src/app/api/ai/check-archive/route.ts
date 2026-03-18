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
  satisfactionSurveys,
  surveyResponses,
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
  progress: number; // 0-100
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

// 进度步骤定义
const PROGRESS_STEPS = [
  { step: 'init', name: '初始化数据库连接' },
  { step: 'project', name: '获取项目信息' },
  { step: 'contract', name: '解析合同文件' },
  { step: 'cost', name: '解析成本测算表' },
  { step: 'declaration', name: '解析项目申报书' },
  { step: 'studentList', name: '解析学员名单' },
  { step: 'satisfaction', name: '解析满意度调查' },
  { step: 'database', name: '获取数据库数据' },
  { step: 'ai', name: 'AI智能分析' },
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
    
    return textContent.substring(0, 8000);
  } catch (error) {
    console.error('读取文件失败:', error);
    return '';
  }
}

// 创建进度发送器
function createProgressSender(
  encoder: TextEncoder,
  totalSteps: number
): (stepIndex: number, stepName: string, data?: unknown) => void {
  return (stepIndex: number, stepName: string, data?: unknown) => {
    // 在controller中发送，这里只返回事件数据
    return {
      type: 'progress' as const,
      step: PROGRESS_STEPS[stepIndex]?.step || 'unknown',
      stepName,
      progress: Math.round(((stepIndex + 1) / totalSteps) * 100),
      total: totalSteps,
      data,
    };
  };
}

export async function POST(request: NextRequest) {
  const encoder = new TextEncoder();
  const totalSteps = PROGRESS_STEPS.length;
  let currentStepIndex = 0;
  
  // 发送进度事件的辅助函数
  const sendProgress = (stepName: string, data?: unknown): ProgressEvent => ({
    type: 'progress',
    step: PROGRESS_STEPS[currentStepIndex]?.step || 'unknown',
    stepName,
    progress: Math.round(((currentStepIndex + 1) / totalSteps) * 100),
    total: totalSteps,
    data,
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
          sendEvent({ type: 'error', step: 'init', stepName: '参数错误', progress: 0, total: totalSteps, data: { error: '缺少项目ID' } });
          controller.close();
          return;
        }

        // Step 1: 初始化数据库
        sendEvent(sendProgress('正在初始化数据库连接...'));
        await ensureDatabaseReady();
        currentStepIndex++;

        // Step 2: 获取项目信息
        sendEvent(sendProgress('正在获取项目信息...'));
        const db = getDb();
        const projectList = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);

        if (!projectList[0]) {
          sendEvent({ type: 'error', step: 'project', stepName: '项目不存在', progress: 10, total: totalSteps, data: { error: '项目不存在' } });
          controller.close();
          return;
        }
        const project = projectList[0];
        currentStepIndex++;

        // 收集文件内容
        const fileContents: Record<string, string> = {};

        // Step 3: 解析合同文件
        sendEvent(sendProgress('正在解析合同文件...'));
        if (project.contractFilePdf) {
          fileContents.contract = await readFileContent(project.contractFilePdf, customHeaders);
        }
        currentStepIndex++;

        // Step 4: 解析成本测算表
        sendEvent(sendProgress('正在解析成本测算表...'));
        if (project.costFilePdf) {
          fileContents.cost = await readFileContent(project.costFilePdf, customHeaders);
        } else if (project.costFileExcel) {
          fileContents.cost = await readFileContent(project.costFileExcel, customHeaders);
        }
        currentStepIndex++;

        // Step 5: 解析项目申报书
        sendEvent(sendProgress('正在解析项目申报书...'));
        if (project.declarationFilePdf) {
          fileContents.declaration = await readFileContent(project.declarationFilePdf, customHeaders);
        }
        currentStepIndex++;

        // Step 6: 解析学员名单
        sendEvent(sendProgress('正在解析学员名单...'));
        if (project.studentListFile) {
          fileContents.studentList = await readFileContent(project.studentListFile, customHeaders);
        }
        currentStepIndex++;

        // Step 7: 解析满意度调查
        sendEvent(sendProgress('正在解析满意度调查...'));
        if (project.satisfactionSurveyFile) {
          fileContents.satisfaction = await readFileContent(project.satisfactionSurveyFile, customHeaders);
        }
        currentStepIndex++;

        // Step 8: 获取数据库数据
        sendEvent(sendProgress('正在获取数据库数据...'));
        const [allTeachers, allVenues, allCourseTemplates, allVisitSites, projectCoursesList] = await Promise.all([
          db.select().from(teachers),
          db.select().from(venues),
          db.select().from(courseTemplates),
          db.select().from(visitSites),
          db.select().from(projectCourses).where(eq(projectCourses.projectId, projectId)),
        ]);
        currentStepIndex++;

        // 构建数据库数据摘要
        const dbDataSummary = {
          teachers: allTeachers.map(t => ({ id: t.id, name: t.name, title: t.title, expertise: t.expertise, organization: t.organization })),
          venues: allVenues.map(v => ({ id: v.id, name: v.name, location: v.location, capacity: v.capacity })),
          courseTemplates: allCourseTemplates.map(c => ({ id: c.id, name: c.name, category: c.category, duration: c.duration })),
          visitSites: allVisitSites.map(s => ({ id: s.id, name: s.name, type: s.type, industry: s.industry })),
          projectCourses: projectCoursesList.map(c => ({ id: c.id, name: c.name, type: c.type, day: c.day })),
        };

        // 构建AI提示词
        const systemPrompt = `你是一个专业的培训项目数据分析师。分析项目上传的文件内容，与系统数据库中已有的数据进行比对，找出需要新增或更新的数据。

检查以下数据类型：
0. 项目基本信息（projectInfo）：参训人数、培训天数、培训课时、培训时段、培训地点、开始日期、结束日期
1. 讲师信息（teachers）：姓名、职称、专业领域、所属单位
2. 场地信息（venues）：名称、位置、容纳人数、配套设施
3. 课程模板（courseTemplates）：名称、类别、描述、时长
4. 参访基地（visitSites）：名称、类型、行业、地址
5. 项目课程（projectCourses）：课程名称、类型、天次、时长

返回JSON格式：
{
  "projectInfo": [{ "field": "字段名", "fieldName": "字段中文名", "currentValue": "当前值", "extractedValue": "提取值", "source": "来源文件", "reason": "更新理由" }],
  "teachers": [{ "action": "add/update", "data": {...}, "existingId": "ID", "reason": "理由" }],
  "venues": [...],
  "courseTemplates": [...],
  "visitSites": [...],
  "projectCourses": [...]
}`;

        let userPrompt = `## 项目基本信息
- 项目名称：${project.name}
- 参训人数：${project.participantCount ?? '未填写'}
- 培训天数：${project.trainingDays ?? '未填写'}
- 培训课时：${project.trainingHours ?? '未填写'}
- 培训地点：${project.location || '未填写'}
- 开始日期：${project.startDate || '未填写'}
- 结束日期：${project.endDate || '未填写'}

## 数据库数据
讲师(${dbDataSummary.teachers.length})、场地(${dbDataSummary.venues.length})、课程模板(${dbDataSummary.courseTemplates.length})、参访基地(${dbDataSummary.visitSites.length})

## 文件内容
`;
        if (fileContents.contract) userPrompt += `\n### 合同\n${fileContents.contract.substring(0, 2000)}\n`;
        if (fileContents.cost) userPrompt += `\n### 成本测算表\n${fileContents.cost.substring(0, 2000)}\n`;
        if (fileContents.declaration) userPrompt += `\n### 项目申报书\n${fileContents.declaration.substring(0, 2000)}\n`;
        if (fileContents.studentList) userPrompt += `\n### 学员名单\n${fileContents.studentList.substring(0, 2000)}\n`;
        if (fileContents.satisfaction) userPrompt += `\n### 满意度调查\n${fileContents.satisfaction.substring(0, 2000)}\n`;

        if (Object.keys(fileContents).length === 0) {
          userPrompt += `\n注意：该项目暂未上传任何文件材料。`;
        }

        // Step 9: AI分析
        sendEvent(sendProgress('正在进行AI智能分析...'));
        const config = new Config();
        const client = new LLMClient(config, customHeaders);
        const messages: Message[] = [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ];

        const response = await client.invoke(messages, {
          model: 'doubao-seed-1-6-251015',
          temperature: 0.3,
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
        const filterValidResults = <T extends { data: Record<string, unknown> }>(items: T[]): T[] => 
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

        // Step 10: 完成
        sendEvent(sendProgress('分析完成'));
        currentStepIndex++;

        // 发送最终结果
        sendEvent({
          type: 'result',
          step: 'complete',
          stepName: '分析完成',
          progress: 100,
          total: totalSteps,
          data: {
            success: true,
            projectId,
            projectName: project.name,
            checkResult,
            totalChanges,
            hasChanges: totalChanges > 0,
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
          total: totalSteps,
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
