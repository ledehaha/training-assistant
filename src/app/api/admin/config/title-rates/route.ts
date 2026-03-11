import { NextRequest, NextResponse } from 'next/server';
import { ensureDatabaseReady, getDb, saveDatabaseImmediate } from '@/storage/database';
import { systemConfigs } from '@/storage/database/schema';
import { eq } from 'drizzle-orm';

// 默认职称课时费配置（上海市标准）
const DEFAULT_TITLE_RATES = [
  // 院士级：1500元/小时
  { title: '院士', rate: 1500, category: '院士级' },
  { title: '中国科学院院士', rate: 1500, category: '院士级' },
  { title: '中国工程院院士', rate: 1500, category: '院士级' },
  
  // 教授级（正高级职称）：1000元/小时
  { title: '教授', rate: 1000, category: '教授级' },
  { title: '正教授', rate: 1000, category: '教授级' },
  { title: '研究员', rate: 1000, category: '教授级' },
  { title: '正高级工程师', rate: 1000, category: '教授级' },
  { title: '正高级经济师', rate: 1000, category: '教授级' },
  { title: '正高级会计师', rate: 1000, category: '教授级' },
  { title: '主任医师', rate: 1000, category: '教授级' },
  { title: '主任药师', rate: 1000, category: '教授级' },
  { title: '主任技师', rate: 1000, category: '教授级' },
  { title: '编审', rate: 1000, category: '教授级' },
  { title: '译审', rate: 1000, category: '教授级' },
  { title: '教授级高级工程师', rate: 1000, category: '教授级' },
  { title: '教授级高工', rate: 1000, category: '教授级' },
  { title: '国家级教练', rate: 1000, category: '教授级' },
  
  // 其他职称：500元/小时
  { title: '副教授', rate: 500, category: '其他' },
  { title: '副研究员', rate: 500, category: '其他' },
  { title: '高级工程师', rate: 500, category: '其他' },
  { title: '高工', rate: 500, category: '其他' },
  { title: '高级经济师', rate: 500, category: '其他' },
  { title: '高级会计师', rate: 500, category: '其他' },
  { title: '讲师', rate: 500, category: '其他' },
  { title: '工程师', rate: 500, category: '其他' },
  { title: '助教', rate: 500, category: '其他' },
  { title: '助理工程师', rate: 500, category: '其他' },
];

const CONFIG_KEY = 'title_hourly_rates';

// 获取职称课时费配置
export async function GET() {
  try {
    await ensureDatabaseReady();
    const db = getDb();
    
    const result = await db.select().from(systemConfigs).where(eq(systemConfigs.configKey, CONFIG_KEY));
    
    if (result.length === 0) {
      // 返回默认配置
      return NextResponse.json({ 
        data: DEFAULT_TITLE_RATES,
        isDefault: true,
        message: '使用默认配置'
      });
    }
    
    const configValue = JSON.parse(result[0].configValue);
    return NextResponse.json({ 
      data: configValue,
      isDefault: false
    });
  } catch (error) {
    console.error('获取职称课时费配置失败:', error);
    return NextResponse.json({ error: '获取配置失败' }, { status: 500 });
  }
}

// 保存职称课时费配置
export async function POST(request: NextRequest) {
  try {
    await ensureDatabaseReady();
    const db = getDb();
    
    const body = await request.json();
    const { rates } = body;
    
    if (!rates || !Array.isArray(rates)) {
      return NextResponse.json({ error: '配置数据格式错误' }, { status: 400 });
    }
    
    const configValue = JSON.stringify(rates);
    
    // 检查是否已存在
    const existing = await db.select().from(systemConfigs).where(eq(systemConfigs.configKey, CONFIG_KEY));
    
    if (existing.length > 0) {
      // 更新
      await db.update(systemConfigs)
        .set({
          configValue,
          description: '职称课时费映射配置',
          updatedAt: new Date().toISOString(),
        })
        .where(eq(systemConfigs.configKey, CONFIG_KEY));
    } else {
      // 创建
      const { randomUUID } = await import('crypto');
      await db.insert(systemConfigs).values({
        id: randomUUID(),
        configKey: CONFIG_KEY,
        configValue,
        description: '职称课时费映射配置',
        createdAt: new Date().toISOString(),
      });
    }
    
    saveDatabaseImmediate();
    return NextResponse.json({ message: '配置已保存', data: rates });
  } catch (error) {
    console.error('保存职称课时费配置失败:', error);
    return NextResponse.json({ error: '保存配置失败' }, { status: 500 });
  }
}

// 重置为默认配置
export async function PUT() {
  try {
    await ensureDatabaseReady();
    const db = getDb();
    
    const configValue = JSON.stringify(DEFAULT_TITLE_RATES);
    
    const existing = await db.select().from(systemConfigs).where(eq(systemConfigs.configKey, CONFIG_KEY));
    
    if (existing.length > 0) {
      await db.update(systemConfigs)
        .set({
          configValue,
          description: '职称课时费映射配置',
          updatedAt: new Date().toISOString(),
        })
        .where(eq(systemConfigs.configKey, CONFIG_KEY));
    } else {
      const { randomUUID } = await import('crypto');
      await db.insert(systemConfigs).values({
        id: randomUUID(),
        configKey: CONFIG_KEY,
        configValue,
        description: '职称课时费映射配置',
        createdAt: new Date().toISOString(),
      });
    }
    
    saveDatabaseImmediate();
    return NextResponse.json({ message: '已重置为默认配置', data: DEFAULT_TITLE_RATES });
  } catch (error) {
    console.error('重置配置失败:', error);
    return NextResponse.json({ error: '重置配置失败' }, { status: 500 });
  }
}
