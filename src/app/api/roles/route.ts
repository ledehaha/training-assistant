import { NextResponse } from 'next/server';
import { db, roles, ensureDatabaseReady } from '@/storage/database';
import { asc } from 'drizzle-orm';
import { cookies } from 'next/headers';

// 获取当前用户信息
async function getCurrentUser() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('session');
  
  if (!sessionCookie) return null;
  
  try {
    return JSON.parse(sessionCookie.value);
  } catch {
    return null;
  }
}

// GET /api/roles - 获取角色列表
export async function GET() {
  try {
    await ensureDatabaseReady();
    
    const currentUser = await getCurrentUser();
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
