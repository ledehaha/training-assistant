import { NextRequest, NextResponse } from 'next/server';
import { db, users, roles, departments, ensureDatabaseReady, generateId, getTimestamp } from '@/storage/database';
import { eq } from 'drizzle-orm';
import { cookies } from 'next/headers';

// 密码验证函数（测试阶段使用简单哈希）
function verifyPassword(password: string, hash: string): boolean {
  const testHash = Buffer.from(`hash_${password}_salt`).toString('base64');
  return testHash === hash;
}

// POST /api/auth/login - 用户登录
export async function POST(request: NextRequest) {
  try {
    await ensureDatabaseReady();
    
    const body = await request.json();
    const { username, password } = body;
    
    if (!username || !password) {
      return NextResponse.json({ error: '请输入用户名和密码' }, { status: 400 });
    }
    
    // 查找用户
    const userList = await db.select()
      .from(users)
      .where(eq(users.username, username))
      .limit(1);
    
    if (userList.length === 0) {
      return NextResponse.json({ error: '用户名或密码错误' }, { status: 401 });
    }
    
    const user = userList[0];
    
    // 验证密码
    if (!verifyPassword(password, user.passwordHash)) {
      return NextResponse.json({ error: '用户名或密码错误' }, { status: 401 });
    }
    
    // 检查用户状态
    if (user.status === 'pending') {
      return NextResponse.json({ error: '账号待审批，请等待管理员审批' }, { status: 403 });
    }
    
    if (user.status === 'disabled') {
      return NextResponse.json({ error: '账号已被禁用，请联系管理员' }, { status: 403 });
    }
    
    // 获取角色和部门信息
    const roleList = await db.select().from(roles).where(eq(roles.id, user.roleId)).limit(1);
    const deptList = await db.select().from(departments).where(eq(departments.id, user.departmentId)).limit(1);
    
    const role = roleList[0];
    const department = deptList[0];
    
    // 更新最后登录时间
    await db.update(users)
      .set({
        lastLoginAt: getTimestamp(),
        lastLoginIp: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
        updatedAt: getTimestamp(),
      })
      .where(eq(users.id, user.id));
    
    // 设置session cookie（7天有效）
    const sessionData = {
      userId: user.id,
      username: user.username,
      name: user.name,
      roleId: user.roleId,
      roleCode: role?.code,
      roleName: role?.name,
      departmentId: user.departmentId,
      departmentName: department?.name,
    };
    
    const cookieStore = await cookies();
    cookieStore.set('session', JSON.stringify(sessionData), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7天
      path: '/',
    });
    
    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        employeeId: user.employeeId,
        phone: user.phone,
        email: user.email,
        avatar: user.avatar,
        role: role ? {
          id: role.id,
          name: role.name,
          code: role.code,
        } : null,
        department: department ? {
          id: department.id,
          name: department.name,
          code: department.code,
          type: department.type,
        } : null,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({ error: '登录失败' }, { status: 500 });
  }
}
