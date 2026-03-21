import { NextRequest, NextResponse } from 'next/server';
import { db, venues, users, departments, eq, desc, sql, and, saveDatabaseImmediate, ensureDatabaseReady } from '@/storage/database';
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

// GET /api/venues - 获取场地列表（按权限过滤）
export async function GET(request: NextRequest) {
  try {
    await ensureDatabaseReady();
    
    // 获取当前用户
    const { user, role } = await getUserRoleInfo(request);
    if (!user) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }
    
    const searchParams = request.nextUrl.searchParams;
    const minCapacity = searchParams.get('minCapacity');
    const location = searchParams.get('location');
    
    // 构建基础条件
    const baseConditions: SQLWrapper[] = [sql`${venues.isActive} = 1`];
    
    if (minCapacity) {
      baseConditions.push(sql`${venues.capacity} >= ${parseInt(minCapacity)}`);
    }
    
    if (location) {
      baseConditions.push(sql`${venues.location} LIKE ${'%' + location + '%'}`);
    }
    
    // 根据权限过滤场地
    // 管理员和教务处可以看到所有场地
    // 学院负责人可以看到本学院创建的场地
    // 普通用户只能看到自己创建的场地
    let additionalCondition: SQLWrapper | undefined;
    
    if (!checkUserRole(role, ['admin', 'dean_office'])) {
      if (checkUserRole(role, ['college_head', 'college_admin'])) {
        // 学院负责人：可以看到本学院的场地
        additionalCondition = sql`${venues.createdByDepartment} = ${user.departmentId}`;
      } else {
        // 普通用户：只能看到自己创建的场地
        additionalCondition = sql`${venues.createdBy} = ${user.userId}`;
      }
    }
    
    // 构建完整查询条件
    const whereClause = additionalCondition
      ? sql`${sql.join(baseConditions, sql` AND `)} AND ${additionalCondition}`
      : sql`${sql.join(baseConditions, sql` AND `)}`;
    
    const results = db
      .select({
        id: venues.id,
        name: venues.name,
        location: venues.location,
        capacity: venues.capacity,
        dailyRate: venues.dailyRate,
        facilities: venues.facilities,
        rating: venues.rating,
        usageCount: venues.usageCount,
        isActive: venues.isActive,
        createdAt: venues.createdAt,
        updatedAt: venues.updatedAt,
        createdBy: venues.createdBy,
        createdByDepartment: venues.createdByDepartment,
        creatorName: users.name,
      })
      .from(venues)
      .leftJoin(users, eq(venues.createdBy, users.id))
      .where(whereClause as any)
      .orderBy(desc(venues.rating))
      .all();

    return NextResponse.json({ data: results });
  } catch (error) {
    console.error('Get venues error:', error);
    return NextResponse.json({ error: 'Failed to get venues' }, { status: 500 });
  }
}

// POST /api/venues - 创建新场地（需登录）
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
      .insert(venues)
      .values({
        id,
        name: body.name,
        location: body.location,
        capacity: body.capacity,
        dailyRate: body.dailyRate,
        facilities: body.facilities,
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
    console.error('Create venue error:', error);
    return NextResponse.json({ error: 'Failed to create venue' }, { status: 500 });
  }
}

// PUT /api/venues - 更新场地（需权限）
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
      return NextResponse.json({ error: '缺少场地ID' }, { status: 400 });
    }

    // 检查场地是否存在
    const existing = db
      .select()
      .from(venues)
      .where(eq(venues.id, id))
      .limit(1)
      .all();

    if (existing.length === 0) {
      return NextResponse.json({ error: '场地不存在' }, { status: 404 });
    }
    
    const venue = existing[0];
    
    // 检查是否有权限修改
    if (!canAccessDataByCreator(user, role, venue)) {
      // 获取创建者信息
      let createdByName = '未知用户';
      let createdByDepartmentName = '未知部门';
      
      if (venue.createdBy) {
        const creator = db
          .select({ name: users.name })
          .from(users)
          .where(eq(users.id, venue.createdBy))
          .limit(1)
          .all();
        if (creator.length > 0) {
          createdByName = creator[0].name || '未知用户';
        }
      }
      
      if (venue.createdByDepartment) {
        const dept = db
          .select({ name: departments.name })
          .from(departments)
          .where(eq(departments.id, venue.createdByDepartment))
          .limit(1)
          .all();
        if (dept.length > 0) {
          createdByDepartmentName = dept[0].name || '未知部门';
        }
      }
      
      return NextResponse.json({ 
        error: '无权限修改此场地', 
        code: 'FORBIDDEN',
        creator: {
          id: venue.createdBy,
          name: createdByName,
          departmentId: venue.createdByDepartment,
          departmentName: createdByDepartmentName
        }
      }, { status: 403 });
    }

    // 更新场地
    const result = db
      .update(venues)
      .set({
        ...updateData,
        updatedAt: getTimestamp(),
      })
      .where(eq(venues.id, id))
      .returning()
      .get();

    // 保存数据库到文件
    saveDatabaseImmediate();

    return NextResponse.json({ data: result });
  } catch (error) {
    console.error('Update venue error:', error);
    return NextResponse.json({ error: 'Failed to update venue' }, { status: 500 });
  }
}

// DELETE /api/venues - 删除场地（需权限）
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
      return NextResponse.json({ error: '缺少场地ID' }, { status: 400 });
    }

    // 检查场地是否存在
    const existing = db
      .select()
      .from(venues)
      .where(eq(venues.id, id))
      .limit(1)
      .all();

    if (existing.length === 0) {
      return NextResponse.json({ error: '场地不存在' }, { status: 404 });
    }
    
    const venue = existing[0];
    
    // 检查是否有权限删除
    if (!canAccessDataByCreator(user, role, venue)) {
      return NextResponse.json({ error: '无权限删除此场地' }, { status: 403 });
    }

    // 软删除（设置为不活跃）
    db
      .update(venues)
      .set({ 
        isActive: false,
        updatedAt: getTimestamp()
      })
      .where(eq(venues.id, id))
      .run();

    // 保存数据库到文件
    saveDatabaseImmediate();

    return NextResponse.json({ success: true, message: '场地已删除' });
  } catch (error) {
    console.error('Delete venue error:', error);
    return NextResponse.json({ error: 'Failed to delete venue' }, { status: 500 });
  }
}
