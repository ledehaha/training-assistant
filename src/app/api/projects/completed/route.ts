import { NextRequest, NextResponse } from 'next/server';
import { db, projects, projectCourses, teachers, eq, desc, sql, ensureDatabaseReady } from '@/storage/database';

// GET /api/projects/completed - 获取已完成项目列表（含课程方案）
export async function GET(request: NextRequest) {
  try {
    await ensureDatabaseReady();
    
    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get('search');
    
    // 获取已完成或已归档的项目
    let projectResults;
    
    if (search) {
      projectResults = db
        .select()
        .from(projects)
        .where(sql`${projects.status} IN ('completed', 'archived') AND ${projects.name} LIKE ${'%' + search + '%'}`)
        .orderBy(desc(projects.completedAt))
        .all();
    } else {
      projectResults = db
        .select()
        .from(projects)
        .where(sql`${projects.status} IN ('completed', 'archived')`)
        .orderBy(desc(projects.completedAt))
        .all();
    }

    // 为每个项目获取课程和讲师信息
    const projectsWithCourses = projectResults.map((project: Record<string, unknown>) => {
      const courses = db
        .select({
          id: projectCourses.id,
          name: projectCourses.name,
          day: projectCourses.day,
          startTime: projectCourses.startTime,
          endTime: projectCourses.endTime,
          duration: projectCourses.duration,
          description: projectCourses.description,
          teacherId: projectCourses.teacherId,
          teacherName: teachers.name,
          teacherTitle: teachers.title,
        })
        .from(projectCourses)
        .leftJoin(teachers, eq(projectCourses.teacherId, teachers.id))
        .where(eq(projectCourses.projectId, project.id as string))
        .all();

      return {
        ...project,
        courses,
      };
    });

    return NextResponse.json({ data: projectsWithCourses });
  } catch (error) {
    console.error('Get completed projects error:', error);
    return NextResponse.json({ error: 'Failed to get completed projects' }, { status: 500 });
  }
}
