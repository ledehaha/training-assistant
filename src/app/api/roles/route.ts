import { NextRequest, NextResponse } from 'next/server';
import { db, roles, ensureDatabaseReady } from '@/storage/database';
import { asc } from 'drizzle-orm';
import { cookies } from 'next/headers';

// 获取当前用户信息（支持 Cookie 和 Authorization header）
async function getCurrentUser(request?: NextRequest) {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('session');
  
  // 优先从 Cookie 获取
  if (sessionCookie?.value) {
    try {
      return JSON.parse(sessionCookie.value);
    } catch {
      // 继续尝试其他方式
    }
  }
  
  // 尝试从 Authorization header 获取
  if (request) {
    const authHeader = request.headers.get('authorization');
    if (authHeader?.startsWith('Bearer ')) {
      try {
        const token = authHeader.substring(7);
        const decoded = Buffer.from(token, 'base64').toString('utf-8');
        return JSON.parse(decoded);
      } catch {
        // 解析失败
      }
    }
  }
  
  return null;
}

// GET /api/roles - 获取角色列表
export async function GET(request: NextRequest) {
  try {
    await ensureDatabaseReady();
    
    const currentUser = await getCurrentUser(request);
    if (!currentUser) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }
    
    // 只有管理员和人事处可以查看角色列表
    if (currentUser.roleCode !== 'admin' && currentUser.roleCode !== 'hr_auditor') {
      return NextResponse.json({ error: '无权限' }, { status: 403 });
    }
    
    const roleList = await db.select()
      .from(roles)
      .orderBy(asc(roles.level))
      .all();
    
    return NextResponse.json({ data: roleList });
  } catch (error) {
    console.error('Get roles error:', error);
    return NextResponse.json({ error: '获取角色列表失败' }, { status: 500 });
  }
}
