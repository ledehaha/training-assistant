import { NextRequest, NextResponse } from 'next/server';
import { db, projects, courses, teachers, eq, desc, sql, and, ensureDatabaseReady } from '@/storage/database';

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
      const coursesList = db
        .select({
          id: courses.id,
          name: courses.name,
          day: courses.day,
          startTime: courses.startTime,
          endTime: courses.endTime,
          duration: courses.duration,
          description: courses.description,
          teacherId: courses.teacherId,
          teacherName: teachers.name,
          teacherTitle: teachers.title,
        })
        .from(courses)
        .leftJoin(teachers, eq(courses.teacherId, teachers.id))
        .where(and(eq(courses.projectId, project.id as string), eq(courses.isTemplate, false)))
        .all();

      return {
        ...project,
        courses: coursesList,
      };
    });

    return NextResponse.json({ data: projectsWithCourses });
  } catch (error) {
    console.error('Get completed projects error:', error);
    return NextResponse.json({ error: 'Failed to get completed projects' }, { status: 500 });
  }
}
