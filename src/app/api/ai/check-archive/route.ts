import { NextRequest, NextResponse } from 'next/server';
import { LLMClient, Config, HeaderUtils, Message } from 'coze-coding-dev-sdk';
import { S3Storage } from 'coze-coding-dev-sdk';
import { getDb } from '@/storage/database';
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

// 读取文件内容
async function readFileContent(fileKey: string): Promise<string> {
  try {
    const buffer = await storage.readFile({ fileKey });
    const content = buffer.toString('utf-8');
    // 限制内容长度，避免超过token限制
    return content.substring(0, 8000);
  } catch (error) {
    console.error('读取文件失败:', error);
    return '';
  }
}

// 读取文件为Base64（用于图片和PDF）
async function readFileAsBase64(fileKey: string): Promise<string | null> {
  try {
    const buffer = await storage.readFile({ fileKey });
    return buffer.toString('base64');
  } catch (error) {
    console.error('读取文件失败:', error);
    return null;
  }
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
}

export async function POST(request: NextRequest) {
  try {
    const { projectId } = await request.json();

    if (!projectId) {
      return NextResponse.json({ error: '缺少项目ID' }, { status: 400 });
    }

    // 获取项目信息
    const db = getDb();
    const projectList = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);

    if (!projectList[0]) {
      return NextResponse.json({ error: '项目不存在' }, { status: 404 });
    }

    const project = projectList[0];

    // 收集上传的文件内容和URL
    const fileContents: Record<string, string> = {};
    const fileUrls: Record<string, string> = {};
    
    // 合同文件
    if (project.contractFilePdf) {
      fileContents.contract = await readFileContent(project.contractFilePdf);
      fileUrls.contract = project.contractFilePdf;
    }
    // 成本测算表
    if (project.costFilePdf) {
      fileContents.cost = await readFileContent(project.costFilePdf);
      fileUrls.cost = project.costFilePdf;
    } else if (project.costFileExcel) {
      fileContents.cost = await readFileContent(project.costFileExcel);
      fileUrls.cost = project.costFileExcel;
    }
    // 项目申报书
    if (project.declarationFilePdf) {
      fileContents.declaration = await readFileContent(project.declarationFilePdf);
      fileUrls.declaration = project.declarationFilePdf;
    }
    // 学员名单
    if (project.studentListFile) {
      fileContents.studentList = await readFileContent(project.studentListFile);
      fileUrls.studentList = project.studentListFile;
    }
    // 满意度调查
    if (project.satisfactionSurveyFile) {
      fileContents.satisfaction = await readFileContent(project.satisfactionSurveyFile);
      fileUrls.satisfaction = project.satisfactionSurveyFile;
    }

    // 获取数据库中的相关数据
    const [
      allTeachers,
      allVenues,
      allCourseTemplates,
      allVisitSites,
      projectCoursesList,
      projectSurveys,
      projectResponses,
    ] = await Promise.all([
      db.select().from(teachers),
      db.select().from(venues),
      db.select().from(courseTemplates),
      db.select().from(visitSites),
      db.select().from(projectCourses).where(eq(projectCourses.projectId, projectId)),
      db.select().from(satisfactionSurveys).where(eq(satisfactionSurveys.projectId, projectId)),
      db.select().from(surveyResponses).where(eq(surveyResponses.projectId, projectId)),
    ]);

    // 构建数据库数据摘要
    const dbDataSummary = {
      teachers: allTeachers.map(t => ({
        id: t.id,
        name: t.name,
        title: t.title,
        expertise: t.expertise,
        organization: t.organization,
        hourlyRate: t.hourlyRate,
      })),
      venues: allVenues.map(v => ({
        id: v.id,
        name: v.name,
        location: v.location,
        capacity: v.capacity,
        facilities: v.facilities,
      })),
      courseTemplates: allCourseTemplates.map(c => ({
        id: c.id,
        name: c.name,
        category: c.category,
        description: c.description,
        duration: c.duration,
        targetAudience: c.targetAudience,
      })),
      visitSites: allVisitSites.map(s => ({
        id: s.id,
        name: s.name,
        type: s.type,
        industry: s.industry,
        address: s.address,
        contactPerson: s.contactPerson,
        contactPhone: s.contactPhone,
      })),
      projectCourses: projectCoursesList.map(c => ({
        id: c.id,
        name: c.name,
        type: c.type,
        day: c.day,
        duration: c.duration,
        description: c.description,
      })),
    };

    // 构建AI提示词
    const systemPrompt = `你是一个专业的培训项目数据分析师。你的任务是分析项目上传的文件内容，与系统数据库中已有的数据进行比对，找出需要新增或更新的数据。

你需要检查以下几类数据：

1. **讲师信息（teachers）**：
   - 从文件中识别讲师姓名、职称、专业领域、所属单位、简介、课时费等信息
   - 对比数据库中已有的讲师，判断是新增还是更新

2. **场地信息（venues）**：
   - 识别培训场地名称、位置、容纳人数、配套设施等
   - 对比数据库已有场地，判断是新增还是更新

3. **课程模板（courseTemplates）**：
   - 识别课程名称、类别、描述、时长、目标受众、课程内容等
   - 对比数据库已有模板，判断是新增还是更新

4. **参访基地/单位（visitSites）**：
   - 识别参访单位名称、类型、行业、地址、联系人、联系电话等
   - 对比数据库已有基地，判断是新增还是更新

5. **项目课程（projectCourses）**：
   - 识别具体的项目课程安排，包括课程名称、类型、天次、时间、时长、描述等
   - 对比项目已有的课程安排，判断是新增还是更新

**输出格式要求**：
返回JSON格式的结果，包含以下字段：
{
  "teachers": [
    {
      "action": "add" 或 "update",
      "data": { "name": "xxx", "title": "xxx", ... },
      "existingId": "如果是更新，填写已有记录的ID",
      "reason": "判断理由"
    }
  ],
  "venues": [...],
  "courseTemplates": [...],
  "visitSites": [...],
  "projectCourses": [...]
}

**判断标准**：
- 如果数据库中存在同名记录，且文件中的信息更完整或有更新，标记为"update"
- 如果数据库中不存在同名记录，标记为"add"
- 如果信息完全一致，则不需要返回该项
- 只有当确实有新增或有价值的信息时才返回结果

请仔细分析文件内容，准确提取数据，避免臆造信息。`;

    let userPrompt = `## 项目基本信息
- 项目名称：${project.name}
- 培训目标：${project.trainingTarget || '未填写'}
- 目标人群：${project.targetAudience || '未填写'}
- 参训人数：${project.participantCount || '未填写'}
- 培训天数：${project.trainingDays || '未填写'}
- 培训地点：${project.location || '未填写'}

## 数据库中已有的数据

### 讲师信息（共${dbDataSummary.teachers.length}条）
${dbDataSummary.teachers.map((t, i) => `${i + 1}. ID:${t.id} 姓名:${t.name} 职称:${t.title || '未知'} 专业:${t.expertise || '未知'} 单位:${t.organization || '未知'}`).join('\n')}

### 场地信息（共${dbDataSummary.venues.length}条）
${dbDataSummary.venues.map((v, i) => `${i + 1}. ID:${v.id} 名称:${v.name} 位置:${v.location || '未知'} 容量:${v.capacity || '未知'}`).join('\n')}

### 课程模板（共${dbDataSummary.courseTemplates.length}条）
${dbDataSummary.courseTemplates.map((c, i) => `${i + 1}. ID:${c.id} 名称:${c.name} 类别:${c.category || '未知'} 时长:${c.duration || '未知'}课时`).join('\n')}

### 参访基地（共${dbDataSummary.visitSites.length}条）
${dbDataSummary.visitSites.map((s, i) => `${i + 1}. ID:${s.id} 名称:${s.name} 类型:${s.type} 行业:${s.industry || '未知'}`).join('\n')}

### 本项目已有课程（共${dbDataSummary.projectCourses.length}条）
${dbDataSummary.projectCourses.map((c, i) => `${i + 1}. ID:${c.id} 名称:${c.name} 类型:${c.type} 第${c.day || '?'}天 时长:${c.duration || '?'}课时`).join('\n')}

## 上传的文件内容

`;

    // 添加文件内容
    if (fileContents.contract) {
      userPrompt += `### 合同文件内容
\`\`\`
${fileContents.contract}
\`\`\`

`;
    }
    if (fileContents.cost) {
      userPrompt += `### 成本测算表内容
\`\`\`
${fileContents.cost}
\`\`\`

`;
    }
    if (fileContents.declaration) {
      userPrompt += `### 项目申报书内容
\`\`\`
${fileContents.declaration}
\`\`\`

`;
    }
    if (fileContents.studentList) {
      userPrompt += `### 学员名单内容
\`\`\`
${fileContents.studentList}
\`\`\`

`;
    }
    if (fileContents.satisfaction) {
      userPrompt += `### 满意度调查结果
\`\`\`
${fileContents.satisfaction}
\`\`\`

`;
    }

    if (Object.keys(fileContents).length === 0) {
      userPrompt += `注意：该项目暂未上传任何文件材料，无法进行数据比对分析。`;
    }

    // 调用LLM进行分析
    const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);
    const config = new Config();
    const client = new LLMClient(config, customHeaders);

    const messages: Message[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ];

    const response = await client.invoke(messages, {
      model: 'doubao-seed-1-6-251015',
      temperature: 0.3, // 使用较低温度以确保结果稳定
    });

    // 解析AI响应
    let checkResult: CheckResult = {
      teachers: [],
      venues: [],
      courseTemplates: [],
      visitSites: [],
      projectCourses: [],
    };

    try {
      // 尝试从响应中提取JSON
      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        checkResult = JSON.parse(jsonMatch[0]);
      }
    } catch (parseError) {
      console.error('解析AI响应失败:', parseError);
      // 解析失败时返回空结果
    }

    // 过滤掉无效的结果
    const filterValidResults = <T extends { data: Record<string, unknown> }>(items: T[]): T[] => {
      return items.filter(item => item.data && Object.keys(item.data).length > 0 && item.data.name);
    };

    checkResult.teachers = filterValidResults(checkResult.teachers);
    checkResult.venues = filterValidResults(checkResult.venues);
    checkResult.courseTemplates = filterValidResults(checkResult.courseTemplates);
    checkResult.visitSites = filterValidResults(checkResult.visitSites);
    checkResult.projectCourses = filterValidResults(checkResult.projectCourses);

    // 计算总变更数量
    const totalChanges = 
      checkResult.teachers.length + 
      checkResult.venues.length + 
      checkResult.courseTemplates.length + 
      checkResult.visitSites.length + 
      checkResult.projectCourses.length;

    return NextResponse.json({
      success: true,
      projectId,
      projectName: project.name,
      checkResult,
      totalChanges,
      hasChanges: totalChanges > 0,
    });
  } catch (error) {
    console.error('AI归档检查失败:', error);
    return NextResponse.json({ 
      error: 'AI检查失败', 
      message: error instanceof Error ? error.message : '未知错误' 
    }, { status: 500 });
  }
}
