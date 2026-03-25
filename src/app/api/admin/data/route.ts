import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { 
  db, teachers, venues, courses, normativeDocuments, 
  projects, satisfactionSurveys, visitSites,
  userProfiles, userTrainingRecords,
  users, departments,
  eq, desc, sql, and,
  saveDatabaseImmediate, ensureDatabaseReady
} from '@/storage/database';
import { generateId, getTimestamp } from '@/storage/database';

// 表映射
const tableMap = {
  teachers,
  venues,
  courses, // 新增：统一的课程表
  course_templates: courses, // 兼容旧API，指向courses表
  normative_documents: normativeDocuments,
  projects,
  project_courses: courses, // 兼容旧API，指向courses表
  satisfaction_surveys: satisfactionSurveys,
  visit_sites: visitSites,
  user_profiles: userProfiles,
  user_training_records: userTrainingRecords,
} as const;

type TableName = keyof typeof tableMap;

// 验证表名
function isValidTable(table: string): table is TableName {
  return table in tableMap;
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

// GET /api/admin/data - 查询数据
export async function GET(request: NextRequest) {
  try {
    await ensureDatabaseReady();
    
    const searchParams = request.nextUrl.searchParams;
    const table = searchParams.get('table') as string;
    const id = searchParams.get('id');

    // 验证表名
    if (!table || !isValidTable(table)) {
      return NextResponse.json({ error: '无效的数据表' }, { status: 400 });
    }

    const tableSchema = tableMap[table];

    // 查询单条记录
    if (id) {
      const result = db
        .select()
        .from(tableSchema)
        .where(sql`id = ${id}`)
        .get();

      return NextResponse.json({ data: result });
    }

    // 查询全部记录
    // 对于 courses 表，根据 table 参数过滤 isTemplate
    if (tableSchema === courses) {
      let results;
      if (table === 'course_templates') {
        // 查询课程模板，关联用户、部门和讲师
        results = db
          .select({
            id: courses.id,
            name: courses.name,
            category: courses.category,
            description: courses.description,
            content: courses.content,
            duration: courses.duration,
            targetAudience: courses.targetAudience,
            difficulty: courses.difficulty,
            teacherId: courses.teacherId,
            usageCount: courses.usageCount,
            avgRating: courses.avgRating,
            isActive: courses.isActive,
            createdAt: courses.createdAt,
            updatedAt: courses.updatedAt,
            createdBy: courses.createdBy,
            createdByDepartment: courses.createdByDepartment,
            creatorName: users.name,
            departmentName: departments.name,
            teacherName: teachers.name,
          })
          .from(courses)
          .leftJoin(users, eq(courses.createdBy, users.id))
          .leftJoin(departments, eq(courses.createdByDepartment, departments.id))
          .leftJoin(teachers, eq(courses.teacherId, teachers.id))
          .where(eq(courses.isTemplate, true))
          .orderBy(desc(courses.createdAt))
          .limit(1000)
          .all();
      } else if (table === 'project_courses') {
        // 查询项目课程
        const projectId = searchParams.get('projectId');
        if (projectId) {
          results = db
            .select()
            .from(courses)
            .where(and(eq(courses.isTemplate, false), eq(courses.projectId, projectId)))
            .orderBy(desc(courses.createdAt))
            .limit(1000)
            .all();
        } else {
          results = db
            .select()
            .from(courses)
            .where(eq(courses.isTemplate, false))
            .orderBy(desc(courses.createdAt))
            .limit(1000)
            .all();
        }
      } else {
        // 查询所有课程（包括模板和项目课程）
        results = db
          .select()
          .from(courses)
          .orderBy(desc(courses.createdAt))
          .limit(1000)
          .all();
      }
      return NextResponse.json({ data: results });
    }

    // 讲师表：关联用户和部门
    if (table === 'teachers') {
      const results = db
        .select({
          id: teachers.id,
          name: teachers.name,
          title: teachers.title,
          expertise: teachers.expertise,
          bio: teachers.bio,
          hourlyRate: teachers.hourlyRate,
          rating: teachers.rating,
          teachingCount: teachers.teachingCount,
          isActive: teachers.isActive,
          isVerified: teachers.isVerified,
          createdAt: teachers.createdAt,
          updatedAt: teachers.updatedAt,
          createdBy: teachers.createdBy,
          createdByDepartment: teachers.createdByDepartment,
          creatorName: users.name,
          departmentName: departments.name,
        })
        .from(teachers)
        .leftJoin(users, eq(teachers.createdBy, users.id))
        .leftJoin(departments, eq(teachers.createdByDepartment, departments.id))
        .orderBy(desc(teachers.createdAt))
        .limit(1000)
        .all();
      return NextResponse.json({ data: results });
    }

    // 场地表：关联用户和部门
    if (table === 'venues') {
      const results = db
        .select({
          id: venues.id,
          name: venues.name,
          location: venues.location,
          capacity: venues.capacity,
          hourlyRate: venues.hourlyRate,
          facilities: venues.facilities,
          rating: venues.rating,
          usageCount: venues.usageCount,
          isActive: venues.isActive,
          createdAt: venues.createdAt,
          updatedAt: venues.updatedAt,
          createdBy: venues.createdBy,
          createdByDepartment: venues.createdByDepartment,
          creatorName: users.name,
          departmentName: departments.name,
        })
        .from(venues)
        .leftJoin(users, eq(venues.createdBy, users.id))
        .leftJoin(departments, eq(venues.createdByDepartment, departments.id))
        .orderBy(desc(venues.createdAt))
        .limit(1000)
        .all();
      return NextResponse.json({ data: results });
    }

    // 参访基地表：关联用户和部门
    if (table === 'visit_sites') {
      const results = db
        .select({
          id: visitSites.id,
          name: visitSites.name,
          type: visitSites.type,
          industry: visitSites.industry,
          address: visitSites.address,
          contactPerson: visitSites.contactPerson,
          contactPhone: visitSites.contactPhone,
          contactEmail: visitSites.contactEmail,
          description: visitSites.description,
          visitContent: visitSites.visitContent,
          visitDuration: visitSites.visitDuration,
          maxVisitors: visitSites.maxVisitors,
          visitFee: visitSites.visitFee,
          facilities: visitSites.facilities,
          requirements: visitSites.requirements,
          rating: visitSites.rating,
          visitCount: visitSites.visitCount,
          isActive: visitSites.isActive,
          isVerified: visitSites.isVerified,
          createdAt: visitSites.createdAt,
          updatedAt: visitSites.updatedAt,
          createdBy: visitSites.createdBy,
          createdByDepartment: visitSites.createdByDepartment,
          creatorName: users.name,
          departmentName: departments.name,
        })
        .from(visitSites)
        .leftJoin(users, eq(visitSites.createdBy, users.id))
        .leftJoin(departments, eq(visitSites.createdByDepartment, departments.id))
        .orderBy(desc(visitSites.createdAt))
        .limit(1000)
        .all();
      return NextResponse.json({ data: results });
    }

    // 规范性文件表：关联用户和部门，支持可见性过滤
    if (table === 'normative_documents') {
      // 获取当前用户信息用于可见性过滤
      const cookieStore = await cookies();
      const sessionCookie = cookieStore.get('session');
      let currentUserId: string | null = null;
      let currentUserDepartmentId: string | null = null;
      
      if (sessionCookie?.value) {
        try {
          const session = JSON.parse(sessionCookie.value);
          currentUserId = session.userId;
          currentUserDepartmentId = session.departmentId;
        } catch {
          // 忽略解析错误
        }
      }

      const results = db
        .select({
          id: normativeDocuments.id,
          name: normativeDocuments.name,
          summary: normativeDocuments.summary,
          issuer: normativeDocuments.issuer,
          issueDate: normativeDocuments.issueDate,
          effectiveDate: normativeDocuments.effectiveDate,
          expiryDate: normativeDocuments.expiryDate,
          filePath: normativeDocuments.filePath,
          fileName: normativeDocuments.fileName,
          fileSize: normativeDocuments.fileSize,
          isEffective: normativeDocuments.isEffective,
          visibility: normativeDocuments.visibility,
          createdAt: normativeDocuments.createdAt,
          updatedAt: normativeDocuments.updatedAt,
          createdBy: normativeDocuments.createdBy,
          createdByDepartment: normativeDocuments.createdByDepartment,
          creatorName: users.name,
          departmentName: departments.name,
        })
        .from(normativeDocuments)
        .leftJoin(users, eq(normativeDocuments.createdBy, users.id))
        .leftJoin(departments, eq(normativeDocuments.createdByDepartment, departments.id))
        .where(
          // 可见性过滤：公开 || 部门可见(同部门) || 本人可见(创建者)
          sql`(
            ${normativeDocuments.visibility} = 'public' 
            OR (${normativeDocuments.visibility} = 'department' AND ${normativeDocuments.createdByDepartment} = ${currentUserDepartmentId})
            OR (${normativeDocuments.visibility} = 'private' AND ${normativeDocuments.createdBy} = ${currentUserId})
            OR ${normativeDocuments.visibility} IS NULL
          )`
        )
        .orderBy(desc(normativeDocuments.createdAt))
        .limit(1000)
        .all();
      return NextResponse.json({ data: results });
    }

    // 其他表的通用查询
    const results = db
      .select()
      .from(tableSchema)
      .orderBy(desc(sql`created_at`))
      .limit(1000)
      .all();

    return NextResponse.json({ data: results });
  } catch (error) {
    console.error('Get data error:', error);
    return NextResponse.json({ error: '查询失败' }, { status: 500 });
  }
}

// POST /api/admin/data - 新增数据
export async function POST(request: NextRequest) {
  try {
    await ensureDatabaseReady();
    
    const body = await request.json();
    const { table, data } = body;

    // 验证表名
    if (!table || !isValidTable(table)) {
      return NextResponse.json({ error: '无效的数据表' }, { status: 400 });
    }

    if (!data || typeof data !== 'object') {
      return NextResponse.json({ error: '无效的数据' }, { status: 400 });
    }

    // 获取当前用户信息（从 Authorization header 或 Cookie）
    const authHeader = request.headers.get('authorization');
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('session');
    
    let currentUser: { userId: string; departmentId?: string } | null = null;
    
    // 从 Authorization header 解析
    if (authHeader?.startsWith('Bearer ')) {
      try {
        const token = authHeader.substring(7);
        const decoded = Buffer.from(token, 'base64').toString('utf-8');
        currentUser = JSON.parse(decoded);
      } catch (e) {
        console.error('Failed to parse auth token:', e);
      }
    }
    
    // 或从 Cookie 解析
    if (!currentUser && sessionCookie?.value) {
      try {
        currentUser = JSON.parse(sessionCookie.value);
      } catch (e) {
        console.error('Failed to parse session cookie:', e);
      }
    }

    // 调试日志
    console.log('[API /admin/data POST] table:', table);
    console.log('[API /admin/data POST] data:', JSON.stringify(data, null, 2));
    console.log('[API /admin/data POST] currentUser:', currentUser?.userId);

    // 对于 projects 表，检查必填字段
    if (table === 'projects') {
      if (!currentUser?.userId) {
        return NextResponse.json({ error: '请先登录后再导入项目' }, { status: 401 });
      }
      if (!currentUser.departmentId) {
        return NextResponse.json({ error: '您的账号未分配部门，请联系管理员' }, { status: 400 });
      }
    }

    // 归档验证：projects 表不能直接创建为 archived 状态
    if (table === 'projects' && data.status === 'archived') {
      const { isComplete, missingFiles } = checkArchiveRequirements(data);
      if (!isComplete) {
        return NextResponse.json({ 
          error: `无法归档：缺少必要文件（${missingFiles.join('、')}），请先创建项目并上传文件后再进行归档` 
        }, { status: 400 });
      }
    }

    // 准备插入数据，添加创建人信息
    const now = getTimestamp();
    const insertData = {
      id: generateId(),
      ...data,
      // 课程表特殊处理：根据 table 设置 isTemplate
      ...(table === 'course_templates' && { isTemplate: true, type: 'course' }),
      ...(table === 'project_courses' && { isTemplate: false }),
      // 添加创建人信息（如果当前用户已登录）
      ...(currentUser && {
        createdBy: currentUser.userId,
        createdByDepartment: currentUser.departmentId,
        // projects 表的必填字段使用不同的字段名
        ...(table === 'projects' && {
          departmentId: currentUser.departmentId,
          createdById: currentUser.userId,
        }),
      }),
      createdAt: now,
    };

    console.log('[API /admin/data POST] insertData:', JSON.stringify(insertData, null, 2));

    // 根据表执行插入
    const tableSchema = tableMap[table];
    const result = db.insert(tableSchema).values(insertData).returning().get();

    console.log('[API /admin/data POST] result:', JSON.stringify(result, null, 2));

    // 保存数据库到文件
    saveDatabaseImmediate();

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error('Create data error:', error);
    // 返回更详细的错误信息
    const errorMessage = error instanceof Error ? error.message : '创建失败';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

// PUT /api/admin/data - 更新数据
export async function PUT(request: NextRequest) {
  try {
    await ensureDatabaseReady();
    
    const body = await request.json();
    const { table, data, id } = body;

    // 验证表名
    if (!table || !isValidTable(table)) {
      return NextResponse.json({ error: '无效的数据表' }, { status: 400 });
    }

    if (!id) {
      return NextResponse.json({ error: '缺少记录ID' }, { status: 400 });
    }

    if (!data || typeof data !== 'object') {
      return NextResponse.json({ error: '无效的数据' }, { status: 400 });
    }

    // 归档验证：projects 表状态变为 archived 时检查文件
    if (table === 'projects' && data.status === 'archived') {
      // 获取当前项目信息
      const currentProject = db
        .select()
        .from(projects)
        .where(sql`id = ${id}`)
        .get() as Record<string, unknown> | undefined;

      if (currentProject) {
        // 合并当前项目数据和新数据
        const projectToCheck = { ...currentProject, ...data };
        const { isComplete, missingFiles } = checkArchiveRequirements(projectToCheck);
        
        if (!isComplete) {
          return NextResponse.json({ 
            error: `无法归档：缺少必要文件（${missingFiles.join('、')}），请先上传这些文件后再进行归档` 
          }, { status: 400 });
        }
      }
    }

    // 准备更新数据
    const now = getTimestamp();
    const updateData = {
      ...data,
      updatedAt: now,
    };

    // 根据表执行更新
    const tableSchema = tableMap[table];
    const result = db
      .update(tableSchema)
      .set(updateData)
      .where(sql`id = ${id}`)
      .returning()
      .get();

    // 保存数据库到文件
    saveDatabaseImmediate();

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error('Update data error:', error);
    return NextResponse.json({ error: '更新失败' }, { status: 500 });
  }
}

// DELETE /api/admin/data - 删除数据
export async function DELETE(request: NextRequest) {
  try {
    await ensureDatabaseReady();
    
    const searchParams = request.nextUrl.searchParams;
    const table = searchParams.get('table') as string;
    const id = searchParams.get('id');

    // 验证表名
    if (!table || !isValidTable(table)) {
      return NextResponse.json({ error: '无效的数据表' }, { status: 400 });
    }

    if (!id) {
      return NextResponse.json({ error: '缺少记录ID' }, { status: 400 });
    }

    // 获取当前用户信息
    const authHeader = request.headers.get('authorization');
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('session');
    
    let currentUser: { userId: string; departmentId?: string; roleCode?: string } | null = null;
    
    // 从 Authorization header 解析
    if (authHeader?.startsWith('Bearer ')) {
      try {
        const token = authHeader.substring(7);
        const decoded = Buffer.from(token, 'base64').toString('utf-8');
        currentUser = JSON.parse(decoded);
      } catch (e) {
        console.error('Failed to parse auth token:', e);
      }
    }
    
    // 或从 Cookie 解析
    if (!currentUser && sessionCookie?.value) {
      try {
        currentUser = JSON.parse(sessionCookie.value);
      } catch (e) {
        console.error('Failed to parse session cookie:', e);
      }
    }

    // 规范性文件删除权限检查
    if (table === 'normative_documents') {
      // 管理员可以删除所有
      const isAdmin = currentUser?.roleCode === 'admin';
      
      if (!isAdmin && currentUser) {
        // 非管理员：检查是否是创建者
        const doc = db
          .select()
          .from(normativeDocuments)
          .where(sql`id = ${id}`)
          .limit(1)
          .all();
        
        if (doc.length === 0) {
          return NextResponse.json({ error: '文档不存在' }, { status: 404 });
        }
        
        if (doc[0].createdBy !== currentUser.userId) {
          return NextResponse.json({ error: '只有创建者或管理员可以删除此文档' }, { status: 403 });
        }
      }
    }

    // 根据表执行删除
    const tableSchema = tableMap[table];
    db.delete(tableSchema).where(sql`id = ${id}`).run();

    // 保存数据库到文件
    saveDatabaseImmediate();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete data error:', error);
    return NextResponse.json({ error: '删除失败' }, { status: 500 });
  }
}
