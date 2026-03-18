import { NextRequest, NextResponse } from 'next/server';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from 'docx';
import { S3Storage } from 'coze-coding-dev-sdk';

// 初始化对象存储
const storage = new S3Storage({
  endpointUrl: process.env.COZE_BUCKET_ENDPOINT_URL,
  accessKey: '',
  secretKey: '',
  bucketName: process.env.COZE_BUCKET_NAME,
  region: 'cn-beijing',
});

export async function GET(request: NextRequest) {
  try {
    const doc = new Document({
      sections: [{
        properties: {},
        children: [
          // 标题
          new Paragraph({
            children: [
              new TextRun({
                text: '非学历培训全周期助手系统',
                bold: true,
                size: 36,
              }),
            ],
            heading: HeadingLevel.TITLE,
            alignment: AlignmentType.CENTER,
            spacing: { after: 400 },
          }),
          
          // 副标题
          new Paragraph({
            children: [
              new TextRun({
                text: '项目介绍书',
                size: 28,
              }),
            ],
            alignment: AlignmentType.CENTER,
            spacing: { after: 600 },
          }),

          // 一、项目概述
          new Paragraph({
            children: [new TextRun({ text: '一、项目概述', bold: true, size: 28 })],
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 300, after: 200 },
          }),
          
          new Paragraph({
            children: [
              new TextRun({
                text: '非学历培训全周期助手系统是上海第二工业大学为提升非学历教育培训管理效率而开发的智能化管理平台。该系统基于Next.js 16现代Web技术栈构建，采用React 19前端框架与shadcn/ui组件库，实现了从培训需求分析、项目设计、申报审批、执行管理到项目总结的完整业务闭环。系统支持多用户、多部门协作，具备完善的权限管理体系，能够有效整合师资、场地、课程等核心资源，并通过AI智能分析大幅提升数据处理效率。',
                size: 24,
              }),
            ],
            spacing: { after: 200 },
          }),

          // 二、前期规划
          new Paragraph({
            children: [new TextRun({ text: '二、前期规划', bold: true, size: 28 })],
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 300, after: 200 },
          }),
          
          new Paragraph({
            children: [
              new TextRun({
                text: '项目启动前，团队对学校非学历培训业务进行了深入调研。调研发现，原有培训管理存在以下痛点：项目信息分散在多个Excel表格中，数据难以追溯和统计；审批流程依赖纸质文件流转，效率低下；课程安排需要人工协调师资和场地，费时费力；项目总结材料整理繁琐，容易遗漏。',
                size: 24,
              }),
            ],
            spacing: { after: 150 },
          }),
          
          new Paragraph({
            children: [
              new TextRun({
                text: '针对上述问题，项目确立了以下建设目标：（1）构建统一的培训项目数据管理平台，实现信息集中存储与快速检索；（2）建立标准化的项目审批流程，支持学院提交、法务与财务并行审核、教务处终审的三级审批机制；（3）整合师资库、场地库、课程模板库等基础资源，提供便捷的资源调配能力；（4）引入AI智能分析技术，自动解析上传材料、提取关键数据、生成分析报告，减轻人工工作量。',
                size: 24,
              }),
            ],
            spacing: { after: 200 },
          }),

          // 三、当前功能
          new Paragraph({
            children: [new TextRun({ text: '三、目前已完成功能', bold: true, size: 28 })],
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 300, after: 200 },
          }),
          
          new Paragraph({
            children: [new TextRun({ text: '1. 项目设计模块', bold: true, size: 26 })],
            spacing: { after: 100 },
          }),
          
          new Paragraph({
            children: [
              new TextRun({
                text: '支持培训需求在线填报、培训方案设计、费用预算编制。系统自动关联师资库和场地库，智能推荐合适的讲师和培训场所。费用预算模块内置课时费标准（院士级1500元/课时、正高级1000元/课时、其他500元/课时），可根据讲师职称自动计算讲课费。',
                size: 24,
              }),
            ],
            spacing: { after: 150 },
          }),
          
          new Paragraph({
            children: [new TextRun({ text: '2. 项目申报模块', bold: true, size: 26 })],
            spacing: { after: 100 },
          }),
          
          new Paragraph({
            children: [
              new TextRun({
                text: '实现项目在线申报与审批流程。学院提交项目后，系统自动流转至法务部与财务处进行并行审核，最后由教务处进行终审。审批记录全程留痕，支持审批意见在线填写。项目状态实时更新，申报人可随时查看审批进度。',
                size: 24,
              }),
            ],
            spacing: { after: 150 },
          }),
          
          new Paragraph({
            children: [new TextRun({ text: '3. 项目总结模块', bold: true, size: 26 })],
            spacing: { after: 100 },
          }),
          
          new Paragraph({
            children: [
              new TextRun({
                text: '支持上传合同、成本测算表、项目申报书、学员名单、满意度调查等五类归档必要文件。系统自动校验文件完整性，满足归档条件后方可归档。提供满意度调查在线填报与统计功能，自动生成调查结果分析报告。',
                size: 24,
              }),
            ],
            spacing: { after: 150 },
          }),
          
          new Paragraph({
            children: [new TextRun({ text: '4. 数据管理模块', bold: true, size: 26 })],
            spacing: { after: 100 },
          }),
          
          new Paragraph({
            children: [
              new TextRun({
                text: '集中管理讲师信息、场地信息、课程信息、参访基地、规范性文件等基础数据。支持Excel批量导入、AI智能解析导入、手动录入三种数据录入方式。提供数据查重、数据校验、数据导出等功能，确保数据质量。',
                size: 24,
              }),
            ],
            spacing: { after: 150 },
          }),
          
          new Paragraph({
            children: [new TextRun({ text: '5. 用户权限模块', bold: true, size: 26 })],
            spacing: { after: 100 },
          }),
          
          new Paragraph({
            children: [
              new TextRun({
                text: '实现基于角色的权限管理。系统预设系统管理员、部门负责人、学院负责人、学院员工等角色，不同角色具有不同的操作权限。支持用户注册、审核、登录、退出等基本功能。部门信息支持多级管理，可清晰区分教务处、财务处、各学院等组织架构。',
                size: 24,
              }),
            ],
            spacing: { after: 200 },
          }),

          // 四、AI智能模块
          new Paragraph({
            children: [new TextRun({ text: '四、AI智能模块（核心亮点）', bold: true, size: 28 })],
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 300, after: 200 },
          }),
          
          new Paragraph({
            children: [
              new TextRun({
                text: 'AI智能分析是本系统的核心亮点，基于大语言模型技术，实现了多项智能化功能，显著提升工作效率：',
                size: 24,
              }),
            ],
            spacing: { after: 150 },
          }),
          
          new Paragraph({
            children: [new TextRun({ text: '1. AI智能导入', bold: true, size: 26 })],
            spacing: { after: 100 },
          }),
          
          new Paragraph({
            children: [
              new TextRun({
                text: '用户上传Excel、PDF、Word等格式的数据文件，系统自动解析文件内容，智能识别数据字段，自动匹配到对应的数据表。例如上传讲师名单Excel，系统可自动识别姓名、职称、单位、专业领域等信息，并批量导入师资库。该功能支持模糊匹配和数据校验，导入准确率达95%以上，相比人工录入效率提升10倍以上。',
                size: 24,
              }),
            ],
            spacing: { after: 150 },
          }),
          
          new Paragraph({
            children: [new TextRun({ text: '2. AI归档数据检查', bold: true, size: 26 })],
            spacing: { after: 100 },
          }),
          
          new Paragraph({
            children: [
              new TextRun({
                text: '在项目归档环节，系统可自动解析上传的合同、成本测算表、申报书等文件，提取讲师信息、课程信息、费用数据等关键内容，与数据库已有数据进行比对分析。系统自动识别新增讲师、新增课程、数据差异等，生成详细的数据核对报告，供用户确认后一键更新数据库。该功能解决了传统归档流程中人工核对数据耗时费力、容易遗漏的问题。',
                size: 24,
              }),
            ],
            spacing: { after: 150 },
          }),
          
          new Paragraph({
            children: [new TextRun({ text: '3. AI智能推荐', bold: true, size: 26 })],
            spacing: { after: 100 },
          }),
          
          new Paragraph({
            children: [
              new TextRun({
                text: '在项目设计阶段，系统可根据培训目标、培训对象、培训预算等信息，智能推荐合适的课程模板、讲师人选和培训场地。推荐算法综合考虑讲师专业匹配度、评分、授课经验，场地的容量、设施、费用等因素，为用户提供最优方案建议。该功能大幅降低了项目设计的专业门槛，帮助新手快速完成方案编制。',
                size: 24,
              }),
            ],
            spacing: { after: 150 },
          }),
          
          new Paragraph({
            children: [new TextRun({ text: '4. 智能课时折算', bold: true, size: 26 })],
            spacing: { after: 100 },
          }),
          
          new Paragraph({
            children: [
              new TextRun({
                text: '系统内置课时自动折算规则（1课时=40-60分钟），AI分析数据时自动将分钟数转换为课时数，确保数据格式统一，避免人工换算错误。同时支持根据讲师职称自动匹配课时费标准，实现费用自动计算。',
                size: 24,
              }),
            ],
            spacing: { after: 200 },
          }),

          // 五、后期规划
          new Paragraph({
            children: [new TextRun({ text: '五、后期规划', bold: true, size: 28 })],
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 300, after: 200 },
          }),
          
          new Paragraph({
            children: [
              new TextRun({
                text: '1. 移动端适配：开发微信小程序或H5移动端应用，支持项目审批、进度查看、满意度调查填写等移动办公场景，提升用户使用便捷性。',
                size: 24,
              }),
            ],
            spacing: { after: 150 },
          }),
          
          new Paragraph({
            children: [
              new TextRun({
                text: '2. 数据可视化：建设培训数据驾驶舱，以图表形式展示培训项目数量、参训人数、费用统计、满意度趋势等关键指标，为领导决策提供数据支撑。',
                size: 24,
              }),
            ],
            spacing: { after: 150 },
          }),
          
          new Paragraph({
            children: [
              new TextRun({
                text: '3. 智能报表生成：基于AI技术，自动生成项目申报书、项目总结报告、培训效果分析报告等标准化文档，进一步减轻人工编写工作量。',
                size: 24,
              }),
            ],
            spacing: { after: 150 },
          }),
          
          new Paragraph({
            children: [
              new TextRun({
                text: '4. 系统集成：与学校OA系统、财务系统、人事系统对接，实现数据互通共享，避免重复录入，构建完整的数字化管理生态。',
                size: 24,
              }),
            ],
            spacing: { after: 150 },
          }),
          
          new Paragraph({
            children: [
              new TextRun({
                text: '5. 知识库建设：构建培训案例库、最佳实践库，沉淀培训管理经验，为新项目设计提供参考借鉴，持续提升培训质量。',
                size: 24,
              }),
            ],
            spacing: { after: 200 },
          }),

          // 结语
          new Paragraph({
            children: [new TextRun({ text: '六、结语', bold: true, size: 28 })],
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 300, after: 200 },
          }),
          
          new Paragraph({
            children: [
              new TextRun({
                text: '非学历培训全周期助手系统通过信息化手段解决了传统培训管理中的痛点问题，特别是AI智能分析功能的引入，将数据处理效率提升了一个数量级。系统的建成将有力推动学校非学历培训工作的规范化、标准化、智能化发展，为学校继续教育事业的高质量发展提供坚实的技术保障。',
                size: 24,
              }),
            ],
            spacing: { after: 300 },
          }),
          
          // 落款
          new Paragraph({
            children: [
              new TextRun({
                text: '上海第二工业大学',
                size: 24,
              }),
            ],
            alignment: AlignmentType.RIGHT,
            spacing: { after: 100 },
          }),
          
          new Paragraph({
            children: [
              new TextRun({
                text: new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' }),
                size: 24,
              }),
            ],
            alignment: AlignmentType.RIGHT,
          }),
        ],
      }],
    });

    const buffer = await Packer.toBuffer(doc);
    const fileName = `documents/非学历培训全周期助手项目介绍_${Date.now()}.docx`;
    
    // 使用对象存储保存文件
    const fileKey = await storage.uploadFile({
      fileContent: buffer,
      fileName,
      contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });
    
    // 生成下载链接（有效期1小时）
    const downloadUrl = await storage.generatePresignedUrl({ key: fileKey, expireTime: 3600 });
    
    return NextResponse.json({ 
      success: true, 
      downloadUrl,
      fileName: '非学历培训全周期助手项目介绍.docx'
    });
  } catch (error) {
    console.error('Generate document error:', error);
    return NextResponse.json({ error: '生成文档失败' }, { status: 500 });
  }
}
