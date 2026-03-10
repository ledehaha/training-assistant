import { NextRequest, NextResponse } from 'next/server';
import { LLMClient, Config, HeaderUtils } from 'coze-coding-dev-sdk';
import { 
  db, teachers, venues, courseTemplates, normativeDocuments, 
  projects, projectCourses, satisfactionSurveys, sql 
} from '@/storage/database';
import { generateId, getTimestamp } from '@/storage/database';
import { saveFile } from '@/storage/file-storage';
import * as XLSX from 'xlsx';
import JSZip from 'jszip';
import { exec } from 'child_process';
import { promisify } from 'util';
import { writeFile, unlink } from 'fs/promises';
import path from 'path';

const execAsync = promisify(exec);

// 解析 PDF 文件
async function parsePDF(buffer: Buffer): Promise<string> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdf2json = require('pdf2json');
    const PDFParser = pdf2json.default || pdf2json;
    
    return new Promise((resolve) => {
      const pdfParser = new PDFParser();
      
      pdfParser.on('pdfParser_dataError', () => resolve(''));
      
      pdfParser.on('pdfParser_dataReady', (pdfData: { Pages?: Array<{ Texts?: Array<{ R?: Array<{ T?: string }> }> }> }) => {
        try {
          if (!pdfData.Pages) { resolve(''); return; }
          const text = pdfData.Pages
            .map(page => page.Texts?.map(text => text.R?.map(r => decodeURIComponent(r.T || '')).join('')).join(' ') || '')
            .join('\n');
          resolve(text);
        } catch { resolve(''); }
      });
      
      pdfParser.parseBuffer(buffer);
    });
  } catch (error) {
    console.error('PDF parse error:', error);
    return '';
  }
}

// 解析 Word 文件
async function parseWord(buffer: Buffer, originalFileName: string): Promise<string> {
  try {
    const ext = originalFileName.split('.').pop()?.toLowerCase();
    
    if (ext === 'docx') {
      const mammoth = await import('mammoth');
      const result = await mammoth.extractRawText({ buffer });
      return result.value || '';
    }
    
    if (ext === 'doc') {
      const tmpDir = '/tmp';
      const tmpDocPath = path.join(tmpDir, `doc_${Date.now()}.doc`);
      
      try {
        await writeFile(tmpDocPath, buffer);
        await execAsync(`libreoffice --headless --convert-to txt:Text --outdir ${tmpDir} ${tmpDocPath}`, { timeout: 30000 });
        const { default: fs } = await import('fs/promises');
        const txtPath = tmpDocPath.replace('.doc', '.txt');
        const text = await fs.readFile(txtPath, 'utf-8');
        await unlink(tmpDocPath).catch(() => {});
        await unlink(txtPath).catch(() => {});
        return text;
      } catch (e) {
        await unlink(tmpDocPath).catch(() => {});
        return '';
      }
    }
    return '';
  } catch (error) {
    console.error('Word parse error:', error);
    return '';
  }
}

// 解析 Excel 文件
function parseExcel(buffer: Buffer): string {
  try {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const results: string[] = [];
    
    workbook.SheetNames.forEach(sheetName => {
      const sheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);
      
      if (jsonData.length > 0) {
        results.push(`\n【工作表: ${sheetName}】`);
        jsonData.forEach((row, idx) => {
          const rowStr = Object.entries(row).map(([key, val]) => `${key}: ${val}`).join(', ');
          results.push(`${idx + 1}. ${rowStr}`);
        });
      }
    });
    
    return results.join('\n');
  } catch (error) {
    console.error('Excel parse error:', error);
    return '';
  }
}

// 解析 PPT 文件
async function parsePPT(buffer: Buffer, originalFileName: string): Promise<string> {
  try {
    const ext = originalFileName.split('.').pop()?.toLowerCase();
    
    if (ext === 'pptx') {
      const zip = await JSZip.loadAsync(buffer);
      const slides: string[] = [];
      
      const slideFiles: string[] = [];
      zip.forEach((relativePath) => {
        if (relativePath.match(/ppt\/slides\/slide\d+\.xml$/)) {
          slideFiles.push(relativePath);
        }
      });
      
      slideFiles.sort((a, b) => {
        const numA = parseInt(a.match(/slide(\d+)/)?.[1] || '0');
        const numB = parseInt(b.match(/slide(\d+)/)?.[1] || '0');
        return numA - numB;
      });
      
      for (const slideFile of slideFiles) {
        const slideNum = slideFile.match(/slide(\d+)/)?.[1] || '?';
        const content = await zip.file(slideFile)?.async('string');
        
        if (content) {
          const textMatches = content.match(/<a:t>([^<]*)<\/a:t>/g);
          if (textMatches && textMatches.length > 0) {
            const slideText = textMatches.map(m => m.replace(/<\/?a:t>/g, '')).filter(t => t.trim()).join(' ');
            if (slideText.trim()) {
              slides.push(`【幻灯片 ${slideNum}】${slideText}`);
            }
          }
        }
      }
      
      return slides.join('\n');
    }
    
    if (ext === 'ppt') {
      const tmpDir = '/tmp';
      const tmpPptPath = path.join(tmpDir, `ppt_${Date.now()}.ppt`);
      
      try {
        await writeFile(tmpPptPath, buffer);
        await execAsync(`libreoffice --headless --convert-to txt:Text --outdir ${tmpDir} ${tmpPptPath}`, { timeout: 30000 });
        const { default: fs } = await import('fs/promises');
        const txtPath = tmpPptPath.replace('.ppt', '.txt');
        const text = await fs.readFile(txtPath, 'utf-8');
        await unlink(tmpPptPath).catch(() => {});
        await unlink(txtPath).catch(() => {});
        return text;
      } catch (e) {
        await unlink(tmpPptPath).catch(() => {});
        return '';
      }
    }
    return '';
  } catch (error) {
    console.error('PPT parse error:', error);
    return '';
  }
}

// 允许操作的表
const ALLOWED_TABLES = ['teachers', 'venues', 'course_templates', 'normative_documents', 'projects', 'project_courses', 'satisfaction_surveys'] as const;

// 表映射
const tableMap = {
  teachers, venues, course_templates: courseTemplates, normative_documents: normativeDocuments,
  projects, project_courses: projectCourses, satisfaction_surveys: satisfactionSurveys,
};

// 表结构描述
const TABLE_SCHEMA: Record<string, string> = {
  teachers: '讲师信息表: name(必填), title, expertise, organization, bio, hourlyRate, rating, teachingCount, isActive',
  venues: '场地信息表: name(必填), location, capacity, dailyRate, facilities, rating, usageCount, isActive',
  course_templates: '课程模板表: name(必填), category, duration, targetAudience, difficulty, description, usageCount, avgRating',
  normative_documents: '规范性文件表: name(必填), summary, issuer, issueDate, filePath, isEffective',
  projects: '培训项目表: name(必填), status, trainingTarget, targetAudience, participantCount, trainingDays, totalBudget',
  project_courses: '项目课程表: projectId(必填), name, teacherId, duration, order',
  satisfaction_surveys: '满意度调查表: projectId, title, questions(JSON), status',
};

// POST /api/admin/data/ai-import-file - 文件上传 AI 智能导入
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const table = formData.get('table') as string;

    if (!file) return NextResponse.json({ error: '请上传文件' }, { status: 400 });
    if (!table || !ALLOWED_TABLES.includes(table as typeof ALLOWED_TABLES[number])) {
      return NextResponse.json({ error: '无效的数据表' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const fileName = file.name.toLowerCase();
    const fileType = fileName.split('.').pop() || '';

    // 解析文件内容
    let extractedText = '';
    if (fileType === 'pdf') extractedText = await parsePDF(buffer);
    else if (fileType === 'docx' || fileType === 'doc') extractedText = await parseWord(buffer, file.name);
    else if (fileType === 'xlsx' || fileType === 'xls') extractedText = parseExcel(buffer);
    else if (fileType === 'pptx' || fileType === 'ppt') extractedText = await parsePPT(buffer, file.name);
    else return NextResponse.json({ error: '不支持的文件格式' }, { status: 400 });

    if (!extractedText.trim()) return NextResponse.json({ error: '无法从文件中提取文本内容' }, { status: 400 });

    // 检查是否配置了 AI API Key
    const hasApiKey = !!process.env.COZE_API_KEY;
    
    let records: Record<string, unknown>[] = [];
    let summary = '';

    if (hasApiKey) {
      // AI 解析
      const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);
      const config = new Config();
      const client = new LLMClient(config, customHeaders);

      // 获取规范性文件作为参考
      const normativeDocsData = db.select().from(normativeDocuments).where(sql`${normativeDocuments.isEffective} = 1`).all();

      let normativeContext = '';
      if (normativeDocsData?.length > 0) {
        const feeDocs = normativeDocsData.filter(d => d.summary?.includes('费') || d.summary?.includes('标准'));
        if (feeDocs.length > 0) {
          normativeContext = `\n规范性文件参考:\n${feeDocs.map(d => `- ${d.name}: ${d.summary}`).join('\n')}`;
        }
      }

      const prompt = `你是一个数据解析专家。从以下文件内容中提取${TABLE_SCHEMA[table] || table}的数据。
${normativeContext}
文件内容:
${extractedText.substring(0, 8000)}

以JSON格式返回: { "records": [...], "summary": "提取摘要" }`;

      const response = await client.invoke([{ role: 'user', content: prompt }], { temperature: 0.3 });

      let parsedResult;
      try {
        const jsonMatch = response.content?.match(/\{[\s\S]*\}/);
        if (jsonMatch) parsedResult = JSON.parse(jsonMatch[0]);
        else throw new Error('未找到 JSON');
      } catch {
        return NextResponse.json({ error: 'AI 解析失败', extractedText: extractedText.substring(0, 500) }, { status: 400 });
      }

      records = parsedResult?.records || [];
      summary = parsedResult?.summary || '';
    } else {
      // 未配置 API Key，尝试简单解析（仅支持 Excel）
      if (fileType === 'xlsx' || fileType === 'xls') {
        const workbook = XLSX.read(buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        records = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);
        summary = `从 Excel 解析出 ${records.length} 条记录`;
      } else {
        return NextResponse.json({ 
          error: '未配置 AI API Key，仅支持 Excel 文件导入。请配置 COZE_API_KEY 环境变量以启用 AI 解析功能。' 
        }, { status: 400 });
      }
    }

    if (records.length === 0) return NextResponse.json({ error: '未提取到有效数据' }, { status: 400 });

    // 保存文件到本地（如果是规范性文件）
    let filePath = '';
    if (table === 'normative_documents') {
      try {
        filePath = saveFile(buffer, file.name, 'normative_docs');
      } catch (e) { 
        console.error('File save error:', e); 
      }
    }

    // 插入数据
    const tableSchema = tableMap[table as keyof typeof tableMap];
    const now = getTimestamp();
    let successCount = 0;
    const insertedRecords: unknown[] = [];

    for (const record of records) {
      try {
        const cleaned: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(record as Record<string, unknown>)) {
          if (value === null || value === undefined || value === '') continue;
          if (['id', 'created_at', 'updated_at', 'createdAt', 'updatedAt'].includes(key)) continue;
          cleaned[key] = value;
        }
        // 保存文件路径而非 URL
        if (filePath) cleaned.filePath = filePath;

        const result = db.insert(tableSchema).values({ id: generateId(), ...cleaned, createdAt: now }).returning().get();
        insertedRecords.push(result);
        successCount++;
      } catch (e) { console.error('Insert error:', e); }
    }

    return NextResponse.json({ 
      success: true, 
      count: successCount, 
      summary, 
      preview: insertedRecords,
      filePath: filePath || undefined
    });
  } catch (error) {
    console.error('AI import file error:', error);
    return NextResponse.json({ error: '导入失败' }, { status: 500 });
  }
}
