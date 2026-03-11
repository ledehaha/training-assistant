import { NextRequest, NextResponse } from 'next/server';
import { LLMClient, Config, HeaderUtils } from 'coze-coding-dev-sdk';
import { getApiKey } from '@/lib/api-key';

// 定义可用的选项
const TRAINING_TARGETS = [
  '企业内训',
  '技能培训',
  '管理培训',
  '安全生产培训',
  '新员工培训',
  '专项培训',
];

const TARGET_AUDIENCES = [
  '班组长',
  '中层管理',
  '高层管理',
  '新员工',
  '技术骨干',
  '全员',
];

// POST /api/ai/analyze-input - AI 分析用户输入并匹配到合适的选项
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, input } = body;

    if (!type || !input) {
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

    // 初始化 LLM 客户端
    const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);
    const config = new Config();
    const client = new LLMClient(config, customHeaders);

    let prompt = '';

    if (type === 'trainingTarget') {
      prompt = `用户输入培训类型，请匹配最合适的选项或返回简化后的输入。

可选类型：${TRAINING_TARGETS.join('、')}

用户输入：${input}

规则：
1. 如果匹配某选项，返回该选项名
2. 不匹配则返回简化的核心词（去掉修饰语）

只返回结果，不要解释。`;
    } else if (type === 'targetAudience') {
      prompt = `用户输入目标人群，请匹配最合适的选项或返回简化后的输入。

可选人群：${TARGET_AUDIENCES.join('、')}

用户输入：${input}

规则：
1. 如果匹配某选项，返回该选项名
2. 不匹配则返回简化的核心词（去掉修饰语）

只返回结果，不要解释。`;
    } else {
      return NextResponse.json({ error: '无效的分析类型' }, { status: 400 });
    }

    // 调用 LLM
    const response = await client.invoke([
      { role: 'user', content: prompt }
    ], { temperature: 0.1 });

    const value = (response.content || '').trim();

    return NextResponse.json({
      data: {
        value,
        originalInput: input,
      }
    });

  } catch (error) {
    console.error('AI analyze error:', error);
    return NextResponse.json(
      { error: 'AI 分析失败，请稍后重试' },
      { status: 500 }
    );
  }
}
