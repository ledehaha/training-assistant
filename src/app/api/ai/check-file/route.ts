import { NextRequest } from 'next/server';
import { LLMClient, FetchClient, Config, HeaderUtils, Message } from 'coze-coding-dev-sdk';
import { S3Storage } from 'coze-coding-dev-sdk';
import { getDb, ensureDatabaseReady } from '@/storage/database';
import {
  projects,
  courses,
  teachers,
  venues,
  visitSites,
  users,
  departments,
} from '@/storage/database/schema';
import { eq, and } from 'drizzle-orm';
import {
  generateAIFieldDescription,
  validateAIData,
  processDurationField,
  getComparisonFields,
} from '@/config/db-schema-config';

// 根据讲师姓名查找讲师ID
function findTeacherIdByName(teacherName: string, teacherList: { id: string; name: string }[]): string | null {
  if (!teacherName || typeof teacherName !== 'string') return null;
  
  // 如果已经是UUID格式，直接返回
  if (teacherName.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
    return teacherName;
  }
  
  // 在讲师库中查找匹配的讲师
  const found = teacherList.find(t => t.name === teacherName.trim());
  return found?.id || null;
}

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
}

// 文件类型定义
type FileType = 'contract' | 'cost' | 'declaration' | 'studentList' | 'satisfaction' | 'other';

// 文件类型中文名映射
const FILE_TYPE_NAMES: Record<FileType, string> = {
  contract: '合同文件',
  cost: '成本测算表',
  declaration: '项目申报书',
  studentList: '学员名单',
  satisfaction: '满意度调查',
  other: '其它附件',
};

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
    
    return textContent.substring(0, 15000); // 单个文件限制
  } catch (error) {
    console.error('读取文件失败:', error);
    return '';
  }
}

/**
 * 生成AI系统提示词
 * 根据文件类型调整提取策略
 */
function generateSystemPrompt(fileType: FileType): string {
  const tableDescriptions = ['teachers', 'venues', 'courseTemplates', 'visitSites']
    .map(key => generateAIFieldDescription(key))
    .join('\n\n');

  // 根据文件类型决定是否提取项目基本信息
  const shouldExtractProjectInfo = ['contract', 'cost', 'declaration'].includes(fileType);
  
  // 文件类型说明
  const fileTypeHints: Record<FileType, string> = {
    contract: '这是合同文件，可能包含项目基本信息、讲师信息、场地信息等。',
    cost: '这是成本测算表，可能包含项目基本信息、课程信息、讲师费用等。',
    declaration: '这是项目申报书，可能包含完整的项目基本信息、课程安排、讲师信息等。',
    studentList: '这是学员名单，主要包含学员信息，不要从中提取项目基本信息。',
    satisfaction: '这是满意度调查文件，主要包含满意度相关数据，不要从中提取项目基本信息或讲师信息。',
    other: `这是其它附件，**请务必仔细分析文件内容**，提取所有相关数据：

## 重点提取内容（按优先级）

### 1. 课程安排（最重要）
识别特征：培训日程、课程表、时间安排、教学计划、培训方案等
提取模式：
- 按天排列的课程（如"第一天"、"Day1"、"日期"等）
- 按时间段排列的课程（如"上午"、"下午"、"9:00-11:00"等）
- 课程名称 + 时间 + 讲师/负责人
- 将每门课程作为单独的课程模板提取

### 2. 师资信息
识别特征：讲师介绍、师资队伍、授课教师、专家名单等
提取模式：
- 姓名 + 职称/职务 + 单位/机构
- 姓名 + 专业领域/研究方向
- 注意：title字段只填专业技术职称（教授、副教授等），不填行政职务

### 3. 参访基地
识别特征：参观安排、考察地点、实地教学等
提取模式：单位名称 + 地址 + 联系方式

### 4. 场地信息
识别特征：培训地点、教室安排、会议室等
提取模式：场地名称 + 地址 + 容量

## 重要提醒
- **一个文件可能同时包含多种信息，请全部提取**
- **课程安排是重点，务必仔细识别并提取**
- 培训方案、教学计划等文件通常包含完整的课程安排，请逐一提取每门课程`,
  };

  const projectInfoSection = shouldExtractProjectInfo 
    ? `\n\n${generateAIFieldDescription('projectInfo')}

### 项目基本信息提取规则【极其重要】
1. 只有从文件中提取到**与当前值不同**的数据时才返回
2. 如果提取的值与当前值完全相同，**不要返回该记录**
3. 例如：当前参训人数是50，文件中也写明50人，则不要返回这条记录
4. 注意：项目基本信息只能从合同、成本测算表、项目申报书等文件中提取。`
    : '\n\n注意：此文件类型不应提取项目基本信息（如参训人数、培训天数等），只提取讲师、场地、课程等相关数据。';

  return `你是一个专业的培训项目数据分析师。你的任务是：
1. 分析提供的文件内容
2. 从文件中提取讲师、场地、课程、参访基地等信息
3. 与数据库中已有的数据进行比对
4. **只返回需要新增或更新的数据**

## 当前文件类型
${fileTypeHints[fileType]}

## 重要原则

### 数据处理原则
- **只提取文件中明确存在的数据，不要臆造**
- **不要从无关文件中提取数据**（例如：不要从专家介绍中提取参训人数）
- 对于同一实体，整合文件中所有相关信息
- 每条数据必须标注source字段说明来源

### ⚠️ 过滤规则【重要】
**以下情况不要返回记录：**
1. 提取的数据为空或只有name字段，没有其他有效信息
2. 无法从文件中提取到任何有用的数据

**对于不同类型的数据，过滤规则不同：**
- **课程模板**：只要是有效的课程安排，都应该返回。即使数据库中有同名课程，但时间安排、讲师、内容等不同，也应该作为新增返回
- **讲师信息**：数据库中已存在同名讲师且信息完全一致时，才跳过
- **场地/参访基地**：数据库中已存在同名记录且信息完全一致时，才跳过

**重点提示**：培训方案中的课程安排是有价值的数据，请积极提取！

### 职称识别规则【极其重要】
**职称（title）字段只能填写专业技术职称，不能填写行政职务！**

✅ 正确的职称示例：
- 高等院校：教授、副教授、讲师、助教
- 科研机构：研究员、副研究员、助理研究员、研究实习员
- 工程技术：正高级工程师、高级工程师、工程师、助理工程师、技术员
- 卫生技术：主任医师、副主任医师、主治医师、医师、医士
- 图书档案：研究馆员、副研究馆员、馆员、助理馆员
- 出版编辑：编审、副编审、编辑、助理编辑
- 财会经济：正高级会计师、高级会计师、会计师、助理会计师
- 中小学：中小学高级教师、中小学一级教师、中小学二级教师

❌ 错误示例（这些是行政职务，不是职称，绝对不能填入title字段）：
- 院长、副院长、处长、副处长、科长、副科长
- 主任、副主任、所长、副所长
- 校长、副校长、系主任、教研室主任
- 总经理、总监、经理等企业管理职务

**处理规则**：
- 如果文件中只有行政职务（如"王XX 院长"），没有专业技术职称，则title字段留空或不填
- 如果文件中同时有职称和职务，只填写职称（如"李XX 教授、院长"→ title填"教授"）
- 不确定是否为职称时，宁可留空也不要错误填写

### 数据来源标注
- source字段填写"${FILE_TYPE_NAMES[fileType]}"等文件名称
- confidence字段表示数据置信度：high/medium/low

## 数据库字段定义（严格按照此定义输出）

${tableDescriptions}
${projectInfoSection}

## 输出格式要求

返回严格的JSON格式：

\`\`\`json
{
  "projectInfo": [{
    "field": "字段名",
    "fieldName": "字段中文名",
    "currentValue": "当前值",
    "extractedValue": "提取值（必须与currentValue不同才返回）",
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
  "visitSites": [...]
}
\`\`\`

## 重要提醒

1. **字段映射必须正确**：严格按照定义的字段含义填写
2. **不要臆造字段**：只输出定义的字段
3. **只有真正有价值的新增或更新才返回**
4. **如果文件中没有任何有用数据，返回空对象 {}**`;
}

/**
 * 格式化数据库数据用于AI对比
 */
function formatDbDataForAI(
  schemaKey: string,
  data: Record<string, unknown>[]
): string {
  if (data.length === 0) return '暂无数据';

  const comparisonFields = getComparisonFields(schemaKey);
  const fieldConfig = {
    teachers: { name: 'name', fields: comparisonFields },
    venues: { name: 'name', fields: comparisonFields },
    courseTemplates: { name: 'name', fields: comparisonFields },
    visitSites: { name: 'name', fields: comparisonFields },
  };

  const config = fieldConfig[schemaKey as keyof typeof fieldConfig];
  if (!config) return '暂无数据';

  // 限制显示数量
  const displayData = data.slice(0, 30);
  
  return displayData.map((item, index) => {
    // 对于课程模板，特殊处理讲师字段：显示讲师名称而非ID
    if (schemaKey === 'courseTemplates') {
      const fields = comparisonFields.filter(f => f !== 'teacherId');
      const fieldValues = fields
        .map(f => `${f}:${item[f] ?? '未填写'}`)
        .join(' ');
      // 添加讲师名称
      const teacherDisplay = item.teacherName ? `讲师:${item.teacherName}` : '讲师:未指定';
      return `${index + 1}. ID:${item.id} ${fieldValues} ${teacherDisplay}`;
    }
    
    const fieldValues = config.fields
      .map(f => `${f}:${item[f] ?? '未填写'}`)
      .join(' ');
    return `${index + 1}. ID:${item.id} ${fieldValues}`;
  }).join('\n') + (data.length > 30 ? `\n...（共${data.length}条，仅显示前30条）` : '');
}

export async function POST(request: NextRequest) {
  const encoder = new TextEncoder();
  
  const stream = new ReadableStream({
    async start(controller) {
      const sendEvent = (event: ProgressEvent) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };
      
      try {
        const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);
        const { projectId, fileType, fileKey, fileName } = await request.json();

        if (!projectId || !fileType || !fileKey) {
          sendEvent({ 
            type: 'error', 
            step: 'init', 
            stepName: '参数错误', 
            progress: 0, 
            total: 3, 
            data: { error: '缺少必要参数' } 
          });
          controller.close();
          return;
        }

        // Step 1: 初始化并读取文件
        sendEvent({ type: 'progress', step: 'init', stepName: '正在读取文件...', progress: 33, total: 3 });
        await ensureDatabaseReady();
        const db = getDb();

        // 获取项目信息
        const projectList = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);
        if (!projectList[0]) {
          sendEvent({ type: 'error', step: 'init', stepName: '项目不存在', progress: 0, total: 3, data: { error: '项目不存在' } });
          controller.close();
          return;
        }
        const project = projectList[0];

        // 读取文件内容
        const fileContent = await readFileContent(fileKey, customHeaders);
        if (!fileContent) {
          sendEvent({ 
            type: 'error', 
            step: 'init', 
            stepName: '文件读取失败', 
            progress: 0, 
            total: 3, 
            data: { error: '无法读取文件内容，请确认文件格式正确' } 
          });
          controller.close();
          return;
        }

        // Step 2: 获取数据库数据
        sendEvent({ type: 'progress', step: 'database', stepName: '正在获取数据库数据...', progress: 66, total: 3 });
        
        // 查询讲师列表（用于匹配）
        const teacherList = db.select({ id: teachers.id, name: teachers.name }).from(teachers).all();
        
        // 查询课程模板，关联讲师表获取讲师名称
        const courseTemplatesWithTeacher = db
          .select({
            id: courses.id,
            name: courses.name,
            category: courses.category,
            description: courses.description,
            content: courses.content,
            duration: courses.duration,
            targetAudience: courses.targetAudience,
            difficulty: courses.difficulty,
            teacherId: courses.teacherId,
            teacherName: teachers.name,
            usageCount: courses.usageCount,
            avgRating: courses.avgRating,
            isActive: courses.isActive,
            createdAt: courses.createdAt,
            createdBy: courses.createdBy,
            createdByDepartment: courses.createdByDepartment,
          })
          .from(courses)
          .leftJoin(teachers, eq(courses.teacherId, teachers.id))
          .where(eq(courses.isTemplate, true))
          .all();
        
        const [allTeachers, allVenues, allVisitSites] = await Promise.all([
          db.select().from(teachers),
          db.select().from(venues),
          db.select().from(visitSites),
        ]);
        
        const allCourseTemplates = courseTemplatesWithTeacher;

        // Step 3: AI分析
        sendEvent({ type: 'progress', step: 'ai', stepName: '正在进行AI智能分析...', progress: 90, total: 3 });

        const systemPrompt = generateSystemPrompt(fileType as FileType);
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

## 待分析文件：${fileName || FILE_TYPE_NAMES[fileType as FileType]}
${fileType === 'other' ? `
⚠️ 这是"其它附件"类型的文件，请根据**文件内容**智能提取所有相关数据：
- 文件中可能同时包含课程安排、讲师介绍、参访安排等多种信息
- 请仔细阅读文件内容，提取所有有价值的数据
- 如果有日程安排（第几天、时间段），提取到courseTemplates作为新的课程模板
- 如果有师资介绍（姓名、职称、单位），提取到teachers
- 如果有参访单位，提取到visitSites
` : ''}

\`\`\`
${fileContent}
\`\`\`

请分析以上文件内容，提取数据并返回JSON格式的结果。`;

        console.log(`AI检查文件 [${fileType}] ${fileName}, 内容长度: ${fileContent.length}`);

        const config = new Config({ timeout: 120000 });
        const client = new LLMClient(config, customHeaders);
        const messages: Message[] = [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ];

        // 使用流式调用
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
        let rawResult: Record<string, unknown> = {};
        try {
          console.log('AI原始响应长度:', fullContent.length);
          console.log('AI原始响应内容(前500字符):', fullContent.substring(0, 500));
          
          // 提取JSON内容
          const jsonMatch = fullContent.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            let jsonStr = jsonMatch[0];
            
            // 尝试修复常见的JSON格式问题
            // 1. 移除末尾的逗号
            jsonStr = jsonStr.replace(/,(\s*[}\]])/g, '$1');
            // 2. 如果JSON不完整，尝试补充闭合括号
            const openBraces = (jsonStr.match(/\{/g) || []).length;
            const closeBraces = (jsonStr.match(/\}/g) || []).length;
            const openBrackets = (jsonStr.match(/\[/g) || []).length;
            const closeBrackets = (jsonStr.match(/\]/g) || []).length;
            
            if (closeBraces < openBraces) {
              jsonStr += '}'.repeat(openBraces - closeBraces);
            }
            if (closeBrackets < openBrackets) {
              jsonStr += ']'.repeat(openBrackets - closeBrackets);
            }
            
            try {
              rawResult = JSON.parse(jsonStr);
              console.log('解析后的JSON结果:', JSON.stringify(rawResult, null, 2).substring(0, 1000));
            } catch (parseError) {
              console.error('JSON解析失败，尝试提取部分数据:', parseError);
              // 尝试提取各个数组
              const extractArray = (key: string): unknown[] => {
                const regex = new RegExp(`"${key}"\\s*:\\s*\\[([\\s\\S]*?)(?:\\]|$)`, 'i');
                const match = jsonStr.match(regex);
                if (match) {
                  try {
                    // 尝试解析数组内容
                    let arrayStr = '[' + match[1];
                    if (!arrayStr.endsWith(']')) arrayStr += ']';
                    arrayStr = arrayStr.replace(/,(\s*\])/g, '$1'); // 移除末尾逗号
                    return JSON.parse(arrayStr);
                  } catch {
                    return [];
                  }
                }
                return [];
              };
              
              rawResult = {
                projectInfo: extractArray('projectInfo'),
                teachers: extractArray('teachers'),
                venues: extractArray('venues'),
                courseTemplates: extractArray('courseTemplates'),
                visitSites: extractArray('visitSites'),
              };
              console.log('部分提取结果:', JSON.stringify(rawResult, null, 2).substring(0, 500));
            }
          } else {
            console.log('未找到JSON匹配');
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
        };

        // 验证项目信息
        if (Array.isArray(rawResult.projectInfo)) {
          checkResult.projectInfo = rawResult.projectInfo.filter(
            (item: { field?: string; currentValue?: unknown; extractedValue?: unknown; reason?: string }) => {
              // 过滤无效数据
              if (!item.field || item.extractedValue === undefined || item.extractedValue === null) {
                return false;
              }
              // 过滤"无需更新"的记录
              const reasonText = item.reason || '';
              if (
                reasonText.includes('无需更新') ||
                reasonText.includes('无需变更') ||
                reasonText.includes('信息一致') ||
                reasonText.includes('数据一致') ||
                reasonText.includes('无变化') ||
                reasonText.includes('完全一致')
              ) {
                console.log(`过滤项目信息: ${item.field} - ${reasonText}`);
                return false;
              }
              // 过滤值相同的记录（currentValue 和 extractedValue 相等时无需更新）
              const currentVal = String(item.currentValue ?? '').trim();
              const extractedVal = String(item.extractedValue ?? '').trim();
              if (currentVal === extractedVal && currentVal !== '') {
                console.log(`过滤项目信息: ${item.field} - 值相同 (${currentVal} = ${extractedVal})`);
                return false;
              }
              // 数值类型比较：处理数字格式差异（如 "50" 和 50）
              const currentNum = parseFloat(currentVal);
              const extractedNum = parseFloat(extractedVal);
              if (!isNaN(currentNum) && !isNaN(extractedNum) && currentNum === extractedNum) {
                console.log(`过滤项目信息: ${item.field} - 数值相同 (${currentNum} = ${extractedNum})`);
                return false;
              }
              return true;
            }
          );
        }

        // 验证各表数据
        type TableKey = 'teachers' | 'venues' | 'courseTemplates' | 'visitSites';
        const tableKeys: TableKey[] = ['teachers', 'venues', 'courseTemplates', 'visitSites'];
        
        for (const key of tableKeys) {
          const rawItems = rawResult[key];
          console.log(`处理表 ${key}, 原始数据:`, Array.isArray(rawItems) ? `数组长度${rawItems.length}` : '非数组');
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
              
              console.log(`  检查项目:`, JSON.stringify(typedItem.data).substring(0, 200));
              
              if (!typedItem.data || Object.keys(typedItem.data).length === 0) {
                console.log(`  跳过: data为空`);
                continue;
              }
              
              if (!typedItem.data.name) {
                console.log(`  跳过: 缺少name字段, data:`, typedItem.data);
                continue;
              }
              
              // 过滤"无需更新"的记录（但对于课程模板，放宽过滤条件）
              const reasonText = typedItem.reason || '';
              // 课程模板数据更有价值，不轻易过滤
              if (key !== 'courseTemplates') {
                if (
                  reasonText.includes('无需更新') ||
                  reasonText.includes('无需变更') ||
                  reasonText.includes('信息一致') ||
                  reasonText.includes('数据一致') ||
                  reasonText.includes('无新增价值') ||
                  reasonText.includes('无变化') ||
                  reasonText.includes('完全一致')
                ) {
                  console.log(`  跳过: ${reasonText}`);
                  continue;
                }
              } else {
                // 课程模板：只有在完全一致时才过滤
                if (
                  reasonText.includes('完全一致') ||
                  reasonText.includes('数据完全相同')
                ) {
                  console.log(`  跳过课程模板: ${reasonText}`);
                  continue;
                }
              }
              
              const validation = validateAIData(key, typedItem.data);
              console.log(`  验证结果: errors=${validation.errors.length}, cleanedData=`, JSON.stringify(validation.cleanedData).substring(0, 100));
              
              let processedData = processDurationField(key, validation.cleanedData) as Record<string, unknown>;
              
              // 对于课程模板，处理讲师字段：将讲师姓名转换为讲师ID
              if (key === 'courseTemplates' && processedData.teacherId && typeof processedData.teacherId === 'string') {
                const teacherIdValue = findTeacherIdByName(processedData.teacherId, teacherList);
                if (teacherIdValue) {
                  processedData.teacherId = teacherIdValue;
                  console.log(`  讲师匹配成功: ${typedItem.data.teacherId} -> ${teacherIdValue}`);
                } else {
                  // 如果找不到匹配的讲师，保留原始值（可能是讲师姓名）
                  // 后续在前端确认时会再次尝试匹配
                  console.log(`  讲师未匹配: ${processedData.teacherId}`);
                }
              }
              
              const action: 'add' | 'update' = typedItem.action === 'update' ? 'update' : 'add';
              
              validatedItems.push({
                action,
                data: processedData,
                existingId: typedItem.existingId,
                reason: typedItem.reason || '',
                source: typedItem.source || fileName || FILE_TYPE_NAMES[fileType as FileType],
                confidence: (['high', 'medium', 'low'].includes(typedItem.confidence || '') ? typedItem.confidence : 'medium') as 'high' | 'medium' | 'low',
                validationErrors: validation.errors.length > 0 ? validation.errors : undefined,
              });
            }
            checkResult[key] = validatedItems;
            console.log(`表 ${key} 最终验证通过: ${validatedItems.length}条`);
          }
        }

        const totalChanges = 
          (checkResult.projectInfo?.length || 0) +
          checkResult.teachers.length + 
          checkResult.venues.length + 
          checkResult.courseTemplates.length + 
          checkResult.visitSites.length;

        console.log('最终结果统计:', {
          projectInfo: checkResult.projectInfo?.length || 0,
          teachers: checkResult.teachers.length,
          venues: checkResult.venues.length,
          courseTemplates: checkResult.courseTemplates.length,
          visitSites: checkResult.visitSites.length,
          totalChanges,
        });

        // 发送最终结果
        sendEvent({
          type: 'result',
          step: 'complete',
          stepName: '分析完成',
          progress: 100,
          total: 3,
          data: {
            success: true,
            projectId,
            projectName: project.name,
            fileType,
            fileName: fileName || FILE_TYPE_NAMES[fileType as FileType],
            checkResult,
            totalChanges,
            hasChanges: totalChanges > 0,
          },
        });

        controller.close();
      } catch (error) {
        console.error('AI文件检查失败:', error);
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({
          type: 'error',
          step: 'error',
          stepName: '分析失败',
          progress: 0,
          total: 3,
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
