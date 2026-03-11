import { NextRequest, NextResponse } from 'next/server';
import { ensureDatabaseReady, getDb, saveDatabaseImmediate } from '@/storage/database';
import { systemConfigs } from '@/storage/database/schema';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'crypto';

// 获取配置列表
export async function GET(request: NextRequest) {
  try {
    await ensureDatabaseReady();
    const db = getDb();
    
    const searchParams = request.nextUrl.searchParams;
    const configKey = searchParams.get('key');
    
    if (configKey) {
      // 获取单个配置
      const result = await db.select().from(systemConfigs).where(eq(systemConfigs.configKey, configKey));
      if (result.length === 0) {
        return NextResponse.json({ error: '配置不存在' }, { status: 404 });
      }
      return NextResponse.json({ data: result[0] });
    }
    
    // 获取所有配置
    const result = await db.select().from(systemConfigs);
    return NextResponse.json({ data: result });
  } catch (error) {
    console.error('获取配置失败:', error);
    return NextResponse.json({ error: '获取配置失败' }, { status: 500 });
  }
}

// 创建或更新配置
export async function POST(request: NextRequest) {
  try {
    await ensureDatabaseReady();
    const db = getDb();
    
    const body = await request.json();
    const { configKey, configValue, description } = body;
    
    if (!configKey || !configValue) {
      return NextResponse.json({ error: '配置键和值不能为空' }, { status: 400 });
    }
    
    // 检查是否已存在
    const existing = await db.select().from(systemConfigs).where(eq(systemConfigs.configKey, configKey));
    
    if (existing.length > 0) {
      // 更新
      await db.update(systemConfigs)
        .set({
          configValue,
          description,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(systemConfigs.configKey, configKey));
      saveDatabaseImmediate();
      return NextResponse.json({ data: { ...existing[0], configValue, description }, message: '配置已更新' });
    } else {
      // 创建
      const id = randomUUID();
      await db.insert(systemConfigs).values({
        id,
        configKey,
        configValue,
        description,
        createdAt: new Date().toISOString(),
      });
      saveDatabaseImmediate();
      return NextResponse.json({ data: { id, configKey, configValue, description }, message: '配置已创建' });
    }
  } catch (error) {
    console.error('保存配置失败:', error);
    return NextResponse.json({ error: '保存配置失败' }, { status: 500 });
  }
}

// 删除配置
export async function DELETE(request: NextRequest) {
  try {
    await ensureDatabaseReady();
    const db = getDb();
    
    const searchParams = request.nextUrl.searchParams;
    const configKey = searchParams.get('key');
    
    if (!configKey) {
      return NextResponse.json({ error: '配置键不能为空' }, { status: 400 });
    }
    
    await db.delete(systemConfigs).where(eq(systemConfigs.configKey, configKey));
    saveDatabaseImmediate();
    return NextResponse.json({ message: '配置已删除' });
  } catch (error) {
    console.error('删除配置失败:', error);
    return NextResponse.json({ error: '删除配置失败' }, { status: 500 });
  }
}
