import { NextResponse } from 'next/server';
import { db, users, roles, departments, ensureDatabaseReady } from '@/storage/database';
import { eq } from 'drizzle-orm';
import { cookies } from 'next/headers';

// GET /api/auth/me - 获取当前登录用户信息
export async function GET() {
  try {
    await ensureDatabaseReady();
    
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('session');
    
    if (!sessionCookie) {
      return NextResponse.json({ error: '未登录', authenticated: false }, { status: 401 });
    }
    
    let session;
    try {
      session = JSON.parse(sessionCookie.value);
    } catch {
      return NextResponse.json({ error: '会话无效', authenticated: false }, { status: 401 });
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
    const deptList = await db.select().from(departments).where(eq(departments.id, user.departmentId)).limit(1);
    
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
