import 'server-only';
import initSqlJs, { Database as SqlJsDatabase, SqlJsStatic } from 'sql.js';
import { drizzle } from 'drizzle-orm/sql-js';
import { eq, and, or, desc, asc, sql, inArray } from 'drizzle-orm';
import * as schema from './schema';
import * as fs from 'fs';
import * as path from 'path';

// 数据库文件路径
const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data');
const DB_PATH = path.join(DATA_DIR, 'training.db');

// 确保数据目录存在
try {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
} catch {
  // 忽略错误
}

// 全局变量
let SQL: SqlJsStatic | null = null;
let sqlite: SqlJsDatabase | null = null;
let dbInstance: ReturnType<typeof drizzle<typeof schema>> | null = null;
let initPromise: Promise<void> | null = null;

// 建表语句
const createTablesSQL = `
  CREATE TABLE IF NOT EXISTS health_check (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    updated_at TEXT DEFAULT (datetime('now'))
  );
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
    contract_file TEXT,
    contract_file_name TEXT,
    cost_file TEXT,
    cost_file_name TEXT,
    declaration_file TEXT,
    declaration_file_name TEXT,
    student_list_file TEXT,
    student_list_name TEXT,
    other_materials TEXT,
    satisfaction_survey_file TEXT,
    satisfaction_survey_file_name TEXT,
    summary_report TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT,
    completed_at TEXT,
    archived_at TEXT
  );
  CREATE INDEX IF NOT EXISTS projects_status_idx ON projects(status);
  CREATE INDEX IF NOT EXISTS projects_created_at_idx ON projects(created_at);
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
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
  );
  CREATE INDEX IF NOT EXISTS project_courses_project_id_idx ON project_courses(project_id);
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
  CREATE TABLE IF NOT EXISTS survey_responses (
    id TEXT PRIMARY KEY,
    survey_id TEXT NOT NULL,
    project_id TEXT NOT NULL,
    respondent_id TEXT,
    answers TEXT NOT NULL,
    overall_rating REAL,
    feedback TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (survey_id) REFERENCES satisfaction_surveys(id) ON DELETE CASCADE
  );
  CREATE INDEX IF NOT EXISTS survey_responses_survey_id_idx ON survey_responses(survey_id);
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
  CREATE TABLE IF NOT EXISTS user_profiles (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    department TEXT,
    position TEXT,
    employee_id TEXT,
    email TEXT,
    phone TEXT,
    preferred_training_types TEXT,
    preferred_time_slots TEXT,
    learning_style TEXT,
    skill_levels TEXT,
    competency_gaps TEXT,
    recommended_courses TEXT,
    completed_trainings INTEGER DEFAULT 0,
    total_training_hours INTEGER DEFAULT 0,
    avg_satisfaction_score REAL,
    last_training_date TEXT,
    is_active INTEGER DEFAULT 1,
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT
  );
  CREATE INDEX IF NOT EXISTS user_profiles_name_idx ON user_profiles(name);
  CREATE INDEX IF NOT EXISTS user_profiles_department_idx ON user_profiles(department);
  CREATE INDEX IF NOT EXISTS user_profiles_employee_id_idx ON user_profiles(employee_id);
  CREATE TABLE IF NOT EXISTS user_training_records (
    id TEXT PRIMARY KEY,
    user_profile_id TEXT NOT NULL,
    project_id TEXT NOT NULL,
    training_name TEXT NOT NULL,
    training_target TEXT,
    training_days INTEGER,
    training_hours INTEGER,
    completion_date TEXT,
    satisfaction_score REAL,
    feedback TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_profile_id) REFERENCES user_profiles(id) ON DELETE CASCADE,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
  );
  CREATE INDEX IF NOT EXISTS user_training_records_user_profile_id_idx ON user_training_records(user_profile_id);
  CREATE INDEX IF NOT EXISTS user_training_records_project_id_idx ON user_training_records(project_id);
  CREATE INDEX IF NOT EXISTS user_training_records_completion_date_idx ON user_training_records(completion_date);
`;

// 保存数据库到文件
export function saveDatabaseImmediate(): void {
  if (sqlite && SQL) {
    try {
      const data = sqlite.export();
      const buffer = Buffer.from(data);
      fs.writeFileSync(DB_PATH, buffer);
    } catch (err) {
      console.error('Failed to save database:', err);
    }
  }
}

// 防抖保存
let saveTimeout: ReturnType<typeof setTimeout> | null = null;
export function debouncedSave(): void {
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    saveDatabaseImmediate();
    saveTimeout = null;
  }, 100);
}

// 数据库迁移SQL - 添加文件存储字段
const migrationSQL = `
  ALTER TABLE projects ADD COLUMN contract_file TEXT;
  ALTER TABLE projects ADD COLUMN contract_file_name TEXT;
  ALTER TABLE projects ADD COLUMN cost_file TEXT;
  ALTER TABLE projects ADD COLUMN cost_file_name TEXT;
  ALTER TABLE projects ADD COLUMN declaration_file TEXT;
  ALTER TABLE projects ADD COLUMN declaration_file_name TEXT;
  ALTER TABLE projects ADD COLUMN student_list_file TEXT;
  ALTER TABLE projects ADD COLUMN student_list_name TEXT;
  ALTER TABLE projects ADD COLUMN other_materials TEXT;
  ALTER TABLE projects ADD COLUMN satisfaction_survey_file TEXT;
  ALTER TABLE projects ADD COLUMN satisfaction_survey_file_name TEXT;
  ALTER TABLE projects ADD COLUMN summary_report TEXT;
  ALTER TABLE projects ADD COLUMN contract_file_pdf TEXT;
  ALTER TABLE projects ADD COLUMN contract_file_name_pdf TEXT;
  ALTER TABLE projects ADD COLUMN contract_file_word TEXT;
  ALTER TABLE projects ADD COLUMN contract_file_name_word TEXT;
  ALTER TABLE projects ADD COLUMN cost_file_pdf TEXT;
  ALTER TABLE projects ADD COLUMN cost_file_name_pdf TEXT;
  ALTER TABLE projects ADD COLUMN cost_file_word TEXT;
  ALTER TABLE projects ADD COLUMN cost_file_name_word TEXT;
  ALTER TABLE projects ADD COLUMN declaration_file_pdf TEXT;
  ALTER TABLE projects ADD COLUMN declaration_file_name_pdf TEXT;
  ALTER TABLE projects ADD COLUMN declaration_file_word TEXT;
  ALTER TABLE projects ADD COLUMN declaration_file_name_word TEXT;
`;

// 执行迁移（检查并添加缺失的列）
function runMigrations(db: SqlJsDatabase): void {
  try {
    // 获取projects表的列信息
    const result = db.exec("PRAGMA table_info(projects)");
    if (result.length === 0) return;
    
    const columns = result[0].values.map((row) => row[1] as string);
    
    // 检查是否需要添加新列
    const migrationStatements = migrationSQL
      .split(';')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    
    for (const stmt of migrationStatements) {
      // 提取列名
      const match = stmt.match(/ADD COLUMN (\w+)/);
      if (match && !columns.includes(match[1])) {
        try {
          db.run(stmt);
          console.log(`Migration: Added column ${match[1]} to projects table`);
        } catch (err) {
          console.warn(`Migration warning for ${match[1]}:`, err);
        }
      }
    }
  } catch (err) {
    console.warn('Migration check failed:', err);
  }
}

// 初始化数据库（内部函数）
async function doInitDatabase(): Promise<void> {
  if (dbInstance) return;
  
  console.log('Initializing sql.js database at:', DB_PATH);
  
  SQL = await initSqlJs({});
  
  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    sqlite = new SQL.Database(fileBuffer);
    console.log('Loaded existing database');
  } else {
    sqlite = new SQL.Database();
    console.log('Created new database');
  }
  
  sqlite.run(createTablesSQL);
  
  // 执行迁移
  if (sqlite) {
    runMigrations(sqlite);
  }
  
  dbInstance = drizzle(sqlite, { schema });
  saveDatabaseImmediate();
  
  console.log('Database initialized successfully');
}

// 确保数据库就绪
export async function ensureDatabaseReady(): Promise<void> {
  if (!initPromise) {
    initPromise = doInitDatabase();
  }
  await initPromise;
}

// 获取数据库实例（同步，需确保已初始化）
export function getDb() {
  if (!dbInstance) {
    throw new Error('Database not initialized. Make sure to call ensureDatabaseReady() first.');
  }
  return dbInstance;
}

// 导出 db - 使用 getter 来延迟访问
let _db: ReturnType<typeof drizzle<typeof schema>> | null = null;
export const db = new Proxy({} as ReturnType<typeof drizzle<typeof schema>>, {
  get(_target, prop) {
    // 如果还没初始化，尝试自动初始化（仅返回一个占位符）
    if (!dbInstance) {
      // 自动触发初始化（异步，但不等待）
      ensureDatabaseReady().catch(console.error);
      throw new Error('Database is initializing. Please retry the request.');
    }
    const value = (dbInstance as unknown as Record<string, unknown>)[prop as string];
    return value;
  }
});

// 导出查询构建器
export { eq, and, or, desc, asc, sql, inArray };

// 导出 schema
export * from './schema';

// 初始化数据库
export async function initDatabase(): Promise<void> {
  await ensureDatabaseReady();
}

// 生成 UUID
export function generateId(): string {
  return crypto.randomUUID();
}

// 获取当前时间戳
export function getTimestamp(): string {
  return new Date().toISOString();
}
