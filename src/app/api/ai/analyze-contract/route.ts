import { NextRequest, NextResponse } from 'next/server';
import { LLMClient, Config, HeaderUtils, S3Storage } from 'coze-coding-dev-sdk';
import mammoth from 'mammoth';
import { getDb, saveDatabaseImmediate, ensureDatabaseReady } from '@/storage/database';
import { projects } from '@/storage/database/schema';
import { eq } from 'drizzle-orm';
import { getApiKey } from '@/lib/api-key';

// 初始化对象存储
const storage = new S3Storage({
  endpointUrl: process.env.COZE_BUCKET_ENDPOINT_URL,
  accessKey: '',
  secretKey: '',
  bucketName: process.env.COZE_BUCKET_NAME,
  region: 'cn-beijing',
});

// 从对象存储读取Word文件并解析内容
async function readWordFileContent(fileKey: string): Promise<string> {
  try {
    const buffer = await storage.readFile({ fileKey });
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  } catch (error) {
    console.error('读取Word文件失败:', error);
    throw new Error('读取Word文件失败');
  }
}

// POST /api/ai/analyze-contract - AI分析合同Word文件，提取项目信息
export async function POST(request: NextRequest) {
  try {
    // 确保数据库已初始化
    await ensureDatabaseReady();
    
    const body = await request.json();
    const { projectId, fileKey } = body;

    if (!projectId || !fileKey) {
      return NextResponse.json({ error: '缺少必要参数' }, { status: 400 });
    }

    // 检查 API Key
    const apiKey = await getApiKey();
    if (!apiKey) {
      return NextResponse.json({ 
        error: '未配置 AI API Key，请在设置页面配置' 
      }, { status: 400 });
    }

    // 设置 API Key 到环境变量
    process.env.LLM_API_KEY = apiKey;
    process.env.COZE_API_KEY = apiKey;

    // 获取项目信息
    const db = getDb();
    const projectList = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);

    if (!projectList[0]) {
      return NextResponse.json({ error: '项目不存在' }, { status: 404 });
    }

    const project = projectList[0];

    // 读取合同Word文件内容
    const contractContent = await readWordFileContent(fileKey);

    if (!contractContent || contractContent.trim().length === 0) {
      return NextResponse.json({ error: '合同文件内容为空或无法解析' }, { status: 400 });
    }

    // 构建AI提示词
    const systemPrompt = `你是一个专业的培训项目信息提取助手。请分析提供的合同文件内容，提取以下项目相关信息。

请以JSON格式返回提取的信息，格式如下：
{
  "name": "项目名称（如果有）",
  "trainingTarget": "培训目标/培训类型",
  "targetAudience": "目标人群",
  "participantCount": 参训人数（数字）,
  "trainingDays": 培训天数（数字）,
  "trainingHours": 培训课时（数字）,
  "trainingPeriod": "培训时段",
  "startDate": "培训开始日期（YYYY-MM-DD格式）",
  "endDate": "培训结束日期（YYYY-MM-DD格式）",
  "location": "培训地点",
  "budgetMin": 预算下限（数字）,
  "budgetMax": 预算上限（数字）,
  "totalBudget": 总预算（数字）,
  "teacherFee": 讲师费（数字）,
  "venueFee": 场地费（数字）,
  "cateringFee": 餐饮费（数字）,
  "teaBreakFee": 茶歇费（数字）,
  "materialFee": 资料费（数字）,
  "laborFee": 人工费（数字）,
  "otherFee": 其他费用（数字）,
  "managementFee": 管理费（数字）,
  "specialRequirements": "特殊要求",
  "extractedInfo": "从合同中提取的其他重要信息摘要"
}

注意事项：
1. 如果某项信息在合同中没有找到，该字段返回null
2. 金额相关的字段请提取纯数字，不要包含货币符号或单位
3. 日期请转换为YYYY-MM-DD格式
4. 对于模糊描述（如"约50人"），请提取合理的估计值
5. 培训目标和目标人群如果有多个，用顿号分隔
6. 只返回JSON，不要包含其他说明文字`;

    const userPrompt = `请分析以下合同文件内容，提取项目相关信息：

合同内容：
${contractContent.substring(0, 8000)}

现有项目基本信息（供参考）：
- 项目名称：${project.name || '未填写'}
- 培训目标：${project.trainingTarget || '未填写'}
- 目标人群：${project.targetAudience || '未填写'}
- 计划参训人数：${project.participantCount || '未填写'}

请返回JSON格式的提取结果。`;

    // 调用 LLM
    const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);
    const config = new Config();
    const client = new LLMClient(config, customHeaders);

    const response = await client.invoke([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ], { 
      model: 'doubao-seed-1-6-251015',
      temperature: 0.1 
    });

    // 解析AI响应
    let extractedData;
    try {
      // 尝试从响应中提取JSON
      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        extractedData = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('无法从AI响应中提取JSON');
      }
    } catch (parseError) {
      console.error('解析AI响应失败:', parseError);
      return NextResponse.json({ 
        error: 'AI返回格式解析失败，请重试',
        rawResponse: response.content 
      }, { status: 500 });
    }

    // 准备更新数据（只更新非空值）
    const updateData: Record<string, string | number | null> = {};
    const fields = [
      'name', 'trainingTarget', 'targetAudience', 'trainingPeriod', 
      'startDate', 'endDate', 'location', 'specialRequirements',
      'participantCount', 'trainingDays', 'trainingHours',
      'budgetMin', 'budgetMax', 'totalBudget',
      'teacherFee', 'venueFee', 'cateringFee', 'teaBreakFee', 
      'materialFee', 'laborFee', 'otherFee', 'managementFee'
    ];

    fields.forEach(field => {
      const value = extractedData[field];
      if (value !== null && value !== undefined && value !== '') {
        updateData[field] = value;
      }
    });

    // 如果有有效数据，更新项目
    if (Object.keys(updateData).length > 0) {
      updateData.updatedAt = new Date().toISOString();
      await db.update(projects).set(updateData).where(eq(projects.id, projectId));
      saveDatabaseImmediate();
    }

    return NextResponse.json({
      success: true,
      extractedData: extractedData,
      updatedFields: Object.keys(updateData).filter(k => k !== 'updatedAt'),
      contractContentPreview: contractContent.substring(0, 500) + (contractContent.length > 500 ? '...' : '')
    });

  } catch (error) {
    console.error('AI分析合同失败:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'AI分析合同失败' },
      { status: 500 }
    );
  }
}
