import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { eq, and, or, desc, asc, sql, inArray } from 'drizzle-orm';
import * as schema from './schema';
import * as fs from 'fs';
import * as path from 'path';

// 数据库文件路径
const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data');
const DB_PATH = path.join(DATA_DIR, 'training.db');

// 确保数据目录存在
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// 创建 SQLite 连接
const sqlite = new Database(DB_PATH);

// 启用外键约束
sqlite.pragma('journal_mode = WAL');
sqlite.pragma('foreign_keys = ON');

// 创建 Drizzle 实例
export const db = drizzle(sqlite, { schema });

// 导出查询构建器
export { eq, and, or, desc, asc, sql, inArray };

// 导出 schema
export * from './schema';

// 数据库初始化函数
export function initDatabase() {
  console.log('Initializing database at:', DB_PATH);
  
  // 创建表
  const createTables = `
    -- 系统检查表
    CREATE TABLE IF NOT EXISTS health_check (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      updated_at TEXT DEFAULT (datetime('now'))
    );

    -- 讲师表
    CREATE TABLE IF NOT EXISTS teachers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      title TEXT,
      expertise TEXT,
      organization TEXT,
      bio TEXT,
      hourly_rate REAL,
      rating REAL DEFAULT 4.5,
      teaching_count INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT
    );
    CREATE INDEX IF NOT EXISTS teachers_name_idx ON teachers(name);
    CREATE INDEX IF NOT EXISTS teachers_title_idx ON teachers(title);

    -- 场地表
    CREATE TABLE IF NOT EXISTS venues (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      location TEXT,
      capacity INTEGER,
      daily_rate REAL,
      facilities TEXT,
      rating REAL DEFAULT 4.0,
      usage_count INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT
    );
    CREATE INDEX IF NOT EXISTS venues_name_idx ON venues(name);
    CREATE INDEX IF NOT EXISTS venues_location_idx ON venues(location);

    -- 课程模板表
    CREATE TABLE IF NOT EXISTS course_templates (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT,
      description TEXT,
      duration INTEGER,
      target_audience TEXT,
      content TEXT,
      difficulty TEXT,
      usage_count INTEGER DEFAULT 0,
      avg_rating REAL DEFAULT 4.0,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT
    );
    CREATE INDEX IF NOT EXISTS course_templates_category_idx ON course_templates(category);
    CREATE INDEX IF NOT EXISTS course_templates_target_audience_idx ON course_templates(target_audience);

    -- 规范性文件表
    CREATE TABLE IF NOT EXISTS normative_documents (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      summary TEXT,
      issuer TEXT,
      issue_date TEXT,
      effective_date TEXT,
      expiry_date TEXT,
      file_path TEXT,
      file_name TEXT,
      file_size INTEGER,
      is_effective INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT
    );
    CREATE INDEX IF NOT EXISTS normative_documents_issuer_idx ON normative_documents(issuer);
    CREATE INDEX IF NOT EXISTS normative_documents_is_effective_idx ON normative_documents(is_effective);

    -- 项目表
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      status TEXT DEFAULT 'draft',
      training_target TEXT,
      target_audience TEXT,
      participant_count INTEGER,
      training_days INTEGER,
      training_hours INTEGER,
      training_period TEXT,
      budget_min REAL,
      budget_max REAL,
      location TEXT,
      special_requirements TEXT,
      start_date TEXT,
      end_date TEXT,
      venue_id TEXT,
      teacher_fee REAL DEFAULT 0,
      venue_fee REAL DEFAULT 0,
      catering_fee REAL DEFAULT 0,
      tea_break_fee REAL DEFAULT 0,
      material_fee REAL DEFAULT 0,
      labor_fee REAL DEFAULT 0,
      other_fee REAL DEFAULT 0,
      management_fee REAL DEFAULT 0,
      total_budget REAL DEFAULT 0,
      actual_cost REAL,
      avg_satisfaction REAL,
      survey_response_rate REAL,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT,
      completed_at TEXT,
      archived_at TEXT
    );
    CREATE INDEX IF NOT EXISTS projects_status_idx ON projects(status);
    CREATE INDEX IF NOT EXISTS projects_training_target_idx ON projects(training_target);
    CREATE INDEX IF NOT EXISTS projects_created_at_idx ON projects(created_at);

    -- 项目课程关联表
    CREATE TABLE IF NOT EXISTS project_courses (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      course_template_id TEXT,
      teacher_id TEXT,
      name TEXT NOT NULL,
      day INTEGER,
      start_time TEXT,
      end_time TEXT,
      duration INTEGER,
      description TEXT,
      "order" INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (course_template_id) REFERENCES course_templates(id),
      FOREIGN KEY (teacher_id) REFERENCES teachers(id)
    );
    CREATE INDEX IF NOT EXISTS project_courses_project_id_idx ON project_courses(project_id);
    CREATE INDEX IF NOT EXISTS project_courses_teacher_id_idx ON project_courses(teacher_id);

    -- 满意度调查表
    CREATE TABLE IF NOT EXISTS satisfaction_surveys (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      questions TEXT NOT NULL,
      status TEXT DEFAULT 'draft',
      deadline TEXT,
      response_count INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS satisfaction_surveys_project_id_idx ON satisfaction_surveys(project_id);
    CREATE INDEX IF NOT EXISTS satisfaction_surveys_status_idx ON satisfaction_surveys(status);

    -- 调查响应表
    CREATE TABLE IF NOT EXISTS survey_responses (
      id TEXT PRIMARY KEY,
      survey_id TEXT NOT NULL,
      project_id TEXT NOT NULL,
      respondent_id TEXT,
      answers TEXT NOT NULL,
      overall_rating REAL,
      feedback TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (survey_id) REFERENCES satisfaction_surveys(id) ON DELETE CASCADE,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS survey_responses_survey_id_idx ON survey_responses(survey_id);
    CREATE INDEX IF NOT EXISTS survey_responses_project_id_idx ON survey_responses(project_id);

    -- 项目文档表
    CREATE TABLE IF NOT EXISTS project_documents (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      name TEXT NOT NULL,
      type TEXT,
      content TEXT,
      file_url TEXT,
      version INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS project_documents_project_id_idx ON project_documents(project_id);
    CREATE INDEX IF NOT EXISTS project_documents_type_idx ON project_documents(type);
  `;

  // 执行建表语句
  sqlite.exec(createTables);
  
  console.log('Database initialized successfully');
}

// 自动初始化
initDatabase();

// 生成 UUID
export function generateId(): string {
  return crypto.randomUUID();
}

// 获取当前时间戳
export function getTimestamp(): string {
  return new Date().toISOString();
}
