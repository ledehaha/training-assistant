import { NextRequest, NextResponse } from 'next/server';
import { LLMClient, Config, HeaderUtils } from 'coze-coding-dev-sdk';
import { getApiKey } from '@/lib/api-key';

// POST /api/ai/analyze-requirement - AI智能分析培训需求
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { requirementText } = body;

    if (!requirementText) {
      return NextResponse.json({ error: '缺少需求描述' }, { status: 400 });
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

    // 初始化 LLM 客户端
    const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);
    const config = new Config();
    const client = new LLMClient(config, customHeaders);

    const prompt = `分析以下培训需求，提取关键信息。

需求描述：
${requirementText}

提取字段：
- name: 项目名称（根据需求自动生成一个简洁的项目名称，格式如"2024年XX培训项目"或"XX能力提升培训"）
- trainingTarget: 培训类型（企业内训/技能培训/管理培训/安全生产培训/新员工培训/专项培训）
- targetAudience: 目标人群（班组长/中层管理/高层管理/新员工/技术骨干/全员）
- participantCount: 参训人数（数字）
- trainingDays: 培训天数（数字）
- trainingHours: 培训课时（数字，每天约8课时）
- trainingPeriod: 培训周期（周末/工作日/连续/分期）
- location: 培训地点
- specialRequirements: 特殊要求

返回JSON格式：
{"name": "项目名称", "trainingTarget": "培训类型", "targetAudience": "目标人群", "participantCount": 数字, "trainingDays": 数字, "trainingHours": 数字, "trainingPeriod": "培训周期", "location": "地点", "specialRequirements": "特殊要求"}

注意：
1. name 字段必须根据需求内容自动生成一个有意义的项目名称，不要返回 null 或空字符串
2. 无法提取的字段返回 null，数字类型不加引号
3. 只返回 JSON，不要包含其他说明文字`;

    const response = await client.invoke([
      { role: 'user', content: prompt }
    ], { temperature: 0.1 });

    let result;
    try {
      let content = response.content || '';
      
      // 移除 AI 思考过程
      content = content.replace(/<[\/]?think>/g, '');
      content = content.replace(/◁[\/]?think▷/g, '');
      content = content.replace(/◁think▷[\s\S]*?◁\/think▷/g, '');
      
      // 尝试提取JSON
      const jsonBlockMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonBlockMatch) {
        content = jsonBlockMatch[1].trim();
      }
      
      // 找到第一个完整JSON对象
      let startIndex = content.indexOf('{');
      if (startIndex !== -1) {
        let depth = 0;
        let endIndex = -1;
        let inString = false;
        let escapeNext = false;
        
        for (let i = startIndex; i < content.length; i++) {
          const char = content[i];
          
          if (escapeNext) {
            escapeNext = false;
            continue;
          }
          
          if (char === '\\') {
            escapeNext = true;
            continue;
          }
          
          if (char === '"') {
            inString = !inString;
            continue;
          }
          
          if (!inString) {
            if (char === '{') depth++;
            else if (char === '}') {
              depth--;
              if (depth === 0) {
                endIndex = i + 1;
                break;
              }
            }
          }
        }
        
        if (endIndex !== -1) {
          const jsonStr = content.substring(startIndex, endIndex);
          result = JSON.parse(jsonStr);
        }
      }
      
      if (!result) {
        result = { raw: response.content };
      }
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      result = { raw: response.content };
    }

    return NextResponse.json({ data: result });

  } catch (error) {
    console.error('AI analyze requirement error:', error);
    return NextResponse.json(
      { error: 'AI 分析失败，请稍后重试' },
      { status: 500 }
    );
  }
}
