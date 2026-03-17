import { NextRequest, NextResponse } from 'next/server';
import { S3Storage } from 'coze-coding-dev-sdk';
import { getDb, saveDatabaseImmediate, ensureDatabaseReady } from '@/storage/database';
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
    // 确保数据库已初始化
    await ensureDatabaseReady();
    
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const projectId = formData.get('projectId') as string;
    const fileType = formData.get('fileType') as string; // contractPdf, contractWord, costPdf, costWord, declarationPdf, declarationWord, studentList, satisfaction, other

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
      // 合同文件
      case 'contractPdf':
        updateData.contractFilePdf = fileKey;
        updateData.contractFileNamePdf = file.name;
        break;
      case 'contractWord':
        updateData.contractFileWord = fileKey;
        updateData.contractFileNameWord = file.name;
        break;
      // 成本测算表
      case 'costPdf':
        updateData.costFilePdf = fileKey;
        updateData.costFileNamePdf = file.name;
        break;
      case 'costWord':
        updateData.costFileWord = fileKey;
        updateData.costFileNameWord = file.name;
        break;
      // 项目申报书
      case 'declarationPdf':
        updateData.declarationFilePdf = fileKey;
        updateData.declarationFileNamePdf = file.name;
        break;
      case 'declarationWord':
        updateData.declarationFileWord = fileKey;
        updateData.declarationFileNameWord = file.name;
        break;
      // 学员名单
      case 'studentList':
        updateData.studentListFile = fileKey;
        updateData.studentListFileName = file.name;
        break;
      // 满意度调查
      case 'satisfaction':
        updateData.satisfactionSurveyFile = fileKey;
        updateData.satisfactionSurveyFileName = file.name;
        break;
      // 会签单
      case 'countersign':
        updateData.countersignFile = fileKey;
        updateData.countersignFileName = file.name;
        break;
      // 其他材料
      case 'other':
        const project = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);
        const existingMaterials = project[0]?.otherMaterials ? JSON.parse(project[0].otherMaterials) : [];
        existingMaterials.push({ key: fileKey, name: file.name, uploadedAt: new Date().toISOString() });
        updateData.otherMaterials = JSON.stringify(existingMaterials);
        break;
      default:
        return NextResponse.json({ error: '无效的文件类型' }, { status: 400 });
    }

    await db.update(projects).set(updateData).where(eq(projects.id, projectId));
    saveDatabaseImmediate();

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
    // 确保数据库已初始化
    await ensureDatabaseReady();
    
    // 尝试读取请求体
    const contentType = request.headers.get('content-type');
    console.log('DELETE request content-type:', contentType);
    
    let body;
    try {
      body = await request.json();
      console.log('DELETE parsed body:', body);
    } catch (jsonError) {
      console.error('JSON parse error:', jsonError);
      // 尝试读取原始文本
      const text = await request.text();
      console.error('Request body text:', text);
      return NextResponse.json({ error: '无效的JSON格式', detail: String(jsonError) }, { status: 400 });
    }
    
    const { projectId, fileType, fileIndex } = body;

    if (!projectId || !fileType) {
      return NextResponse.json({ error: '缺少必要参数' }, { status: 400 });
    }

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
      // 合同文件
      case 'contractPdf':
        fileKey = project[0].contractFilePdf || '';
        updateData.contractFilePdf = null;
        updateData.contractFileNamePdf = null;
        break;
      case 'contractWord':
        fileKey = project[0].contractFileWord || '';
        updateData.contractFileWord = null;
        updateData.contractFileNameWord = null;
        break;
      // 成本测算表
      case 'costPdf':
        fileKey = project[0].costFilePdf || '';
        updateData.costFilePdf = null;
        updateData.costFileNamePdf = null;
        break;
      case 'costWord':
        fileKey = project[0].costFileWord || '';
        updateData.costFileWord = null;
        updateData.costFileNameWord = null;
        break;
      // 项目申报书
      case 'declarationPdf':
        fileKey = project[0].declarationFilePdf || '';
        updateData.declarationFilePdf = null;
        updateData.declarationFileNamePdf = null;
        break;
      case 'declarationWord':
        fileKey = project[0].declarationFileWord || '';
        updateData.declarationFileWord = null;
        updateData.declarationFileNameWord = null;
        break;
      // 学员名单
      case 'studentList':
        fileKey = project[0].studentListFile || '';
        updateData.studentListFile = null;
        updateData.studentListFileName = null;
        break;
      // 满意度调查
      case 'satisfaction':
        fileKey = project[0].satisfactionSurveyFile || '';
        updateData.satisfactionSurveyFile = null;
        updateData.satisfactionSurveyFileName = null;
        break;
      // 会签单
      case 'countersign':
        fileKey = project[0].countersignFile || '';
        updateData.countersignFile = null;
        updateData.countersignFileName = null;
        break;
      // 其他材料
      case 'other':
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
      try {
        await storage.deleteFile({ fileKey });
        console.log('Deleted file from storage:', fileKey);
      } catch (storageError) {
        console.error('Failed to delete from storage:', storageError);
        // 继续执行数据库更新，即使存储删除失败
      }
    }

    // 更新数据库
    console.log('Updating database with:', updateData);
    await db.update(projects).set(updateData).where(eq(projects.id, projectId));
    saveDatabaseImmediate();
    console.log('Database updated successfully');

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
