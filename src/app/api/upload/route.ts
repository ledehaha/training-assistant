import { NextRequest, NextResponse } from 'next/server';
import { S3Storage } from 'coze-coding-dev-sdk';
import { getDb } from '@/storage/database';
import { projects } from '@/storage/database/schema';
import { eq } from 'drizzle-orm';

// 初始化对象存储
const storage = new S3Storage({
  endpointUrl: process.env.COZE_BUCKET_ENDPOINT_URL,
  accessKey: '',
  secretKey: '',
  bucketName: process.env.COZE_BUCKET_NAME,
  region: 'cn-beijing',
});

// 上传文件
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const projectId = formData.get('projectId') as string;
    const fileType = formData.get('fileType') as string; // contract, cost, declaration, studentList, satisfaction, other

    if (!file || !projectId || !fileType) {
      return NextResponse.json({ error: '缺少必要参数' }, { status: 400 });
    }

    // 读取文件内容
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 上传到对象存储
    const fileName = `projects/${projectId}/${fileType}/${file.name}`;
    const fileKey = await storage.uploadFile({
      fileContent: buffer,
      fileName,
      contentType: file.type,
    });

    // 更新数据库
    const db = getDb();
    const updateData: Record<string, string> = {};

    switch (fileType) {
      case 'contract':
        updateData.contractFile = fileKey;
        updateData.contractFileName = file.name;
        break;
      case 'cost':
        updateData.costFile = fileKey;
        updateData.costFileName = file.name;
        break;
      case 'declaration':
        updateData.declarationFile = fileKey;
        updateData.declarationFileName = file.name;
        break;
      case 'studentList':
        updateData.studentListFile = fileKey;
        updateData.studentListFileName = file.name;
        break;
      case 'satisfaction':
        updateData.satisfactionSurveyFile = fileKey;
        updateData.satisfactionSurveyFileName = file.name;
        break;
      case 'other':
        // 其他材料需要特殊处理，存储为JSON数组
        const project = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);
        const existingMaterials = project[0]?.otherMaterials ? JSON.parse(project[0].otherMaterials) : [];
        existingMaterials.push({ key: fileKey, name: file.name, uploadedAt: new Date().toISOString() });
        updateData.otherMaterials = JSON.stringify(existingMaterials);
        break;
      default:
        return NextResponse.json({ error: '无效的文件类型' }, { status: 400 });
    }

    await db.update(projects).set(updateData).where(eq(projects.id, projectId));

    // 生成访问URL（有效期7天）
    const url = await storage.generatePresignedUrl({ key: fileKey, expireTime: 604800 });

    return NextResponse.json({
      success: true,
      fileKey,
      fileName: file.name,
      url,
    });
  } catch (error) {
    console.error('文件上传失败:', error);
    return NextResponse.json({ error: '文件上传失败' }, { status: 500 });
  }
}

// 删除文件
export async function DELETE(request: NextRequest) {
  try {
    const { projectId, fileType, fileIndex } = await request.json();

    if (!projectId || !fileType) {
      return NextResponse.json({ error: '缺少必要参数' }, { status: 400 });
    }

    const db = getDb();
    const project = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);

    if (!project[0]) {
      return NextResponse.json({ error: '项目不存在' }, { status: 404 });
    }

    let fileKey = '';
    const updateData: Record<string, string | null> = {};

    switch (fileType) {
      case 'contract':
        fileKey = project[0].contractFile || '';
        updateData.contractFile = null;
        updateData.contractFileName = null;
        break;
      case 'cost':
        fileKey = project[0].costFile || '';
        updateData.costFile = null;
        updateData.costFileName = null;
        break;
      case 'declaration':
        fileKey = project[0].declarationFile || '';
        updateData.declarationFile = null;
        updateData.declarationFileName = null;
        break;
      case 'studentList':
        fileKey = project[0].studentListFile || '';
        updateData.studentListFile = null;
        updateData.studentListFileName = null;
        break;
      case 'satisfaction':
        fileKey = project[0].satisfactionSurveyFile || '';
        updateData.satisfactionSurveyFile = null;
        updateData.satisfactionSurveyFileName = null;
        break;
      case 'other':
        // 删除其他材料中的指定文件
        const existingMaterials = project[0].otherMaterials ? JSON.parse(project[0].otherMaterials) : [];
        if (fileIndex !== undefined && existingMaterials[fileIndex]) {
          fileKey = existingMaterials[fileIndex].key;
          existingMaterials.splice(fileIndex, 1);
          updateData.otherMaterials = existingMaterials.length > 0 ? JSON.stringify(existingMaterials) : null;
        }
        break;
      default:
        return NextResponse.json({ error: '无效的文件类型' }, { status: 400 });
    }

    // 从对象存储删除
    if (fileKey) {
      await storage.deleteFile({ fileKey });
    }

    // 更新数据库
    await db.update(projects).set(updateData).where(eq(projects.id, projectId));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('文件删除失败:', error);
    return NextResponse.json({ error: '文件删除失败' }, { status: 500 });
  }
}

// 获取文件访问URL
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const fileKey = searchParams.get('fileKey');

    if (!fileKey) {
      return NextResponse.json({ error: '缺少文件key' }, { status: 400 });
    }

    // 生成访问URL（有效期7天）
    const url = await storage.generatePresignedUrl({ key: fileKey, expireTime: 604800 });

    return NextResponse.json({ url });
  } catch (error) {
    console.error('获取文件URL失败:', error);
    return NextResponse.json({ error: '获取文件URL失败' }, { status: 500 });
  }
}
