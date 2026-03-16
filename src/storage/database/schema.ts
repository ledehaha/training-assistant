import { sqliteTable, text, integer, real, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';

// ==================== 用户权限相关表 ====================

// 部门表
export const departments = sqliteTable(
  'departments',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    code: text('code').notNull().unique(), // 部门代码
    type: text('type').notNull(), // 'management'(管理部门) / 'college'(学院)
    parentId: text('parent_id'), // 上级部门ID
    level: integer('level').default(1), // 层级：1=顶级(教务处), 2=二级部门
    sortOrder: integer('sort_order').default(0), // 排序
    description: text('description'),
    status: text('status').default('active'), // 'active' / 'disabled'
    createdAt: text('created_at').default(sql`datetime('now')`).notNull(),
    updatedAt: text('updated_at'),
  },
  (table) => [
    index('departments_type_idx').on(table.type),
    index('departments_parent_id_idx').on(table.parentId),
    index('departments_code_idx').on(table.code),
  ]
);

// 角色表
export const roles = sqliteTable(
  'roles',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    code: text('code').notNull().unique(), // 角色代码
    description: text('description'),
    level: integer('level').default(1), // 角色级别，数值越大权限越高
    isSystem: integer('is_system', { mode: 'boolean' }).default(false), // 是否系统内置角色
    status: text('status').default('active'),
    createdAt: text('created_at').default(sql`datetime('now')`).notNull(),
    updatedAt: text('updated_at'),
  },
  (table) => [
    index('roles_code_idx').on(table.code),
  ]
);

// 权限表
export const permissions = sqliteTable(
  'permissions',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    code: text('code').notNull().unique(), // 权限代码，如 'project:create'
    module: text('module').notNull(), // 模块：project/user/data/system
    description: text('description'),
    createdAt: text('created_at').default(sql`datetime('now')`).notNull(),
  },
  (table) => [
    index('permissions_module_idx').on(table.module),
    index('permissions_code_idx').on(table.code),
  ]
);

// 角色权限关联表
export const rolePermissions = sqliteTable(
  'role_permissions',
  {
    id: text('id').primaryKey(),
    roleId: text('role_id').notNull().references(() => roles.id, { onDelete: 'cascade' }),
    permissionId: text('permission_id').notNull().references(() => permissions.id, { onDelete: 'cascade' }),
    createdAt: text('created_at').default(sql`datetime('now')`).notNull(),
  },
  (table) => [
    index('role_permissions_role_id_idx').on(table.roleId),
    index('role_permissions_permission_id_idx').on(table.permissionId),
  ]
);

// 用户表
export const users = sqliteTable(
  'users',
  {
    id: text('id').primaryKey(),
    username: text('username').notNull().unique(), // 登录账号
    passwordHash: text('password_hash').notNull(), // 密码哈希
    name: text('name').notNull(), // 真实姓名
    employeeId: text('employee_id').notNull().unique(), // 工号（11位纯数字）
    departmentId: text('department_id').references(() => departments.id), // 所属部门（系统管理员可为null）
    roleId: text('role_id').notNull().references(() => roles.id), // 用户主角色
    phone: text('phone'),
    email: text('email'),
    avatar: text('avatar'), // 头像URL
    status: text('status').default('pending'), // 'pending'(待审批) / 'active'(正常) / 'disabled'(禁用)
    approvedBy: text('approved_by'), // 审批人ID
    approvedAt: text('approved_at'), // 审批时间
    lastLoginAt: text('last_login_at'),
    lastLoginIp: text('last_login_ip'),
    createdAt: text('created_at').default(sql`datetime('now')`).notNull(),
    updatedAt: text('updated_at'),
  },
  (table) => [
    index('users_username_idx').on(table.username),
    index('users_employee_id_idx').on(table.employeeId),
    index('users_department_id_idx').on(table.departmentId),
    index('users_role_id_idx').on(table.roleId),
    index('users_status_idx').on(table.status),
  ]
);

// 项目审批记录表
export const projectApprovals = sqliteTable(
  'project_approvals',
  {
    id: text('id').primaryKey(),
    projectId: text('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
    departmentId: text('department_id').notNull().references(() => departments.id), // 审批部门
    approverId: text('approver_id').notNull().references(() => users.id), // 审批人
    stage: text('stage').notNull(), // 审批阶段：'legal'(法务) / 'finance'(财务) / 'academic'(教务处终审)
    status: text('status').notNull(), // 'pending'(待审批) / 'approved'(通过) / 'rejected'(拒绝)
    comment: text('comment'), // 审批意见
    approvedAt: text('approved_at'),
    createdAt: text('created_at').default(sql`datetime('now')`).notNull(),
  },
  (table) => [
    index('project_approvals_project_id_idx').on(table.projectId),
    index('project_approvals_department_id_idx').on(table.departmentId),
    index('project_approvals_status_idx').on(table.status),
    index('project_approvals_stage_idx').on(table.stage),
  ]
);

// 资源共享请求表
export const shareRequests = sqliteTable(
  'share_requests',
  {
    id: text('id').primaryKey(),
    resourceType: text('resource_type').notNull(), // 'project'(项目) / 'course'(课程方案) / 'document'(文档)
    resourceId: text('resource_id').notNull(), // 资源ID
    resourceName: text('resource_name'), // 资源名称（冗余，方便显示）
    requesterId: text('requester_id').notNull().references(() => users.id), // 请求人
    requesterDepartmentId: text('requester_department_id').notNull().references(() => departments.id), // 请求人部门
    ownerId: text('owner_id').notNull().references(() => users.id), // 资源所有者（项目负责人）
    ownerDepartmentId: text('owner_department_id').notNull().references(() => departments.id), // 所有者部门
    purpose: text('purpose'), // 申请用途
    status: text('status').default('pending'), // 'pending'(待审批) / 'approved'(已通过) / 'rejected'(已拒绝) / 'expired'(已过期)
    approvedBy: text('approved_by').references(() => users.id),
    approvedAt: text('approved_at'),
    expireAt: text('expire_at'), // 过期时间（7天后）
    createdAt: text('created_at').default(sql`datetime('now')`).notNull(),
    updatedAt: text('updated_at'),
  },
  (table) => [
    index('share_requests_resource_type_idx').on(table.resourceType),
    index('share_requests_resource_id_idx').on(table.resourceId),
    index('share_requests_requester_id_idx').on(table.requesterId),
    index('share_requests_owner_id_idx').on(table.ownerId),
    index('share_requests_status_idx').on(table.status),
  ]
);

// ==================== 原有业务表 ====================

// 系统表
export const healthCheck = sqliteTable('health_check', {
  id: integer().primaryKey({ autoIncrement: true }),
  updatedAt: text('updated_at').default(sql`datetime('now')`),
});

// 讲师表
export const teachers = sqliteTable(
  'teachers',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    title: text('title'),
    expertise: text('expertise'),
    organization: text('organization'),
    bio: text('bio'),
    hourlyRate: real('hourly_rate'),
    rating: real('rating').default(4.5),
    teachingCount: integer('teaching_count').default(0),
    isActive: integer('is_active', { mode: 'boolean' }).default(true),
    // 审核相关字段
    isVerified: integer('is_verified', { mode: 'boolean' }).default(false), // 是否已审核确认
    createdBy: text('created_by'), // 创建人ID
    createdByDepartment: text('created_by_department'), // 创建人部门
    verifiedBy: text('verified_by'), // 审核人ID（人事处）
    verifiedAt: text('verified_at'), // 审核时间
    verifyComment: text('verify_comment'), // 审核备注
    createdAt: text('created_at').default(sql`datetime('now')`).notNull(),
    updatedAt: text('updated_at'),
  },
  (table) => [
    index('teachers_name_idx').on(table.name),
    index('teachers_title_idx').on(table.title),
    index('teachers_is_verified_idx').on(table.isVerified),
    index('teachers_created_by_department_idx').on(table.createdByDepartment),
  ]
);

// 场地表
export const venues = sqliteTable(
  'venues',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    location: text('location'),
    capacity: integer('capacity'),
    dailyRate: real('daily_rate'),
    facilities: text('facilities'),
    rating: real('rating').default(4.0),
    usageCount: integer('usage_count').default(0),
    isActive: integer('is_active', { mode: 'boolean' }).default(true),
    // 创建人信息
    createdBy: text('created_by'), // 创建人ID
    createdByDepartment: text('created_by_department'), // 创建人部门ID
    createdAt: text('created_at').default(sql`datetime('now')`).notNull(),
    updatedAt: text('updated_at'),
  },
  (table) => [
    index('venues_name_idx').on(table.name),
    index('venues_location_idx').on(table.location),
    index('venues_created_by_department_idx').on(table.createdByDepartment),
  ]
);

// 参访基地/参访单位表
export const visitSites = sqliteTable(
  'visit_sites',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(), // 单位名称
    type: text('type').notNull(), // 'enterprise'(企业) / 'government'(政府部门) / 'institution'(事业单位) / 'other'(其他)
    industry: text('industry'), // 行业领域
    address: text('address'), // 详细地址
    contactPerson: text('contact_person'), // 联系人
    contactPhone: text('contact_phone'), // 联系电话
    contactEmail: text('contact_email'), // 联系邮箱
    description: text('description'), // 单位简介
    visitContent: text('visit_content'), // 可参观学习内容
    visitDuration: integer('visit_duration'), // 建议参观时长（小时）
    maxVisitors: integer('max_visitors'), // 最大接待人数
    visitFee: real('visit_fee'), // 参观费用（元/人）
    facilities: text('facilities'), // 配套设施（会议室、停车场等）
    requirements: text('requirements'), // 参观要求/注意事项
    rating: real('rating').default(4.0), // 评价评分
    visitCount: integer('visit_count').default(0), // 累计接待次数
    isActive: integer('is_active', { mode: 'boolean' }).default(true), // 是否可用
    // 审核相关
    isVerified: integer('is_verified', { mode: 'boolean' }).default(false),
    createdBy: text('created_by'),
    createdByDepartment: text('created_by_department'),
    verifiedBy: text('verified_by'),
    verifiedAt: text('verified_at'),
    verifyComment: text('verify_comment'),
    createdAt: text('created_at').default(sql`datetime('now')`).notNull(),
    updatedAt: text('updated_at'),
  },
  (table) => [
    index('visit_sites_name_idx').on(table.name),
    index('visit_sites_type_idx').on(table.type),
    index('visit_sites_industry_idx').on(table.industry),
    index('visit_sites_is_verified_idx').on(table.isVerified),
    index('visit_sites_created_by_department_idx').on(table.createdByDepartment),
  ]
);

// 课程模板表
export const courseTemplates = sqliteTable(
  'course_templates',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    category: text('category'),
    description: text('description'),
    duration: integer('duration'),
    targetAudience: text('target_audience'),
    content: text('content'),
    difficulty: text('difficulty'),
    usageCount: integer('usage_count').default(0),
    avgRating: real('avg_rating').default(4.0),
    isActive: integer('is_active', { mode: 'boolean' }).default(true),
    // 创建人信息
    createdBy: text('created_by'), // 创建人ID
    createdByDepartment: text('created_by_department'), // 创建人部门ID
    createdAt: text('created_at').default(sql`datetime('now')`).notNull(),
    updatedAt: text('updated_at'),
  },
  (table) => [
    index('course_templates_category_idx').on(table.category),
    index('course_templates_target_audience_idx').on(table.targetAudience),
    index('course_templates_created_by_department_idx').on(table.createdByDepartment),
  ]
);

// 规范性文件表
export const normativeDocuments = sqliteTable(
  'normative_documents',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    summary: text('summary'),
    issuer: text('issuer'),
    issueDate: text('issue_date'),
    effectiveDate: text('effective_date'),
    expiryDate: text('expiry_date'),
    filePath: text('file_path'), // 本地文件路径
    fileName: text('file_name'), // 原始文件名
    fileSize: integer('file_size'), // 文件大小（字节）
    isEffective: integer('is_effective', { mode: 'boolean' }).default(true),
    // 创建人信息
    createdBy: text('created_by'), // 创建人ID
    createdByDepartment: text('created_by_department'), // 创建人部门ID
    createdAt: text('created_at').default(sql`datetime('now')`).notNull(),
    updatedAt: text('updated_at'),
  },
  (table) => [
    index('normative_documents_issuer_idx').on(table.issuer),
    index('normative_documents_is_effective_idx').on(table.isEffective),
    index('normative_documents_created_by_department_idx').on(table.createdByDepartment),
  ]
);

// 项目表
export const projects = sqliteTable(
  'projects',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    status: text('status').default('draft'), // draft/executing/completed/archived/pending_approval/approved/rejected
    // 所属部门和创建人
    departmentId: text('department_id').notNull().references(() => departments.id), // 所属学院/部门
    createdById: text('created_by_id').notNull().references(() => users.id), // 创建人
    // 审批相关
    approvalStatus: text('approval_status'), // pending_legal/pending_finance/pending_academic/approved/rejected
    submittedAt: text('submitted_at'), // 提交审批时间
    // 需求信息
    trainingTarget: text('training_target'),
    targetAudience: text('target_audience'),
    participantCount: integer('participant_count'),
    trainingDays: integer('training_days'),
    trainingHours: integer('training_hours'),
    trainingPeriod: text('training_period'),
    budgetMin: real('budget_min'),
    budgetMax: real('budget_max'),
    location: text('location'),
    specialRequirements: text('special_requirements'),
    // 方案信息
    startDate: text('start_date'),
    endDate: text('end_date'),
    venueId: text('venue_id'),
    // 费用信息
    teacherFee: real('teacher_fee').default(0),
    venueFee: real('venue_fee').default(0),
    cateringFee: real('catering_fee').default(0),
    teaBreakFee: real('tea_break_fee').default(0),
    materialFee: real('material_fee').default(0),
    laborFee: real('labor_fee').default(0),
    otherFee: real('other_fee').default(0),
    managementFee: real('management_fee').default(0),
    totalBudget: real('total_budget').default(0),
    actualCost: real('actual_cost'),
    // 满意度信息
    avgSatisfaction: real('avg_satisfaction'),
    surveyResponseRate: real('survey_response_rate'),
    // 项目总结相关文件
    // 合同文件（PDF和Word两个版本）
    contractFilePdf: text('contract_file_pdf'),
    contractFileNamePdf: text('contract_file_name_pdf'),
    contractFileWord: text('contract_file_word'),
    contractFileNameWord: text('contract_file_name_word'),
    // 成本测算表（PDF和Word两个版本）
    costFilePdf: text('cost_file_pdf'),
    costFileNamePdf: text('cost_file_name_pdf'),
    costFileWord: text('cost_file_word'),
    costFileNameWord: text('cost_file_name_word'),
    // 项目申报书（PDF和Word两个版本）
    declarationFilePdf: text('declaration_file_pdf'),
    declarationFileNamePdf: text('declaration_file_name_pdf'),
    declarationFileWord: text('declaration_file_word'),
    declarationFileNameWord: text('declaration_file_name_word'),
    // 学员名单
    studentListFile: text('student_list_file'),
    studentListFileName: text('student_list_name'),
    // 其他材料
    otherMaterials: text('other_materials'),
    // 满意度调查
    satisfactionSurveyFile: text('satisfaction_survey_file'),
    satisfactionSurveyFileName: text('satisfaction_survey_file_name'),
    // 总结报告
    summaryReport: text('summary_report'),
    // 时间戳
    createdAt: text('created_at').default(sql`datetime('now')`).notNull(),
    updatedAt: text('updated_at'),
    completedAt: text('completed_at'),
    archivedAt: text('archived_at'),
  },
  (table) => [
    index('projects_status_idx').on(table.status),
    index('projects_department_id_idx').on(table.departmentId),
    index('projects_created_by_id_idx').on(table.createdById),
    index('projects_approval_status_idx').on(table.approvalStatus),
    index('projects_training_target_idx').on(table.trainingTarget),
    index('projects_created_at_idx').on(table.createdAt),
  ]
);

// 项目课程关联表
export const projectCourses = sqliteTable(
  'project_courses',
  {
    id: text('id').primaryKey(),
    projectId: text('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
    courseTemplateId: text('course_template_id').references(() => courseTemplates.id),
    teacherId: text('teacher_id').references(() => teachers.id),
    visitSiteId: text('visit_site_id').references(() => visitSites.id), // 参访基地ID（参访环节用）
    type: text('type').default('course'), // 'course'(课程) / 'visit'(参访) / 'break'(休息) / 'other'(其他)
    name: text('name').notNull(),
    day: integer('day'),
    startTime: text('start_time'),
    endTime: text('end_time'),
    duration: integer('duration'),
    description: text('description'),
    order: integer('order').default(0),
    createdAt: text('created_at').default(sql`datetime('now')`).notNull(),
  },
  (table) => [
    index('project_courses_project_id_idx').on(table.projectId),
    index('project_courses_teacher_id_idx').on(table.teacherId),
    index('project_courses_visit_site_id_idx').on(table.visitSiteId),
    index('project_courses_type_idx').on(table.type),
  ]
);

// 满意度调查表
export const satisfactionSurveys = sqliteTable(
  'satisfaction_surveys',
  {
    id: text('id').primaryKey(),
    projectId: text('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    description: text('description'),
    questions: text('questions').notNull(), // JSON 字符串
    status: text('status').default('draft'),
    deadline: text('deadline'),
    responseCount: integer('response_count').default(0),
    createdAt: text('created_at').default(sql`datetime('now')`).notNull(),
    updatedAt: text('updated_at'),
  },
  (table) => [
    index('satisfaction_surveys_project_id_idx').on(table.projectId),
    index('satisfaction_surveys_status_idx').on(table.status),
  ]
);

// 调查响应表
export const surveyResponses = sqliteTable(
  'survey_responses',
  {
    id: text('id').primaryKey(),
    surveyId: text('survey_id').notNull().references(() => satisfactionSurveys.id, { onDelete: 'cascade' }),
    projectId: text('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
    respondentId: text('respondent_id'),
    answers: text('answers').notNull(), // JSON 字符串
    overallRating: real('overall_rating'),
    feedback: text('feedback'),
    createdAt: text('created_at').default(sql`datetime('now')`).notNull(),
  },
  (table) => [
    index('survey_responses_survey_id_idx').on(table.surveyId),
    index('survey_responses_project_id_idx').on(table.projectId),
  ]
);

// 项目文档表
export const projectDocuments = sqliteTable(
  'project_documents',
  {
    id: text('id').primaryKey(),
    projectId: text('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    type: text('type'),
    content: text('content'), // JSON 字符串
    fileUrl: text('file_url'),
    version: integer('version').default(1),
    createdAt: text('created_at').default(sql`datetime('now')`).notNull(),
    updatedAt: text('updated_at'),
  },
  (table) => [
    index('project_documents_project_id_idx').on(table.projectId),
    index('project_documents_type_idx').on(table.type),
  ]
);

// 用户特征库表
export const userProfiles = sqliteTable(
  'user_profiles',
  {
    id: text('id').primaryKey(),
    // 基本信息
    name: text('name').notNull(),
    department: text('department'),
    position: text('position'),
    employeeId: text('employee_id'),
    email: text('email'),
    phone: text('phone'),
    // 培训偏好
    preferredTrainingTypes: text('preferred_training_types'), // JSON 数组：喜欢的培训类型
    preferredTimeSlots: text('preferred_time_slots'), // JSON 数组：偏好时间段
    learningStyle: text('learning_style'), // 学习风格：visual/auditory/kinesthetic/reading
    // 能力评估（AI 分析结果）
    skillLevels: text('skill_levels'), // JSON 对象：各技能水平评估
    competencyGaps: text('competency_gaps'), // JSON 数组：能力差距
    recommendedCourses: text('recommended_courses'), // JSON 数组：推荐课程
    // 培训历史
    completedTrainings: integer('completed_trainings').default(0), // 已完成培训数量
    totalTrainingHours: integer('total_training_hours').default(0), // 累计培训学时
    avgSatisfactionScore: real('avg_satisfaction_score'), // 平均满意度评分
    lastTrainingDate: text('last_training_date'), // 最近培训日期
    // 状态
    isActive: integer('is_active', { mode: 'boolean' }).default(true),
    notes: text('notes'), // 备注
    // 时间戳
    createdAt: text('created_at').default(sql`datetime('now')`).notNull(),
    updatedAt: text('updated_at'),
  },
  (table) => [
    index('user_profiles_name_idx').on(table.name),
    index('user_profiles_department_idx').on(table.department),
    index('user_profiles_employee_id_idx').on(table.employeeId),
  ]
);

// 用户培训记录表（记录用户参与的每次培训）
export const userTrainingRecords = sqliteTable(
  'user_training_records',
  {
    id: text('id').primaryKey(),
    userProfileId: text('user_profile_id').notNull().references(() => userProfiles.id, { onDelete: 'cascade' }),
    projectId: text('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
    // 培训详情
    trainingName: text('training_name').notNull(),
    trainingTarget: text('training_target'),
    trainingDays: integer('training_days'),
    trainingHours: integer('training_hours'),
    completionDate: text('completion_date'),
    // 评价信息
    satisfactionScore: real('satisfaction_score'), // 满意度评分 1-5
    feedback: text('feedback'), // 用户反馈
    // 时间戳
    createdAt: text('created_at').default(sql`datetime('now')`).notNull(),
  },
  (table) => [
    index('user_training_records_user_profile_id_idx').on(table.userProfileId),
    index('user_training_records_project_id_idx').on(table.projectId),
    index('user_training_records_completion_date_idx').on(table.completionDate),
  ]
);

// Zod schemas for validation
export const insertProjectSchema = createInsertSchema(projects).pick({
  name: true,
  trainingTarget: true,
  targetAudience: true,
  participantCount: true,
  trainingDays: true,
  trainingHours: true,
  trainingPeriod: true,
  budgetMin: true,
  budgetMax: true,
  location: true,
  specialRequirements: true,
});

export const insertTeacherSchema = createInsertSchema(teachers).pick({
  name: true,
  title: true,
  expertise: true,
  organization: true,
  bio: true,
  hourlyRate: true,
});

export const insertVenueSchema = createInsertSchema(venues).pick({
  name: true,
  location: true,
  capacity: true,
  dailyRate: true,
  facilities: true,
});

export const insertCourseTemplateSchema = createInsertSchema(courseTemplates).pick({
  name: true,
  category: true,
  description: true,
  duration: true,
  targetAudience: true,
  content: true,
  difficulty: true,
});

// TypeScript types
export type Project = typeof projects.$inferSelect;
export type InsertProject = z.infer<typeof insertProjectSchema>;
export type Teacher = typeof teachers.$inferSelect;
export type InsertTeacher = z.infer<typeof insertTeacherSchema>;
export type Venue = typeof venues.$inferSelect;
export type InsertVenue = z.infer<typeof insertVenueSchema>;
export type CourseTemplate = typeof courseTemplates.$inferSelect;
export type InsertCourseTemplate = z.infer<typeof insertCourseTemplateSchema>;
export type ProjectCourse = typeof projectCourses.$inferSelect;
export type SatisfactionSurvey = typeof satisfactionSurveys.$inferSelect;
export type SurveyResponse = typeof surveyResponses.$inferSelect;
export type ProjectDocument = typeof projectDocuments.$inferSelect;
export type NormativeDocument = typeof normativeDocuments.$inferSelect;
export type UserProfile = typeof userProfiles.$inferSelect;
export type InsertUserProfile = {
  name: string;
  department?: string | null;
  position?: string | null;
  employeeId?: string | null;
  email?: string | null;
  phone?: string | null;
  preferredTrainingTypes?: string | null;
  preferredTimeSlots?: string | null;
  learningStyle?: string | null;
  skillLevels?: string | null;
  competencyGaps?: string | null;
  recommendedCourses?: string | null;
  completedTrainings?: number | null;
  totalTrainingHours?: number | null;
  avgSatisfactionScore?: number | null;
  lastTrainingDate?: string | null;
  isActive?: boolean | null;
  notes?: string | null;
};
export type UserTrainingRecord = typeof userTrainingRecords.$inferSelect;
export type InsertUserTrainingRecord = {
  userProfileId: string;
  projectId: string;
  trainingName: string;
  trainingTarget?: string | null;
  trainingDays?: number | null;
  trainingHours?: number | null;
  completionDate?: string | null;
  satisfactionScore?: number | null;
  feedback?: string | null;
};
