import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  varchar,
  timestamp,
  boolean,
  integer,
  jsonb,
  index,
  serial,
  numeric,
  date,
} from "drizzle-orm/pg-core";
import { createSchemaFactory } from "drizzle-zod";
import { z } from "zod";

// 系统表 - 必须保留
export const healthCheck = pgTable("health_check", {
  id: serial().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
});

// 讲师表
export const teachers = pgTable(
  "teachers",
  {
    id: varchar("id", { length: 36 })
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    name: varchar("name", { length: 100 }).notNull(),
    title: varchar("title", { length: 50 }), // 职称：副高、正高、院士等
    expertise: text("expertise"), // 专业方向
    organization: varchar("organization", { length: 200 }), // 所属单位
    bio: text("bio"), // 简介
    hourlyRate: numeric("hourly_rate", { precision: 10, scale: 2 }), // 课时费
    rating: numeric("rating", { precision: 3, scale: 2 }).default("4.5"), // 评分
    teachingCount: integer("teaching_count").default(0), // 授课次数
    isActive: boolean("is_active").default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }),
  },
  (table) => [
    index("teachers_name_idx").on(table.name),
    index("teachers_title_idx").on(table.title),
  ]
);

// 场地表
export const venues = pgTable(
  "venues",
  {
    id: varchar("id", { length: 36 })
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    name: varchar("name", { length: 200 }).notNull(),
    location: varchar("location", { length: 300 }), // 地址
    capacity: integer("capacity"), // 容量
    dailyRate: numeric("daily_rate", { precision: 10, scale: 2 }), // 日租金
    facilities: text("facilities"), // 设施说明
    rating: numeric("rating", { precision: 3, scale: 2 }).default("4.0"),
    usageCount: integer("usage_count").default(0), // 使用次数
    isActive: boolean("is_active").default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }),
  },
  (table) => [
    index("venues_name_idx").on(table.name),
    index("venues_location_idx").on(table.location),
  ]
);

// 课程模板表
export const courseTemplates = pgTable(
  "course_templates",
  {
    id: varchar("id", { length: 36 })
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    name: varchar("name", { length: 200 }).notNull(),
    category: varchar("category", { length: 50 }), // 课程类别：职业素养、管理技能、专业技能、综合提升
    description: text("description"),
    duration: integer("duration"), // 课时数
    targetAudience: varchar("target_audience", { length: 100 }), // 目标人群
    content: text("content"), // 课程内容大纲
    difficulty: varchar("difficulty", { length: 20 }), // 难度：初级、中级、高级
    usageCount: integer("usage_count").default(0), // 使用次数
    avgRating: numeric("avg_rating", { precision: 3, scale: 2 }).default("4.0"),
    isActive: boolean("is_active").default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }),
  },
  (table) => [
    index("course_templates_category_idx").on(table.category),
    index("course_templates_target_audience_idx").on(table.targetAudience),
  ]
);

// 规范性文件表
export const normativeDocuments = pgTable(
  "normative_documents",
  {
    id: varchar("id", { length: 36 })
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    name: varchar("name", { length: 300 }).notNull(), // 文件名称
    summary: varchar("summary", { length: 200 }), // 内容摘要（50字内）
    issuer: varchar("issuer", { length: 100 }), // 颁发部门
    issueDate: date("issue_date"), // 颁发时间
    fileUrl: text("file_url"), // 文件下载链接
    isEffective: boolean("is_effective").default(true), // 是否有效
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }),
  },
  (table) => [
    index("normative_documents_issuer_idx").on(table.issuer),
    index("normative_documents_is_effective_idx").on(table.isEffective),
  ]
);

// 项目表
export const projects = pgTable(
  "projects",
  {
    id: varchar("id", { length: 36 })
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    name: varchar("name", { length: 200 }).notNull(),
    status: varchar("status", { length: 30 }).default("draft"), // draft, designing, pending_approval, approved, executing, completed, archived
    // 需求信息
    trainingTarget: varchar("training_target", { length: 100 }), // 培训对象
    targetAudience: varchar("target_audience", { length: 100 }), // 目标人群
    participantCount: integer("participant_count"), // 参训人数
    trainingDays: integer("training_days"), // 培训天数
    trainingHours: integer("training_hours"), // 培训课时
    trainingPeriod: varchar("training_period", { length: 50 }), // 培训周期
    budgetMin: numeric("budget_min", { precision: 12, scale: 2 }), // 预算下限
    budgetMax: numeric("budget_max", { precision: 12, scale: 2 }), // 预算上限
    location: varchar("location", { length: 200 }), // 培训地点
    specialRequirements: text("special_requirements"), // 特殊要求
    // 方案信息
    startDate: date("start_date"), // 开始日期
    endDate: date("end_date"), // 结束日期
    venueId: varchar("venue_id", { length: 36 }), // 场地ID
    // 费用信息
    teacherFee: numeric("teacher_fee", { precision: 12, scale: 2 }).default("0"),
    venueFee: numeric("venue_fee", { precision: 12, scale: 2 }).default("0"),
    cateringFee: numeric("catering_fee", { precision: 12, scale: 2 }).default("0"),
    teaBreakFee: numeric("tea_break_fee", { precision: 12, scale: 2 }).default("0"),
    materialFee: numeric("material_fee", { precision: 12, scale: 2 }).default("0"),
    laborFee: numeric("labor_fee", { precision: 12, scale: 2 }).default("0"),
    otherFee: numeric("other_fee", { precision: 12, scale: 2 }).default("0"),
    managementFee: numeric("management_fee", { precision: 12, scale: 2 }).default("0"),
    totalBudget: numeric("total_budget", { precision: 12, scale: 2 }).default("0"),
    actualCost: numeric("actual_cost", { precision: 12, scale: 2 }), // 实际成本
    // 满意度信息
    avgSatisfaction: numeric("avg_satisfaction", { precision: 3, scale: 2 }),
    surveyResponseRate: numeric("survey_response_rate", { precision: 5, scale: 2 }),
    // 时间戳
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
  },
  (table) => [
    index("projects_status_idx").on(table.status),
    index("projects_training_target_idx").on(table.trainingTarget),
    index("projects_created_at_idx").on(table.createdAt),
  ]
);

// 项目课程关联表
export const projectCourses = pgTable(
  "project_courses",
  {
    id: varchar("id", { length: 36 })
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    projectId: varchar("project_id", { length: 36 }).notNull(),
    courseTemplateId: varchar("course_template_id", { length: 36 }),
    teacherId: varchar("teacher_id", { length: 36 }),
    name: varchar("name", { length: 200 }).notNull(),
    day: integer("day"), // 第几天
    startTime: varchar("start_time", { length: 20 }), // 开始时间
    endTime: varchar("end_time", { length: 20 }), // 结束时间
    duration: integer("duration"), // 课时
    description: text("description"),
    order: integer("order").default(0), // 排序
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("project_courses_project_id_idx").on(table.projectId),
    index("project_courses_teacher_id_idx").on(table.teacherId),
  ]
);

// 满意度调查表
export const satisfactionSurveys = pgTable(
  "satisfaction_surveys",
  {
    id: varchar("id", { length: 36 })
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    projectId: varchar("project_id", { length: 36 }).notNull(),
    title: varchar("title", { length: 200 }).notNull(),
    description: text("description"),
    questions: jsonb("questions").notNull(), // 问题列表JSON
    status: varchar("status", { length: 30 }).default("draft"), // draft, active, closed
    deadline: timestamp("deadline", { withTimezone: true }),
    responseCount: integer("response_count").default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }),
  },
  (table) => [
    index("satisfaction_surveys_project_id_idx").on(table.projectId),
    index("satisfaction_surveys_status_idx").on(table.status),
  ]
);

// 调查响应表
export const surveyResponses = pgTable(
  "survey_responses",
  {
    id: varchar("id", { length: 36 })
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    surveyId: varchar("survey_id", { length: 36 }).notNull(),
    projectId: varchar("project_id", { length: 36 }).notNull(),
    respondentId: varchar("respondent_id", { length: 100 }), // 匿名响应可以没有
    answers: jsonb("answers").notNull(), // 答案JSON
    overallRating: numeric("overall_rating", { precision: 3, scale: 2 }),
    feedback: text("feedback"), // 开放性反馈
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("survey_responses_survey_id_idx").on(table.surveyId),
    index("survey_responses_project_id_idx").on(table.projectId),
  ]
);

// 项目文档表
export const projectDocuments = pgTable(
  "project_documents",
  {
    id: varchar("id", { length: 36 })
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    projectId: varchar("project_id", { length: 36 }).notNull(),
    name: varchar("name", { length: 200 }).notNull(),
    type: varchar("type", { length: 50 }), // proposal, quotation, declaration, cost_estimation, satisfaction_report, contract, etc.
    content: jsonb("content"), // 文档内容JSON
    fileUrl: varchar("file_url", { length: 500 }), // 文件URL
    version: integer("version").default(1),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }),
  },
  (table) => [
    index("project_documents_project_id_idx").on(table.projectId),
    index("project_documents_type_idx").on(table.type),
  ]
);

// 使用 createSchemaFactory 配置 date coercion
const { createInsertSchema: createCoercedInsertSchema } = createSchemaFactory({
  coerce: { date: true },
});

// Zod schemas for validation
export const insertProjectSchema = createCoercedInsertSchema(projects).pick({
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

export const insertTeacherSchema = createCoercedInsertSchema(teachers).pick({
  name: true,
  title: true,
  expertise: true,
  organization: true,
  bio: true,
  hourlyRate: true,
});

export const insertVenueSchema = createCoercedInsertSchema(venues).pick({
  name: true,
  location: true,
  capacity: true,
  dailyRate: true,
  facilities: true,
});

export const insertCourseTemplateSchema = createCoercedInsertSchema(courseTemplates).pick({
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
