import { NextRequest, NextResponse } from 'next/server';
import { LLMClient, Config, HeaderUtils } from 'coze-coding-dev-sdk';
import { 
  db, teachers, venues, courseTemplates, normativeDocuments, 
  eq, desc, sql, ensureDatabaseReady 
} from '@/storage/database';
import { getApiKey } from '@/lib/api-key';

// POST /api/ai/recommend - AI智能推荐
export async function POST(request: NextRequest) {
  try {
    // 确保数据库已初始化
    await ensureDatabaseReady();
    
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

    const body = await request.json();
    const { type, projectData } = body;
    const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);
    
    const config = new Config();
    const client = new LLMClient(config, customHeaders);

    // 根据类型进行不同的推荐
    let prompt = '';
    let contextData = '';

    switch (type) {
      case 'courses':
        // 获取历史课程数据
        const courseTemplatesData = db
          .select()
          .from(courseTemplates)
          .where(eq(courseTemplates.isActive, true))
          .limit(20)
          .all();
        
        contextData = `现有课程模板数据：\n${JSON.stringify(courseTemplatesData, null, 2)}`;
        const budgetStr = projectData.noBudgetLimit || (!projectData.budgetMin && !projectData.budgetMax)
          ? '无预算限制'
          : `${projectData.budgetMin || 0} - ${projectData.budgetMax || 0}万元`;
        
        prompt = `你是一个专业的培训方案设计专家。请根据以下培训需求，推荐合适的课程安排：

培训对象：${projectData.trainingTarget || '未指定'}
目标人群：${projectData.targetAudience || '未指定'}
参训人数：${projectData.participantCount || '未指定'}人
培训天数：${projectData.trainingDays || '未指定'}天
培训课时：${projectData.trainingHours || '未指定'}课时
培训预算：${budgetStr}
特殊要求：${projectData.specialRequirements || '无'}

${contextData}

请推荐课程安排，要求：
1. 课程类别分布：职业素养类30%、管理技能类30%、专业技能类20%、综合提升类20%
2. 每门课程需要包含：课程名称、课时、简要描述、建议讲师职称要求
3. 按天安排课程，说明每天的课程安排

请以JSON格式返回课程列表，格式如下：
{
  "courses": [
    {
      "day": 1,
      "name": "课程名称",
      "duration": 4,
      "description": "课程描述",
      "category": "课程类别",
      "teacherTitle": "建议讲师职称"
    }
  ],
  "summary": "方案概述"
}

注意：只返回JSON数据，不要包含任何解释或思考过程。`;
        break;

      case 'modify-courses':
        const modifyBudgetStr = projectData.noBudgetLimit || (!projectData.budgetMin && !projectData.budgetMax)
          ? '无预算限制'
          : `${projectData.budgetMin || 0} - ${projectData.budgetMax || 0}万元`;
        
        prompt = `你是一个专业的培训方案设计专家。用户对当前的培训方案提出了修改意见，请根据修改意见调整课程安排。

## 原培训需求
培训对象：${projectData.trainingTarget || '未指定'}
目标人群：${projectData.targetAudience || '未指定'}
参训人数：${projectData.participantCount || '未指定'}人
培训天数：${projectData.trainingDays || '未指定'}天
培训课时：${projectData.trainingHours || '未指定'}课时
培训预算：${modifyBudgetStr}
特殊要求：${projectData.specialRequirements || '无'}

## 当前课程方案
${JSON.stringify(projectData.currentCourses, null, 2)}

## 用户修改意见
${projectData.modifySuggestion}

## 调整要求
1. 根据用户的修改意见调整课程方案
2. 保持课程类别分布：职业素养类30%、管理技能类30%、专业技能类20%、综合提升类20%
3. 总课时必须等于 ${projectData.trainingHours || 32} 课时
4. 天数范围：第1天到第${projectData.trainingDays || 4}天

请以JSON格式返回调整后的课程列表，格式如下：
{
  "courses": [
    {
      "day": 1,
      "name": "课程名称",
      "duration": 4,
      "description": "课程描述",
      "category": "课程类别",
      "teacherTitle": "建议讲师职称",
      "location": "建议上课地点"
    }
  ],
  "summary": "调整说明"
}

注意：只返回JSON数据，不要包含任何解释或思考过程。`;
        break;

      case 'teachers':
        // 获取讲师数据
        const teachersData = db
          .select()
          .from(teachers)
          .where(eq(teachers.isActive, true))
          .orderBy(desc(teachers.rating))
          .limit(20)
          .all();
        
        contextData = `现有讲师资源：\n${JSON.stringify(teachersData, null, 2)}`;
        prompt = `你是一个培训资源匹配专家。请根据以下课程需求，推荐合适的讲师：

课程列表：${JSON.stringify(projectData.courses, null, 2)}

${contextData}

请为每门课程推荐合适的讲师，要求：
1. 根据讲师专业方向匹配课程内容
2. 优先选择评分高、授课次数多的讲师
3. 避免同一讲师连续授课

请以JSON格式返回讲师分配建议，格式如下：
{
  "assignments": [
    {
      "courseId": "课程ID或名称",
      "teacherId": "推荐的讲师ID",
      "teacherName": "讲师姓名",
      "reason": "推荐理由"
    }
  ]
}

注意：只返回JSON数据，不要包含任何解释或思考过程。`;
        break;

      case 'venues':
        // 获取场地数据
        const venuesData = db
          .select()
          .from(venues)
          .where(eq(venues.isActive, true))
          .orderBy(desc(venues.rating))
          .limit(10)
          .all();
        
        contextData = `现有场地资源：\n${JSON.stringify(venuesData, null, 2)}`;
        prompt = `你是一个培训场地推荐专家。请根据以下培训需求，推荐合适的场地：

参训人数：${projectData.participantCount || '未指定'}人
培训地点：${projectData.location || '未指定'}
培训天数：${projectData.trainingDays || '未指定'}天
特殊要求：${projectData.specialRequirements || '无'}

${contextData}

请推荐最合适的场地，要求：
1. 容量需要足够容纳参训人数
2. 地点需要匹配培训地点要求
3. 考虑性价比

请以JSON格式返回场地推荐，格式如下：
{
  "recommendations": [
    {
      "venueId": "场地ID",
      "venueName": "场地名称",
      "score": 95,
      "reasons": ["推荐理由1", "推荐理由2"]
    }
  ]
}

注意：只返回JSON数据，不要包含任何解释或思考过程。`;
        break;

      case 'quotation':
        // 获取规范性文件（费用标准）
        const normativeDocsData = db
          .select()
          .from(normativeDocuments)
          .where(sql`${normativeDocuments.isEffective} = 1`)
          .all();
        
        contextData = `规范性文件（费用标准）：\n${JSON.stringify(normativeDocsData, null, 2)}`;
        prompt = `你是一个培训项目报价专家。请根据以下培训方案，生成详细的报价单：

培训信息：
- 参训人数：${projectData.participantCount || 0}人
- 培训天数：${projectData.trainingDays || 0}天
- 培训课时：${projectData.trainingHours || 0}课时

课程安排：${JSON.stringify(projectData.courses, null, 2)}
选定场地：${JSON.stringify(projectData.venue, null, 2)}
讲师安排：${JSON.stringify(projectData.teachers, null, 2)}

${contextData}

请生成详细的费用明细，要求：
1. 讲师费：根据讲师职称和课时计算
2. 场地费：根据场地日租金和天数计算
3. 餐饮费：按人数和天数计算
4. 茶歇费：按人数和天数计算
5. 资料费：按人数计算
6. 劳务费：班主任等人员费用
7. 其他费用
8. 管理费：收入的15%
9. 合计

请以JSON格式返回报价单，格式如下：
{
  "items": [
    {
      "category": "费用类别",
      "name": "费用名称",
      "unit": "单位",
      "quantity": 数量,
      "unitPrice": 单价,
      "amount": 金额,
      "remark": "备注"
    }
  ],
  "subtotal": 小计,
  "managementFee": 管理费,
  "total": 合计,
  "compliance": {
    "compliant": true,
    "issues": []
  }
}

注意：只返回JSON数据，不要包含任何解释或思考过程。`;
        break;

      case 'satisfaction-analysis':
        prompt = `你是一个培训效果评估专家。请分析以下满意度调查数据：

项目名称：${projectData.projectName}
调查响应数：${projectData.responseCount}
回收率：${projectData.responseRate}%

评分数据：
- 整体满意度：${projectData.avgSatisfaction}/5
- 课程内容满意度：${projectData.courseSatisfaction}/5
- 讲师满意度：${projectData.teacherSatisfaction}/5
- 场地满意度：${projectData.venueSatisfaction}/5
- 餐饮满意度：${projectData.cateringSatisfaction}/5

开放性反馈：
${projectData.feedback}

请进行深度分析，生成满意度分析报告，包括：
1. 评分分析（优势和不足）
2. 反馈情感分析
3. 高频关键词提取
4. 改进建议

请以JSON格式返回分析报告，格式如下：
{
  "summary": "整体评价概述",
  "analysis": {
    "strengths": ["优势1", "优势2"],
    "weaknesses": ["不足1", "不足2"]
  },
  "sentiment": {
    "positive": 0.7,
    "neutral": 0.2,
    "negative": 0.1,
    "keywords": ["关键词1", "关键词2"]
  },
  "recommendations": ["建议1", "建议2"]
}

注意：只返回JSON数据，不要包含任何解释或思考过程。`;
        break;

      default:
        return NextResponse.json({ error: 'Invalid recommendation type' }, { status: 400 });
    }

    const messages = [
      {
        role: 'system' as const,
        content: '你是一个专业的非学历培训全周期管理专家，擅长培训方案设计、资源匹配、成本测算和效果评估。请始终以纯JSON格式返回结果，不要包含任何解释或思考过程。',
      },
      { role: 'user' as const, content: prompt },
    ];

    const response = await client.invoke(messages, {
      temperature: 0.7,
    });

    // 解析JSON响应
    let result;
    try {
      let content = response.content || '';
      
      // 移除 AI 思考过程（如 <think>...</think> 和 ◁think▷...◁/think▷）
      content = content.replace(/<[\/]?think>/g, '');
      content = content.replace(/◁[\/]?think▷/g, '');
      content = content.replace(/◁think▷[\s\S]*?◁\/think▷/g, '');
      
      // 尝试提取JSON块
      const jsonBlockMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonBlockMatch) {
        content = jsonBlockMatch[1].trim();
      }
      
      // 尝试找到第一个完整的JSON对象
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
          try {
            result = JSON.parse(jsonStr);
          } catch {
            const cleanedJson = jsonStr
              .replace(/,\s*}/g, '}')
              .replace(/,\s*]/g, ']');
            try {
              result = JSON.parse(cleanedJson);
            } catch (e) {
              console.error('JSON parse error after cleaning:', e);
              result = { raw: response.content };
            }
          }
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
    console.error('AI recommend error:', error);
    return NextResponse.json({ error: 'Failed to generate recommendation' }, { status: 500 });
  }
}
