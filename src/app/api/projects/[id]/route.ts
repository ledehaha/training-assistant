import { NextRequest, NextResponse } from 'next/server';
import { db, projects, courses, projectDocuments, eq, asc, desc, and, saveDatabaseImmediate, ensureDatabaseReady } from '@/storage/database';
import { generateId, getTimestamp } from '@/storage/database';
import { cookies } from 'next/headers';

// 获取当前用户信息
async function getCurrentUser(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('session');
    const authHeader = request.headers.get('authorization');
    
    let session: { userId?: string; roleCode?: string } | null = null;
    
    if (sessionCookie?.value) {
      try {
        session = JSON.parse(sessionCookie.value);
      } catch {
        // 忽略解析错误
      }
    }
    
    if (!session && authHeader?.startsWith('Bearer ')) {
      try {
        const token = authHeader.substring(7);
        const decoded = Buffer.from(token, 'base64').toString('utf-8');
        session = JSON.parse(decoded);
      } catch {
        // 忽略解析错误
      }
    }
    
    return session;
  } catch {
    return null;
  }
}

// 检查用户是否是管理员
function isAdmin(user: { roleCode?: string } | null): boolean {
  return user?.roleCode === 'admin';
}

// 检查文件是否是有效的上传文件（以 "projects/" 开头）
function isValidFile(fileKey: unknown): boolean {
  if (!fileKey || typeof fileKey !== 'string') return false;
  return fileKey.startsWith('projects/');
}

// 检查项目是否满足归档条件
function checkArchiveRequirements(project: Record<string, unknown>): { isComplete: boolean; missingFiles: string[] } {
  const requirements = [
    {
      name: '合同文件',
      uploaded: isValidFile(project.contractFilePdf) && isValidFile(project.contractFileWord),
      required: true,
    },
    {
      name: '成本测算表',
      uploaded: isValidFile(project.costFilePdf) && isValidFile(project.costFileExcel),
      required: true,
    },
    {
      name: '项目申报书',
      uploaded: isValidFile(project.declarationFilePdf) && isValidFile(project.declarationFileWord),
      required: true,
    },
    {
      name: '学员名单',
      uploaded: isValidFile(project.studentListFile),
      required: true,
    },
    {
      name: '满意度调查结果',
      uploaded: isValidFile(project.satisfactionSurveyFile),
      required: false, // 非必选
    },
    {
      name: '会签单',
      uploaded: isValidFile(project.countersignFile),
      required: true,
    },
  ];
  
  const missingFiles = requirements.filter(r => r.required && !r.uploaded).map(r => r.name);
  
  return {
    isComplete: missingFiles.length === 0,
    missingFiles,
  };
}

// GET /api/projects/[id] - 获取项目详情
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await ensureDatabaseReady();
    
    const { id } = await params;
    
    // 获取当前用户信息
    const currentUser = await getCurrentUser(request);
    const userIsAdmin = isAdmin(currentUser);

    // 获取项目信息
    const project = db
      .select()
      .from(projects)
      .where(eq(projects.id, id))
      .get();

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }
    
    // 权限检查：非管理员只能访问自己创建的项目
    if (!userIsAdmin && project.createdById !== currentUser?.userId) {
      return NextResponse.json({ error: '无权访问此项目' }, { status: 403 });
    }

    // 获取项目课程
    const coursesList = db
      .select()
      .from(courses)
      .where(and(eq(courses.projectId, id), eq(courses.isTemplate, false)))
      .orderBy(asc(courses.order))
      .all();

    // 获取项目文档
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
  } catch (error) {
    console.error('Get project error:', error);
    return NextResponse.json({ error: 'Failed to get project' }, { status: 500 });
  }
}

// PUT /api/projects/[id] - 更新项目
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await ensureDatabaseReady();
    
    const { id } = await params;
    
    // 获取当前用户信息
    const currentUser = await getCurrentUser(request);
    const userIsAdmin = isAdmin(currentUser);
    
    // 检查项目是否存在及权限
    const existingProject = db
      .select()
      .from(projects)
      .where(eq(projects.id, id))
      .get();
    
    if (!existingProject) {
      return NextResponse.json({ error: '项目不存在' }, { status: 404 });
    }
    
    // 权限检查：非管理员只能修改自己创建的项目
    if (!userIsAdmin && existingProject.createdById !== currentUser?.userId) {
      return NextResponse.json({ error: '无权修改此项目' }, { status: 403 });
    }
    
    const body = await request.json();
    const now = getTimestamp();

    const updateData: Record<string, unknown> = {
      updatedAt: now,
    };

    // 字段映射（驼峰转下划线）
    const fieldMapping: Record<string, string> = {
      name: 'name',
      status: 'status',
      trainingTarget: 'trainingTarget',
      targetAudience: 'targetAudience',
      participantCount: 'participantCount',
      trainingDays: 'trainingDays',
      trainingHours: 'trainingHours',
      trainingPeriod: 'trainingPeriod',
      budgetMin: 'budgetMin',
      budgetMax: 'budgetMax',
      location: 'location',
      specialRequirements: 'specialRequirements',
      startDate: 'startDate',
      endDate: 'endDate',
      venueId: 'venueId',
      teacherFee: 'teacherFee',
      venueFee: 'venueFee',
      cateringFee: 'cateringFee',
      teaBreakFee: 'teaBreakFee',
      materialFee: 'materialFee',
      laborFee: 'laborFee',
      otherFee: 'otherFee',
      managementFee: 'managementFee',
      totalBudget: 'totalBudget',
      actualCost: 'actualCost',
      avgSatisfaction: 'avgSatisfaction',
      surveyResponseRate: 'surveyResponseRate',
      completedAt: 'completedAt',
      archivedAt: 'archivedAt',
      summaryReport: 'summaryReport',
      // 文件字段映射
      contractFilePdf: 'contractFilePdf',
      contractFileWord: 'contractFileWord',
      costFilePdf: 'costFilePdf',
      costFileExcel: 'costFileExcel',
      declarationFilePdf: 'declarationFilePdf',
      declarationFileWord: 'declarationFileWord',
      studentListFile: 'studentListFile',
      satisfactionSurveyFile: 'satisfactionSurveyFile',
    };

    Object.entries(fieldMapping).forEach(([bodyKey, dbKey]) => {
      if (body[bodyKey] !== undefined) {
        updateData[dbKey] = body[bodyKey];
      }
    });

    // 归档验证：如果状态要变为 archived，检查是否满足归档条件
    if (body.status === 'archived') {
      // 获取当前项目信息
      const currentProject = db
        .select()
        .from(projects)
        .where(eq(projects.id, id))
        .get();

      if (currentProject) {
        // 合并当前项目数据和新上传的文件数据
        const projectToCheck = { ...currentProject, ...updateData };
        const { isComplete, missingFiles } = checkArchiveRequirements(projectToCheck as Record<string, unknown>);
        
        if (!isComplete) {
          return NextResponse.json({ 
            error: `无法归档：缺少必要文件（${missingFiles.join('、')}），请先上传这些文件后再进行归档` 
          }, { status: 400 });
        }
        
        // 满足条件，设置归档时间
        updateData.archivedAt = now;
      }
    }

    const result = db
      .update(projects)
      .set(updateData)
      .where(eq(projects.id, id))
      .returning()
      .get();

    // 更新课程数据
    if (body.courses !== undefined) {
      // 删除旧的课程记录
      db.delete(courses).where(and(eq(courses.projectId, id), eq(courses.isTemplate, false))).run();
      
      // 插入新的课程记录
      if (Array.isArray(body.courses) && body.courses.length > 0) {
        for (let i = 0; i < body.courses.length; i++) {
          const course = body.courses[i];
          db.insert(courses)
            .values({
              id: course.id || generateId(),
              isTemplate: false,
              projectId: id,
              name: course.name,
              day: course.day,
              duration: course.duration,
              description: course.description,
              teacherId: course.teacherId,
              visitSiteId: course.visitSiteId,
              type: course.type || 'course',
              order: i,
              isActive: true,
              createdAt: course.createdAt || now,
            })
            .run();
        }
      }
    }

    // 保存数据库到文件
    saveDatabaseImmediate();

    return NextResponse.json({ data: result });
  } catch (error) {
    console.error('Update project error:', error);
    return NextResponse.json({ error: 'Failed to update project' }, { status: 500 });
  }
}

// DELETE /api/projects/[id] - 删除项目
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await ensureDatabaseReady();
    
    const { id } = await params;
    
    // 获取当前用户信息
    const currentUser = await getCurrentUser(request);
    const userIsAdmin = isAdmin(currentUser);
    
    // 检查项目是否存在及权限
    const existingProject = db
      .select()
      .from(projects)
      .where(eq(projects.id, id))
      .get();
    
    if (!existingProject) {
      return NextResponse.json({ error: '项目不存在' }, { status: 404 });
    }
    
    // 权限检查：非管理员只能删除自己创建的项目
    if (!userIsAdmin && existingProject.createdById !== currentUser?.userId) {
      return NextResponse.json({ error: '无权删除此项目' }, { status: 403 });
    }

    // 由于设置了 ON DELETE CASCADE，删除项目会自动删除关联数据
    db.delete(projects).where(eq(projects.id, id)).run();

    // 保存数据库到文件
    saveDatabaseImmediate();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete project error:', error);
    return NextResponse.json({ error: 'Failed to delete project' }, { status: 500 });
  }
}
