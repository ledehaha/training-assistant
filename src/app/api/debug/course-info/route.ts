import { NextRequest, NextResponse } from 'next/server';
import { db, courses, teachers, eq } from '@/storage/database';
import { ensureDatabaseReady } from '@/storage/database';

// GET /api/debug/course-info?projectId=xxx - 调试接口：查看项目的课程和讲师信息
export async function GET(request: NextRequest) {
  try {
    await ensureDatabaseReady();
    
    const searchParams = request.nextUrl.searchParams;
    const projectId = searchParams.get('projectId');
    
    if (!projectId) {
      return NextResponse.json({ error: 'projectId is required' }, { status: 400 });
    }
    
    // 获取项目所有课程
    const courseList = db
      .select()
      .from(courses)
      .where(eq(courses.projectId, projectId))
      .all();
    
    // 获取所有讲师信息
    const teacherList = db.select().from(teachers).all();
    
    // 创建讲师映射
    const teacherMap = new Map(teacherList.map(t => [t.id, t]));
    
    // 为每个课程添加讲师详细信息
    const courseWithTeacherInfo = courseList.map(course => {
      const teacher = course.teacherId ? teacherMap.get(course.teacherId) : null;
      return {
        ...course,
        teacherName: course.teacherName,
        teacherTitle: course.teacherTitle,
        teacherInfo: teacher ? {
          id: teacher.id,
          name: teacher.name,
          title: teacher.title,
          organization: teacher.organization,
        } : null,
        // 判断师资级别
        titleLevel: determineTitleLevel(course.teacherTitle || (teacher?.title || '')),
      };
    });
    
    return NextResponse.json({
      success: true,
      data: {
        projectId,
        courseCount: courseList.length,
        courses: courseWithTeacherInfo,
      },
    });
  } catch (error) {
    console.error('Debug course info error:', error);
    return NextResponse.json(
      { error: 'Failed to get course info', details: String(error) },
      { status: 500 }
    );
  }
}

// 根据职称判断级别（复制自前端逻辑）
function determineTitleLevel(title: string): 'academician' | 'professor' | 'other' {
  if (!title) return 'other';
  
  const normalizedTitle = title.trim();
  
  // 院士级别
  const academicianTitles = ['中国科学院院士', '中国工程院院士', '院士'];
  if (academicianTitles.some(t => normalizedTitle.includes(t))) {
    return 'academician';
  }
  
  // 教授级别
  const professorTitles = [
    '教授', '教授级高级讲师', '教授级高级政工师',
    '研究员', '教授级研究员',
    '教授级高级工程师', '教授级高级建筑师', '教授级高级城市规划师',
    '教授级高级农艺师', '教授级高级畜牧师', '教授级高级兽医师', '教授级高级水产师',
    '主任医师', '教授级主任医师',
    '教授级高级经济师',
    '教授级高级会计师', '教授级高级审计师',
    '教授级高级统计师',
    '教授级高级翻译',
    '教授级高级档案师',
    '教授级高级编辑', '教授级高级记者', '教授级高级播音指导',
    '教授级高级', '正高级',
  ];
  if (professorTitles.some(t => normalizedTitle.includes(t))) {
    return 'professor';
  }
  
  return 'other';
}
