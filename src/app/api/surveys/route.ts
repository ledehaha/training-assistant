import { NextRequest, NextResponse } from 'next/server';
import { db, satisfactionSurveys, projects, users, departments, eq, desc, sql, and, saveDatabaseImmediate, ensureDatabaseReady } from '@/storage/database';
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

// GET /api/surveys - 获取满意度调查列表（按权限过滤）
// 规则：仅同学院可见
export async function GET(request: NextRequest) {
  try {
    await ensureDatabaseReady();
    
    // 获取当前用户
    const { user, role } = await getUserRoleInfo(request);
    if (!user) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }
    
    const searchParams = request.nextUrl.searchParams;
    const projectId = searchParams.get('projectId');
    
    // 构建基础条件
    const conditions: SQLWrapper[] = [];
    
    if (projectId) {
      conditions.push(eq(satisfactionSurveys.projectId, projectId));
    }
    
    // 根据权限过滤
    // 管理员可以看到所有
    // 其他用户只能看到同学院的调查（通过项目的部门信息关联）
    if (!checkUserRole(role, ['admin', 'dean_office'])) {
      // 需要关联项目表获取部门信息
      // 使用子查询获取项目所属部门
      conditions.push(sql`
        ${satisfactionSurveys.projectId} IN (
          SELECT id FROM projects WHERE department_id = ${user.departmentId}
        )
      `);
    }
    
    const whereClause = conditions.length > 0 
      ? and(...conditions) 
      : undefined;
    
    const results = db
      .select({
        id: satisfactionSurveys.id,
        projectId: satisfactionSurveys.projectId,
        title: satisfactionSurveys.title,
        description: satisfactionSurveys.description,
        questions: satisfactionSurveys.questions,
        status: satisfactionSurveys.status,
        deadline: satisfactionSurveys.deadline,
        responseCount: satisfactionSurveys.responseCount,
        createdAt: satisfactionSurveys.createdAt,
        updatedAt: satisfactionSurveys.updatedAt,
        projectName: projects.name,
      })
      .from(satisfactionSurveys)
      .leftJoin(projects, eq(satisfactionSurveys.projectId, projects.id))
      .where(whereClause)
      .orderBy(desc(satisfactionSurveys.createdAt))
      .all();

    return NextResponse.json({ data: results });
  } catch (error) {
    console.error('Get surveys error:', error);
    return NextResponse.json({ error: 'Failed to get surveys' }, { status: 500 });
  }
}

// POST /api/surveys - 创建满意度调查（需登录）
export async function POST(request: NextRequest) {
  try {
    await ensureDatabaseReady();
    
    // 获取当前用户
    const { user, role } = await getUserRoleInfo(request);
    if (!user) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }
    
    const body = await request.json();
    
    // 检查项目是否属于用户所在学院
    if (body.projectId && !checkUserRole(role, ['admin', 'dean_office'])) {
      const project = db
        .select()
        .from(projects)
        .where(eq(projects.id, body.projectId))
        .limit(1)
        .all();
      
      if (project.length === 0 || project[0].departmentId !== user.departmentId) {
        return NextResponse.json({ error: '无权限为此项目创建满意度调查' }, { status: 403 });
      }
    }
    
    const id = generateId();
    const now = getTimestamp();

    const result = db
      .insert(satisfactionSurveys)
      .values({
        id,
        projectId: body.projectId,
        title: body.title,
        description: body.description,
        questions: JSON.stringify(body.questions),
        status: 'active',
        createdAt: now,
      })
      .returning()
      .get();

    // 保存数据库到文件
    saveDatabaseImmediate();

    return NextResponse.json({ data: result });
  } catch (error) {
    console.error('Create survey error:', error);
    return NextResponse.json({ error: 'Failed to create survey' }, { status: 500 });
  }
}

// DELETE /api/surveys - 删除满意度调查（需权限）
// 规则：创建者可删除，管理员可删除，学院负责人可删除本学院的
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
      return NextResponse.json({ error: '缺少调查ID' }, { status: 400 });
    }

    // 检查调查是否存在
    const existing = db
      .select({
        survey: satisfactionSurveys,
        project: projects,
      })
      .from(satisfactionSurveys)
      .leftJoin(projects, eq(satisfactionSurveys.projectId, projects.id))
      .where(eq(satisfactionSurveys.id, id))
      .limit(1)
      .all();

    if (existing.length === 0) {
      return NextResponse.json({ error: '调查不存在' }, { status: 404 });
    }
    
    const survey = existing[0].survey;
    const project = existing[0].project;
    
    // 检查删除权限
    // 管理员可以删除
    if (checkUserRole(role, ['admin'])) {
      // 允许删除
    }
    // 学院负责人可以删除本学院的
    else if (checkUserRole(role, ['college_head', 'college_admin']) && project?.departmentId === user.departmentId) {
      // 允许删除
    }
    // 项目创建者可以删除
    else if (project?.createdById === user.userId) {
      // 允许删除
    }
    else {
      return NextResponse.json({ error: '无权限删除此满意度调查' }, { status: 403 });
    }

    // 删除调查
    db
      .delete(satisfactionSurveys)
      .where(eq(satisfactionSurveys.id, id))
      .run();

    // 保存数据库到文件
    saveDatabaseImmediate();

    return NextResponse.json({ success: true, message: '满意度调查已删除' });
  } catch (error) {
    console.error('Delete survey error:', error);
    return NextResponse.json({ error: 'Failed to delete survey' }, { status: 500 });
  }
}
