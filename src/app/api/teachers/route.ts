import { NextRequest, NextResponse } from 'next/server';
import { db, teachers, users, departments, eq, desc, sql, and, saveDatabaseImmediate, ensureDatabaseReady } from '@/storage/database';
import type { SQLWrapper } from 'drizzle-orm';
import { generateId, getTimestamp } from '@/storage/database';
import { 
  getCurrentUser, 
  isAdmin, 
  isCollegeAdmin,
  type UserInfo 
} from '@/lib/access-control';

// 获取用户角色信息
async function getUserRoleInfo(request: NextRequest): Promise<{
  user: UserInfo | null;
  role: { code: string } | null;
}> {
  const user = await getCurrentUser(request);
  if (!user) {
    return { user: null, role: null };
  }
  
  // 从角色代码获取角色信息
  const roleCode = user.roleCode || user.roleId;
  return {
    user,
    role: roleCode ? { code: roleCode } : null,
  };
}

// 检查用户角色
function checkUserRole(role: { code: string } | null, allowedRoles: string[]): boolean {
  if (!role?.code) return false;
  return allowedRoles.includes(role.code);
}

// 检查数据访问权限
function canAccessDataByCreator(
  user: UserInfo | null,
  role: { code: string } | null,
  data: { createdBy?: string | null; createdByDepartment?: string | null }
): boolean {
  // 管理员或教务处可以访问所有
  if (checkUserRole(role, ['admin', 'dean_office'])) {
    return true;
  }
  
  // 未登录用户不能访问
  if (!user?.userId) {
    return false;
  }
  
  // 学院负责人可以访问本学院的数据
  if (checkUserRole(role, ['college_head', 'college_admin'])) {
    return data.createdByDepartment === user.departmentId;
  }
  
  // 普通用户只能访问自己创建的数据
  return data.createdBy === user.userId;
}

// GET /api/teachers - 获取讲师列表（按权限过滤）
export async function GET(request: NextRequest) {
  try {
    // 确保数据库已初始化
    await ensureDatabaseReady();
    
    // 获取当前用户
    const { user, role } = await getUserRoleInfo(request);
    if (!user) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }
    
    const searchParams = request.nextUrl.searchParams;
    const title = searchParams.get('title');
    const expertise = searchParams.get('expertise');
    
    // 构建基础条件
    const baseConditions: SQLWrapper[] = [eq(teachers.isActive, true)];
    
    if (title) {
      baseConditions.push(eq(teachers.title, title));
    }
    
    if (expertise) {
      baseConditions.push(sql`${teachers.expertise} LIKE ${'%' + expertise + '%'}`);
    }
    
    // 根据权限过滤讲师
    // 管理员和教务处可以看到所有
    // 学院负责人可以看到本学院创建的
    // 普通用户只能看到自己创建的
    if (!checkUserRole(role, ['admin', 'dean_office'])) {
      if (checkUserRole(role, ['college_head', 'college_admin'])) {
        // 学院负责人：可以看到本学院的讲师
        baseConditions.push(sql`${teachers.createdByDepartment} = ${user.departmentId}`);
      } else {
        // 普通用户：只能看到自己创建的讲师
        baseConditions.push(sql`${teachers.createdBy} = ${user.userId}`);
      }
    }
    
    const results = db
      .select({
        id: teachers.id,
        name: teachers.name,
        title: teachers.title,
        expertise: teachers.expertise,
        organization: teachers.organization,
        bio: teachers.bio,
        hourlyRate: teachers.hourlyRate,
        rating: teachers.rating,
        teachingCount: teachers.teachingCount,
        isActive: teachers.isActive,
        createdAt: teachers.createdAt,
        updatedAt: teachers.updatedAt,
        createdBy: teachers.createdBy,
        createdByDepartment: teachers.createdByDepartment,
        creatorName: users.name,
      })
      .from(teachers)
      .leftJoin(users, eq(teachers.createdBy, users.id))
      .where(and(...baseConditions))
      .orderBy(desc(teachers.rating))
      .all();

    return NextResponse.json({ data: results });
  } catch (error) {
    console.error('Get teachers error:', error);
    return NextResponse.json({ error: 'Failed to get teachers' }, { status: 500 });
  }
}

// POST /api/teachers - 创建新讲师（需登录）
export async function POST(request: NextRequest) {
  try {
    // 确保数据库已初始化
    await ensureDatabaseReady();
    
    // 获取当前用户
    const { user } = await getUserRoleInfo(request);
    if (!user) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }
    
    const body = await request.json();
    const id = generateId();
    const now = getTimestamp();

    const result = db
      .insert(teachers)
      .values({
        id,
        name: body.name,
        title: body.title,
        expertise: body.expertise,
        organization: body.organization,
        bio: body.bio,
        hourlyRate: body.hourlyRate,
        createdBy: user.userId,
        createdByDepartment: user.departmentId,
        createdAt: now,
      })
      .returning()
      .get();

    // 保存数据库到文件
    saveDatabaseImmediate();

    return NextResponse.json({ data: result });
  } catch (error) {
    console.error('Create teacher error:', error);
    return NextResponse.json({ error: 'Failed to create teacher' }, { status: 500 });
  }
}

// PUT /api/teachers - 更新讲师（需权限）
export async function PUT(request: NextRequest) {
  try {
    await ensureDatabaseReady();
    
    // 获取当前用户
    const { user, role } = await getUserRoleInfo(request);
    if (!user) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }
    
    const body = await request.json();
    const { id, ...updateData } = body;

    if (!id) {
      return NextResponse.json({ error: '缺少讲师ID' }, { status: 400 });
    }

    // 检查讲师是否存在
    const existing = db
      .select()
      .from(teachers)
      .where(eq(teachers.id, id))
      .limit(1)
      .all();

    if (existing.length === 0) {
      return NextResponse.json({ error: '讲师不存在' }, { status: 404 });
    }
    
    const teacher = existing[0];
    
    // 检查是否有权限修改
    if (!canAccessDataByCreator(user, role, teacher)) {
      // 获取创建者信息
      let createdByName = '未知用户';
      let createdByDepartmentName = '未知部门';
      
      if (teacher.createdBy) {
        const creator = db
          .select({ name: users.name })
          .from(users)
          .where(eq(users.id, teacher.createdBy))
          .limit(1)
          .all();
        if (creator.length > 0) {
          createdByName = creator[0].name || '未知用户';
        }
      }
      
      if (teacher.createdByDepartment) {
        const dept = db
          .select({ name: departments.name })
          .from(departments)
          .where(eq(departments.id, teacher.createdByDepartment))
          .limit(1)
          .all();
        if (dept.length > 0) {
          createdByDepartmentName = dept[0].name || '未知部门';
        }
      }
      
      return NextResponse.json({ 
        error: '无权限修改此讲师信息', 
        code: 'FORBIDDEN',
        creator: {
          id: teacher.createdBy,
          name: createdByName,
          departmentId: teacher.createdByDepartment,
          departmentName: createdByDepartmentName
        }
      }, { status: 403 });
    }

    // 更新讲师
    const result = db
      .update(teachers)
      .set({
        ...updateData,
        updatedAt: getTimestamp(),
      })
      .where(eq(teachers.id, id))
      .returning()
      .get();

    // 保存数据库到文件
    saveDatabaseImmediate();

    return NextResponse.json({ data: result });
  } catch (error) {
    console.error('Update teacher error:', error);
    return NextResponse.json({ error: 'Failed to update teacher' }, { status: 500 });
  }
}

// DELETE /api/teachers - 删除讲师（需权限）
export async function DELETE(request: NextRequest) {
  try {
    await ensureDatabaseReady();
    
    // 获取当前用户
    const { user, role } = await getUserRoleInfo(request);
    if (!user) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }
    
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');
    
    if (!id) {
      return NextResponse.json({ error: '缺少讲师ID' }, { status: 400 });
    }

    // 检查讲师是否存在
    const existing = db
      .select()
      .from(teachers)
      .where(eq(teachers.id, id))
      .limit(1)
      .all();

    if (existing.length === 0) {
      return NextResponse.json({ error: '讲师不存在' }, { status: 404 });
    }
    
    const teacher = existing[0];
    
    // 检查是否有权限删除
    if (!canAccessDataByCreator(user, role, teacher)) {
      return NextResponse.json({ error: '无权限删除此讲师信息' }, { status: 403 });
    }

    // 软删除（设置为不活跃）
    db
      .update(teachers)
      .set({ 
        isActive: false,
        updatedAt: getTimestamp()
      })
      .where(eq(teachers.id, id))
      .run();

    // 保存数据库到文件
    saveDatabaseImmediate();

    return NextResponse.json({ success: true, message: '讲师信息已删除' });
  } catch (error) {
    console.error('Delete teacher error:', error);
    return NextResponse.json({ error: 'Failed to delete teacher' }, { status: 500 });
  }
}
