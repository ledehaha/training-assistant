import { NextRequest, NextResponse } from 'next/server';
import { LLMClient, Config, HeaderUtils } from 'coze-coding-dev-sdk';

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

    // 初始化 LLM 客户端
    const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);
    const config = new Config();
    const client = new LLMClient(config, customHeaders);

    let options: string[] = [];
    let prompt = '';

    if (type === 'trainingTarget') {
      options = TRAINING_TARGETS;
      prompt = `你是一个培训分类专家。用户输入了一个培训类型描述，请从给定的选项中选择最匹配的一个，如果都不匹配则直接返回用户输入的内容（去除多余的修饰词，保留核心词）。

可用选项：
${options.map(o => `- ${o}`).join('\n')}

用户输入：${input}

请只返回最匹配的选项名称或简化后的用户输入，不要包含任何解释。如果用户输入与某个选项高度相关，就返回该选项；否则返回简化后的用户输入内容。

示例：
- 用户输入"数字化转型培训" -> 返回"数字化转型培训"
- 用户输入"领导力提升培训" -> 返回"管理培训"
- 用户输入"安全生产相关培训" -> 返回"安全生产培训"
- 用户输入"新入职员工培训" -> 返回"新员工培训"`;
    } else if (type === 'targetAudience') {
      options = TARGET_AUDIENCES;
      prompt = `你是一个培训受众分类专家。用户输入了一个目标人群描述，请从给定的选项中选择最匹配的一个，如果都不匹配则直接返回用户输入的内容（去除多余的修饰词，保留核心词）。

可用选项：
${options.map(o => `- ${o}`).join('\n')}

用户输入：${input}

请只返回最匹配的选项名称或简化后的用户输入，不要包含任何解释。如果用户输入与某个选项高度相关，就返回该选项；否则返回简化后的用户输入内容。

示例：
- 用户输入"项目经理" -> 返回"项目经理"
- 用户输入"财务人员" -> 返回"财务人员"
- 用户输入"班组长和组长" -> 返回"班组长"
- 用户输入"公司全体员工" -> 返回"全员"
- 用户输入"刚入职的新人" -> 返回"新员工"`;
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
