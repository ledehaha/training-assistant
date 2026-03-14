import { NextRequest, NextResponse } from 'next/server';
import { db, users, roles, departments, ensureDatabaseReady } from '@/storage/database';
import { eq } from 'drizzle-orm';
import { cookies } from 'next/headers';

// GET /api/auth/me - 获取当前登录用户信息
export async function GET(request: NextRequest) {
  try {
    await ensureDatabaseReady();
    
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('session');
    
    // 调试日志
    const host = request.headers.get('host') || 'localhost';
    const forwardedHost = request.headers.get('x-forwarded-host');
    const forwardedProto = request.headers.get('x-forwarded-proto');
    const cookieHeader = request.headers.get('cookie');
    const authHeader = request.headers.get('authorization');
    
    console.log('[/api/auth/me] Host:', host);
    console.log('[/api/auth/me] Forwarded-Host:', forwardedHost);
    console.log('[/api/auth/me] Forwarded-Proto:', forwardedProto);
    console.log('[/api/auth/me] Request Cookie Header:', cookieHeader ? 'exists' : 'none');
    console.log('[/api/auth/me] Session Cookie:', sessionCookie ? 'exists' : 'none');
    console.log('[/api/auth/me] Authorization Header:', authHeader ? 'exists' : 'none');
    
    // 尝试从 Cookie 或 Authorization header 获取 session
    let session = null;
    
    // 优先从 Cookie 获取
    if (sessionCookie?.value) {
      try {
        session = JSON.parse(sessionCookie.value);
        console.log('[/api/auth/me] Session from cookie:', session?.username);
      } catch (e) {
        console.log('[/api/auth/me] Failed to parse session cookie');
      }
    }
    
    // 如果 Cookie 没有，尝试从 Authorization header 获取
    if (!session && authHeader?.startsWith('Bearer ')) {
      try {
        const token = authHeader.substring(7);
        // 解码 token (base64 encoded session data)
        const decoded = Buffer.from(token, 'base64').toString('utf-8');
        session = JSON.parse(decoded);
        console.log('[/api/auth/me] Session from token:', session?.username);
      } catch (e) {
        console.log('[/api/auth/me] Failed to parse token');
      }
    }
    
    // 如果还是没有 session，返回未登录
    if (!session?.userId) {
      console.log('[/api/auth/me] No valid session found');
      return NextResponse.json({ error: '未登录', authenticated: false }, { status: 401 });
    }
    
    // 获取完整的用户信息
    const userList = await db.select()
      .from(users)
      .where(eq(users.id, session.userId))
      .limit(1);
    
    if (userList.length === 0) {
      return NextResponse.json({ error: '用户不存在', authenticated: false }, { status: 401 });
    }
    
    const user = userList[0];
    
    // 检查用户状态
    if (user.status !== 'active') {
      return NextResponse.json({ error: '账号状态异常', authenticated: false }, { status: 401 });
    }
    
    // 获取角色和部门信息
    const roleList = await db.select().from(roles).where(eq(roles.id, user.roleId)).limit(1);
    const deptList = user.departmentId 
      ? await db.select().from(departments).where(eq(departments.id, user.departmentId)).limit(1)
      : [];
    
    const role = roleList[0];
    const department = deptList[0];
    
    return NextResponse.json({
      authenticated: true,
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        employeeId: user.employeeId,
        phone: user.phone,
        email: user.email,
        avatar: user.avatar,
        status: user.status,
        role: role ? {
          id: role.id,
          name: role.name,
          code: role.code,
          level: role.level,
        } : null,
        department: department ? {
          id: department.id,
          name: department.name,
          code: department.code,
          type: department.type,
          parentId: department.parentId,
        } : null,
        lastLoginAt: user.lastLoginAt,
      },
    });
  } catch (error) {
    console.error('Get current user error:', error);
    return NextResponse.json({ error: '获取用户信息失败', authenticated: false }, { status: 500 });
  }
}
