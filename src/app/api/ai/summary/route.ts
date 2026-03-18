import { NextRequest, NextResponse } from 'next/server';
import { LLMClient, FetchClient, Config, HeaderUtils, Message } from 'coze-coding-dev-sdk';
import { S3Storage } from 'coze-coding-dev-sdk';
import { getDb, saveDatabaseImmediate, ensureDatabaseReady } from '@/storage/database';
import { projects, courses, teachers } from '@/storage/database/schema';
import { eq, and } from 'drizzle-orm';

// 初始化对象存储
const storage = new S3Storage({
  endpointUrl: process.env.COZE_BUCKET_ENDPOINT_URL,
  accessKey: '',
  secretKey: '',
  bucketName: process.env.COZE_BUCKET_NAME,
  region: 'cn-beijing',
});

// 读取并解析文件内容（支持PDF、Word、Excel等）
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

// 分析上传的文件并生成报告
export async function POST(request: NextRequest) {
  try {
    // 确保数据库已初始化
    await ensureDatabaseReady();
    
    const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);
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

    // 获取课程信息
    const coursesList = await db.select().from(courses).where(and(eq(courses.projectId, projectId), eq(courses.isTemplate, false)));

    // 获取讲师ID列表
    const teacherIds = [...new Set(coursesList.map(c => c.teacherId).filter((id): id is string => id !== null))];
    
    // 获取讲师信息
    let teacherList: (typeof teachers.$inferSelect)[] = [];
    if (teacherIds.length > 0) {
      // 简化处理，获取所有讲师后过滤
      const allTeachers = await db.select().from(teachers);
      teacherList = allTeachers.filter(t => teacherIds.includes(t.id));
    }

    // 收集上传文件的内容
    const fileContents: Record<string, string> = {};
    
    // 合同文件（优先PDF，其次Word）
    if (project.contractFilePdf) {
      fileContents.contract = await readFileContent(project.contractFilePdf, customHeaders);
    } else if (project.contractFileWord) {
      fileContents.contract = await readFileContent(project.contractFileWord, customHeaders);
    }
    // 成本测算表（优先PDF，其次Excel）
    if (project.costFilePdf) {
      fileContents.cost = await readFileContent(project.costFilePdf, customHeaders);
    } else if (project.costFileExcel) {
      fileContents.cost = await readFileContent(project.costFileExcel, customHeaders);
    }
    // 项目申报书（优先PDF，其次Word）
    if (project.declarationFilePdf) {
      fileContents.declaration = await readFileContent(project.declarationFilePdf, customHeaders);
    } else if (project.declarationFileWord) {
      fileContents.declaration = await readFileContent(project.declarationFileWord, customHeaders);
    }
    if (project.studentListFile) {
      fileContents.studentList = await readFileContent(project.studentListFile, customHeaders);
    }
    if (project.satisfactionSurveyFile) {
      fileContents.satisfaction = await readFileContent(project.satisfactionSurveyFile, customHeaders);
    }

    // 解析其它附件
    const otherMaterials: { key: string; name: string }[] = project.otherMaterials 
      ? JSON.parse(project.otherMaterials) 
      : [];
    
    const otherFileContents: { name: string; content: string }[] = [];
    for (const material of otherMaterials) {
      const content = await readFileContent(material.key, customHeaders);
      if (content) {
        otherFileContents.push({ name: material.name, content });
      }
    }

    // 构建AI提示词
    const systemPrompt = `你是一个专业的培训项目分析师。请根据提供的项目信息和上传的材料，生成一份详细的项目总结报告。

报告应包含以下内容：
1. 项目基本信息总结（项目名称、培训目标、参训人数、培训时间等）
2. 课程实施情况（课程设置、讲师安排、课时分配）
3. 费用分析（各项费用明细、预算执行情况）
4. 满意度分析（如果提供了满意度调查数据）
5. 项目亮点与成效
6. 存在问题与改进建议

同时，请从材料中提取以下可补入系统的数据（以JSON格式返回）：
- 实际参训人数（actualParticipantCount）
- 实际费用（actualCost）
- 平均满意度（avgSatisfaction）
- 调查响应率（surveyResponseRate）
- 其他关键指标

请使用JSON格式返回结果：
{
  "report": "项目总结报告的完整文本内容",
  "extractedData": {
    "actualParticipantCount": 数字或null,
    "actualCost": 数字或null,
    "avgSatisfaction": 数字或null,
    "surveyResponseRate": 数字或null,
    "其他字段": "值"
  }
}`;

    let userPrompt = `项目基本信息：
- 项目名称：${project.name}
- 培训目标：${project.trainingTarget || '未填写'}
- 目标人群：${project.targetAudience || '未填写'}
- 计划参训人数：${project.participantCount || '未填写'}
- 培训天数：${project.trainingDays || '未填写'}
- 培训课时：${project.trainingHours || '未填写'}
- 培训时段：${project.trainingPeriod || '未填写'}
- 预算范围：${project.budgetMin || ''}-${project.budgetMax || ''}元
- 培训地点：${project.location || '未填写'}
- 特殊要求：${project.specialRequirements || '无'}
- 开始日期：${project.startDate || '未确定'}
- 结束日期：${project.endDate || '未确定'}

费用信息：
- 讲师费：${project.teacherFee || 0}元
- 场地费：${project.venueFee || 0}元
- 餐饮费：${project.cateringFee || 0}元
- 茶歇费：${project.teaBreakFee || 0}元
- 资料费：${project.materialFee || 0}元
- 人工费：${project.laborFee || 0}元
- 其他费用：${project.otherFee || 0}元
- 管理费：${project.managementFee || 0}元
- 总预算：${project.totalBudget || 0}元

课程信息：`;

    coursesList.forEach((course, index) => {
      const courseTeacher = teacherList.find(t => t.id === course.teacherId);
      userPrompt += `
${index + 1}. ${course.name}
   - 天次：第${course.day || 1}天
   - 课时：${course.duration || 0}课时
   - 讲师：${courseTeacher?.name || '待定'}
   - 描述：${course.description || '无'}`;
    });

    if (teacherList.length > 0) {
      userPrompt += '\n\n讲师信息：';
      teacherList.forEach((teacher, index) => {
        userPrompt += `
${index + 1}. ${teacher.name}
   - 职称：${teacher.title || '未知'}
   - 单位：${teacher.organization || '未知'}`;
      });
    }

    // 添加上传文件的内容
    const hasFileContent = Object.keys(fileContents).length > 0 || otherFileContents.length > 0;
    
    if (hasFileContent) {
      userPrompt += '\n\n上传的材料内容：';
      
      if (fileContents.contract) {
        userPrompt += `\n\n【合同文件内容】\n${fileContents.contract}\n`;
      }
      if (fileContents.cost) {
        userPrompt += `\n\n【成本测算表内容】\n${fileContents.cost}\n`;
      }
      if (fileContents.declaration) {
        userPrompt += `\n\n【项目申报书内容】\n${fileContents.declaration}\n`;
      }
      if (fileContents.studentList) {
        userPrompt += `\n\n【学员名单内容】\n${fileContents.studentList}\n`;
      }
      if (fileContents.satisfaction) {
        userPrompt += `\n\n【满意度调查结果】\n${fileContents.satisfaction}\n`;
      }
      
      // 添加其它附件内容
      otherFileContents.forEach((file) => {
        userPrompt += `\n\n【${file.name}内容】\n${file.content}\n`;
      });
    } else {
      userPrompt += '\n\n注意：该项目暂未上传任何材料，请基于项目基本信息生成报告框架。';
    }

    // 调用LLM生成报告
    const config = new Config();
    const client = new LLMClient(config, customHeaders);

    const messages: Message[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ];

    const response = await client.invoke(messages, {
      model: 'doubao-seed-1-6-251015',
      temperature: 0.7,
    });

    // 解析AI响应
    let result;
    try {
      // 尝试从响应中提取JSON
      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[0]);
      } else {
        // 如果没有找到JSON格式，直接使用整个响应作为报告
        result = {
          report: response.content,
          extractedData: {},
        };
      }
    } catch {
      // 解析失败，使用整个响应作为报告
      result = {
        report: response.content,
        extractedData: {},
      };
    }

    // 保存报告到数据库
    await db.update(projects)
      .set({ summaryReport: JSON.stringify(result), updatedAt: new Date().toISOString() })
      .where(eq(projects.id, projectId));
    saveDatabaseImmediate();

    return NextResponse.json({ data: result });
  } catch (error) {
    console.error('生成总结报告失败:', error);
    return NextResponse.json({ 
      error: '生成总结报告失败', 
      message: error instanceof Error ? error.message : '未知错误' 
    }, { status: 500 });
  }
}
