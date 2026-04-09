import { NextRequest, NextResponse } from 'next/server';
import {
  generateQuotationExcel,
  generateCostCalculationExcel,
  generateProjectApplicationWord,
} from '@/lib/document-generator';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { projectData, fileType } = body;

    if (!projectData) {
      return NextResponse.json(
        { error: '缺少项目数据' },
        { status: 400 }
      );
    }

    if (!fileType) {
      return NextResponse.json(
        { error: '缺少文件类型' },
        { status: 400 }
      );
    }

    let blob: Blob;
    let fileName: string;
    let contentType: string;

    switch (fileType) {
      case 'quotation':
        // 生成报价表
        blob = await generateQuotationExcel(projectData);
        fileName = `${projectData.name}-报价表.xlsx`;
        contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
        break;

      case 'cost-calculation':
        // 生成成本测算表
        blob = await generateCostCalculationExcel(projectData);
        fileName = `${projectData.name}-成本测算表.xlsx`;
        contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
        break;

      case 'application':
        // 生成项目申报表
        blob = await generateProjectApplicationWord(projectData);
        fileName = `${projectData.name}-项目申报表.docx`;
        contentType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
        break;

      default:
        return NextResponse.json(
          { error: '不支持的文件类型' },
          { status: 400 }
        );
    }

    // 返回文件
    return new NextResponse(blob, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${encodeURIComponent(fileName)}"`,
      },
    });
  } catch (error) {
    console.error('生成申报文件失败:', error);
    return NextResponse.json(
      { error: '生成申报文件失败' },
      { status: 500 }
    );
  }
}
