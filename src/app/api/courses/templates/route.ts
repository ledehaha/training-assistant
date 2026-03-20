import { NextRequest, NextResponse } from 'next/server';
import { db, courses, teachers, eq, and, ensureDatabaseReady } from '@/storage/database';

// GET /api/courses/templates - 获取课程模板列表
export async function GET(request: NextRequest) {
  try {
    // 确保数据库已初始化
    await ensureDatabaseReady();

    // 从 courses 表查询课程模板（isTemplate = true）
    const templates = db
      .select()
      .from(courses)
      .where(and(eq(courses.isTemplate, true), eq(courses.isActive, true)))
      .all();

    // 获取所有讲师信息用于匹配
    const teachersList = db
      .select()
      .from(teachers)
      .where(eq(teachers.isActive, true))
      .all();

    // 创建讲师ID到讲师信息的映射
    const teacherMap = new Map(
      teachersList.map((t) => [t.id, t])
    );

    return NextResponse.json({
      success: true,
      templates: templates.map((t) => {
        const teacher = t.teacherId ? teacherMap.get(t.teacherId) : null;
        return {
          id: t.id,
          name: t.name,
          category: t.category,
          duration: t.duration,
          description: t.description,
          content: t.content,
          targetAudience: t.targetAudience,
          teacherId: t.teacherId,
          teacherName: teacher?.name || null,
          teacherTitle: teacher?.title || null,
        };
      }),
    });
  } catch (error) {
    console.error('获取课程模板失败:', error);
    return NextResponse.json(
      { success: false, error: '获取课程模板失败' },
      { status: 500 }
    );
  }
}
