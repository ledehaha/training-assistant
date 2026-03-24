import { NextRequest } from 'next/server';
import { LLMClient, FetchClient, Config, HeaderUtils, Message } from 'coze-coding-dev-sdk';
import { S3Storage } from 'coze-coding-dev-sdk';
import { getDb, ensureDatabaseReady } from '@/storage/database';
import { projects, teachers, visitSites } from '@/storage/database/schema';
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
  name: string;
  day: number;
  duration: number;
  type: 'course' | 'visit';
  description?: string;
  teacherName?: string;
  teacherTitle?: string;
  visitSiteName?: string;
  visitAddress?: string;
  startTime?: string;
  endTime?: string;
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
    
    return textContent.substring(0, 20000);
  } catch (error) {
    console.error('读取文件失败:', error);
    return '';
  }
}

// AI系统提示词
function generateSystemPrompt(): string {
  return `你是一个专业的培训课程分析师。你的任务是从课程安排表中提取真正的培训课程信息。

## ⚠️ 重要：必须排除的活动（这些不是课程！）

以下活动属于后勤安排，**绝对不要**提取为课程，直接忽略：
- 用餐类：早餐、午餐、晚餐、自助餐、宴会、欢迎晚宴、告别宴等
- 住宿类：酒店入住、办理入住、退房、住宿安排等
- 交通类：出发、返程、集合、乘车、机场接送、交通安排等
- 签到类：签到、报到、领取资料、开班仪式（不含培训内容的）、结业仪式（不含培训内容的）等
- 休息类：茶歇、自由活动、休息、午休等

**只有真正的培训内容才需要提取！**

## 输出要求

### 课程信息字段
每门课程需要提取以下信息：
- **name**: 课程名称（必填）
- **day**: 第几天（数字，从1开始）
- **duration**: 课时数（数字，**必须是0.5的倍数**）
- **type**: 课程类型（course=理论课程, visit=参访活动）
- **description**: 课程描述/内容概要
- **teacherName**: 讲师姓名
- **teacherTitle**: 建议讲师职称（如：教授、副教授、高级工程师等）
- **visitSiteName**: 参访地点名称（仅参访类型）
- **visitAddress**: 参访地址（仅参访类型）
- **startTime**: 开始时间（如：09:00）
- **endTime**: 结束时间（如：11:00）

### 课时折算规则（CRITICAL：课时必须是0.5的倍数）
- 1课时 = 40-60分钟
- 课时数**只能是**：0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5, 6...（0.5的倍数）
- 折算示例：
  - 30-45分钟 → 0.5课时
  - 45-75分钟 → 1课时
  - 75-105分钟 → 1.5课时
  - 90分钟 → 1.5课时
  - 2小时（120分钟）→ 2课时
  - 2.5小时（150分钟）→ 2.5课时
  - 3小时（180分钟）→ 3课时
  - 半天（3-4小时）→ 3.5或4课时

### 提取规则
1. **排除非课程活动**：用餐、住宿、交通、签到、休息等活动直接忽略
2. **只提取培训内容**：讲座、授课、研讨、参访、实训等才是课程
3. **按时间顺序排列**：按照课程在文件中的时间顺序提取
4. **识别天数**：根据"第一天"、"Day 1"、"日期"等标识判断是第几天
5. **区分课程类型**：
   - 理论授课、讲座、研讨、培训、讲课 → course
   - 参观、考察、实地教学、现场教学 → visit
6. **讲师信息**：
   - 如果有明确讲师姓名，提取到teacherName
   - 如果没有具体姓名但有职称要求，提取到teacherTitle

### 输出格式
返回严格的JSON格式：
\`\`\`json
{
  "courses": [
    {
      "name": "课程名称",
      "day": 1,
      "duration": 1.5,
      "type": "course",
      "description": "课程描述",
      "teacherName": "张教授",
      "teacherTitle": "教授",
      "startTime": "09:00",
      "endTime": "10:30"
    }
  ],
  "totalHours": 32.5
}
\`\`\`

## 重要提示
1. **过滤后勤活动**：午餐、晚餐、酒店入住、出发、返程等不是课程！
2. **课时必须是0.5的倍数**：如1、1.5、2、2.5、3、3.5、4等
3. **只提取真正的培训内容**：没有培训内容的活动不要提取
4. **保持原始顺序**：按照文件中的顺序排列课程`;

}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params;
    const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);
    const { fileKey, fileName } = await request.json();

    if (!fileKey) {
      return Response.json({ error: '缺少文件参数' }, { status: 400 });
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

    // 获取讲师列表和参访基地列表
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
        jsonStr = jsonStr.replace(/,(\s*[}\]])/g, '$1');
        
        const parsed = JSON.parse(jsonStr);
        console.log('AI返回的课程数量:', parsed.courses?.length || 0);
        
        if (Array.isArray(parsed.courses)) {
          const validatedCourses: ExtractedCourse[] = [];
          
          for (const course of parsed.courses) {
            if (!course.name || typeof course.name !== 'string') continue;
            
            // 过滤掉非课程活动（用餐、住宿、交通等）
            const name = course.name.trim().toLowerCase();
            const excludedKeywords = [
              '早餐', '午餐', '晚餐', '自助餐', '宴会', '晚宴', '用餐', '吃饭',
              '酒店', '入住', '退房', '住宿',
              '出发', '返程', '集合', '乘车', '接送', '机场',
              '签到', '报到', '领取资料',
              '茶歇', '自由活动', '休息', '午休', '开班仪式', '结业仪式'
            ];
            if (excludedKeywords.some(kw => name.includes(kw))) {
              console.log('过滤非课程活动:', course.name);
              continue;
            }
            
            // 课时数四舍五入到0.5的倍数
            let duration = parseFloat(course.duration) || 2;
            duration = Math.round(duration * 2) / 2; // 四舍五入到0.5
            duration = Math.max(0.5, Math.min(8, duration)); // 限制范围0.5-8
            
            // 类型只能是 course 或 visit
            const courseType = course.type === 'visit' ? 'visit' : 'course';
            
            const validatedCourse: ExtractedCourse = {
              name: course.name.trim(),
              day: Math.max(1, parseInt(course.day) || 1),
              duration: duration,
              type: courseType,
              description: course.description?.trim() || undefined,
              teacherName: course.teacherName?.trim() || undefined,
              teacherTitle: course.teacherTitle?.trim() || undefined,
              visitSiteName: course.visitSiteName?.trim() || undefined,
              visitAddress: course.visitAddress?.trim() || undefined,
              startTime: course.startTime?.trim() || undefined,
              endTime: course.endTime?.trim() || undefined,
            };
            
            // 匹配讲师库
            if (validatedCourse.type === 'course' && validatedCourse.teacherName) {
              const matchedTeacher = allTeachers.find(
                t => t.name === validatedCourse.teacherName
              );
              if (matchedTeacher) {
                validatedCourse.teacherTitle = matchedTeacher.title || validatedCourse.teacherTitle;
              }
            }
            
            // 匹配参访基地库
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
          
          // 排序
          validatedCourses.sort((a, b) => {
            if (a.day !== b.day) return a.day - b.day;
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
          console.log('课程提取结果: 提取到', validatedCourses.length, '门课程');
          console.log('课程列表:', validatedCourses.map(c => c.name).join(', '));
        }
      }
    } catch (parseError) {
      console.error('解析AI响应失败:', parseError);
      result.message = '解析课程信息失败，请检查文件格式';
    }

    console.log('最终返回课程数量:', result.courses?.length || 0);
    return Response.json(result);
  } catch (error) {
    console.error('课程提取失败:', error);
    return Response.json({ error: '课程提取失败' }, { status: 500 });
  }
}
