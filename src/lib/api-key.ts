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
export async function readConfig(): Promise<Config> {
  try {
    await ensureConfigDir();
    const data = await fs.readFile(CONFIG_FILE, 'utf-8');
    return JSON.parse(data);
  } catch {
    return {};
  }
}

// 获取 API Key（优先从配置文件读取，其次从环境变量）
export async function getApiKey(): Promise<string | undefined> {
  // 先检查环境变量（可能是启动时设置的）
  if (process.env.LLM_API_KEY) {
    return process.env.LLM_API_KEY;
  }
  
  // 从配置文件读取
  const config = await readConfig();
  if (config.apiKey) {
    // 同步到环境变量
    process.env.LLM_API_KEY = config.apiKey;
    return config.apiKey;
  }
  
  // 兼容旧的 COZE_API_KEY
  return process.env.COZE_API_KEY;
}

// 检查是否配置了 API Key
export async function hasApiKey(): Promise<boolean> {
  const apiKey = await getApiKey();
  return !!apiKey && apiKey.length > 0;
}
