import { NextRequest, NextResponse } from 'next/server';
import { db, projects, courses, projectDocuments, eq, asc, desc, and, saveDatabaseImmediate, ensureDatabaseReady } from '@/storage/database';
import { generateId, getTimestamp } from '@/storage/database';
import { 
  getCurrentUser, 
  isAdmin, 
  isCollegeAdmin,
  canViewArchivedProjectDetail 
} from '@/lib/access-control';

// 检查文件是否是有效的上传文件
function isValidFile(fileKey: unknown): boolean {
  if (!fileKey || typeof fileKey !== 'string') return false;
  return fileKey.startsWith('projects/');
}

// 检查项目是否满足归档条件
function checkArchiveRequirements(project: Record<string, unknown>): { isComplete: boolean; missingFiles: string[] } {
  const requirements = [
    { name: '合同文件', uploaded: isValidFile(project.contractFilePdf) && isValidFile(project.contractFileWord), required: true },
    { name: '成本测算表', uploaded: isValidFile(project.costFilePdf) && isValidFile(project.costFileExcel), required: true },
    { name: '项目申报书', uploaded: isValidFile(project.declarationFilePdf) && isValidFile(project.declarationFileWord), required: true },
    { name: '学员名单', uploaded: isValidFile(project.studentListFile), required: true },
    { name: '课程安排表', uploaded: isValidFile(project.courseScheduleFile), required: true },
    { name: '满意度调查结果', uploaded: isValidFile(project.satisfactionSurveyFile), required: false },
    { name: '会签单', uploaded: isValidFile(project.countersignFile), required: true },
  ];
  
  const missingFiles = requirements.filter(r => r.required && !r.uploaded).map(r => r.name);
  
  return { isComplete: missingFiles.length === 0, missingFiles };
}

// GET /api/projects/[id] - 获取项目详情
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await ensureDatabaseReady();
    
    const { id } = await params;
    const currentUser = await getCurrentUser(request);

    // 获取项目信息
    const project = db
      .select()
      .from(projects)
      .where(eq(projects.id, id))
      .get();

    if (!project) {
      return NextResponse.json({ error: '项目不存在' }, { status: 404 });
    }
    
    // 管理员可以访问所有项目
    if (isAdmin(currentUser)) {
      return returnProjectWithDetails(id, project);
    }
    
    // 未登录用户只能看归档项目列表（不能看详情）
    if (!currentUser?.userId) {
      return NextResponse.json({ error: '请先登录' }, { status: 401 });
    }
    
    // 创建者可以访问自己的项目
    if (project.createdById === currentUser.userId) {
      return returnProjectWithDetails(id, project);
    }
    
    // 归档项目：需要检查共享权限
    if (project.status === 'archived') {
      const accessCheck = await canViewArchivedProjectDetail(
        id, 
        currentUser, 
        project.createdById || '',
        project.departmentId
      );
      
      if (!accessCheck.canView) {
        return NextResponse.json({ 
          error: '需要申请共享权限才能查看此归档项目详情',
          needShareRequest: true,
          projectId: id
        }, { status: 403 });
      }
      
      return returnProjectWithDetails(id, project);
    }
    
    // 学院负责人可以访问本学院项目
    if (isCollegeAdmin(currentUser) && project.departmentId === currentUser.departmentId) {
      return returnProjectWithDetails(id, project);
    }
    
    // 其他情况：无权限
    return NextResponse.json({ error: '无权访问此项目' }, { status: 403 });
    
  } catch (error) {
    console.error('Get project error:', error);
    return NextResponse.json({ error: 'Failed to get project' }, { status: 500 });
  }
}

// 返回项目详情（包含课程和文档）
function returnProjectWithDetails(id: string, project: typeof projects.$inferSelect) {
  const coursesList = db
    .select()
    .from(courses)
    .where(and(eq(courses.projectId, id), eq(courses.isTemplate, false)))
    .orderBy(asc(courses.order))
    .all();

  const documents = db
    .select()
    .from(projectDocuments)
    .where(eq(projectDocuments.projectId, id))
    .orderBy(desc(projectDocuments.createdAt))
    .all();

  return NextResponse.json({
    data: {
      ...project,
      courses: coursesList || [],
      documents: documents || [],
    },
  });
}

// PUT /api/projects/[id] - 更新项目
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await ensureDatabaseReady();
    
    const { id } = await params;
    const currentUser = await getCurrentUser(request);
    
    // 检查项目是否存在
    const existingProject = db
      .select()
      .from(projects)
      .where(eq(projects.id, id))
      .get();
    
    if (!existingProject) {
      return NextResponse.json({ error: '项目不存在' }, { status: 404 });
    }
    
    // 权限检查
    if (!isAdmin(currentUser)) {
      if (!currentUser?.userId) {
        return NextResponse.json({ error: '请先登录' }, { status: 401 });
      }
      
      // 创建者可以修改
      if (existingProject.createdById !== currentUser.userId) {
        // 学院负责人可以修改本学院项目
        if (!(isCollegeAdmin(currentUser) && existingProject.departmentId === currentUser.departmentId)) {
          return NextResponse.json({ error: '无权修改此项目' }, { status: 403 });
        }
      }
    }
    
    const body = await request.json();
    const now = getTimestamp();

    const updateData: Record<string, unknown> = { updatedAt: now };

    // 字段映射
    const fieldMapping: Record<string, string> = {
      name: 'name', status: 'status', trainingTarget: 'trainingTarget',
      targetAudience: 'targetAudience', participantCount: 'participantCount',
      trainingDays: 'trainingDays', trainingHours: 'trainingHours',
      trainingPeriod: 'trainingPeriod', budgetMin: 'budgetMin', budgetMax: 'budgetMax',
      location: 'location', specialRequirements: 'specialRequirements',
      startDate: 'startDate', endDate: 'endDate', venueId: 'venueId',
      teacherFee: 'teacherFee', venueFee: 'venueFee', cateringFee: 'cateringFee',
      teaBreakFee: 'teaBreakFee', materialFee: 'materialFee', laborFee: 'laborFee',
      otherFee: 'otherFee', managementFee: 'managementFee', totalBudget: 'totalBudget',
      actualCost: 'actualCost', avgSatisfaction: 'avgSatisfaction',
      surveyResponseRate: 'surveyResponseRate', completedAt: 'completedAt',
      archivedAt: 'archivedAt', summaryReport: 'summaryReport',
      contractFilePdf: 'contractFilePdf', contractFileWord: 'contractFileWord',
      contractFileNamePdf: 'contractFileNamePdf', contractFileNameWord: 'contractFileNameWord',
      costFilePdf: 'costFilePdf', costFileExcel: 'costFileExcel',
      costFileNamePdf: 'costFileNamePdf', costFileNameExcel: 'costFileNameExcel',
      declarationFilePdf: 'declarationFilePdf', declarationFileWord: 'declarationFileWord',
      declarationFileNamePdf: 'declarationFileNamePdf', declarationFileNameWord: 'declarationFileNameWord',
      studentListFile: 'studentListFile', studentListFileName: 'studentListFileName',
      courseScheduleFile: 'courseScheduleFile', courseScheduleFileName: 'courseScheduleFileName',
      satisfactionSurveyFile: 'satisfactionSurveyFile', satisfactionSurveyFileName: 'satisfactionSurveyFileName',
      countersignFile: 'countersignFile', countersignFileName: 'countersignFileName',
      otherMaterials: 'otherMaterials',
    };

    Object.entries(fieldMapping).forEach(([bodyKey, dbKey]) => {
      if (body[bodyKey] !== undefined) {
        updateData[dbKey] = body[bodyKey];
      }
    });

    // 归档验证
    if (body.status === 'archived') {
      const projectToCheck = { ...existingProject, ...updateData };
      const { isComplete, missingFiles } = checkArchiveRequirements(projectToCheck as Record<string, unknown>);
      
      if (!isComplete) {
        return NextResponse.json({ 
          error: `无法归档：缺少必要文件（${missingFiles.join('、')}）` 
        }, { status: 400 });
      }
      updateData.archivedAt = now;
    }

    const result = db
      .update(projects)
      .set(updateData)
      .where(eq(projects.id, id))
      .returning()
      .get();

    // 更新课程数据
    if (body.courses !== undefined) {
      db.delete(courses).where(and(eq(courses.projectId, id), eq(courses.isTemplate, false))).run();
      
      if (Array.isArray(body.courses) && body.courses.length > 0) {
        for (let i = 0; i < body.courses.length; i++) {
          const course = body.courses[i];
          db.insert(courses).values({
            id: course.id || generateId(),
            isTemplate: false, projectId: id, name: course.name,
            day: course.day, duration: course.duration, description: course.description,
            teacherId: course.teacherId, visitSiteId: course.visitSiteId,
            type: course.type || 'course', order: i, isActive: true,
            createdAt: course.createdAt || now,
          }).run();
        }
      }
    }

    saveDatabaseImmediate();

    return NextResponse.json({ data: result });
  } catch (error) {
    console.error('Update project error:', error);
    return NextResponse.json({ error: 'Failed to update project' }, { status: 500 });
  }
}

// DELETE /api/projects/[id] - 删除项目（按阶段区分权限）
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await ensureDatabaseReady();
    
    const { id } = await params;
    const currentUser = await getCurrentUser(request);
    
    // 检查项目是否存在
    const existingProject = db
      .select()
      .from(projects)
      .where(eq(projects.id, id))
      .get();
    
    if (!existingProject) {
      return NextResponse.json({ error: '项目不存在' }, { status: 404 });
    }
    
    // 管理员可以删除任何项目
    if (isAdmin(currentUser)) {
      return deleteProject(id);
    }
    
    if (!currentUser?.userId) {
      return NextResponse.json({ error: '请先登录' }, { status: 401 });
    }
    
    // 归档后的项目：只有管理员可以删除
    if (existingProject.status === 'archived') {
      return NextResponse.json({ error: '已归档的项目只能由管理员删除' }, { status: 403 });
    }
    
    // 设计和申报阶段：创建者可以删除
    if (existingProject.createdById === currentUser.userId) {
      return deleteProject(id);
    }
    
    // 其他情况：无权限
    return NextResponse.json({ error: '无权删除此项目' }, { status: 403 });
    
  } catch (error) {
    console.error('Delete project error:', error);
    return NextResponse.json({ error: 'Failed to delete project' }, { status: 500 });
  }
}

// 执行删除操作
function deleteProject(id: string) {
  db.delete(projects).where(eq(projects.id, id)).run();
  saveDatabaseImmediate();
  return NextResponse.json({ success: true });
}
