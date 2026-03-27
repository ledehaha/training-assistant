import { NextRequest, NextResponse } from 'next/server';
import { db, projects, courses, eq, desc, sql, and, ensureDatabaseReady } from '@/storage/database';
import { cookies } from 'next/headers';
import type { SQLWrapper } from 'drizzle-orm';

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

// GET /api/projects/completed - 获取已完成项目列表（含课程方案）
export async function GET(request: NextRequest) {
  try {
    await ensureDatabaseReady();
    
    // 获取当前用户信息
    const currentUser = await getCurrentUser(request);
    const userIsAdmin = isAdmin(currentUser);
    
    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get('search');
    
    // 构建查询条件
    const conditions: (SQLWrapper | undefined)[] = [
      sql`${projects.status} IN ('completed', 'archived')`
    ];
    
    // 非管理员只能看到自己创建的项目
    if (!userIsAdmin && currentUser?.userId) {
      conditions.push(eq(projects.createdById, currentUser.userId));
    }
    
    if (search) {
      conditions.push(sql`${projects.name} LIKE ${'%' + search + '%'}`);
    }
    
    // 获取已完成或已归档的项目
    const projectResults = db
      .select()
      .from(projects)
      .where(and(...conditions))
      .orderBy(desc(projects.completedAt))
      .all();

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
          teacherName: courses.teacherName,
          teacherTitle: courses.teacherTitle,
        })
        .from(courses)
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
