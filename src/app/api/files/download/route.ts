import { NextRequest, NextResponse } from 'next/server';
import { readFile, fileExists, getFileInfo } from '@/storage/file-storage';
import path from 'path';

// GET /api/files/download - 下载文件
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const filePath = searchParams.get('path');

    if (!filePath) {
      return NextResponse.json({ error: '缺少文件路径参数' }, { status: 400 });
    }

    // 安全检查：防止路径遍历攻击
    if (filePath.includes('..') || filePath.startsWith('/')) {
      return NextResponse.json({ error: '无效的文件路径' }, { status: 400 });
    }

    // 检查文件是否存在
    if (!fileExists(filePath)) {
      return NextResponse.json({ error: '文件不存在' }, { status: 404 });
    }

    // 读取文件
    const fileBuffer = readFile(filePath);
    const fileInfo = getFileInfo(filePath);

    // 获取文件名
    const fileName = path.basename(filePath);

    // 确定 Content-Type
    const ext = path.extname(filePath).toLowerCase();
    const contentTypes: Record<string, string> = {
      '.pdf': 'application/pdf',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.xls': 'application/vnd.ms-excel',
      '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      '.ppt': 'application/vnd.ms-powerpoint',
      '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      '.txt': 'text/plain',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
    };

    const contentType = contentTypes[ext] || 'application/octet-stream';

    // 返回文件
    return new NextResponse(new Uint8Array(fileBuffer), {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
        'Content-Length': fileBuffer.length.toString(),
        'Cache-Control': 'private, max-age=3600',
      },
    });

  } catch (error) {
    console.error('File download error:', error);
    return NextResponse.json({ error: '文件下载失败' }, { status: 500 });
  }
}
