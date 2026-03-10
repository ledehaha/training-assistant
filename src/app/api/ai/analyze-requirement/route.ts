import { NextRequest, NextResponse } from 'next/server';
import { LLMClient, Config, HeaderUtils } from 'coze-coding-dev-sdk';

// POST /api/ai/analyze-requirement - AI智能分析培训需求
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { requirementText } = body;

    if (!requirementText) {
      return NextResponse.json({ error: '缺少需求描述' }, { status: 400 });
    }

    // 初始化 LLM 客户端
    const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);
    const config = new Config();
    const client = new LLMClient(config, customHeaders);

    const prompt = `你是一个培训需求分析专家。请分析以下培训需求描述，提取关键信息。

## 需求描述
${requirementText}

## 需要提取的信息
1. 项目名称（name）：培训项目的名称
2. 培训类型（trainingTarget）：企业内训/技能培训/管理培训/安全生产培训/新员工培训/专项培训/其他
3. 目标人群（targetAudience）：班组长/中层管理/高层管理/新员工/技术骨干/全员/其他
4. 参训人数（participantCount）：参加培训的人数
5. 培训天数（trainingDays）：培训持续天数
6. 培训课时（trainingHours）：总课时数（通常每天8课时）
7. 培训周期（trainingPeriod）：周末/工作日/连续/分期/其他
8. 培训地点（location）：培训举办的地点
9. 特殊要求（specialRequirements）：其他特殊需求

请以JSON格式返回分析结果，格式如下：
{
  "name": "项目名称",
  "trainingTarget": "培训类型",
  "targetAudience": "目标人群",
  "participantCount": 人数,
  "trainingDays": 天数,
  "trainingHours": 课时数,
  "trainingPeriod": "培训周期",
  "location": "培训地点",
  "specialRequirements": "特殊要求"
}

注意：
1. 只返回JSON数据，不要包含任何解释
2. 如果某项信息无法从描述中提取，返回null
3. 数字类型直接返回数字，不要加引号`;

    const response = await client.invoke([
      { role: 'user', content: prompt }
    ], { temperature: 0.1 });

    let result;
    try {
      let content = response.content || '';
      
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
