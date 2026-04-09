import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, BorderStyle, AlignmentType, HeadingLevel } from 'docx';
import * as XLSX from 'xlsx';

// 费用项数据结构
interface BudgetItem {
  name: string;
  category: string;
  unit: string;
  unitPrice: number;
  quantity: number;
  total: number;
  description?: string;
}

interface ProjectData {
  name: string;
  trainingTarget: string;
  targetAudience: string;
  participantCount: number;
  trainingDays: number;
  trainingPeriod: string;
  budgetMin: number;
  budgetMax: number;
  location: string;
  specialRequirements: string;
  budgetItems: BudgetItem[];
  totalBudget: number;
}

/**
 * 生成报价表（Excel 格式）
 */
export async function generateQuotationExcel(projectData: ProjectData): Promise<Blob> {
  // 按类别分组，过滤金额为0的项
  const categoryGroups = projectData.budgetItems.reduce((acc, item) => {
    if (item.total === 0) return acc;

    if (!acc[item.category]) {
      acc[item.category] = [];
    }
    acc[item.category].push(item);
    return acc;
  }, {} as Record<string, BudgetItem[]>);

  // 创建工作簿
  const workbook = XLSX.utils.book_new();

  // 创建报价表数据
  const quotationData = [
    ['培训项目报价表'],
    [''],
    ['项目名称', projectData.name],
    ['培训对象', projectData.targetAudience],
    ['参训人数', projectData.participantCount],
    ['培训天数', projectData.trainingDays],
    ['培训周期', projectData.trainingPeriod],
    ['培训地点', projectData.location],
    [''],
    ['费用明细'],
    ['类别', '项目名称', '单位', '单价', '数量', '金额', '说明'],
  ];

  // 添加费用明细
  Object.entries(categoryGroups).forEach(([category, items]) => {
    // 添加类别标题
    quotationData.push([category, '', '', '', '', '', '']);

    // 添加该类别下的所有项目
    items.forEach(item => {
      quotationData.push([
        '',
        item.name,
        item.unit,
        item.unitPrice,
        item.quantity,
        item.total,
        item.description || '',
      ]);
    });
  });

  // 添加总计
  quotationData.push([]);
  quotationData.push(['', '', '', '', '费用总计', projectData.totalBudget, '']);
  quotationData.push(['', '', '', '', '人均费用', Math.round(projectData.totalBudget / projectData.participantCount), '']);

  // 创建工作表
  const worksheet = XLSX.utils.aoa_to_sheet(quotationData);

  // 设置列宽
  worksheet['!cols'] = [
    { wch: 15 }, // 类别
    { wch: 30 }, // 项目名称
    { wch: 10 }, // 单位
    { wch: 10 }, // 单价
    { wch: 10 }, // 数量
    { wch: 12 }, // 金额
    { wch: 30 }, // 说明
  ];

  // 添加工作表到工作簿
  XLSX.utils.book_append_sheet(workbook, worksheet, '报价表');

  // 生成 Excel 文件
  const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  return new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

/**
 * 生成成本测算表（Excel 格式）
 */
export async function generateCostCalculationExcel(projectData: ProjectData): Promise<Blob> {
  // 按类别分组，过滤金额为0的项
  const categoryGroups = projectData.budgetItems.reduce((acc, item) => {
    if (item.total === 0) return acc;

    if (!acc[item.category]) {
      acc[item.category] = [];
    }
    acc[item.category].push(item);
    return acc;
  }, {} as Record<string, BudgetItem[]>);

  // 创建工作簿
  const workbook = XLSX.utils.book_new();

  // 创建成本测算表数据
  const costCalculationData = [
    [projectData.name + '-成本测算表'],
    [''],
    ['基本信息'],
    ['项目名称', projectData.name],
    ['培训目标', projectData.trainingTarget],
    ['培训对象', projectData.targetAudience],
    ['参训人数', projectData.participantCount],
    ['培训天数', projectData.trainingDays],
    ['培训周期', projectData.trainingPeriod],
    ['培训地点', projectData.location],
    [''],
    ['成本测算明细'],
    ['序号', '费用类别', '项目名称', '单位', '单价', '数量', '金额', '备注'],
  ];

  // 添加费用明细
  let seqNo = 1;
  Object.entries(categoryGroups).forEach(([category, items]) => {
    items.forEach(item => {
      costCalculationData.push([
        seqNo++,
        category,
        item.name,
        item.unit,
        item.unitPrice,
        item.quantity,
        item.total,
        item.description || '',
      ]);
    });
  });

  // 添加总计
  costCalculationData.push([]);
  costCalculationData.push(['', '', '', '', '', '', '成本总计', projectData.totalBudget]);
  costCalculationData.push(['', '', '', '', '', '', '人均成本', Math.round(projectData.totalBudget / projectData.participantCount)]);

  // 创建工作表
  const worksheet = XLSX.utils.aoa_to_sheet(costCalculationData);

  // 设置列宽
  worksheet['!cols'] = [
    { wch: 6 },  // 序号
    { wch: 15 }, // 费用类别
    { wch: 30 }, // 项目名称
    { wch: 10 }, // 单位
    { wch: 10 }, // 单价
    { wch: 10 }, // 数量
    { wch: 12 }, // 金额
    { wch: 30 }, // 备注
  ];

  // 添加工作表到工作簿
  XLSX.utils.book_append_sheet(workbook, worksheet, '成本测算表');

  // 生成 Excel 文件
  const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  return new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

/**
 * 生成项目申报表（Word 格式）
 */
export async function generateProjectApplicationWord(projectData: ProjectData): Promise<Blob> {
  // 按类别分组，过滤金额为0的项
  const categoryGroups = projectData.budgetItems.reduce((acc, item) => {
    if (item.total === 0) return acc;

    if (!acc[item.category]) {
      acc[item.category] = [];
    }
    acc[item.category].push(item);
    return acc;
  }, {} as Record<string, BudgetItem[]>);

  // 创建文档
  const doc = new Document({
    sections: [{
      properties: {},
      children: [
        // 标题
        new Paragraph({
          text: '培训项目申报表',
          heading: HeadingLevel.HEADING_1,
          alignment: AlignmentType.CENTER,
          spacing: {
            after: 400,
          },
        }),

        // 基本信息
        new Paragraph({
          text: '一、项目基本信息',
          heading: HeadingLevel.HEADING_2,
          spacing: {
            before: 400,
            after: 200,
          },
        }),

        new Paragraph({
          children: [
            new TextRun({ text: '项目名称：', bold: true }),
            new TextRun(projectData.name),
          ],
          spacing: { after: 200 },
        }),

        new Paragraph({
          children: [
            new TextRun({ text: '培训目标：', bold: true }),
            new TextRun(projectData.trainingTarget),
          ],
          spacing: { after: 200 },
        }),

        new Paragraph({
          children: [
            new TextRun({ text: '培训对象：', bold: true }),
            new TextRun(projectData.targetAudience),
          ],
          spacing: { after: 200 },
        }),

        new Paragraph({
          children: [
            new TextRun({ text: '参训人数：', bold: true }),
            new TextRun(projectData.participantCount + ' 人'),
          ],
          spacing: { after: 200 },
        }),

        new Paragraph({
          children: [
            new TextRun({ text: '培训天数：', bold: true }),
            new TextRun(projectData.trainingDays + ' 天'),
          ],
          spacing: { after: 200 },
        }),

        new Paragraph({
          children: [
            new TextRun({ text: '培训周期：', bold: true }),
            new TextRun(projectData.trainingPeriod),
          ],
          spacing: { after: 200 },
        }),

        new Paragraph({
          children: [
            new TextRun({ text: '培训地点：', bold: true }),
            new TextRun(projectData.location),
          ],
          spacing: { after: 200 },
        }),

        new Paragraph({
          children: [
            new TextRun({ text: '特殊要求：', bold: true }),
            new TextRun(projectData.specialRequirements || '无'),
          ],
          spacing: { after: 400 },
        }),

        // 费用预算
        new Paragraph({
          text: '二、费用预算',
          heading: HeadingLevel.HEADING_2,
          spacing: {
            before: 400,
            after: 200,
          },
        }),

        // 费用预算表格
        new Table({
          width: {
            size: 100,
            type: WidthType.PERCENTAGE,
          },
          rows: [
            // 表头
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph({ text: '序号', bold: true })], width: { size: 10, type: WidthType.PERCENTAGE } }),
                new TableCell({ children: [new Paragraph({ text: '费用类别', bold: true })], width: { size: 20, type: WidthType.PERCENTAGE } }),
                new TableCell({ children: [new Paragraph({ text: '项目名称', bold: true })], width: { size: 30, type: WidthType.PERCENTAGE } }),
                new TableCell({ children: [new Paragraph({ text: '金额', bold: true })], width: { size: 20, type: WidthType.PERCENTAGE } }),
                new TableCell({ children: [new Paragraph({ text: '备注', bold: true })], width: { size: 20, type: WidthType.PERCENTAGE } }),
              ],
              tableHeader: true,
            }),
          ],
          borders: {
            top: { style: BorderStyle.SINGLE, size: 1 },
            bottom: { style: BorderStyle.SINGLE, size: 1 },
            left: { style: BorderStyle.SINGLE, size: 1 },
            right: { style: BorderStyle.SINGLE, size: 1 },
            insideHorizontal: { style: BorderStyle.SINGLE, size: 1 },
            insideVertical: { style: BorderStyle.SINGLE, size: 1 },
          },
        }),
      ],
    }],
  });

  // 添加费用明细行
  const table = doc.sections[0].children.find(child => child instanceof Table) as Table;
  let seqNo = 1;
  Object.entries(categoryGroups).forEach(([category, items]) => {
    items.forEach(item => {
      table.root.push(new TableRow({
        children: [
          new TableCell({ children: [new Paragraph(seqNo.toString())], width: { size: 10, type: WidthType.PERCENTAGE } }),
          new TableCell({ children: [new Paragraph(category)], width: { size: 20, type: WidthType.PERCENTAGE } }),
          new TableCell({ children: [new Paragraph(item.name)], width: { size: 30, type: WidthType.PERCENTAGE } }),
          new TableCell({ children: [new Paragraph('¥' + item.total.toLocaleString())], width: { size: 20, type: WidthType.PERCENTAGE } }),
          new TableCell({ children: [new Paragraph(item.description || '')], width: { size: 20, type: WidthType.PERCENTAGE } }),
        ],
      }));
      seqNo++;
    });
  });

  // 添加总计行
  table.root.push(new TableRow({
    children: [
      new TableCell({ children: [new Paragraph('')], width: { size: 10, type: WidthType.PERCENTAGE } }),
      new TableCell({ children: [new Paragraph('')], width: { size: 20, type: WidthType.PERCENTAGE } }),
      new TableCell({ children: [new Paragraph({ text: '费用总计', bold: true })], width: { size: 30, type: WidthType.PERCENTAGE } }),
      new TableCell({ children: [new Paragraph({ text: '¥' + projectData.totalBudget.toLocaleString(), bold: true })], width: { size: 20, type: WidthType.PERCENTAGE } }),
      new TableCell({ children: [new Paragraph('人均：¥' + Math.round(projectData.totalBudget / projectData.participantCount).toLocaleString())], width: { size: 20, type: WidthType.PERCENTAGE } }),
    ],
  }));

  // 生成 Word 文件
  const buffer = await Packer.toBuffer(doc);
  return new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
}
