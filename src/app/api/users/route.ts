import { NextRequest, NextResponse } from 'next/server';
import { db, users, roles, departments, ensureDatabaseReady, getTimestamp } from '@/storage/database';
import { eq, desc, sql } from 'drizzle-orm';
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

// 检查是否有用户审批权限
function hasUserApprovePermission(user: { roleCode: string }): boolean {
  return user.roleCode === 'admin' || user.roleCode === 'hr_auditor';
}

// GET /api/users - 获取用户列表
export async function GET(request: NextRequest) {
  try {
    await ensureDatabaseReady();
    
    const currentUser = await getCurrentUser(request);
    if (!currentUser) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }
    
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status'); // pending, active, disabled
    const departmentId = searchParams.get('departmentId');
    const search = searchParams.get('search');
    
    // 构建查询
    let queryBuilder = db.select({
      id: users.id,
      username: users.username,
      name: users.name,
      employeeId: users.employeeId,
      phone: users.phone,
      email: users.email,
      avatar: users.avatar,
      status: users.status,
      approvedBy: users.approvedBy,
      approvedAt: users.approvedAt,
      createdAt: users.createdAt,
      department: {
        id: departments.id,
        name: departments.name,
        code: departments.code,
        type: departments.type,
      },
      role: {
        id: roles.id,
        name: roles.name,
        code: roles.code,
      },
    })
    .from(users)
    .leftJoin(departments, eq(users.departmentId, departments.id))
    .leftJoin(roles, eq(users.roleId, roles.id));
    
    // 非管理员只能看到自己部门的用户（学院）或全部用户（管理部门）
    if (currentUser.roleCode !== 'admin' && currentUser.roleCode !== 'hr_auditor') {
      // 普通用户不能查看用户列表
      return NextResponse.json({ error: '无权限' }, { status: 403 });
    }
    
    // 应用筛选条件
    if (status) {
      queryBuilder = queryBuilder.where(eq(users.status, status)) as typeof queryBuilder;
    }
    
    const userList = await queryBuilder.orderBy(desc(users.createdAt)).all();
    
    return NextResponse.json({ data: userList });
  } catch (error) {
    console.error('Get users error:', error);
    return NextResponse.json({ error: '获取用户列表失败' }, { status: 500 });
  }
}

// PUT /api/users - 审批用户
export async function PUT(request: NextRequest) {
  try {
    await ensureDatabaseReady();
    
    const currentUser = await getCurrentUser(request);
    if (!currentUser) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }
    
    if (!hasUserApprovePermission(currentUser)) {
      return NextResponse.json({ error: '无审批权限' }, { status: 403 });
    }
    
    const body = await request.json();
    const { userId, action, roleId } = body; // action: 'approve' | 'reject' | 'disable' | 'enable'
    
    if (!userId || !action) {
      return NextResponse.json({ error: '缺少必要参数' }, { status: 400 });
    }
    
    // 获取用户信息
    const userList = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (userList.length === 0) {
      return NextResponse.json({ error: '用户不存在' }, { status: 404 });
    }
    
    const user = userList[0];
    const now = getTimestamp();
    
    let newStatus = user.status;
    let updateData: Record<string, string | null> = {
      updatedAt: now,
    };
    
    switch (action) {
      case 'approve':
        newStatus = 'active';
        updateData.approvedBy = currentUser.userId;
        updateData.approvedAt = now;
        if (roleId) {
          updateData.roleId = roleId;
        }
        break;
      case 'reject':
        newStatus = 'disabled';
        updateData.approvedBy = currentUser.userId;
        updateData.approvedAt = now;
        break;
      case 'disable':
        newStatus = 'disabled';
        break;
      case 'enable':
        newStatus = 'active';
        break;
      default:
        return NextResponse.json({ error: '无效的操作' }, { status: 400 });
    }
    
    updateData.status = newStatus;
    
    await db.update(users)
      .set(updateData)
      .where(eq(users.id, userId));
    
    return NextResponse.json({
      success: true,
      message: action === 'approve' ? '审批通过' : action === 'reject' ? '已拒绝' : '操作成功',
      user: {
        id: userId,
        status: newStatus,
      },
    });
  } catch (error) {
    console.error('Update user error:', error);
    return NextResponse.json({ error: '操作失败' }, { status: 500 });
  }
}
