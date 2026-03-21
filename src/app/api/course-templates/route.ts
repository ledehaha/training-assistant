import { NextRequest, NextResponse } from 'next/server';
import { db, courses, users, departments, eq, desc, sql, and, saveDatabaseImmediate, ensureDatabaseReady } from '@/storage/database';
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
  
  // 学院负责人可以修改本学院的数据
  if (checkUserRole(role, ['college_head', 'college_admin'])) {
    // 可以修改本学院创建的数据
    if (data.createdByDepartment === user.departmentId) {
      return true;
    }
    // 也可以修改没有部门归属的公共数据
    if (!data.createdByDepartment) {
      return true;
    }
  }
  
  // 普通用户只能访问自己创建的数据
  return data.createdBy === user.userId;
}

// GET /api/course-templates - 获取课程模板列表（按权限过滤）
// 现在从 courses 表中查询 isTemplate = true 的记录
export async function GET(request: NextRequest) {
  try {
    await ensureDatabaseReady();
    
    // 获取当前用户
    const { user, role } = await getUserRoleInfo(request);
    if (!user) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }
    
    const searchParams = request.nextUrl.searchParams;
    const category = searchParams.get('category');
    const targetAudience = searchParams.get('targetAudience');
    
    // 构建基础条件：isTemplate = true 且 isActive = true
    const baseConditions: SQLWrapper[] = [
      eq(courses.isTemplate, true),
      eq(courses.isActive, true)
    ];
    
    if (category) {
      baseConditions.push(eq(courses.category, category));
    }
    
    if (targetAudience) {
      baseConditions.push(sql`${courses.targetAudience} LIKE ${'%' + targetAudience + '%'}`);
    }
    
    // 根据权限过滤课程模板
    // 管理员和教务处可以看到所有
    // 学院负责人可以看到本学院创建的
    // 普通用户只能看到自己创建的
    if (!checkUserRole(role, ['admin', 'dean_office'])) {
      if (checkUserRole(role, ['college_head', 'college_admin'])) {
        // 学院负责人：可以看到本学院的模板
        baseConditions.push(sql`${courses.createdByDepartment} = ${user.departmentId}`);
      } else {
        // 普通用户：只能看到自己创建的模板
        baseConditions.push(sql`${courses.createdBy} = ${user.userId}`);
      }
    }
    
    const results = db
      .select({
        id: courses.id,
        name: courses.name,
        category: courses.category,
        description: courses.description,
        duration: courses.duration,
        targetAudience: courses.targetAudience,
        content: courses.content,
        difficulty: courses.difficulty,
        type: courses.type,
        usageCount: courses.usageCount,
        isActive: courses.isActive,
        createdAt: courses.createdAt,
        updatedAt: courses.updatedAt,
        createdBy: courses.createdBy,
        createdByDepartment: courses.createdByDepartment,
        creatorName: users.name,
      })
      .from(courses)
      .leftJoin(users, eq(courses.createdBy, users.id))
      .where(and(...baseConditions))
      .orderBy(desc(courses.usageCount))
      .all();

    return NextResponse.json({ data: results });
  } catch (error) {
    console.error('Get course templates error:', error);
    return NextResponse.json({ error: 'Failed to get course templates' }, { status: 500 });
  }
}

// POST /api/course-templates - 创建新课程模板（需登录）
// 现在写入 courses 表，设置 isTemplate = true
export async function POST(request: NextRequest) {
  try {
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
      .insert(courses)
      .values({
        id,
        isTemplate: true, // 标记为模板
        projectId: null, // 模板不关联项目
        name: body.name,
        category: body.category,
        description: body.description,
        duration: body.duration,
        targetAudience: body.targetAudience,
        content: body.content,
        difficulty: body.difficulty,
        type: 'course', // 默认类型
        isActive: true,
        createdAt: now,
        createdBy: user.userId,
        createdByDepartment: user.departmentId,
      })
      .returning()
      .get();

    // 保存数据库到文件
    saveDatabaseImmediate();

    return NextResponse.json({ data: result });
  } catch (error) {
    console.error('Create course template error:', error);
    return NextResponse.json({ error: 'Failed to create course template' }, { status: 500 });
  }
}

// PUT /api/course-templates - 更新课程模板（需权限）
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
      return NextResponse.json({ error: '缺少课程模板ID' }, { status: 400 });
    }

    // 检查课程模板是否存在（从 courses 表查询 isTemplate = true 的记录）
    const existing = db
      .select()
      .from(courses)
      .where(and(eq(courses.id, id), eq(courses.isTemplate, true)))
      .limit(1)
      .all();

    if (existing.length === 0) {
      return NextResponse.json({ error: '课程模板不存在' }, { status: 404 });
    }
    
    const template = existing[0];
    
    // 检查是否有权限修改
    if (!canAccessDataByCreator(user, role, template)) {
      return NextResponse.json({ error: '无权限修改此课程模板' }, { status: 403 });
    }

    // 更新课程模板
    const result = db
      .update(courses)
      .set({
        ...updateData,
        updatedAt: getTimestamp(),
      })
      .where(eq(courses.id, id))
      .returning()
      .get();

    // 保存数据库到文件
    saveDatabaseImmediate();

    return NextResponse.json({ data: result });
  } catch (error) {
    console.error('Update course template error:', error);
    return NextResponse.json({ error: 'Failed to update course template' }, { status: 500 });
  }
}

// DELETE /api/course-templates - 删除课程模板（需权限）
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
      return NextResponse.json({ error: '缺少课程模板ID' }, { status: 400 });
    }

    // 检查课程模板是否存在
    const existing = db
      .select()
      .from(courses)
      .where(and(eq(courses.id, id), eq(courses.isTemplate, true)))
      .limit(1)
      .all();

    if (existing.length === 0) {
      return NextResponse.json({ error: '课程模板不存在' }, { status: 404 });
    }
    
    const template = existing[0];
    
    // 检查是否有权限删除
    if (!canAccessDataByCreator(user, role, template)) {
      return NextResponse.json({ error: '无权限删除此课程模板' }, { status: 403 });
    }

    // 软删除（设置为不活跃）
    db
      .update(courses)
      .set({ 
        isActive: false,
        updatedAt: getTimestamp()
      })
      .where(eq(courses.id, id))
      .run();

    // 保存数据库到文件
    saveDatabaseImmediate();

    return NextResponse.json({ success: true, message: '课程模板已删除' });
  } catch (error) {
    console.error('Delete course template error:', error);
    return NextResponse.json({ error: 'Failed to delete course template' }, { status: 500 });
  }
}
