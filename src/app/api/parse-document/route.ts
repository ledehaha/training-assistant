import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
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
      
      pdfParser.on('pdfParser_dataError', () => {
        resolve('');
      });
      
      pdfParser.on('pdfParser_dataReady', (pdfData: {
        Pages?: Array<{
          Texts?: Array<{
            R?: Array<{ T?: string }>;
          }>;
        }>;
      }) => {
        try {
          if (!pdfData.Pages) {
            resolve('');
            return;
          }
          
          const text = pdfData.Pages
            .map(page => {
              if (!page.Texts) return '';
              return page.Texts
                .map(text => {
                  if (!text.R) return '';
                  return text.R.map(r => decodeURIComponent(r.T || '')).join('');
                })
                .join(' ');
            })
            .join('\n');
          resolve(text);
        } catch {
          resolve('');
        }
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
        await execAsync(`libreoffice --headless --convert-to txt:Text --outdir ${tmpDir} ${tmpDocPath}`, {
          timeout: 30000
        });
        
        const { default: fs } = await import('fs/promises');
        const txtPath = tmpDocPath.replace('.doc', '.txt');
        const text = await fs.readFile(txtPath, 'utf-8');
        
        await unlink(tmpDocPath).catch(() => {});
        await unlink(txtPath).catch(() => {});
        
        return text;
      } catch (conversionError) {
        console.error('LibreOffice conversion error:', conversionError);
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
          const rowStr = Object.entries(row)
            .map(([key, val]) => `${key}: ${val}`)
            .join(', ');
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

// 解析文本文件
async function parseText(buffer: Buffer): Promise<string> {
  try {
    return buffer.toString('utf-8');
  } catch (error) {
    console.error('Text parse error:', error);
    return '';
  }
}

// POST /api/parse-document - 解析文档文件
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: '请上传文件' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const fileName = file.name.toLowerCase();
    const fileType = fileName.split('.').pop() || '';

    let text = '';

    if (fileType === 'pdf') {
      text = await parsePDF(buffer);
    } else if (fileType === 'docx' || fileType === 'doc') {
      text = await parseWord(buffer, file.name);
    } else if (fileType === 'xlsx' || fileType === 'xls') {
      text = parseExcel(buffer);
    } else if (fileType === 'txt') {
      text = await parseText(buffer);
    } else if (fileType === 'pptx' || fileType === 'ppt') {
      // PPT解析较复杂，暂时返回提示
      text = `[PPT文件: ${file.name}]`;
    } else {
      return NextResponse.json({ 
        error: '不支持的文件格式，请上传 PDF、Word、Excel 或 TXT 文件' 
      }, { status: 400 });
    }

    if (!text.trim()) {
      return NextResponse.json({ error: '无法从文件中提取文本内容' }, { status: 400 });
    }

    return NextResponse.json({ 
      text: text.substring(0, 10000), // 限制长度
      fileName: file.name,
      fileType
    });

  } catch (error) {
    console.error('Parse document error:', error);
    return NextResponse.json(
      { error: '文件解析失败' },
      { status: 500 }
    );
  }
}
