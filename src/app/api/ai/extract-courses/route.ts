import { NextRequest } from 'next/server';
import { LLMClient, FetchClient, Config, HeaderUtils, Message } from 'coze-coding-dev-sdk';
import { S3Storage } from 'coze-coding-dev-sdk';
import { getDb, ensureDatabaseReady } from '@/storage/database';
import { projects, courses, teachers, visitSites } from '@/storage/database/schema';
import { eq } from 'drizzle-orm';

// 初始化对象存储
const storage = new S3Storage({
  endpointUrl: process.env.COZE_BUCKET_ENDPOINT_URL,
  accessKey: '',
  secretKey: '',
  bucketName: process.env.COZE_BUCKET_NAME,
  region: 'cn-beijing',
});

// 课程信息接口
interface ExtractedCourse {
  name: string;           // 课程名称
  day: number;            // 第几天
  duration: number;       // 课时数
  type: 'course' | 'visit' | 'break' | 'other';  // 类型
  description?: string;   // 课程描述
  teacherName?: string;   // 讲师姓名
  teacherTitle?: string;  // 讲师职称（建议职称）
  visitSiteName?: string; // 参访地点名称
  visitAddress?: string;  // 参访地址
  startTime?: string;     // 开始时间
  endTime?: string;       // 结束时间
}

interface ExtractionResult {
  success: boolean;
  courses: ExtractedCourse[];
  totalHours: number;
  message?: string;
}

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
    
    return textContent.substring(0, 20000); // 课程安排表可能较长
  } catch (error) {
    console.error('读取文件失败:', error);
    return '';
  }
}

// AI系统提示词
function generateSystemPrompt(): string {
  return `你是一个专业的培训课程分析师。你的任务是从课程安排表中提取课程信息。

## 输出要求

### 课程信息字段
每门课程需要提取以下信息：
- **name**: 课程名称（必填）
- **day**: 第几天（数字，从1开始）
- **duration**: 课时数（数字，1课时=40-60分钟）
- **type**: 课程类型（course=理论课程, visit=参访活动, break=休息, other=其他）
- **description**: 课程描述/内容概要
- **teacherName**: 讲师姓名
- **teacherTitle**: 建议讲师职称（如：教授、副教授、高级工程师等）
- **visitSiteName**: 参访地点名称（仅参访类型）
- **visitAddress**: 参访地址（仅参访类型）
- **startTime**: 开始时间（如：09:00）
- **endTime**: 结束时间（如：11:00）

### 课时折算规则
- 1课时 = 40-60分钟
- 半天（3-4小时）= 4课时
- 2小时左右 = 2课时
- 1小时左右 = 1课时
- 自动将分钟数折算为课时，四舍五入到0.5的倍数

### 提取规则
1. **按时间顺序排列**：按照课程在文件中的时间顺序提取
2. **识别天数**：根据"第一天"、"Day 1"、"日期"等标识判断是第几天
3. **识别时间段**：上午、下午、或具体时间（09:00-11:00）
4. **区分课程类型**：
   - 理论授课、讲座、研讨 → course
   - 参观、考察、实地教学 → visit
   - 休息、用餐、自由活动 → break
   - 其他无法归类的 → other
5. **讲师信息**：
   - 如果有明确讲师姓名，提取到teacherName
   - 如果没有具体姓名但有职称要求，提取到teacherTitle
6. **参访信息**：
   - 参访类型的课程，提取参访地点和地址

### 输出格式
返回严格的JSON格式：
\`\`\`json
{
  "courses": [
    {
      "name": "课程名称",
      "day": 1,
      "duration": 4,
      "type": "course",
      "description": "课程描述",
      "teacherName": "张教授",
      "teacherTitle": "教授",
      "startTime": "09:00",
      "endTime": "12:00"
    }
  ],
  "totalHours": 32
}
\`\`\`

## 重要提示
1. **必须提取所有课程**：不要遗漏任何课程安排
2. **课时计算准确**：确保总课时数合理
3. **类型判断正确**：正确区分理论课和参访活动
4. **保持原始顺序**：按照文件中的顺序排列课程`;
}

export async function POST(request: NextRequest) {
  try {
    const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);
    const { projectId, fileKey, fileName } = await request.json();

    if (!projectId || !fileKey) {
      return Response.json({ error: '缺少必要参数' }, { status: 400 });
    }

    await ensureDatabaseReady();
    const db = getDb();

    // 获取项目信息
    const projectList = db.select().from(projects).where(eq(projects.id, projectId)).limit(1);
    const project = (await projectList)[0];
    
    if (!project) {
      return Response.json({ error: '项目不存在' }, { status: 404 });
    }

    // 读取文件内容
    const fileContent = await readFileContent(fileKey, customHeaders);
    if (!fileContent) {
      return Response.json({ error: '无法读取文件内容' }, { status: 400 });
    }

    // 获取讲师列表和参访基地列表（用于匹配）
    const allTeachers = db.select().from(teachers).all();
    const allVisitSites = db.select().from(visitSites).all();

    // 构建用户提示词
    const userPrompt = `## 项目基本信息
- 项目名称：${project.name}
- 培训天数：${project.trainingDays || '未指定'}
- 培训课时：${project.trainingHours || '未指定'}
- 参训人数：${project.participantCount || '未指定'}

## 讲师库（用于匹配讲师）
${allTeachers.map(t => `- ${t.name}（${t.title || '职称未知'}）`).join('\n') || '暂无讲师'}

## 参访基地库（用于匹配参访地点）
${allVisitSites.map(v => `- ${v.name}（${v.address || '地址未知'}）`).join('\n') || '暂无参访基地'}

## 待分析的课程安排表：${fileName || '课程安排表'}

\`\`\`
${fileContent}
\`\`\`

请提取所有课程安排信息，返回JSON格式的结果。`;

    // 调用AI
    const config = new Config({ timeout: 120000 });
    const client = new LLMClient(config, customHeaders);
    const messages: Message[] = [
      { role: 'system', content: generateSystemPrompt() },
      { role: 'user', content: userPrompt },
    ];

    let fullContent = '';
    try {
      const streamResponse = client.stream(messages, {
        model: 'doubao-seed-1-6-251015',
        temperature: 0.2,
      });

      for await (const chunk of streamResponse) {
        if (chunk.content) {
          fullContent += chunk.content.toString();
        }
      }
    } catch (streamError) {
      console.error('AI流式调用失败:', streamError);
      const response = await client.invoke(messages, {
        model: 'doubao-seed-1-6-251015',
        temperature: 0.2,
      });
      fullContent = response.content;
    }

    // 解析AI响应
    let result: ExtractionResult = {
      success: false,
      courses: [],
      totalHours: 0,
    };

    try {
      const jsonMatch = fullContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        let jsonStr = jsonMatch[0];
        // 修复JSON格式
        jsonStr = jsonStr.replace(/,(\s*[}\]])/g, '$1');
        
        const parsed = JSON.parse(jsonStr);
        
        if (Array.isArray(parsed.courses)) {
          // 验证并清理课程数据
          const validatedCourses: ExtractedCourse[] = [];
          
          for (const course of parsed.courses) {
            if (!course.name || typeof course.name !== 'string') continue;
            
            const validatedCourse: ExtractedCourse = {
              name: course.name.trim(),
              day: Math.max(1, parseInt(course.day) || 1),
              duration: Math.max(1, Math.min(8, parseFloat(course.duration) || 2)),
              type: ['course', 'visit', 'break', 'other'].includes(course.type) 
                ? course.type 
                : 'course',
              description: course.description?.trim() || undefined,
              teacherName: course.teacherName?.trim() || undefined,
              teacherTitle: course.teacherTitle?.trim() || undefined,
              visitSiteName: course.visitSiteName?.trim() || undefined,
              visitAddress: course.visitAddress?.trim() || undefined,
              startTime: course.startTime?.trim() || undefined,
              endTime: course.endTime?.trim() || undefined,
            };
            
            // 尝试匹配讲师库中的讲师
            if (validatedCourse.type === 'course' && validatedCourse.teacherName) {
              const matchedTeacher = allTeachers.find(
                t => t.name === validatedCourse.teacherName
              );
              if (matchedTeacher) {
                validatedCourse.teacherTitle = matchedTeacher.title || validatedCourse.teacherTitle;
              }
            }
            
            // 尝试匹配参访基地库中的参访点
            if (validatedCourse.type === 'visit' && validatedCourse.visitSiteName) {
              const matchedSite = allVisitSites.find(
                v => v.name === validatedCourse.visitSiteName
              );
              if (matchedSite && !validatedCourse.visitAddress) {
                validatedCourse.visitAddress = matchedSite.address || undefined;
              }
            }
            
            validatedCourses.push(validatedCourse);
          }
          
          // 按天数和顺序排序
          validatedCourses.sort((a, b) => {
            if (a.day !== b.day) return a.day - b.day;
            // 同一天按时间排序
            if (a.startTime && b.startTime) {
              return a.startTime.localeCompare(b.startTime);
            }
            return 0;
          });
          
          result = {
            success: true,
            courses: validatedCourses,
            totalHours: parsed.totalHours || validatedCourses.reduce((sum, c) => sum + c.duration, 0),
          };
        }
      }
    } catch (parseError) {
      console.error('解析AI响应失败:', parseError);
      result.message = '解析课程信息失败，请检查文件格式';
    }

    return Response.json(result);
  } catch (error) {
    console.error('课程提取失败:', error);
    return Response.json(
      { error: error instanceof Error ? error.message : '课程提取失败' },
      { status: 500 }
    );
  }
}
