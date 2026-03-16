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
  
  -- 用户权限相关表
  CREATE TABLE IF NOT EXISTS departments (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    code TEXT NOT NULL UNIQUE,
    type TEXT NOT NULL,
    parent_id TEXT,
    level INTEGER DEFAULT 1,
    sort_order INTEGER DEFAULT 0,
    description TEXT,
    status TEXT DEFAULT 'active',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT
  );
  CREATE INDEX IF NOT EXISTS departments_type_idx ON departments(type);
  CREATE INDEX IF NOT EXISTS departments_parent_id_idx ON departments(parent_id);
  CREATE INDEX IF NOT EXISTS departments_code_idx ON departments(code);
  
  CREATE TABLE IF NOT EXISTS roles (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    code TEXT NOT NULL UNIQUE,
    description TEXT,
    level INTEGER DEFAULT 1,
    is_system INTEGER DEFAULT 0,
    status TEXT DEFAULT 'active',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT
  );
  CREATE INDEX IF NOT EXISTS roles_code_idx ON roles(code);
  
  CREATE TABLE IF NOT EXISTS permissions (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    code TEXT NOT NULL UNIQUE,
    module TEXT NOT NULL,
    description TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS permissions_module_idx ON permissions(module);
  CREATE INDEX IF NOT EXISTS permissions_code_idx ON permissions(code);
  
  CREATE TABLE IF NOT EXISTS role_permissions (
    id TEXT PRIMARY KEY,
    role_id TEXT NOT NULL,
    permission_id TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
    FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
  );
  CREATE INDEX IF NOT EXISTS role_permissions_role_id_idx ON role_permissions(role_id);
  CREATE INDEX IF NOT EXISTS role_permissions_permission_id_idx ON role_permissions(permission_id);
  
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    employee_id TEXT NOT NULL UNIQUE,
    department_id TEXT,
    role_id TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    avatar TEXT,
    status TEXT DEFAULT 'pending',
    approved_by TEXT,
    approved_at TEXT,
    last_login_at TEXT,
    last_login_ip TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT,
    FOREIGN KEY (department_id) REFERENCES departments(id),
    FOREIGN KEY (role_id) REFERENCES roles(id)
  );
  CREATE INDEX IF NOT EXISTS users_username_idx ON users(username);
  CREATE INDEX IF NOT EXISTS users_employee_id_idx ON users(employee_id);
  CREATE INDEX IF NOT EXISTS users_department_id_idx ON users(department_id);
  CREATE INDEX IF NOT EXISTS users_role_id_idx ON users(role_id);
  CREATE INDEX IF NOT EXISTS users_status_idx ON users(status);
  
  CREATE TABLE IF NOT EXISTS project_approvals (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    department_id TEXT NOT NULL,
    approver_id TEXT NOT NULL,
    stage TEXT NOT NULL,
    status TEXT NOT NULL,
    comment TEXT,
    approved_at TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (department_id) REFERENCES departments(id),
    FOREIGN KEY (approver_id) REFERENCES users(id)
  );
  CREATE INDEX IF NOT EXISTS project_approvals_project_id_idx ON project_approvals(project_id);
  CREATE INDEX IF NOT EXISTS project_approvals_department_id_idx ON project_approvals(department_id);
  CREATE INDEX IF NOT EXISTS project_approvals_status_idx ON project_approvals(status);
  CREATE INDEX IF NOT EXISTS project_approvals_stage_idx ON project_approvals(stage);
  
  CREATE TABLE IF NOT EXISTS share_requests (
    id TEXT PRIMARY KEY,
    resource_type TEXT NOT NULL,
    resource_id TEXT NOT NULL,
    resource_name TEXT,
    requester_id TEXT NOT NULL,
    requester_department_id TEXT NOT NULL,
    owner_id TEXT NOT NULL,
    owner_department_id TEXT NOT NULL,
    purpose TEXT,
    status TEXT DEFAULT 'pending',
    approved_by TEXT,
    approved_at TEXT,
    expire_at TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT,
    FOREIGN KEY (requester_id) REFERENCES users(id),
    FOREIGN KEY (requester_department_id) REFERENCES departments(id),
    FOREIGN KEY (owner_id) REFERENCES users(id),
    FOREIGN KEY (owner_department_id) REFERENCES departments(id),
    FOREIGN KEY (approved_by) REFERENCES users(id)
  );
  CREATE INDEX IF NOT EXISTS share_requests_resource_type_idx ON share_requests(resource_type);
  CREATE INDEX IF NOT EXISTS share_requests_resource_id_idx ON share_requests(resource_id);
  CREATE INDEX IF NOT EXISTS share_requests_requester_id_idx ON share_requests(requester_id);
  CREATE INDEX IF NOT EXISTS share_requests_owner_id_idx ON share_requests(owner_id);
  CREATE INDEX IF NOT EXISTS share_requests_status_idx ON share_requests(status);
  
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
    is_verified INTEGER DEFAULT 0,
    created_by TEXT,
    created_by_department TEXT,
    verified_by TEXT,
    verified_at TEXT,
    verify_comment TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT
  );
  CREATE INDEX IF NOT EXISTS teachers_name_idx ON teachers(name);
  CREATE INDEX IF NOT EXISTS teachers_title_idx ON teachers(title);
  CREATE INDEX IF NOT EXISTS teachers_is_verified_idx ON teachers(is_verified);
  CREATE INDEX IF NOT EXISTS teachers_created_by_department_idx ON teachers(created_by_department);
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
    created_by TEXT,
    created_by_department TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT
  );
  CREATE INDEX IF NOT EXISTS venues_name_idx ON venues(name);
  CREATE INDEX IF NOT EXISTS venues_location_idx ON venues(location);
  CREATE INDEX IF NOT EXISTS venues_created_by_department_idx ON venues(created_by_department);
  CREATE TABLE IF NOT EXISTS visit_sites (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    industry TEXT,
    address TEXT,
    contact_person TEXT,
    contact_phone TEXT,
    contact_email TEXT,
    description TEXT,
    visit_content TEXT,
    visit_duration INTEGER,
    max_visitors INTEGER,
    visit_fee REAL,
    facilities TEXT,
    requirements TEXT,
    rating REAL DEFAULT 4.0,
    visit_count INTEGER DEFAULT 0,
    is_active INTEGER DEFAULT 1,
    is_verified INTEGER DEFAULT 0,
    created_by TEXT,
    created_by_department TEXT,
    verified_by TEXT,
    verified_at TEXT,
    verify_comment TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT
  );
  CREATE INDEX IF NOT EXISTS visit_sites_name_idx ON visit_sites(name);
  CREATE INDEX IF NOT EXISTS visit_sites_type_idx ON visit_sites(type);
  CREATE INDEX IF NOT EXISTS visit_sites_industry_idx ON visit_sites(industry);
  CREATE INDEX IF NOT EXISTS visit_sites_is_verified_idx ON visit_sites(is_verified);
  CREATE INDEX IF NOT EXISTS visit_sites_created_by_department_idx ON visit_sites(created_by_department);
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
    created_by TEXT,
    created_by_department TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT
  );
  CREATE INDEX IF NOT EXISTS course_templates_category_idx ON course_templates(category);
  CREATE INDEX IF NOT EXISTS course_templates_created_by_department_idx ON course_templates(created_by_department);
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
    created_by TEXT,
    created_by_department TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT
  );
  CREATE INDEX IF NOT EXISTS normative_documents_issuer_idx ON normative_documents(issuer);
  CREATE INDEX IF NOT EXISTS normative_documents_created_by_department_idx ON normative_documents(created_by_department);
  CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    status TEXT DEFAULT 'draft',
    department_id TEXT NOT NULL,
    created_by_id TEXT NOT NULL,
    approval_status TEXT,
    submitted_at TEXT,
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
    contract_file_pdf TEXT,
    contract_file_name_pdf TEXT,
    contract_file_word TEXT,
    contract_file_name_word TEXT,
    cost_file_pdf TEXT,
    cost_file_name_pdf TEXT,
    cost_file_word TEXT,
    cost_file_name_word TEXT,
    declaration_file_pdf TEXT,
    declaration_file_name_pdf TEXT,
    declaration_file_word TEXT,
    declaration_file_name_word TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT,
    completed_at TEXT,
    archived_at TEXT,
    FOREIGN KEY (department_id) REFERENCES departments(id),
    FOREIGN KEY (created_by_id) REFERENCES users(id)
  );
  CREATE INDEX IF NOT EXISTS projects_status_idx ON projects(status);
  CREATE INDEX IF NOT EXISTS projects_department_id_idx ON projects(department_id);
  CREATE INDEX IF NOT EXISTS projects_created_by_id_idx ON projects(created_by_id);
  CREATE INDEX IF NOT EXISTS projects_approval_status_idx ON projects(approval_status);
  CREATE INDEX IF NOT EXISTS projects_created_at_idx ON projects(created_at);
  CREATE TABLE IF NOT EXISTS project_courses (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    course_template_id TEXT,
    teacher_id TEXT,
    visit_site_id TEXT,
    type TEXT DEFAULT 'course',
    name TEXT NOT NULL,
    day INTEGER,
    start_time TEXT,
    end_time TEXT,
    duration INTEGER,
    description TEXT,
    "order" INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (visit_site_id) REFERENCES visit_sites(id)
  );
  CREATE INDEX IF NOT EXISTS project_courses_project_id_idx ON project_courses(project_id);
  CREATE INDEX IF NOT EXISTS project_courses_visit_site_id_idx ON project_courses(visit_site_id);
  CREATE INDEX IF NOT EXISTS project_courses_type_idx ON project_courses(type);
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
  
  // 初始化种子数据（部门、角色、权限、管理员账号）
  await initializeSeedData();
  
  saveDatabaseImmediate();
  
  console.log('Database initialized successfully');
}

// 生成ID（种子数据内部使用）
function createId(): string {
  return `${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 9)}`;
}

// 简单密码哈希（测试阶段使用，生产环境应使用bcrypt）
function hashPassword(password: string): string {
  // 简单的Base64编码，仅用于测试阶段
  // 生产环境应使用bcrypt或其他安全哈希算法
  return Buffer.from(`hash_${password}_salt`).toString('base64');
}

// 初始化种子数据
async function initializeSeedData(): Promise<void> {
  if (!sqlite) return;
  
  const now = new Date().toISOString();
  
  // 检查是否已初始化
  const deptCount = sqlite.exec("SELECT COUNT(*) FROM departments");
  if (deptCount.length > 0 && deptCount[0].values[0][0] as number > 0) {
    console.log('Seed data already initialized');
    return;
  }
  
  console.log('Initializing seed data...');
  
  // 1. 初始化部门
  const departments = [
    // 管理部门 (level 1: 教务处作为顶级)
    { id: 'dept_academic', name: '教务处', code: 'academic_affairs', type: 'management', parentId: null, level: 1, sortOrder: 1 },
    // 管理部门 (level 2)
    { id: 'dept_finance', name: '财务处', code: 'finance', type: 'management', parentId: 'dept_academic', level: 2, sortOrder: 2 },
    { id: 'dept_audit', name: '审计处', code: 'audit', type: 'management', parentId: 'dept_academic', level: 2, sortOrder: 3 },
    { id: 'dept_planning', name: '发展规划处', code: 'planning', type: 'management', parentId: 'dept_academic', level: 2, sortOrder: 4 },
    { id: 'dept_legal', name: '法务部', code: 'legal', type: 'management', parentId: 'dept_academic', level: 2, sortOrder: 5 },
    { id: 'dept_hr', name: '人事处', code: 'hr', type: 'management', parentId: 'dept_academic', level: 2, sortOrder: 6 },
    { id: 'dept_security', name: '保卫处', code: 'security', type: 'management', parentId: 'dept_academic', level: 2, sortOrder: 7 },
    { id: 'dept_logistics', name: '后勤服务中心', code: 'logistics', type: 'management', parentId: 'dept_academic', level: 2, sortOrder: 8 },
    { id: 'dept_it', name: '信息中心', code: 'it', type: 'management', parentId: 'dept_academic', level: 2, sortOrder: 9 },
    // 学院
    { id: 'dept_labor', name: '劳模学院', code: 'labor_college', type: 'college', parentId: null, level: 1, sortOrder: 10 },
    { id: 'dept_adult', name: '成人与继续教育学院', code: 'adult_college', type: 'college', parentId: null, level: 1, sortOrder: 11 },
    { id: 'dept_teacher', name: '职业师资教育学院', code: 'teacher_college', type: 'college', parentId: null, level: 1, sortOrder: 12 },
  ];
  
  for (const dept of departments) {
    sqlite.run(
      `INSERT OR IGNORE INTO departments (id, name, code, type, parent_id, level, sort_order, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?)`,
      [dept.id, dept.name, dept.code, dept.type, dept.parentId, dept.level, dept.sortOrder, now]
    );
  }
  
  // 2. 初始化角色
  const roles = [
    { id: 'role_admin', name: '系统管理员', code: 'admin', level: 100, description: '系统最高权限，负责用户管理和系统配置' },
    { id: 'role_dept_head', name: '部门负责人', code: 'dept_head', level: 50, description: '管理部门业务审批，查看所有项目' },
    { id: 'role_dept_staff', name: '部门员工', code: 'dept_staff', level: 40, description: '协助处理本部门业务，查看所有项目' },
    { id: 'role_college_admin', name: '学院负责人', code: 'college_admin', level: 30, description: '本学院项目管理，审批共享请求' },
    { id: 'role_college_staff', name: '学院员工', code: 'college_staff', level: 20, description: '本学院项目填报，查看公开项目' },
    { id: 'role_hr_auditor', name: '人事处审核员', code: 'hr_auditor', level: 45, description: '师资信息审核' },
  ];
  
  for (const role of roles) {
    sqlite.run(
      `INSERT OR IGNORE INTO roles (id, name, code, level, description, is_system, status, created_at) VALUES (?, ?, ?, ?, ?, 1, 'active', ?)`,
      [role.id, role.name, role.code, role.level, role.description, now]
    );
  }
  
  // 3. 初始化权限
  const permissions = [
    // 项目模块
    { id: 'perm_project_create', name: '创建项目', code: 'project:create', module: 'project' },
    { id: 'perm_project_view', name: '查看项目', code: 'project:view', module: 'project' },
    { id: 'perm_project_edit', name: '编辑项目', code: 'project:edit', module: 'project' },
    { id: 'perm_project_delete', name: '删除项目', code: 'project:delete', module: 'project' },
    { id: 'perm_project_approve', name: '审批项目', code: 'project:approve', module: 'project' },
    { id: 'perm_project_summary', name: '项目总结', code: 'project:summary', module: 'project' },
    { id: 'perm_project_share', name: '共享项目', code: 'project:share', module: 'project' },
    // 用户模块
    { id: 'perm_user_create', name: '创建用户', code: 'user:create', module: 'user' },
    { id: 'perm_user_view', name: '查看用户', code: 'user:view', module: 'user' },
    { id: 'perm_user_edit', name: '编辑用户', code: 'user:edit', module: 'user' },
    { id: 'perm_user_approve', name: '审批用户', code: 'user:approve', module: 'user' },
    // 数据模块
    { id: 'perm_data_view', name: '查看数据', code: 'data:view', module: 'data' },
    { id: 'perm_data_edit', name: '编辑数据', code: 'data:edit', module: 'data' },
    { id: 'perm_data_export', name: '导出数据', code: 'data:export', module: 'data' },
    // 师资模块
    { id: 'perm_teacher_create', name: '添加师资', code: 'teacher:create', module: 'teacher' },
    { id: 'perm_teacher_verify', name: '审核师资', code: 'teacher:verify', module: 'teacher' },
    // 场地模块
    { id: 'perm_venue_create', name: '添加场地', code: 'venue:create', module: 'venue' },
    // 系统模块
    { id: 'perm_system_config', name: '系统配置', code: 'system:config', module: 'system' },
  ];
  
  for (const perm of permissions) {
    sqlite.run(
      `INSERT OR IGNORE INTO permissions (id, name, code, module, created_at) VALUES (?, ?, ?, ?, ?)`,
      [perm.id, perm.name, perm.code, perm.module, now]
    );
  }
  
  // 4. 初始化角色权限
  const rolePermissions = [
    // 系统管理员 - 所有权限
    ['role_admin', 'perm_project_create'], ['role_admin', 'perm_project_view'], ['role_admin', 'perm_project_edit'],
    ['role_admin', 'perm_project_delete'], ['role_admin', 'perm_project_approve'], ['role_admin', 'perm_project_summary'],
    ['role_admin', 'perm_project_share'], ['role_admin', 'perm_user_create'], ['role_admin', 'perm_user_view'],
    ['role_admin', 'perm_user_edit'], ['role_admin', 'perm_user_approve'], ['role_admin', 'perm_data_view'],
    ['role_admin', 'perm_data_edit'], ['role_admin', 'perm_data_export'], ['role_admin', 'perm_teacher_create'],
    ['role_admin', 'perm_teacher_verify'], ['role_admin', 'perm_venue_create'], ['role_admin', 'perm_system_config'],
    
    // 部门负责人 - 查看所有项目，审批权限
    ['role_dept_head', 'perm_project_view'], ['role_dept_head', 'perm_project_approve'],
    ['role_dept_head', 'perm_data_view'], ['role_dept_head', 'perm_data_export'],
    
    // 部门员工 - 查看所有项目
    ['role_dept_staff', 'perm_project_view'], ['role_dept_staff', 'perm_data_view'],
    
    // 学院负责人 - 项目管理权限
    ['role_college_admin', 'perm_project_create'], ['role_college_admin', 'perm_project_view'],
    ['role_college_admin', 'perm_project_edit'], ['role_college_admin', 'perm_project_summary'],
    ['role_college_admin', 'perm_project_share'], ['role_college_admin', 'perm_data_view'],
    ['role_college_admin', 'perm_data_export'], ['role_college_admin', 'perm_teacher_create'],
    ['role_college_admin', 'perm_venue_create'],
    
    // 学院员工 - 项目填报权限
    ['role_college_staff', 'perm_project_create'], ['role_college_staff', 'perm_project_view'],
    ['role_college_staff', 'perm_project_edit'], ['role_college_staff', 'perm_data_view'],
    ['role_college_staff', 'perm_teacher_create'], ['role_college_staff', 'perm_venue_create'],
    
    // 人事处审核员 - 师资审核权限
    ['role_hr_auditor', 'perm_project_view'], ['role_hr_auditor', 'perm_teacher_create'],
    ['role_hr_auditor', 'perm_teacher_verify'], ['role_hr_auditor', 'perm_user_approve'],
  ];
  
  for (const [roleId, permId] of rolePermissions) {
    sqlite.run(
      `INSERT OR IGNORE INTO role_permissions (id, role_id, permission_id, created_at) VALUES (?, ?, ?, ?)`,
      [createId(), roleId, permId, now]
    );
  }
  
  // 5. 初始化管理员账号（系统调试账号，不属于任何部门）
  const adminPasswordHash = hashPassword('123456');
  sqlite.run(
    `INSERT OR IGNORE INTO users (id, username, password_hash, name, employee_id, department_id, role_id, status, approved_by, approved_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'active', 'system', ?, ?)`,
    ['user_admin', '00000000000', adminPasswordHash, '系统管理员', '00000000000', null, 'role_admin', now, now]
  );
  
  // 6. 初始化参访基地示例数据
  const visitSites = [
    ['visit_001', '华为技术有限公司', 'enterprise', '信息技术', '深圳市龙岗区坂田华为基地', '张经理', '13800138001', 'zhang@huawei.com', '全球领先的ICT基础设施和智能终端提供商', '数据中心参观、研发中心参观、企业文化展厅、数字化转型案例分享', 3, 50, 0, '会议室、停车场、餐厅', '需提前1周预约，需提供身份信息备案', 4.8, 10, 1, 1, null, null, null, now],
    ['visit_002', '比亚迪股份有限公司', 'enterprise', '新能源汽车', '深圳市坪山区比亚迪路', '李主任', '13800138002', 'li@byd.com', '中国领先的新能源汽车制造商', '新能源汽车生产线、电池技术展示、智能驾驶演示、绿色制造实践', 4, 40, 50, '会议室、停车场', '需提前预约，禁止拍照区域请勿拍摄', 4.6, 8, 1, 1, null, null, null, now],
    ['visit_003', '深圳市市场监督管理局', 'government', '市场监管', '深圳市福田区深南大道', '王科长', '13800138003', 'wang@sz.gov.cn', '负责市场综合监督管理', '政务服务大厅、市场监管大数据中心、食品安全检测实验室', 2, 30, 0, '会议室', '需公函预约，着装整洁', 4.5, 5, 1, 1, null, null, null, now],
    ['visit_004', '深圳湾创业广场', 'institution', '创新创业', '深圳市南山区科技园', '陈经理', '13800138004', 'chen@szwgc.com', '国家级创业孵化基地', '创业孵化器、众创空间、路演中心、创业企业交流', 3, 60, 0, '会议室、咖啡厅、停车场', '适合创新创业主题培训', 4.7, 15, 1, 1, null, null, null, now],
    ['visit_005', '腾讯滨海大厦', 'enterprise', '互联网', '深圳市南山区科技园', '周助理', '13800138005', 'zhou@tencent.com', '中国领先的互联网科技公司', '腾讯展厅、智慧办公体验、AI技术展示、数字文创体验', 2.5, 35, 100, '会议室、餐厅', '需提前2周预约，需签署保密协议', 4.9, 20, 1, 1, null, null, null, now],
  ];
  
  for (const site of visitSites) {
    sqlite.run(
      `INSERT OR IGNORE INTO visit_sites (id, name, type, industry, address, contact_person, contact_phone, contact_email, description, visit_content, visit_duration, max_visitors, visit_fee, facilities, requirements, rating, visit_count, is_active, is_verified, created_by, verified_by, verified_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      site
    );
  }
  
  // 7. 初始化师资示例数据
  const teachers = [
    { id: 'teacher_001', name: '张明远', title: '教授', expertise: '企业战略管理', organization: '清华大学经济管理学院', bio: '资深企业管理专家，曾为多家世界500强企业提供战略咨询', hourlyRate: 1000, rating: 4.9, teachingCount: 156, isVerified: 1, isActive: 1 },
    { id: 'teacher_002', name: '李华', title: '副教授', expertise: '数字化转型', organization: '北京大学光华管理学院', bio: '数字化领域专家，专注企业数字化转型理论与实践', hourlyRate: 500, rating: 4.7, teachingCount: 89, isVerified: 1, isActive: 1 },
    { id: 'teacher_003', name: '王芳', title: '高级工程师', expertise: '人工智能应用', organization: '华为技术有限公司', bio: 'AI技术专家，拥有丰富的企业AI落地实施经验', hourlyRate: 500, rating: 4.8, teachingCount: 67, isVerified: 1, isActive: 1 },
    { id: 'teacher_004', name: '刘强', title: '正高级工程师', expertise: '新能源技术', organization: '比亚迪股份有限公司', bio: '新能源汽车技术专家，参与多项国家重点研发项目', hourlyRate: 1000, rating: 4.6, teachingCount: 45, isVerified: 1, isActive: 1 },
    { id: 'teacher_005', name: '陈静', title: '副教授', expertise: '人力资源管理', organization: '中国人民大学劳动人事学院', bio: '人力资源领域知名学者，擅长组织发展与人才管理', hourlyRate: 500, rating: 4.8, teachingCount: 112, isVerified: 1, isActive: 1 },
    { id: 'teacher_006', name: '赵伟', title: '高级经济师', expertise: '金融风险管理', organization: '中国建设银行总行', bio: '金融风险管理专家，具有丰富的银行风控实战经验', hourlyRate: 500, rating: 4.5, teachingCount: 78, isVerified: 1, isActive: 1 },
    { id: 'teacher_007', name: '孙丽', title: '研究员', expertise: '创新创业管理', organization: '中国科学院大学', bio: '创新创业领域专家，孵化多个成功创业项目', hourlyRate: 1000, rating: 4.9, teachingCount: 134, isVerified: 1, isActive: 1 },
    { id: 'teacher_008', name: '周军', title: '讲师', expertise: '安全生产管理', organization: '中国安全生产科学研究院', bio: '安全生产领域资深专家，主讲企业安全管理与应急处理', hourlyRate: 500, rating: 4.6, teachingCount: 98, isVerified: 0, isActive: 1 },
  ];
  
  for (const teacher of teachers) {
    sqlite.run(
      `INSERT OR IGNORE INTO teachers (id, name, title, expertise, organization, bio, hourly_rate, rating, teaching_count, is_verified, is_active, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [teacher.id, teacher.name, teacher.title, teacher.expertise, teacher.organization, teacher.bio, teacher.hourlyRate, teacher.rating, teacher.teachingCount, teacher.isVerified, teacher.isActive, now]
    );
  }
  
  // 8. 初始化场地示例数据
  const venues = [
    { id: 'venue_001', name: '学术报告厅', location: '培训中心A栋1楼', capacity: 200, dailyRate: 2000, facilities: '投影仪、音响系统、演讲台、空调、WiFi', rating: 4.8, usageCount: 156, isActive: 1 },
    { id: 'venue_002', name: '多媒体教室1', location: '培训中心B栋2楼', capacity: 50, dailyRate: 800, facilities: '投影仪、电脑、白板、空调、WiFi', rating: 4.6, usageCount: 234, isActive: 1 },
    { id: 'venue_003', name: '多媒体教室2', location: '培训中心B栋2楼', capacity: 50, dailyRate: 800, facilities: '投影仪、电脑、白板、空调、WiFi', rating: 4.5, usageCount: 189, isActive: 1 },
    { id: 'venue_004', name: '研讨室A', location: '培训中心C栋3楼', capacity: 20, dailyRate: 500, facilities: '投影仪、白板、空调、WiFi', rating: 4.7, usageCount: 312, isActive: 1 },
    { id: 'venue_005', name: '研讨室B', location: '培训中心C栋3楼', capacity: 20, dailyRate: 500, facilities: '投影仪、白板、空调、WiFi', rating: 4.6, usageCount: 287, isActive: 1 },
    { id: 'venue_006', name: '计算机实训室', location: '培训中心D栋1楼', capacity: 40, dailyRate: 1500, facilities: '电脑40台、投影仪、空调、WiFi', rating: 4.9, usageCount: 178, isActive: 1 },
    { id: 'venue_007', name: '多功能厅', location: '培训中心A栋2楼', capacity: 100, dailyRate: 1500, facilities: '投影仪、音响系统、舞台、空调、WiFi', rating: 4.7, usageCount: 145, isActive: 1 },
    { id: 'venue_008', name: 'VIP会议室', location: '培训中心A栋3楼', capacity: 15, dailyRate: 1000, facilities: '投影仪、会议桌、茶水服务、空调、WiFi', rating: 4.9, usageCount: 89, isActive: 1 },
  ];
  
  for (const venue of venues) {
    sqlite.run(
      `INSERT OR IGNORE INTO venues (id, name, location, capacity, daily_rate, facilities, rating, usage_count, is_active, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [venue.id, venue.name, venue.location, venue.capacity, venue.dailyRate, venue.facilities, venue.rating, venue.usageCount, venue.isActive, now]
    );
  }
  
  // 9. 初始化课程模板示例数据
  const courseTemplates = [
    { id: 'course_tpl_001', name: '企业战略管理', category: '管理能力', duration: 16, description: '培养企业中高层管理者的战略思维能力，掌握战略分析工具、制定企业发展战略', targetAudience: '企业中高层管理者', difficulty: '高级', usageCount: 45, avgRating: 4.8, isActive: 1 },
    { id: 'course_tpl_002', name: '数字化转型实务', category: '信息技术', duration: 12, description: '帮助企业理解并推进数字化转型，理解数字化转型理念、掌握实施路径', targetAudience: '企业管理者、IT负责人', difficulty: '中级', usageCount: 38, avgRating: 4.7, isActive: 1 },
    { id: 'course_tpl_003', name: '人工智能应用入门', category: '信息技术', duration: 8, description: '了解AI技术原理及企业应用场景，理解AI基础概念、识别应用场景', targetAudience: '企业各层级员工', difficulty: '初级', usageCount: 56, avgRating: 4.6, isActive: 1 },
    { id: 'course_tpl_004', name: '人力资源管理实务', category: '人力资源', duration: 12, description: '提升人力资源管理专业能力，掌握招聘、培训、绩效等核心模块', targetAudience: 'HR从业者、部门管理者', difficulty: '中级', usageCount: 42, avgRating: 4.7, isActive: 1 },
    { id: 'course_tpl_005', name: '安全生产管理', category: '安全管理', duration: 8, description: '强化安全生产意识和管理能力，掌握安全生产法规、隐患排查方法', targetAudience: '安全管理人员、生产管理者', difficulty: '中级', usageCount: 67, avgRating: 4.5, isActive: 1 },
    { id: 'course_tpl_006', name: '领导力提升', category: '管理能力', duration: 16, description: '培养卓越领导力和团队管理能力，提升领导艺术、团队激励能力', targetAudience: '中高层管理者', difficulty: '高级', usageCount: 34, avgRating: 4.9, isActive: 1 },
    { id: 'course_tpl_007', name: '项目管理实战', category: '管理能力', duration: 12, description: '掌握项目管理方法论和工具，学会项目规划、执行、监控和收尾', targetAudience: '项目经理、业务骨干', difficulty: '中级', usageCount: 51, avgRating: 4.6, isActive: 1 },
    { id: 'course_tpl_008', name: '创新创业思维', category: '创新创业', duration: 8, description: '培养创新创业意识和方法论，掌握创新方法、创业流程', targetAudience: '创业者、创新业务负责人', difficulty: '中级', usageCount: 29, avgRating: 4.7, isActive: 1 },
  ];
  
  for (const template of courseTemplates) {
    sqlite.run(
      `INSERT OR IGNORE INTO course_templates (id, name, category, duration, description, target_audience, difficulty, usage_count, avg_rating, is_active, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [template.id, template.name, template.category, template.duration, template.description, template.targetAudience, template.difficulty, template.usageCount, template.avgRating, template.isActive, now]
    );
  }
  
  // 10. 初始化规范性文件示例数据
  const normativeDocs = [
    { id: 'norm_001', name: '《非学历教育培训管理办法》', issuer: '教务处', issueDate: '2024-01-01', effectiveDate: '2024-02-01', isEffective: 1, summary: '规范非学历教育培训项目的申报、审批、执行和总结流程' },
    { id: 'norm_002', name: '《培训经费管理规定》', issuer: '财务处', issueDate: '2024-01-15', effectiveDate: '2024-02-15', isEffective: 1, summary: '明确培训经费的使用范围、审批流程和报销标准' },
    { id: 'norm_003', name: '《师资聘用管理办法》', issuer: '人事处', issueDate: '2024-03-01', effectiveDate: '2024-04-01', isEffective: 1, summary: '规范外聘师资的选聘、考核和薪酬管理' },
    { id: 'norm_004', name: '《安全生产培训规定》', issuer: '保卫处', issueDate: '2024-02-01', effectiveDate: '2024-03-01', isEffective: 1, summary: '安全生产培训的内容要求、学时标准和考核方式' },
    { id: 'norm_005', name: '《培训场地管理规定》', issuer: '后勤服务中心', issueDate: '2024-01-20', effectiveDate: '2024-02-20', isEffective: 1, summary: '培训场地的预约、使用、维护和安全管理规范' },
  ];
  
  for (const doc of normativeDocs) {
    sqlite.run(
      `INSERT OR IGNORE INTO normative_documents (id, name, issuer, issue_date, effective_date, is_effective, summary, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [doc.id, doc.name, doc.issuer, doc.issueDate, doc.effectiveDate, doc.isEffective, doc.summary, now]
    );
  }
  
  console.log('Seed data initialized successfully');
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
