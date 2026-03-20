import { NextRequest, NextResponse } from 'next/server';
import { db, projectShares, projects, eq, and, desc } from '@/storage/database';
import { getTimestamp, ensureDatabaseReady, saveDatabaseImmediate } from '@/storage/database';
import { getCurrentUser, isAdmin, isCollegeAdmin } from '@/lib/access-control';

// PUT /api/project-shares/[shareId] - 审批共享请求
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ shareId: string }> }
) {
  try {
    await ensureDatabaseReady();
    
    const { shareId } = await params;
    const currentUser = await getCurrentUser(request);
    
    if (!currentUser?.userId) {
      return NextResponse.json({ error: '请先登录' }, { status: 401 });
    }
    
    // 获取共享记录
    const share = await db.select()
      .from(projectShares)
      .where(eq(projectShares.id, shareId))
      .limit(1);
    
    if (!share[0]) {
      return NextResponse.json({ error: '共享记录不存在' }, { status: 404 });
    }
    
    // 获取项目信息
    const project = await db.select()
      .from(projects)
      .where(eq(projects.id, share[0].projectId))
      .limit(1);
    
    if (!project[0]) {
      return NextResponse.json({ error: '项目不存在' }, { status: 404 });
    }
    
    // 权限检查：只有创建者和管理员可以审批
    if (project[0].createdById !== currentUser.userId && !isAdmin(currentUser)) {
      // 学院负责人可以审批本学院项目的共享请求
      if (!(isCollegeAdmin(currentUser) && project[0].departmentId === currentUser.departmentId)) {
        return NextResponse.json({ error: '无权审批此共享请求' }, { status: 403 });
      }
    }
    
    const body = await request.json();
    const now = getTimestamp();
    
    // 更新共享状态
    await db.update(projectShares)
      .set({
        status: body.approved ? 'approved' : 'rejected',
        responseMessage: body.message || '',
        respondedAt: now,
      })
      .where(eq(projectShares.id, shareId));
    
    saveDatabaseImmediate();
    
    return NextResponse.json({ 
      success: true, 
      message: body.approved ? '已批准共享请求' : '已拒绝共享请求' 
    });
    
  } catch (error) {
    console.error('Update share error:', error);
    return NextResponse.json({ error: 'Failed to update share' }, { status: 500 });
  }
}

// DELETE /api/project-shares/[shareId] - 撤销共享
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ shareId: string }> }
) {
  try {
    await ensureDatabaseReady();
    
    const { shareId } = await params;
    const currentUser = await getCurrentUser(request);
    
    if (!currentUser?.userId) {
      return NextResponse.json({ error: '请先登录' }, { status: 401 });
    }
    
    // 获取共享记录
    const share = await db.select()
      .from(projectShares)
      .where(eq(projectShares.id, shareId))
      .limit(1);
    
    if (!share[0]) {
      return NextResponse.json({ error: '共享记录不存在' }, { status: 404 });
    }
    
    // 权限检查：创建者可以撤销自己发出的共享
    if (share[0].sharedBy === currentUser.userId) {
      await db.delete(projectShares).where(eq(projectShares.id, shareId));
      saveDatabaseImmediate();
      return NextResponse.json({ success: true, message: '已撤销共享' });
    }
    
    // 被共享者可以放弃共享权限
    if (share[0].sharedWith === currentUser.userId) {
      await db.delete(projectShares).where(eq(projectShares.id, shareId));
      saveDatabaseImmediate();
      return NextResponse.json({ success: true, message: '已放弃共享权限' });
    }
    
    // 管理员可以删除任何共享记录
    if (isAdmin(currentUser)) {
      await db.delete(projectShares).where(eq(projectShares.id, shareId));
      saveDatabaseImmediate();
      return NextResponse.json({ success: true, message: '已删除共享记录' });
    }
    
    return NextResponse.json({ error: '无权操作' }, { status: 403 });
    
  } catch (error) {
    console.error('Delete share error:', error);
    return NextResponse.json({ error: 'Failed to delete share' }, { status: 500 });
  }
}

// GET /api/project-shares - 获取我的共享申请列表
export async function GET(request: NextRequest) {
  try {
    await ensureDatabaseReady();
    
    const currentUser = await getCurrentUser(request);
    
    if (!currentUser?.userId) {
      return NextResponse.json({ error: '请先登录' }, { status: 401 });
    }
    
    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get('type'); // 'received' 或 'sent'
    
    if (type === 'received') {
      // 我收到的共享申请（作为项目创建者）
      const shares = await db.select({
        id: projectShares.id,
        projectId: projectShares.projectId,
        projectName: projects.name,
        sharedWith: projectShares.sharedWith,
        status: projectShares.status,
        requestMessage: projectShares.requestMessage,
        requestedAt: projectShares.requestedAt,
      })
        .from(projectShares)
        .leftJoin(projects, eq(projectShares.projectId, projects.id))
        .where(eq(projectShares.sharedBy, currentUser.userId))
        .orderBy(desc(projectShares.createdAt))
        .all();
      
      return NextResponse.json({ data: shares });
      
    } else {
      // 我发出的共享申请
      const shares = await db.select({
        id: projectShares.id,
        projectId: projectShares.projectId,
        projectName: projects.name,
        projectCreator: projects.createdById,
        status: projectShares.status,
        responseMessage: projectShares.responseMessage,
        requestedAt: projectShares.requestedAt,
        respondedAt: projectShares.respondedAt,
      })
        .from(projectShares)
        .leftJoin(projects, eq(projectShares.projectId, projects.id))
        .where(eq(projectShares.sharedWith, currentUser.userId))
        .orderBy(desc(projectShares.createdAt))
        .all();
      
      return NextResponse.json({ data: shares });
    }
    
  } catch (error) {
    console.error('Get shares error:', error);
    return NextResponse.json({ error: 'Failed to get shares' }, { status: 500 });
  }
}
