import { NextRequest, NextResponse } from 'next/server';
import { LLMClient, Config, HeaderUtils } from 'coze-coding-dev-sdk';
import { ensureDatabaseReady } from '@/storage/database';
import { getApiKey } from '@/lib/api-key';
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
        results.push(`【工作表: ${sheetName}】`);
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

// POST /api/admin/data/analyze-normative - AI 分析规范性文件
export async function POST(request: NextRequest) {
  try {
    await ensureDatabaseReady();
    
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: '请上传文件' }, { status: 400 });
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

    if (!extractedText.trim()) {
      return NextResponse.json({ error: '无法从文件中提取文本内容' }, { status: 400 });
    }

    // 检查 API Key
    const apiKey = await getApiKey();
    
    let result: {
      name: string;
      summary: string;
      issuer: string;
      issueDate: string;
    };

    if (apiKey) {
      // 设置 API Key 到环境变量
      process.env.LLM_API_KEY = apiKey;
      process.env.COZE_API_KEY = apiKey;

      // AI 解析
      const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);
      const config = new Config();
      const client = new LLMClient(config, customHeaders);

      const prompt = `你是一个规范性文件分析专家。请阅读以下文件内容，分析并提取关键信息：

文件原始名称：${file.name}

文件内容：
${extractedText.substring(0, 10000)}

请分析文件内容后，以 JSON 格式返回以下信息：
{
  "name": "文件标题（根据文件内容提炼一个简洁准确的标题，不超过30字，不要包含文件扩展名）",
  "summary": "内容摘要（用一句话概括文件的核心内容，20字左右，不要直接摘抄原文）",
  "issuer": "颁发部门（发文机关或发布单位）",
  "issueDate": "颁发时间（格式：YYYY-MM-DD，如无法确定返回空字符串）"
}

要求：
1. 标题要准确反映文件主题，简洁明了
2. 摘要要高度概括，突出文件的核心要点和适用范围，20字左右
3. 只返回 JSON，不要包含其他解释文字
4. 如果某项信息无法从文件中提取，返回空字符串`;

      const response = await client.invoke([{ role: 'user', content: prompt }], { temperature: 0.3 });

      try {
        const jsonMatch = response.content?.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          result = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error('未找到 JSON');
        }
      } catch {
        // 解析失败，使用基本信息
        result = {
          name: file.name.replace(/\.[^/.]+$/, ''),
          summary: '文件内容待人工补充摘要',
          issuer: '',
          issueDate: '',
        };
      }
    } else {
      // 未配置 API Key，提示需要配置
      result = {
        name: file.name.replace(/\.[^/.]+$/, ''),
        summary: '请配置 API Key 后使用 AI 分析功能',
        issuer: '',
        issueDate: '',
      };
    }

    return NextResponse.json({
      success: true,
      data: result,
      fileName: file.name,
      fileSize: file.size,
      extractedText: extractedText.substring(0, 500), // 返回前500字供参考
    });
  } catch (error) {
    console.error('Analyze normative document error:', error);
    return NextResponse.json({ error: '文件解析失败' }, { status: 500 });
  }
}
