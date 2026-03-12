import { NextRequest, NextResponse } from 'next/server';
import { LLMClient, Config, HeaderUtils } from 'coze-coding-dev-sdk';
import { 
  db, teachers, venues, courseTemplates, normativeDocuments, userProfiles,
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
      case 'courses': {
        // 获取历史课程数据
        const courseTemplatesData = db
          .select()
          .from(courseTemplates)
          .where(eq(courseTemplates.isActive, true))
          .limit(20)
          .all();
        
        contextData = courseTemplatesData.length > 0 
          ? `\n\n参考课程模板：\n${JSON.stringify(courseTemplatesData.slice(0, 10).map((c: Record<string, unknown>) => ({
              name: c.name,
              category: c.category,
              targetAudience: c.target_audience
            })), null, 2)}`
          : '';
        
        // 获取用户特征库数据（用于个性化推荐）
        const userProfilesData = db
          .select()
          .from(userProfiles)
          .where(eq(userProfiles.isActive, true))
          .limit(50)
          .all();
        
        // 分析目标人群的用户特征
        let userProfileContext = '';
        if (userProfilesData.length > 0 && projectData.targetAudience) {
          // 筛选与目标人群匹配的用户
          const matchingUsers = userProfilesData.filter((u: Record<string, unknown>) => {
            const dept = (u.department as string) || '';
            const position = (u.position as string) || '';
            const target = (projectData.targetAudience as string) || '';
            return dept.includes(target) || position.includes(target) || target.includes(dept) || target.includes(position);
          });
          
          if (matchingUsers.length > 0) {
            // 统计用户偏好
            const preferences: Record<string, number> = {};
            const styles: Record<string, number> = {};
            matchingUsers.forEach((u: Record<string, unknown>) => {
              if (u.preferredTrainingTypes) {
                try {
                  const types = JSON.parse(u.preferredTrainingTypes as string);
                  types.forEach((t: string) => {
                    preferences[t] = (preferences[t] || 0) + 1;
                  });
                } catch {
                  // 忽略解析错误
                }
              }
              if (u.learningStyle) {
                styles[u.learningStyle as string] = (styles[u.learningStyle as string] || 0) + 1;
              }
            });
            
            // 计算平均满意度
            const avgSatisfaction = matchingUsers
              .filter((u: Record<string, unknown>) => u.avgSatisfactionScore)
              .reduce((sum: number, u: Record<string, unknown>) => sum + (u.avgSatisfactionScore as number), 0) / 
              matchingUsers.filter((u: Record<string, unknown>) => u.avgSatisfactionScore).length || 0;
            
            userProfileContext = `\n\n目标人群特征分析（基于${matchingUsers.length}名用户数据）：` +
              `\n- 偏好培训类型：${Object.entries(preferences).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k, v]) => `${k}(${v}人)`).join('、') || '暂无数据'}` +
              `\n- 学习风格分布：${Object.entries(styles).map(([k, v]) => `${k}(${v}人)`).join('、') || '暂无数据'}` +
              `\n- 历史平均满意度：${avgSatisfaction > 0 ? avgSatisfaction.toFixed(1) + '分' : '暂无数据'}`;
          }
        }
        
        const budgetStr = projectData.noBudgetLimit || (!projectData.budgetMin && !projectData.budgetMax)
          ? '无预算限制'
          : `${projectData.budgetMin || 0} - ${projectData.budgetMax || 0}万元`;
        
        prompt = `你是培训方案设计专家。请为以下培训项目设计课程安排：

培训主题：${projectData.name || projectData.trainingTarget || '未指定'}
培训类型：${projectData.trainingTarget || '未指定'}
目标人群：${projectData.targetAudience || '未指定'}
参训人数：${projectData.participantCount || 0}人
培训天数：${projectData.trainingDays || 0}天
总课时：${projectData.trainingHours || 0}课时
平均每天课时：${projectData.trainingHours && projectData.trainingDays ? Math.round((projectData.trainingHours / projectData.trainingDays) * 10) / 10 : '未指定'}
预算：${budgetStr}
特殊要求：${projectData.specialRequirements || '无'}
${contextData}${userProfileContext}

要求：
1. 所有课程必须紧扣培训主题，不要生成无关课程
2. 总课时必须严格等于${projectData.trainingHours || 32}课时，不能多也不能少
3. 【重要】根据"平均每天课时"合理安排每天的课时量：
   - 如果平均每天≤4课时：每天安排半天课程即可
   - 如果平均每天在5-8课时：安排上午+下午的课程
   - 如果平均每天>8课时：可以考虑安排晚上课程
   - 不要机械地每天安排相同课时，可以有适当变化
4. 每门课程时长必须是4课时或2课时：
   - 4课时 = 半天（上午或下午的标准单位）
   - 2课时 = 短课程（如晚上课程）
   - 禁止生成6、8、10、12课时的单门课程
   - 如果内容较多需要拆分为多门课程，命名使用"（上）"、"（下）"、"（中）"区分
5. 每门课程标注建议讲师职称
6. 考虑目标人群的特征偏好进行个性化设计

返回JSON格式：
{
  "courses": [
    {"day": 1, "name": "课程名", "duration": 4, "description": "内容概述", "category": "类别", "teacherTitle": "讲师职称"}
  ],
  "summary": "方案说明"
}

只返回JSON。`;
        break;
      }

      case 'modify-courses':
        prompt = `你是培训方案设计专家。请根据用户意见调整课程方案。

培训主题：${projectData.name || projectData.trainingTarget || '未指定'}
培训类型：${projectData.trainingTarget || '未指定'}
目标人群：${projectData.targetAudience || '未指定'}
总课时：${projectData.trainingHours || 32}课时
培训天数：${projectData.trainingDays || 4}天
平均每天课时：${projectData.trainingHours && projectData.trainingDays ? Math.round((projectData.trainingHours / projectData.trainingDays) * 10) / 10 : '未指定'}

当前方案：
${JSON.stringify(projectData.currentCourses, null, 2)}

用户修改意见：
${projectData.modifySuggestion}

要求：
1. 根据意见调整课程，保持与培训主题相关
2. 总课时必须严格等于${projectData.trainingHours || 32}课时
3. 根据"平均每天课时"合理安排每天的课时量，不要机械地每天排满
4. 课程时长必须是4课时或2课时，禁止生成6、8、10、12课时的单门课程
5. 如果内容较多需要拆分为多门课程，命名使用"（上）"、"（下）"、"（中）"区分

返回JSON格式：
{
  "courses": [
    {"day": 1, "name": "课程名", "duration": 4, "description": "概述", "category": "类别", "teacherTitle": "职称"}
  ],
  "summary": "调整说明"
}

只返回JSON。`;
        break;

      case 'teachers': {
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
      }

      case 'venues': {
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
      }

      case 'quotation': {
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
      }

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
      
      // 移除 AI 思考过程
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
