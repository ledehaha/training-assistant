import { NextRequest, NextResponse } from 'next/server';
import { db, visitSites, users, departments, eq, desc, sql, and, saveDatabaseImmediate, ensureDatabaseReady } from '@/storage/database';
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

// GET /api/visit-sites - 获取参访基地列表（按权限过滤）
export async function GET(request: NextRequest) {
  try {
    await ensureDatabaseReady();
    
    // 获取当前用户
    const { user, role } = await getUserRoleInfo(request);
    if (!user) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }
    
    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get('type');
    const industry = searchParams.get('industry');
    
    // 构建基础条件
    const baseConditions: SQLWrapper[] = [eq(visitSites.isActive, true)];
    
    if (type) {
      baseConditions.push(eq(visitSites.type, type));
    }
    
    if (industry) {
      baseConditions.push(sql`${visitSites.industry} LIKE ${'%' + industry + '%'}`);
    }
    
    // 根据权限过滤参访基地
    // 管理员和教务处可以看到所有
    // 学院负责人可以看到本学院创建的
    // 普通用户只能看到自己创建的
    if (!checkUserRole(role, ['admin', 'dean_office'])) {
      if (checkUserRole(role, ['college_head', 'college_admin'])) {
        // 学院负责人：可以看到本学院的参访基地
        baseConditions.push(sql`${visitSites.createdByDepartment} = ${user.departmentId}`);
      } else {
        // 普通用户：只能看到自己创建的参访基地
        baseConditions.push(sql`${visitSites.createdBy} = ${user.userId}`);
      }
    }
    
    const results = db
      .select({
        id: visitSites.id,
        name: visitSites.name,
        type: visitSites.type,
        industry: visitSites.industry,
        address: visitSites.address,
        contactPerson: visitSites.contactPerson,
        contactPhone: visitSites.contactPhone,
        contactEmail: visitSites.contactEmail,
        description: visitSites.description,
        visitContent: visitSites.visitContent,
        visitDuration: visitSites.visitDuration,
        maxVisitors: visitSites.maxVisitors,
        visitFee: visitSites.visitFee,
        facilities: visitSites.facilities,
        requirements: visitSites.requirements,
        rating: visitSites.rating,
        visitCount: visitSites.visitCount,
        isActive: visitSites.isActive,
        createdAt: visitSites.createdAt,
        updatedAt: visitSites.updatedAt,
        createdBy: visitSites.createdBy,
        createdByDepartment: visitSites.createdByDepartment,
        creatorName: users.name,
      })
      .from(visitSites)
      .leftJoin(users, eq(visitSites.createdBy, users.id))
      .where(and(...baseConditions))
      .orderBy(desc(visitSites.rating))
      .all();

    return NextResponse.json({ data: results });
  } catch (error) {
    console.error('Get visit sites error:', error);
    return NextResponse.json({ error: 'Failed to get visit sites' }, { status: 500 });
  }
}

// POST /api/visit-sites - 创建参访基地（需登录）
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
      .insert(visitSites)
      .values({
        id,
        name: body.name,
        type: body.type,
        industry: body.industry,
        address: body.address,
        contactPerson: body.contactPerson,
        contactPhone: body.contactPhone,
        contactEmail: body.contactEmail,
        description: body.description,
        visitContent: body.visitContent,
        visitDuration: body.visitDuration,
        maxVisitors: body.maxVisitors,
        visitFee: body.visitFee,
        facilities: body.facilities,
        requirements: body.requirements,
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
    console.error('Create visit site error:', error);
    return NextResponse.json({ error: 'Failed to create visit site' }, { status: 500 });
  }
}

// PUT /api/visit-sites - 更新参访基地（需权限）
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
      return NextResponse.json({ error: '缺少参访基地ID' }, { status: 400 });
    }

    // 检查参访基地是否存在
    const existing = db
      .select()
      .from(visitSites)
      .where(eq(visitSites.id, id))
      .limit(1)
      .all();

    if (existing.length === 0) {
      return NextResponse.json({ error: '参访基地不存在' }, { status: 404 });
    }
    
    const site = existing[0];
    
    // 检查是否有权限修改
    if (!canAccessDataByCreator(user, role, site)) {
      return NextResponse.json({ error: '无权限修改此参访基地' }, { status: 403 });
    }

    // 更新参访基地
    const result = db
      .update(visitSites)
      .set({
        ...updateData,
        updatedAt: getTimestamp(),
      })
      .where(eq(visitSites.id, id))
      .returning()
      .get();

    // 保存数据库到文件
    saveDatabaseImmediate();

    return NextResponse.json({ data: result });
  } catch (error) {
    console.error('Update visit site error:', error);
    return NextResponse.json({ error: 'Failed to update visit site' }, { status: 500 });
  }
}

// DELETE /api/visit-sites - 删除参访基地（需权限）
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
      return NextResponse.json({ error: '缺少参访基地ID' }, { status: 400 });
    }

    // 检查参访基地是否存在
    const existing = db
      .select()
      .from(visitSites)
      .where(eq(visitSites.id, id))
      .limit(1)
      .all();

    if (existing.length === 0) {
      return NextResponse.json({ error: '参访基地不存在' }, { status: 404 });
    }
    
    const site = existing[0];
    
    // 检查是否有权限删除
    if (!canAccessDataByCreator(user, role, site)) {
      return NextResponse.json({ error: '无权限删除此参访基地' }, { status: 403 });
    }

    // 软删除（设置为不活跃）
    db
      .update(visitSites)
      .set({ 
        isActive: false,
        updatedAt: getTimestamp()
      })
      .where(eq(visitSites.id, id))
      .run();

    // 保存数据库到文件
    saveDatabaseImmediate();

    return NextResponse.json({ success: true, message: '参访基地已删除' });
  } catch (error) {
    console.error('Delete visit site error:', error);
    return NextResponse.json({ error: 'Failed to delete visit site' }, { status: 500 });
  }
}
