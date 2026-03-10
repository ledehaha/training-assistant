import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

// 配置文件路径
const CONFIG_DIR = path.join(process.cwd(), 'data');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

interface Config {
  apiKey?: string;
  updatedAt?: string;
}

// 确保配置目录存在
async function ensureConfigDir() {
  try {
    await fs.access(CONFIG_DIR);
  } catch {
    await fs.mkdir(CONFIG_DIR, { recursive: true });
  }
}

// 读取配置
async function readConfig(): Promise<Config> {
  try {
    await ensureConfigDir();
    const data = await fs.readFile(CONFIG_FILE, 'utf-8');
    return JSON.parse(data);
  } catch {
    return {};
  }
}

// 写入配置
async function writeConfig(config: Config) {
  await ensureConfigDir();
  await fs.writeFile(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
}

// 检查 API Key 是否已配置
export async function GET() {
  try {
    const config = await readConfig();
    const configured = !!(config.apiKey && config.apiKey.length > 0);
    
    return NextResponse.json({
      success: true,
      configured,
      updatedAt: config.updatedAt,
    });
  } catch (error) {
    console.error('检查API Key状态失败:', error);
    return NextResponse.json({
      success: false,
      configured: false,
    });
  }
}

// 保存 API Key
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { apiKey } = body;

    if (!apiKey || typeof apiKey !== 'string') {
      return NextResponse.json(
        { success: false, error: 'API Key 不能为空' },
        { status: 400 }
      );
    }

    // 保存配置
    const config = await readConfig();
    config.apiKey = apiKey.trim();
    config.updatedAt = new Date().toISOString();
    await writeConfig(config);

    // 同时更新环境变量（当前进程）
    process.env.LLM_API_KEY = apiKey.trim();

    return NextResponse.json({
      success: true,
      message: 'API Key 保存成功',
    });
  } catch (error) {
    console.error('保存API Key失败:', error);
    return NextResponse.json(
      { success: false, error: '保存失败' },
      { status: 500 }
    );
  }
}

// 删除 API Key
export async function DELETE() {
  try {
    const config = await readConfig();
    delete config.apiKey;
    config.updatedAt = new Date().toISOString();
    await writeConfig(config);

    // 清除环境变量
    delete process.env.LLM_API_KEY;

    return NextResponse.json({
      success: true,
      message: 'API Key 已清除',
    });
  } catch (error) {
    console.error('清除API Key失败:', error);
    return NextResponse.json(
      { success: false, error: '清除失败' },
      { status: 500 }
    );
  }
}
