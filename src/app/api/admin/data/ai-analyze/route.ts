import { NextRequest, NextResponse } from 'next/server';
import { LLMClient, Config, HeaderUtils } from 'coze-coding-dev-sdk';
import { ensureDatabaseReady, db, normativeDocuments, sql } from '@/storage/database';
import { getApiKey } from '@/lib/api-key';
import * as XLSX from 'xlsx';
import JSZip from 'jszip';
import { exec } from 'child_process';
import { promisify } from 'util';
import { writeFile, unlink, readFile } from 'fs/promises';
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

// 表结构描述和提示词模板
const TABLE_PROMPTS: Record<string, { schema: string; prompt: string }> = {
  teachers: {
    schema: '讲师信息表',
    prompt: `你是一个培训讲师信息分析专家。请阅读以下内容，分析并提取讲师信息：

文件原始名称：{fileName}

内容：
{content}

请分析后以 JSON 数组格式返回讲师信息（支持多个讲师）：
[
  {
    "name": "讲师姓名（必填）",
    "title": "职称（填写原文中的实际职称，如：教授、副教授、高级工程师、讲师等，不要转换为标准等级）",
    "expertise": "专业领域（多个领域用逗号分隔）",
    "organization": "所属单位/机构",
    "bio": "个人简介",
    "hourly_rate": 课时费（数字，单位元，必须根据职称自动计算）,
    "rating": 评分（1-5分，默认4.5）,
    "teaching_count": 授课次数（默认0）,
    "is_active": true
  }
]

**重要规则**：

1. **职称字段(title)**：直接填写原文中的实际职称名称，不要转换！
   - 例如：原文写"高级工程师"就填"高级工程师"，不要填"副高"
   - 例如：原文写"教授"就填"教授"，不要填"正高"
   - 例如：原文写"特级技师"就填"特级技师"

2. **课时费计算(hourly_rate)**：根据职称自动计算，规则如下：
   - 院士、中国科学院院士、中国工程院院士 → 1500元
   - 教授、研究员、正高级工程师、主任医师、教授级高级工程师、国家级教练 → 1000元
   - 副教授、副研究员、高级工程师、高级经济师、副主任医师、高级技师 → 500元
   - 讲师、工程师、经济师、主治医师、技师 → 500元
   - 助教、助理工程师、医师 → 500元
   - 其他未识别职称 → 500元

3. **识别技巧**：
   - "高级工程师"通常是副高 → 500元
   - "教授级高级工程师"是正高 → 1000元
   - "高级技师"是副高 → 500元
   - "技师"是中级 → 500元

要求：
1. name 是必填字段
2. 如果内容中提到多个讲师，返回数组
3. 数值类型字段必须是数字，不能是字符串
4. **hourly_rate 必须根据职称自动计算**
5. 只返回 JSON，不要包含其他解释文字`
  },
  venues: {
    schema: '场地信息表',
    prompt: `你是一个培训场地信息分析专家。请阅读以下内容，分析并提取场地信息：

文件原始名称：{fileName}

内容：
{content}

请分析后以 JSON 数组格式返回场地信息（支持多个场地）：
[
  {
    "name": "场地名称（必填）",
    "location": "地址",
    "capacity": 容纳人数（数字）,
    "daily_rate": 日租金（数字，单位元）,
    "facilities": "设施描述（如：投影仪、音响、白板等）",
    "rating": 评分（1-5分，默认4.0）,
    "usage_count": 使用次数（默认0）,
    "is_active": true
  }
]

要求：
1. name 是必填字段
2. 如果内容中提到多个场地，返回数组
3. 如果只有一个场地，返回只包含一个元素的数组
4. 数值类型字段必须是数字
5. 只返回 JSON，不要包含其他解释文字
6. 如果某项信息无法提取，使用合理的默认值或不填`
  },
  course_templates: {
    schema: '课程模板表',
    prompt: `你是一个培训课程信息分析专家。请阅读以下内容，分析并提取课程信息：

文件原始名称：{fileName}

内容：
{content}

请分析后以 JSON 数组格式返回课程信息（支持多个课程）：
[
  {
    "name": "课程名称（必填）",
    "category": "类别（管理技能/专业技能/职业素养/综合提升）",
    "duration": 课时（数字，单位小时）,
    "target_audience": "目标人群",
    "difficulty": "难度（初级/中级/高级）",
    "description": "课程描述",
    "usage_count": 使用次数（默认0）,
    "avg_rating": 平均评分（1-5分，默认4.5）
  }
]

要求：
1. name 是必填字段
2. 如果内容中提到多个课程，返回数组
3. 如果只有一个课程，返回只包含一个元素的数组
4. 数值类型字段必须是数字
5. 只返回 JSON，不要包含其他解释文字
6. 如果某项信息无法提取，使用合理的默认值或不填`
  },
  normative_documents: {
    schema: '规范性文件表',
    prompt: `你是一个规范性文件分析专家。请阅读以下文件内容，分析并提取关键信息：

文件原始名称：{fileName}

文件内容：
{content}

请分析文件内容后，以 JSON 格式返回以下信息：
{
  "name": "文件标题（根据文件内容提炼一个简洁准确的标题，不超过30字，不要包含文件扩展名）",
  "summary": "内容摘要（用一句话概括文件的核心内容，20字左右，不要直接摘抄原文）",
  "issuer": "颁发部门（发文机关或发布单位）",
  "issue_date": "颁发时间（格式：YYYY-MM-DD，如无法确定返回空字符串）",
  "is_effective": true
}

要求：
1. 标题要准确反映文件主题，简洁明了
2. 摘要要高度概括，突出文件的核心要点和适用范围，20字左右
3. 只返回 JSON，不要包含其他解释文字
4. 如果某项信息无法从文件中提取，返回空字符串`
  },
  projects: {
    schema: '培训项目表',
    prompt: `你是一个培训项目信息分析专家。请阅读以下内容，分析并提取项目信息：

文件原始名称：{fileName}

内容：
{content}

请分析后以 JSON 格式返回项目信息：
{
  "name": "项目名称（必填）",
  "status": "状态（draft/designing/executing/completed/archived，默认draft）",
  "training_target": "培训目标",
  "target_audience": "目标人群",
  "participant_count": 参训人数（数字）,
  "training_days": 培训天数（数字）,
  "total_budget": 总预算（数字，单位元）
}

要求：
1. name 是必填字段
2. 数值类型字段必须是数字
3. 只返回 JSON，不要包含其他解释文字
4. 如果某项信息无法提取，使用合理的默认值或不填`
  },
  satisfaction_surveys: {
    schema: '满意度调查表',
    prompt: `你是一个培训满意度调查分析专家。请阅读以下内容，分析并提取调查信息：

文件原始名称：{fileName}

内容：
{content}

请分析后以 JSON 格式返回调查信息：
{
  "overall_score": 总体评分（数字，1-5分）,
  "content_score": 内容评分（数字，1-5分）,
  "teacher_score": 讲师评分（数字，1-5分）,
  "venue_score": 场地评分（数字，1-5分）,
  "suggestions": "建议或反馈内容"
}

要求：
1. 评分字段必须是 1-5 之间的数字
2. 如果内容中有多份调查，可以返回 JSON 数组
3. 只返回 JSON，不要包含其他解释文字
4. 如果某项信息无法提取，使用合理的默认值或不填`
  }
};

// POST /api/admin/data/ai-analyze - AI 分析文件内容
export async function POST(request: NextRequest) {
  try {
    await ensureDatabaseReady();
    
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const table = formData.get('table') as string | null;
    const text = formData.get('text') as string | null;

    if (!table || !TABLE_PROMPTS[table]) {
      return NextResponse.json({ error: '不支持的表类型' }, { status: 400 });
    }

    let extractedText = text || '';

    // 如果上传了文件，解析文件内容
    if (file) {
      const buffer = Buffer.from(await file.arrayBuffer());
      const fileName = file.name.toLowerCase();
      const fileType = fileName.split('.').pop() || '';

      if (fileType === 'pdf') extractedText = await parsePDF(buffer);
      else if (fileType === 'docx' || fileType === 'doc') extractedText = await parseWord(buffer, file.name);
      else if (fileType === 'xlsx' || fileType === 'xls') extractedText = parseExcel(buffer);
      else if (fileType === 'pptx' || fileType === 'ppt') extractedText = await parsePPT(buffer, file.name);
      else return NextResponse.json({ error: '不支持的文件格式' }, { status: 400 });
    }

    if (!extractedText.trim()) {
      return NextResponse.json({ error: '无法提取内容，请上传文件或输入文字' }, { status: 400 });
    }

    // 检查 API Key
    const apiKey = await getApiKey();
    
    let result: Record<string, unknown> | Record<string, unknown>[];

    if (apiKey) {
      // 设置 API Key 到环境变量
      process.env.LLM_API_KEY = apiKey;
      process.env.COZE_API_KEY = apiKey;

      // 查询职称等级对照表（仅对讲师信息）
      let titleLevelContext = '';
      if (table === 'teachers') {
        try {
          const normativeDocsData = db
            .select()
            .from(normativeDocuments)
            .where(sql`${normativeDocuments.isEffective} = 1`)
            .all();

          const titleLevelDoc = normativeDocsData?.find(d => 
            d.name && (
              d.name.includes('专业技术岗位') || 
              d.name.includes('职称') || 
              d.name.includes('等级对照') ||
              d.name.includes('岗位名称')
            )
          );

          if (titleLevelDoc?.filePath) {
            const filePath = path.join(process.cwd(), titleLevelDoc.filePath);
            try {
              const fileContent = await readFile(filePath, 'utf-8');
              titleLevelContext = `\n\n**职称等级对照表参考**：\n${fileContent.substring(0, 5000)}\n\n请根据上述对照表将讲师的具体职称映射到标准等级（院士/正高/副高/中级/初级/其他），然后计算课时费。`;
            } catch (e) {
              console.error('读取职称对照表文件失败:', e);
            }
          }
        } catch (e) {
          console.error('查询规范性文件失败:', e);
        }
      }

      // AI 解析
      const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);
      const config = new Config();
      const client = new LLMClient(config, customHeaders);

      const promptTemplate = TABLE_PROMPTS[table].prompt;
      const prompt = promptTemplate
        .replace('{fileName}', file?.name || '用户输入')
        .replace('{content}', extractedText.substring(0, 12000)) + titleLevelContext;

      const response = await client.invoke([{ role: 'user', content: prompt }], { temperature: 0.3 });

      // 解析 JSON
      const jsonMatch = response.content.match(/\[[\s\S]*\]|\{[\s\S]*\}/);
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('AI 返回格式错误');
      }
    } else {
      // 无 API Key 时返回空数据结构
      return NextResponse.json({ error: '请先配置 API Key' }, { status: 400 });
    }

    return NextResponse.json({ 
      success: true, 
      data: result,
      table: table,
      fileName: file?.name
    });
  } catch (error) {
    console.error('AI analyze error:', error);
    return NextResponse.json({ 
      error: '分析失败，请检查文件内容或稍后重试',
      detail: error instanceof Error ? error.message : '未知错误'
    }, { status: 500 });
  }
}
