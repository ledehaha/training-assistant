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
          let score = 10; // 所有模板都有基础分，确保都能被考虑
          const templateCategory = (t.category as string) || '';
          const templateTarget = (t.targetAudience as string) || '';
          const templateName = (t.name as string) || '';
          const templateDesc = (t.description as string) || '';
          
          // 培训类型匹配（增强匹配逻辑）
          if (trainingTarget && templateCategory) {
            // 完全匹配
            if (templateCategory === trainingTarget) {
              score += 40;
            }
            // 包含匹配
            else if (templateCategory.includes(trainingTarget) || trainingTarget.includes(templateCategory)) {
              score += 30;
            }
            // 模糊匹配：关键词重叠
            else {
              const targetKeywords = trainingTarget.split(/[，,、\s]+/).filter((k: string) => k.length > 1);
              const categoryKeywords = templateCategory.split(/[，,、\s]+/).filter((k: string) => k.length > 1);
              const overlap = targetKeywords.filter((k: string) => categoryKeywords.some((ck: string) => k.includes(ck) || ck.includes(k)));
              if (overlap.length > 0) {
                score += overlap.length * 10;
              }
            }
          }
          
          // 目标人群匹配（增强匹配逻辑）
          if (targetAudience && templateTarget) {
            // 完全匹配
            if (templateTarget === targetAudience) {
              score += 40;
            }
            // 包含匹配
            else if (templateTarget.includes(targetAudience) || targetAudience.includes(templateTarget)) {
              score += 30;
            }
            // 模糊匹配
            else {
              const targetKeywords = targetAudience.split(/[，,、\s]+/).filter((k: string) => k.length > 1);
              const audienceKeywords = templateTarget.split(/[，,、\s]+/).filter((k: string) => k.length > 1);
              const overlap = targetKeywords.filter((k: string) => audienceKeywords.some((ak: string) => k.includes(ak) || ak.includes(k)));
              if (overlap.length > 0) {
                score += overlap.length * 10;
              }
            }
          }
          
          // 课程名称与项目名称/培训类型匹配
          if (projectName && templateName) {
            const projectKeywords = projectName.split(/[，,、\s]+/).filter((k: string) => k.length > 1);
            projectKeywords.forEach((keyword: string) => {
              if (templateName.includes(keyword) || templateDesc.includes(keyword)) {
                score += 10;
              }
            });
          }
          
          // 课程描述与培训类型匹配
          if (trainingTarget && templateDesc) {
            if (templateDesc.includes(trainingTarget)) {
              score += 15;
            }
          }
          
          // 使用频率加分（热门课程优先）
          score += Math.min((t.usageCount as number) || 0, 20);
          
          // 评分加分
          score += ((t.avgRating as number) || 4) * 2;
          
          return { template: t, score };
        });
        
        // 筛选匹配的模板（降低阈值，确保更多模板被考虑）
        const matchedTemplates = scoredTemplates
          .sort((a, b) => b.score - a.score)
          .slice(0, 15) // 增加候选数量
          .map(st => st.template);
        
        // 为匹配的模板匹配合适的讲师
        const templatesWithTeachers = matchedTemplates.map((t: Record<string, unknown>) => {
          // 1. 优先使用模板已关联的讲师
          const templateTeacherId = t.teacherId as string | undefined;
          if (templateTeacherId) {
            const linkedTeacher = teachersData.find((teacher: Record<string, unknown>) => teacher.id === templateTeacherId);
            if (linkedTeacher) {
              return {
                ...t,
                matchedTeacher: {
                  id: linkedTeacher.id,
                  name: linkedTeacher.name,
                  title: linkedTeacher.title,
                },
              };
            }
          }
          
          // 2. 根据课程类别和描述匹配合适的讲师
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
        
        // 构建课程模板上下文 - 即使没有高匹配模板，也显示所有可用模板
        let templateContext = '';
        const templatesToShow = templatesWithTeachers.length > 0 ? templatesWithTeachers : matchedTemplates.slice(0, 10);
        
        if (templatesToShow.length > 0) {
          // 计算模板总课时
          const templateTotalHours = templatesToShow.reduce((sum: number, t: Record<string, unknown>) => sum + ((t.duration as number) || 4), 0);
          
          templateContext = `\n\n【课程模板库 - 必须优先使用】
以下是系统中已有的课程模板，请优先从中选择课程组合方案：

${templatesToShow.map((t: Record<string, unknown>, idx: number) => {
  const template = t as Record<string, unknown>;
  const teacher = template.matchedTeacher as Record<string, unknown> | null;
  
  return `${idx + 1}. ${template.name}
   - 模板ID：${template.id}（使用时templateId必填此ID）
   - 类别：${template.category || '未分类'}
   - 课时：${template.duration || 4}课时
   - 关联讲师：${teacher ? `${teacher.name}，讲师ID：${teacher.id}` : '无'}`;
}).join('\n')}

【讲师填写规则 - 简单明了】：

**情况1：使用模板库的课程（isFromTemplate=true）**
- 有关联讲师：填写 teacherName（讲师姓名）和 teacherId（讲师ID）
- 无关联讲师：填写 teacherTitle（建议职称，如"副教授"）

**情况2：AI自己生成的课程（isFromTemplate=false）**
- 只填写 teacherTitle（建议职称）
- 不填写 teacherName 和 teacherId

【其他规则】：
- 必须优先使用上述模板
- 使用模板时：isFromTemplate=true，templateId必填
- 总课时必须等于${totalHours}课时`;
        } else if (courseTemplatesData.length > 0) {
          // 如果没有匹配模板但有其他模板，显示所有模板
          templateContext = `\n\n【课程模板库 - 请优先使用】
以下是系统中已有的课程模板：

${courseTemplatesData.slice(0, 15).map((t: Record<string, unknown>, idx: number) => {
  return `${idx + 1}. ${t.name}
   - 模板ID：${t.id}
   - 类别：${t.category || '未分类'}
   - 课时：${t.duration || 4}课时`;
}).join('\n')}

【重要】请优先从上述模板中选择合适的课程。`;
        }
        
        // 获取参访基地数据并匹配
        const visitSitesData = db
          .select()
          .from(visitSites)
          .where(eq(visitSites.isActive, true))
          .all();
        
        // 获取培训地点
        const trainingLocation = (projectData.location as string) || '';
        
        // 计算参访基地匹配分数
        const scoredVisitSites = visitSitesData.map((site: Record<string, unknown>) => {
          let score = 0;
          const siteIndustry = (site.industry as string) || '';
          const siteType = (site.type as string) || '';
          const siteName = (site.name as string) || '';
          const visitContent = (site.visitContent as string) || '';
          const siteAddress = (site.address as string) || '';
          
          // 【最重要】培训地点匹配 - 必须在同一城市/地区
          if (trainingLocation && siteAddress) {
            // 提取城市名（去掉"市"、"省"等后缀进行比较）
            const locationCity = trainingLocation.replace(/[省市县区]/g, '').trim();
            const addressCity = siteAddress.replace(/[省市县区]/g, '').trim();
            
            // 完全匹配（地址包含培训地点，或培训地点包含地址城市）
            if (siteAddress.includes(locationCity) || locationCity.includes(addressCity) || addressCity.includes(locationCity)) {
              score += 100; // 地点匹配给予最高权重
            } else {
              // 地点不匹配，扣分
              score -= 50;
            }
          }
          
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
        
        // 筛选高匹配度的参访基地（优先选择地点匹配的）
        const matchedVisitSites = scoredVisitSites
          .filter(ss => ss.score > 0) // 过滤掉负分的（地点不匹配的）
          .sort((a, b) => b.score - a.score)
          .slice(0, 5)
          .map(ss => ss.site);
        
        // 构建参访基地上下文
        let visitSitesContext = '';
        if (matchedVisitSites.length > 0) {
          visitSitesContext = `\n\n【优先使用以下匹配的参访基地】（已按地点和匹配度排序）：
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

【重要规则】：
- 培训地点是"${trainingLocation || '未指定'}"，参访基地必须在同一城市或附近
- 优先从上述匹配的基地中选择（已筛选地点匹配的基地）
- 如果上述基地都不合适，可以在培训地点附近推荐其他参访点`;
        } else if (trainingLocation) {
          // 没有匹配的参访基地，但培训地点已指定
          visitSitesContext = `\n\n【参访安排提示】
培训地点：${trainingLocation}

注意：系统中暂无与培训地点"${trainingLocation}"匹配的参访基地。
- 如果需要安排参访，请在"${trainingLocation}"附近推荐合适的参访点
- 参访基地ID和名称可以留空，系统会自动处理`;
        }
        
        prompt = `你是培训方案设计专家。请为以下培训项目设计课程安排：

培训主题：${projectData.name || projectData.trainingTarget || '未指定'}
培训类型：${projectData.trainingTarget || '未指定'}
目标人群：${projectData.targetAudience || '未指定'}
培训地点：${projectData.location || '未指定'}
参训人数：${projectData.participantCount || 0}人
培训天数：${trainingDays}天
总课时：${totalHours}课时
平均每天课时：${avgHoursPerDay}
预算：${budgetStr}
特殊要求：${projectData.specialRequirements || '无'}
${templateContext}${visitSitesContext}${userProfileContext}

【核心要求 - 必须严格遵守】：

1. **【最重要】优先使用课程模板库中的模板**
   - 必须先从模板库中选择课程
   - 使用模板时：isFromTemplate=true，templateId填写模板ID
   - 只有当模板课程总课时不足时，才自行设计补充课程
   - 自行设计的课程：isFromTemplate=false

2. **参访安排**（培训天数>=2天时）
   - 安排1-2次参访活动，每次2-4课时
   - **【重要】参访地点必须与培训地点"${projectData.location || '未指定'}"在同一城市或附近**
   - 优先从匹配的参访基地中选择

3. **课时控制 - 必须精确**
   - 总课时必须严格等于${totalHours}课时
   - 单门课程课时只能是：1、2、4（禁止其他数值）

4. **讲师填写规则（重要）**
   - 使用模板库课程：填模板关联的讲师（teacherName + teacherId）
   - 使用模板库课程但无关联讲师：填建议职称（teacherTitle）
   - AI自己生成的课程：只填建议职称（teacherTitle）
   - 参访活动：不需要讲师信息

返回JSON格式：
{
  "courses": [
    {
      "day": 1, 
      "name": "课程名", 
      "duration": 4,
      "description": "内容概述", 
      "category": "类别", 
      "type": "course或visit",
      "isFromTemplate": true,
      "templateId": "模板ID（使用模板时必填）",
      "teacherName": "讲师姓名（使用模板有关联讲师时填）",
      "teacherId": "讲师ID（使用模板有关联讲师时填）",
      "teacherTitle": "建议职称（无关联讲师或AI生成时填，如'副教授'）",
      "visitSiteId": "参访基地ID",
      "visitSiteName": "参访基地名称",
      "isFromVisitLibrary": true
    }
  ],
  "totalDurationCheck": ${totalHours},
  "templateUsageCount": 5,
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
2. 【课时控制 - 最重要】
   - 总课时必须严格等于${projectData.trainingHours || 32}课时，一点都不能多也不能少
   - 生成完成后请逐一累加每门课程的duration，确保总和等于${projectData.trainingHours || 32}
3. 【单门课程课时数 - 必须遵守】
   - 课时数只能是：1、2、4 这三个数字
   - 4课时 = 标准半天课程（上午或下午）
   - 2课时 = 短课程（约2小时）
   - 1课时 = 极短课程（约1小时）
   - 【禁止】生成3、5、6、7、8等其他课时数
   - 【禁止】生成大于4的课时数
4. 根据"平均每天课时"合理安排每天的课时量，不要机械地每天排满
5. 如果内容较多需要拆分为多门课程，命名使用"（上）"、"（下）"、"（中）"区分

返回JSON格式：
{
  "courses": [
    {"day": 1, "name": "课程名", "duration": 4, "description": "概述", "category": "类别", "teacherTitle": "职称"}
  ],
  "totalDurationCheck": ${projectData.trainingHours || 32},
  "summary": "调整说明"
}

注意：只返回JSON数据，不要包含任何解释或思考过程。`;
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

      case 'adjust-single-course': {
        // AI调整单个课程
        prompt = `你是一个培训课程设计专家。请根据用户需求调整课程信息。

当前课程信息：
${JSON.stringify(projectData.currentCourse, null, 2)}

用户调整需求：
${projectData.adjustRequirement}

培训背景：
- 培训类型：${projectData.trainingTarget || '未指定'}
- 目标人群：${projectData.targetAudience || '未指定'}

要求：
1. 根据用户需求调整课程名称、描述、课时等字段
2. 保持课程的合理性和专业性
3. 课时只能是：1、2、4 这三个标准值（4课时=半天，2课时=约2小时，1课时=约1小时）
4. 如果需要特殊课时，可以是1-8之间的整数

请返回调整后的课程信息，格式如下：
{
  "course": {
    "name": "调整后的课程名称",
    "description": "调整后的课程描述",
    "duration": 4,
    "category": "课程类别",
    "teacherTitle": "建议讲师职称"
  }
}

注意：只返回JSON数据，不要包含任何解释或思考过程。`;
        break;
      }

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
