import { NextRequest, NextResponse } from 'next/server';
import { db, projects, projectCourses, projectDocuments, eq, asc, desc, saveDatabaseImmediate, ensureDatabaseReady } from '@/storage/database';
import { generateId, getTimestamp } from '@/storage/database';

// GET /api/projects/[id] - 获取项目详情
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await ensureDatabaseReady();
    
    const { id } = await params;

    // 获取项目信息
    const project = db
      .select()
      .from(projects)
      .where(eq(projects.id, id))
      .get();

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // 获取项目课程
    const courses = db
      .select()
      .from(projectCourses)
      .where(eq(projectCourses.projectId, id))
      .orderBy(asc(projectCourses.order))
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
        courses: courses || [],
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
    };

    Object.entries(fieldMapping).forEach(([bodyKey, dbKey]) => {
      if (body[bodyKey] !== undefined) {
        updateData[dbKey] = body[bodyKey];
      }
    });

    const result = db
      .update(projects)
      .set(updateData)
      .where(eq(projects.id, id))
      .returning()
      .get();

    // 更新课程数据
    if (body.courses !== undefined) {
      // 删除旧的课程记录
      db.delete(projectCourses).where(eq(projectCourses.projectId, id)).run();
      
      // 插入新的课程记录
      if (Array.isArray(body.courses) && body.courses.length > 0) {
        for (let i = 0; i < body.courses.length; i++) {
          const course = body.courses[i];
          db.insert(projectCourses)
            .values({
              id: course.id || generateId(),
              projectId: id,
              name: course.name,
              day: course.day,
              duration: course.duration,
              description: course.description,
              teacherId: course.teacherId,
              order: i,
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
