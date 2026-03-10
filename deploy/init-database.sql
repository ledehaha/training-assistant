-- ============================================
-- 培训助手系统 - 数据库初始化脚本
-- 适用于 PostgreSQL 15+
-- ============================================

-- 启用 UUID 扩展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 1. 讲师表
-- ============================================
CREATE TABLE IF NOT EXISTS teachers (
    id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    title VARCHAR(50),
    expertise TEXT,
    organization VARCHAR(200),
    bio TEXT,
    hourly_rate NUMERIC(10, 2),
    rating NUMERIC(3, 2) DEFAULT 4.5,
    teaching_count INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS teachers_name_idx ON teachers(name);
CREATE INDEX IF NOT EXISTS teachers_title_idx ON teachers(title);

-- ============================================
-- 2. 场地表
-- ============================================
CREATE TABLE IF NOT EXISTS venues (
    id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(200) NOT NULL,
    location VARCHAR(300),
    capacity INTEGER,
    daily_rate NUMERIC(10, 2),
    facilities TEXT,
    rating NUMERIC(3, 2) DEFAULT 4.0,
    usage_count INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS venues_name_idx ON venues(name);
CREATE INDEX IF NOT EXISTS venues_location_idx ON venues(location);

-- ============================================
-- 3. 课程模板表
-- ============================================
CREATE TABLE IF NOT EXISTS course_templates (
    id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(200) NOT NULL,
    category VARCHAR(50),
    description TEXT,
    duration INTEGER,
    target_audience VARCHAR(100),
    content TEXT,
    difficulty VARCHAR(20),
    usage_count INTEGER DEFAULT 0,
    avg_rating NUMERIC(3, 2) DEFAULT 4.0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS course_templates_category_idx ON course_templates(category);
CREATE INDEX IF NOT EXISTS course_templates_target_audience_idx ON course_templates(target_audience);

-- ============================================
-- 4. 规范性文件表
-- ============================================
CREATE TABLE IF NOT EXISTS normative_documents (
    id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(300) NOT NULL,
    summary VARCHAR(200),
    issuer VARCHAR(100),
    issue_date DATE,
    file_url TEXT,
    is_effective BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS normative_documents_issuer_idx ON normative_documents(issuer);
CREATE INDEX IF NOT EXISTS normative_documents_is_effective_idx ON normative_documents(is_effective);

-- ============================================
-- 5. 项目表
-- ============================================
CREATE TABLE IF NOT EXISTS projects (
    id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(200) NOT NULL,
    status VARCHAR(30) DEFAULT 'draft',
    
    -- 需求信息
    training_target VARCHAR(100),
    target_audience VARCHAR(100),
    participant_count INTEGER,
    training_days INTEGER,
    training_hours INTEGER,
    training_period VARCHAR(50),
    budget_min NUMERIC(12, 2),
    budget_max NUMERIC(12, 2),
    location VARCHAR(200),
    special_requirements TEXT,
    
    -- 方案信息
    start_date DATE,
    end_date DATE,
    venue_id VARCHAR(36),
    
    -- 费用信息
    teacher_fee NUMERIC(12, 2) DEFAULT 0,
    venue_fee NUMERIC(12, 2) DEFAULT 0,
    catering_fee NUMERIC(12, 2) DEFAULT 0,
    tea_break_fee NUMERIC(12, 2) DEFAULT 0,
    material_fee NUMERIC(12, 2) DEFAULT 0,
    labor_fee NUMERIC(12, 2) DEFAULT 0,
    other_fee NUMERIC(12, 2) DEFAULT 0,
    management_fee NUMERIC(12, 2) DEFAULT 0,
    total_budget NUMERIC(12, 2) DEFAULT 0,
    actual_cost NUMERIC(12, 2),
    
    -- 满意度信息
    avg_satisfaction NUMERIC(3, 2),
    survey_response_rate NUMERIC(5, 2),
    
    -- 时间戳
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    archived_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS projects_status_idx ON projects(status);
CREATE INDEX IF NOT EXISTS projects_training_target_idx ON projects(training_target);
CREATE INDEX IF NOT EXISTS projects_created_at_idx ON projects(created_at);

-- ============================================
-- 6. 项目课程关联表
-- ============================================
CREATE TABLE IF NOT EXISTS project_courses (
    id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id VARCHAR(36) NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    course_template_id VARCHAR(36) REFERENCES course_templates(id),
    teacher_id VARCHAR(36) REFERENCES teachers(id),
    name VARCHAR(200) NOT NULL,
    day INTEGER,
    start_time VARCHAR(20),
    end_time VARCHAR(20),
    duration INTEGER,
    description TEXT,
    "order" INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS project_courses_project_id_idx ON project_courses(project_id);
CREATE INDEX IF NOT EXISTS project_courses_teacher_id_idx ON project_courses(teacher_id);

-- ============================================
-- 7. 满意度调查表
-- ============================================
CREATE TABLE IF NOT EXISTS satisfaction_surveys (
    id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id VARCHAR(36) NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    questions JSONB NOT NULL,
    status VARCHAR(30) DEFAULT 'draft',
    deadline TIMESTAMP WITH TIME ZONE,
    response_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS satisfaction_surveys_project_id_idx ON satisfaction_surveys(project_id);
CREATE INDEX IF NOT EXISTS satisfaction_surveys_status_idx ON satisfaction_surveys(status);

-- ============================================
-- 8. 调查响应表
-- ============================================
CREATE TABLE IF NOT EXISTS survey_responses (
    id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
    survey_id VARCHAR(36) NOT NULL REFERENCES satisfaction_surveys(id) ON DELETE CASCADE,
    project_id VARCHAR(36) NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    respondent_id VARCHAR(100),
    answers JSONB NOT NULL,
    overall_rating NUMERIC(3, 2),
    feedback TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS survey_responses_survey_id_idx ON survey_responses(survey_id);
CREATE INDEX IF NOT EXISTS survey_responses_project_id_idx ON survey_responses(project_id);

-- ============================================
-- 9. 项目文档表
-- ============================================
CREATE TABLE IF NOT EXISTS project_documents (
    id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id VARCHAR(36) NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name VARCHAR(200) NOT NULL,
    type VARCHAR(50),
    content JSONB,
    file_url VARCHAR(500),
    version INTEGER DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS project_documents_project_id_idx ON project_documents(project_id);
CREATE INDEX IF NOT EXISTS project_documents_type_idx ON project_documents(type);

-- ============================================
-- 10. 健康检查表
-- ============================================
CREATE TABLE IF NOT EXISTS health_check (
    id SERIAL PRIMARY KEY,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 示例数据
-- ============================================

-- 示例讲师
INSERT INTO teachers (name, title, expertise, organization, hourly_rate, rating) VALUES
('张教授', '正高', '领导力发展、团队管理', '清华大学', 2000.00, 4.8),
('李教授', '副高', '数据分析、Python编程', '北京大学', 1500.00, 4.6),
('王老师', '中级', '沟通技巧、职场礼仪', '中科院', 1000.00, 4.5)
ON CONFLICT DO NOTHING;

-- 示例场地
INSERT INTO venues (name, location, capacity, daily_rate, facilities, rating) VALUES
('中关村培训中心', '北京市海淀区中关村大街1号', 100, 5000.00, '投影仪、音响、空调、WiFi', 4.5),
('朝阳区会议中心', '北京市朝阳区建国路88号', 200, 8000.00, '投影仪、音响、空调、WiFi、茶歇区', 4.7),
('西城培训基地', '北京市西城区金融街10号', 50, 3000.00, '投影仪、空调、WiFi', 4.3)
ON CONFLICT DO NOTHING;

-- 示例课程模板
INSERT INTO course_templates (name, category, description, duration, target_audience, difficulty, avg_rating) VALUES
('高效团队管理', '管理技能', '培养管理者的团队建设和领导能力', 8, '中层管理者', '中级', 4.6),
('数据驱动决策', '专业技能', '学习数据分析方法和决策模型', 16, '业务分析师', '高级', 4.5),
('职场沟通艺术', '职业素养', '提升职场沟通能力和人际关系处理', 4, '全员', '初级', 4.4)
ON CONFLICT DO NOTHING;
