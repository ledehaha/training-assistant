import { NextRequest, NextResponse } from 'next/server';
import { db, users, roles, departments, ensureDatabaseReady, generateId, getTimestamp } from '@/storage/database';
import { eq } from 'drizzle-orm';

// 密码哈希函数（测试阶段使用简单哈希）
function hashPassword(password: string): string {
  return Buffer.from(`hash_${password}_salt`).toString('base64');
}

// POST /api/auth/register - 用户注册
export async function POST(request: NextRequest) {
  try {
    await ensureDatabaseReady();
    
    const body = await request.json();
    const { password, name, employeeId, departmentId, phone, email } = body;
    
    // 参数验证
    if (!password || !name || !employeeId || !departmentId) {
      return NextResponse.json({ 
        error: '请填写必填信息：密码、姓名、工号、所属部门' 
      }, { status: 400 });
    }
    
    // 工号补0到11位
    const paddedEmployeeId = String(employeeId).padStart(11, '0');
    
    // 验证密码长度
    if (password.length < 6) {
      return NextResponse.json({ error: '密码长度至少6位' }, { status: 400 });
    }
    
    // 检查工号是否已存在
    const existingEmployee = await db.select()
      .from(users)
      .where(eq(users.employeeId, paddedEmployeeId))
      .limit(1);
    
    if (existingEmployee.length > 0) {
      return NextResponse.json({ error: '工号已被注册' }, { status: 400 });
    }
    
    // 检查部门是否存在
    const deptList = await db.select()
      .from(departments)
      .where(eq(departments.id, departmentId))
      .limit(1);
    
    if (deptList.length === 0) {
      return NextResponse.json({ error: '所选部门不存在' }, { status: 400 });
    }
    
    const department = deptList[0];
    
    // 根据部门类型分配默认角色
    // 学院用户默认为学院员工，管理部门用户默认为部门员工
    let defaultRoleCode = 'college_staff';
    if (department.type === 'management') {
      defaultRoleCode = 'dept_staff';
    }
    
    const roleList = await db.select()
      .from(roles)
      .where(eq(roles.code, defaultRoleCode))
      .limit(1);
    
    if (roleList.length === 0) {
      return NextResponse.json({ error: '系统角色配置错误' }, { status: 500 });
    }
    
    const defaultRole = roleList[0];
    
    // 创建用户
    const userId = generateId();
    const now = getTimestamp();
    
    await db.insert(users).values({
      id: userId,
      username: paddedEmployeeId, // 工号作为用户名
      passwordHash: hashPassword(password),
      name,
      employeeId: paddedEmployeeId,
      departmentId,
      roleId: defaultRole.id,
      phone: phone || null,
      email: email || null,
      status: 'pending', // 待审批状态
      createdAt: now,
      updatedAt: now,
    });
    
    return NextResponse.json({
      success: true,
      message: '注册成功，请等待管理员审批',
      user: {
        id: userId,
        username: paddedEmployeeId,
        name,
        employeeId: paddedEmployeeId,
        department: {
          id: department.id,
          name: department.name,
        },
        status: 'pending',
      },
    });
  } catch (error) {
    console.error('Register error:', error);
    return NextResponse.json({ error: '注册失败' }, { status: 500 });
  }
}
