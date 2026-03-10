/**
 * 本地文件存储模块
 * 用于存储上传的文件（规范性文件等）到本地文件系统
 */

import fs from 'fs';
import path from 'path';

// 文件存储根目录
const FILE_STORAGE_ROOT = process.env.FILE_STORAGE_PATH || '/data/files';

// 确保目录存在
function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/**
 * 生成唯一文件名
 */
function generateUniqueFileName(originalName: string): string {
  const ext = path.extname(originalName);
  const baseName = path.basename(originalName, ext);
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `${baseName}_${timestamp}_${random}${ext}`;
}

/**
 * 保存文件到本地
 * @param fileContent 文件内容（Buffer）
 * @param originalName 原始文件名
 * @param category 文件分类（如 'normative_docs', 'attachments'）
 * @returns 文件相对路径（用于数据库存储）
 */
export function saveFile(
  fileContent: Buffer,
  originalName: string,
  category: string = 'general'
): string {
  const categoryDir = path.join(FILE_STORAGE_ROOT, category);
  ensureDir(categoryDir);
  
  const uniqueName = generateUniqueFileName(originalName);
  const filePath = path.join(categoryDir, uniqueName);
  
  fs.writeFileSync(filePath, fileContent);
  
  // 返回相对路径（用于数据库存储和后续访问）
  return `${category}/${uniqueName}`;
}

/**
 * 读取本地文件
 * @param relativePath 文件相对路径
 * @returns 文件内容（Buffer）
 */
export function readFile(relativePath: string): Buffer {
  const filePath = path.join(FILE_STORAGE_ROOT, relativePath);
  
  if (!fs.existsSync(filePath)) {
    throw new Error(`文件不存在: ${relativePath}`);
  }
  
  return fs.readFileSync(filePath);
}

/**
 * 删除本地文件
 * @param relativePath 文件相对路径
 * @returns 是否删除成功
 */
export function deleteFile(relativePath: string): boolean {
  const filePath = path.join(FILE_STORAGE_ROOT, relativePath);
  
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
    return true;
  }
  
  return false;
}

/**
 * 检查文件是否存在
 * @param relativePath 文件相对路径
 * @returns 是否存在
 */
export function fileExists(relativePath: string): boolean {
  const filePath = path.join(FILE_STORAGE_ROOT, relativePath);
  return fs.existsSync(filePath);
}

/**
 * 获取文件信息
 * @param relativePath 文件相对路径
 * @returns 文件信息
 */
export function getFileInfo(relativePath: string): {
  size: number;
  created: Date;
  modified: Date;
  extension: string;
} {
  const filePath = path.join(FILE_STORAGE_ROOT, relativePath);
  
  if (!fs.existsSync(filePath)) {
    throw new Error(`文件不存在: ${relativePath}`);
  }
  
  const stats = fs.statSync(filePath);
  
  return {
    size: stats.size,
    created: stats.birthtime,
    modified: stats.mtime,
    extension: path.extname(relativePath),
  };
}

/**
 * 列出目录下的所有文件
 * @param category 文件分类
 * @returns 文件列表
 */
export function listFiles(category: string): string[] {
  const categoryDir = path.join(FILE_STORAGE_ROOT, category);
  
  if (!fs.existsSync(categoryDir)) {
    return [];
  }
  
  return fs.readdirSync(categoryDir);
}

/**
 * 获取文件的完整路径（用于发送文件）
 * @param relativePath 文件相对路径
 * @returns 完整路径
 */
export function getFullPath(relativePath: string): string {
  return path.join(FILE_STORAGE_ROOT, relativePath);
}

/**
 * 获取文件存储根目录
 */
export function getStorageRoot(): string {
  return FILE_STORAGE_ROOT;
}

/**
 * 初始化文件存储目录
 */
export function initStorage(): void {
  const categories = ['normative_docs', 'attachments', 'exports', 'imports'];
  
  categories.forEach(category => {
    ensureDir(path.join(FILE_STORAGE_ROOT, category));
  });
  
  console.log(`文件存储目录已初始化: ${FILE_STORAGE_ROOT}`);
}
