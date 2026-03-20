import { NextRequest, NextResponse } from 'next/server';
import { db, projects, projectShares, users, eq, and, desc } from '@/storage/database';
import { generateId, getTimestamp, ensureDatabaseReady, saveDatabaseImmediate } from '@/storage/database';
import { getCurrentUser, isAdmin, isCollegeAdmin } from '@/lib/access-control';

// GET /api/projects/[id]/shares - 获取项目的共享记录
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await ensureDatabaseReady();
    
    const { id } = await params;
    const currentUser = await getCurrentUser(request);
    
    if (!currentUser?.userId) {
      return NextResponse.json({ error: '请先登录' }, { status: 401 });
    }
    
    // 检查项目是否存在
    const project = await db.select()
      .from(projects)
      .where(eq(projects.id, id))
      .limit(1);
    
    if (!project[0]) {
      return NextResponse.json({ error: '项目不存在' }, { status: 404 });
    }
    
    // 只有创建者和管理员可以查看共享记录
    if (project[0].createdById !== currentUser.userId && !isAdmin(currentUser)) {
      // 学院负责人可以查看本学院项目的共享记录
      if (!(isCollegeAdmin(currentUser) && project[0].departmentId === currentUser.departmentId)) {
        return NextResponse.json({ error: '无权查看共享记录' }, { status: 403 });
      }
    }
    
    // 获取共享记录
    const shares = await db.select({
      id: projectShares.id,
      projectId: projectShares.projectId,
      sharedWith: projectShares.sharedWith,
      sharedWithName: users.name,
      sharedWithUsername: users.username,
      status: projectShares.status,
      requestMessage: projectShares.requestMessage,
      responseMessage: projectShares.responseMessage,
      requestedAt: projectShares.requestedAt,
      respondedAt: projectShares.respondedAt,
      expiresAt: projectShares.expiresAt,
    })
      .from(projectShares)
      .leftJoin(users, eq(projectShares.sharedWith, users.id))
      .where(eq(projectShares.projectId, id))
      .orderBy(desc(projectShares.createdAt))
      .all();
    
    return NextResponse.json({ data: shares });
    
  } catch (error) {
    console.error('Get shares error:', error);
    return NextResponse.json({ error: 'Failed to get shares' }, { status: 500 });
  }
}

// POST /api/projects/[id]/shares - 申请共享
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await ensureDatabaseReady();
    
    const { id } = await params;
    const currentUser = await getCurrentUser(request);
    
    if (!currentUser?.userId) {
      return NextResponse.json({ error: '请先登录' }, { status: 401 });
    }
    
    // 检查项目是否存在且已归档
    const project = await db.select()
      .from(projects)
      .where(eq(projects.id, id))
      .limit(1);
    
    if (!project[0]) {
      return NextResponse.json({ error: '项目不存在' }, { status: 404 });
    }
    
    if (project[0].status !== 'archived') {
      return NextResponse.json({ error: '只能申请共享已归档的项目' }, { status: 400 });
    }
    
    // 不能申请共享自己的项目
    if (project[0].createdById === currentUser.userId) {
      return NextResponse.json({ error: '不能申请共享自己创建的项目' }, { status: 400 });
    }
    
    // 检查是否已经申请过
    const existingShare = await db.select()
      .from(projectShares)
      .where(and(
        eq(projectShares.projectId, id),
        eq(projectShares.sharedWith, currentUser.userId)
      ))
      .limit(1);
    
    if (existingShare[0]) {
      if (existingShare[0].status === 'approved') {
        return NextResponse.json({ error: '您已获得该项目的访问权限' }, { status: 400 });
      }
      if (existingShare[0].status === 'pending') {
        return NextResponse.json({ error: '您已提交过申请，请等待审批' }, { status: 400 });
      }
    }
    
    const body = await request.json();
    const now = getTimestamp();
    
    // 创建共享申请
    const shareId = generateId();
    await db.insert(projectShares).values({
      id: shareId,
      projectId: id,
      sharedBy: project[0].createdById!,
      sharedWith: currentUser.userId,
      status: 'pending',
      requestMessage: body.message || '',
      requestedAt: now,
      createdAt: now,
    });
    
    saveDatabaseImmediate();
    
    return NextResponse.json({ 
      success: true, 
      message: '共享申请已提交，请等待项目创建者审批' 
    });
    
  } catch (error) {
    console.error('Create share request error:', error);
    return NextResponse.json({ error: 'Failed to create share request' }, { status: 500 });
  }
}
