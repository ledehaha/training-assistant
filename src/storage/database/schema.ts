import { sqliteTable, text, integer, real, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';

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
    createdAt: text('created_at').default(sql`datetime('now')`).notNull(),
    updatedAt: text('updated_at'),
  },
  (table) => [
    index('teachers_name_idx').on(table.name),
    index('teachers_title_idx').on(table.title),
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
    createdAt: text('created_at').default(sql`datetime('now')`).notNull(),
    updatedAt: text('updated_at'),
  },
  (table) => [
    index('venues_name_idx').on(table.name),
    index('venues_location_idx').on(table.location),
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
    createdAt: text('created_at').default(sql`datetime('now')`).notNull(),
    updatedAt: text('updated_at'),
  },
  (table) => [
    index('course_templates_category_idx').on(table.category),
    index('course_templates_target_audience_idx').on(table.targetAudience),
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
    createdAt: text('created_at').default(sql`datetime('now')`).notNull(),
    updatedAt: text('updated_at'),
  },
  (table) => [
    index('normative_documents_issuer_idx').on(table.issuer),
    index('normative_documents_is_effective_idx').on(table.isEffective),
  ]
);

// 项目表
export const projects = sqliteTable(
  'projects',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    status: text('status').default('draft'),
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
    // 时间戳
    createdAt: text('created_at').default(sql`datetime('now')`).notNull(),
    updatedAt: text('updated_at'),
    completedAt: text('completed_at'),
    archivedAt: text('archived_at'),
  },
  (table) => [
    index('projects_status_idx').on(table.status),
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

// 系统配置表
export const systemConfigs = sqliteTable(
  'system_configs',
  {
    id: text('id').primaryKey(),
    configKey: text('config_key').notNull().unique(),
    configValue: text('config_value').notNull(),
    description: text('description'),
    createdAt: text('created_at').default(sql`datetime('now')`).notNull(),
    updatedAt: text('updated_at'),
  },
  (table) => [
    index('system_configs_config_key_idx').on(table.configKey),
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
export type SystemConfig = typeof systemConfigs.$inferSelect;
