import { NextRequest, NextResponse } from 'next/server';
import { LLMClient, Config, HeaderUtils } from 'coze-coding-dev-sdk';
import { 
  db, teachers, venues, courses, normativeDocuments, userProfiles, visitSites,
  eq, desc, sql, and, ensureDatabaseReady 
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
        // 获取所有课程模板（从 courses 表查询 isTemplate = true）
        const courseTemplatesData = db
          .select()
          .from(courses)
          .where(and(eq(courses.isTemplate, true), eq(courses.isActive, true)))
          .all();
        
        // 获取所有讲师
        const teachersData = db
          .select()
          .from(teachers)
          .where(eq(teachers.isActive, true))
          .all();
        
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
        
        // 匹配课程模板：根据培训目标、目标人群、培训类型进行匹配
        const trainingTarget = (projectData.trainingTarget as string) || '';
        const targetAudience = (projectData.targetAudience as string) || '';
        const projectName = (projectData.name as string) || '';
        
        // 计算模板匹配分数
        const scoredTemplates = courseTemplatesData.map((t: Record<string, unknown>) => {
          let score = 0;
          const templateCategory = (t.category as string) || '';
          const templateTarget = (t.targetAudience as string) || '';
          const templateName = (t.name as string) || '';
          
          // 培训类型匹配
          if (trainingTarget && templateCategory) {
            if (templateCategory.includes(trainingTarget) || trainingTarget.includes(templateCategory)) {
              score += 30;
            }
          }
          
          // 目标人群匹配
          if (targetAudience && templateTarget) {
            if (templateTarget.includes(targetAudience) || targetAudience.includes(templateTarget)) {
              score += 30;
            }
          }
          
          // 项目名称关键词匹配
          if (projectName && templateName) {
            const projectKeywords = projectName.split(/[，,、\s]+/).filter((k: string) => k.length > 1);
            projectKeywords.forEach((keyword: string) => {
              if (templateName.includes(keyword)) {
                score += 10;
              }
            });
          }
          
          // 使用频率加分
          score += Math.min((t.usageCount as number) || 0, 20);
          
          // 评分加分
          score += ((t.avgRating as number) || 4) * 2;
          
          return { template: t, score };
        });
        
        // 筛选高匹配度的模板（分数 >= 30）
        const matchedTemplates = scoredTemplates
          .filter(st => st.score >= 30)
          .sort((a, b) => b.score - a.score)
          .slice(0, 10)
          .map(st => st.template);
        
        // 为匹配的模板匹配合适的讲师
        const templatesWithTeachers = matchedTemplates.map((t: Record<string, unknown>) => {
          const templateCategory = (t.category as string) || '';
          const templateDesc = (t.description as string) || '';
          
          // 匹配讲师：根据专业方向
          const matchingTeachers = teachersData.filter((teacher: Record<string, unknown>) => {
            const teacherExpertise = (teacher.expertise as string) || '';
            const teacherTitle = (teacher.title as string) || '';
            return (
              teacherExpertise.includes(templateCategory) ||
              templateCategory.includes(teacherExpertise) ||
              teacherExpertise.includes(templateDesc) ||
              templateDesc.includes(teacherExpertise) ||
              // 管理类培训匹配
              (templateCategory.includes('管理') && (teacherTitle.includes('教授') || teacherTitle.includes('研究员'))) ||
              // 技能类培训匹配
              (templateCategory.includes('技能') && (teacherTitle.includes('工程师') || teacherTitle.includes('技师')))
            );
          });
          
          // 选择评分最高的讲师
          const bestTeacher = matchingTeachers.sort((a: Record<string, unknown>, b: Record<string, unknown>) => {
            const ratingA = (a.rating as number) || 0;
            const ratingB = (b.rating as number) || 0;
            return ratingB - ratingA;
          })[0];
          
          return {
            ...t,
            matchedTeacher: bestTeacher ? {
              id: bestTeacher.id,
              name: bestTeacher.name,
              title: bestTeacher.title,
            } : null,
          };
        });
        
        const totalHours = projectData.trainingHours || 32;
        const trainingDays = projectData.trainingDays || 4;
        const avgHoursPerDay = Math.round((totalHours / trainingDays) * 10) / 10;
        
        const budgetStr = projectData.noBudgetLimit || (!projectData.budgetMin && !projectData.budgetMax)
          ? '无预算限制'
          : `${projectData.budgetMin || 0} - ${projectData.budgetMax || 0}万元`;
        
        // 如果有足够的匹配模板，优先使用模板组合方案
        let templateContext = '';
        if (templatesWithTeachers.length > 0) {
          templateContext = `\n\n【优先使用以下匹配的课程模板】（已按匹配度排序）：
${templatesWithTeachers.map((t: Record<string, unknown>, idx: number) => {
  const template = t as Record<string, unknown>;
  const teacher = template.matchedTeacher as Record<string, unknown> | null;
  return `${idx + 1}. ${template.name}
   - 类别：${template.category || '未分类'}
   - 课时：${template.duration || 4}课时
   - 目标人群：${template.targetAudience || '不限'}
   - 可用讲师：${teacher ? `${teacher.name}（${teacher.title}）` : '需AI推荐'}`;
}).join('\n')}

【重要】请优先从上述模板中选择课程组合方案，如果模板课程总课时不足，再自行设计补充课程。`;
        }
        
        // 获取参访基地数据并匹配
        const visitSitesData = db
          .select()
          .from(visitSites)
          .where(eq(visitSites.isActive, true))
          .all();
        
        // 计算参访基地匹配分数
        const scoredVisitSites = visitSitesData.map((site: Record<string, unknown>) => {
          let score = 0;
          const siteIndustry = (site.industry as string) || '';
          const siteType = (site.type as string) || '';
          const siteName = (site.name as string) || '';
          const visitContent = (site.visitContent as string) || '';
          
          // 培训类型匹配
          if (trainingTarget && (siteIndustry || siteType)) {
            if (siteIndustry.includes(trainingTarget) || trainingTarget.includes(siteIndustry)) {
              score += 30;
            }
            if (siteType.includes(trainingTarget) || trainingTarget.includes(siteType)) {
              score += 20;
            }
          }
          
          // 项目名称关键词匹配
          if (projectName && siteName) {
            const projectKeywords = projectName.split(/[，,、\s]+/).filter((k: string) => k.length > 1);
            projectKeywords.forEach((keyword: string) => {
              if (siteName.includes(keyword) || visitContent.includes(keyword)) {
                score += 10;
              }
            });
          }
          
          // 访问次数加分
          score += Math.min((site.visitCount as number) || 0, 20);
          
          // 评分加分
          score += ((site.rating as number) || 4) * 2;
          
          return { site, score };
        });
        
        // 筛选高匹配度的参访基地（分数 >= 20）
        const matchedVisitSites = scoredVisitSites
          .filter(ss => ss.score >= 20)
          .sort((a, b) => b.score - a.score)
          .slice(0, 5)
          .map(ss => ss.site);
        
        // 构建参访基地上下文
        let visitSitesContext = '';
        if (matchedVisitSites.length > 0) {
          visitSitesContext = `\n\n【优先使用以下匹配的参访基地】（已按匹配度排序）：
${matchedVisitSites.map((site: Record<string, unknown>, idx: number) => {
  return `${idx + 1}. ${site.name}
   - 类型：${site.type || '未分类'}
   - 行业：${site.industry || '未指定'}
   - 地址：${site.address || '未指定'}
   - 参访内容：${site.visitContent || '暂无详情'}
   - 最大接待人数：${site.maxVisitors || '不限'}人
   - 参访时长：${site.visitDuration || 2}小时
   - 费用：${site.visitFee ? site.visitFee + '元/人' : '免费'}`;
}).join('\n')}

【重要】如果培训方案中包含参访环节，请优先从上述基地中选择。`;
        }
        
        prompt = `你是培训方案设计专家。请为以下培训项目设计课程安排：

培训主题：${projectData.name || projectData.trainingTarget || '未指定'}
培训类型：${projectData.trainingTarget || '未指定'}
目标人群：${projectData.targetAudience || '未指定'}
参训人数：${projectData.participantCount || 0}人
培训天数：${trainingDays}天
总课时：${totalHours}课时
平均每天课时：${avgHoursPerDay}
预算：${budgetStr}
特殊要求：${projectData.specialRequirements || '无'}
${templateContext}${visitSitesContext}${userProfileContext}

要求：
1. 【优先使用模板】如果上述有匹配的课程模板，请优先选择模板课程组合方案
2. 【参访安排】根据培训主题和天数，合理安排1-2次参访活动（如果培训天数>=2天）
   - 如果有匹配的参访基地，优先从中选择
   - 参访通常安排2-4课时，计入总课时
   - 参访内容应与培训主题相关
3. 所有课程必须紧扣培训主题，不要生成无关课程
4. 总课时必须严格等于${totalHours}课时，不能多也不能少
5. 【重要】根据"平均每天课时"合理安排每天的课时量：
   - 如果平均每天≤4课时：每天安排半天课程即可
   - 如果平均每天在5-8课时：安排上午+下午的课程
   - 如果平均每天>8课时：可以考虑安排晚上课程
   - 不要机械地每天安排相同课时，可以有适当变化
6. 每门课程时长必须是4课时或2课时：
   - 4课时 = 半天（上午或下午的标准单位）
   - 2课时 = 短课程（如晚上课程）
   - 参访活动可以是2-4课时
   - 禁止生成6、8、10、12课时的单门课程
   - 如果内容较多需要拆分为多门课程，命名使用"（上）"、"（下）"、"（中）"区分
7. 每门课程标注建议讲师职称
8. 如果使用了模板中的讲师，在 teacherName 字段中标注讲师姓名
9. 考虑目标人群的特征偏好进行个性化设计

返回JSON格式：
{
  "courses": [
    {
      "day": 1, 
      "name": "课程名或参访活动名", 
      "duration": 4, 
      "description": "内容概述", 
      "category": "类别", 
      "type": "course或visit",
      "teacherTitle": "讲师职称（仅当type=course且isFromTemplate=false时填写）", 
      "teacherName": "讲师姓名（使用模板讲师时必填）",
      "templateId": "模板ID（如使用模板）",
      "isFromTemplate": true/false,
      "visitSiteId": "参访基地ID（如使用库中基地）",
      "visitSiteName": "参访基地名称",
      "isFromVisitLibrary": true/false
    }
  ],
  "summary": "方案说明",
  "templateUsage": {"used": 3, "total": 5},
  "visitUsage": {"used": 1, "total": 2}
}

【重要字段说明】：
- type: "course"表示课程，"visit"表示参访活动
- isFromTemplate: 布尔值，true表示使用了课程模板
- isFromVisitLibrary: 布尔值，true表示使用了参访基地库中的基地
- teacherName: 如果使用了模板且模板有匹配的讲师，填写讲师姓名
- teacherTitle: 仅当没有使用模板时填写建议讲师职称
- visitSiteId: 如果使用了参访基地库中的基地，填写基地ID
- visitSiteName: 参访基地名称（使用库中基地时必填）

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
