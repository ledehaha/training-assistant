/**
 * 数据库Schema配置文件
 * 
 * 用于定义所有表的字段元数据，包括：
 * - 字段名称、显示名称、说明
 * - 字段类型、是否必填
 * - AI提取规则和说明
 * - 匹配规则（如何判断新增/更新）
 * - 审计字段配置
 * 
 * 设计目的：
 * 1. AI分析严格按照数据库字段定义输出
 * 2. 后续添加字段只需修改此配置，无需修改AI逻辑
 * 3. 统一管理所有表的元数据
 */

// ==================== 类型定义 ====================

/** 字段类型 */
export type FieldType = 'string' | 'number' | 'boolean' | 'date' | 'enum' | 'array' | 'json';

/** 字段定义 */
export interface FieldDefinition {
  /** 数据库字段名 */
  name: string;
  /** 显示名称（中文） */
  displayName: string;
  /** 字段说明 */
  description: string;
  /** 字段类型 */
  type: FieldType;
  /** 如果是枚举类型，定义可选值 */
  enumValues?: { value: string; label: string }[];
  /** 是否必填 */
  required?: boolean;
  /** 是否需要AI提取（默认true） */
  aiExtract?: boolean;
  /** AI提取时的特殊说明（如示例、注意事项） */
  aiHint?: string;
  /** 字段验证规则 */
  validation?: {
    minLength?: number;
    maxLength?: number;
    min?: number;
    max?: number;
    pattern?: string;
  };
}

/** 匹配规则 */
export interface MatchRule {
  /** 用于匹配的字段（如name） */
  fields: string[];
  /** 匹配方式：exact=精确匹配，similar=相似匹配 */
  mode: 'exact' | 'similar';
  /** 相似度阈值（mode=similar时使用） */
  threshold?: number;
}

/** 审计字段配置 */
export interface AuditConfig {
  /** 是否有创建人字段 */
  createdBy?: boolean;
  /** 是否有创建人部门字段 */
  createdByDepartment?: boolean;
  /** 是否有更新人字段 */
  updatedBy?: boolean;
  /** 是否有审核人字段 */
  verifiedBy?: boolean;
  /** 是否有审核时间字段 */
  verifiedAt?: boolean;
  /** 是否有审核备注字段 */
  verifyComment?: boolean;
  /** 是否有状态字段 */
  statusField?: string;
}

/** 表Schema定义 */
export interface TableSchemaConfig {
  /** 表名（数据库表名） */
  tableName: string;
  /** Schema键名（用于代码引用） */
  schemaKey: string;
  /** 显示名称 */
  displayName: string;
  /** 表说明 */
  description: string;
  /** 字段定义列表 */
  fields: FieldDefinition[];
  /** 匹配规则 */
  matchRule: MatchRule;
  /** 审计字段配置 */
  auditConfig?: AuditConfig;
  /** 是否启用（可用于临时禁用某个表） */
  enabled?: boolean;
}

// ==================== 表配置定义 ====================

/**
 * 讲师表配置
 * 数据库表：teachers
 */
export const teachersSchema: TableSchemaConfig = {
  tableName: 'teachers',
  schemaKey: 'teachers',
  displayName: '讲师信息',
  description: '存储讲师/专家的基本信息',
  fields: [
    {
      name: 'name',
      displayName: '姓名',
      description: '讲师/专家姓名',
      type: 'string',
      required: true,
      aiExtract: true,
      aiHint: '必须准确提取，不能为空',
      validation: { maxLength: 100 },
    },
    {
      name: 'title',
      displayName: '职称',
      description: '专业技术职称，如教授、副教授、高级工程师、研究员等',
      type: 'string',
      aiExtract: true,
      aiHint: `【重要】只填写专业技术职称，不要填写行政职务！
正确职称示例：教授、副教授、讲师、助教、研究员、副研究员、助理研究员、高级工程师、工程师、助理工程师、主任医师、副主任医师、主治医师、医师、研究馆员、副研究馆员、编审、副编审、高级会计师、会计师等
错误示例（这些是行政职务，不是职称）：院长、副院长、处长、科长、主任、副主任、所长等
注意：如果文件中只有"XX院长"、"XX主任"等行政职务，没有专业技术职称，则title字段留空`,
      validation: { maxLength: 50 },
    },
    {
      name: 'expertise',
      displayName: '专业领域',
      description: '讲师的专业领域或研究方向，如企业管理、人工智能、财务会计等',
      type: 'string',
      aiExtract: true,
      aiHint: '可以包含多个领域，用顿号或逗号分隔，如"企业管理、战略管理"',
      validation: { maxLength: 200 },
    },
    {
      name: 'organization',
      displayName: '所属单位',
      description: '讲师所在的工作单位/机构',
      type: 'string',
      aiExtract: true,
      aiHint: '填写完整单位名称，如"清华大学经济管理学院"',
      validation: { maxLength: 200 },
    },
    {
      name: 'bio',
      displayName: '个人简介',
      description: '讲师的个人简介、学术背景、主要成就等',
      type: 'string',
      aiExtract: true,
      aiHint: '可以包含较长的介绍内容，如"XX大学教授，博士生导师，主要研究方向为..."',
    },
    {
      name: 'hourlyRate',
      displayName: '课时费',
      description: '每课时的授课费用，单位：元',
      type: 'number',
      aiExtract: true,
      aiHint: '提取数字即可，如文件中写"1000元/课时"，则填写1000',
      validation: { min: 0 },
    },
    {
      name: 'rating',
      displayName: '评分',
      description: '讲师评分（1-5分）',
      type: 'number',
      aiExtract: false,
      validation: { min: 1, max: 5 },
    },
    {
      name: 'teachingCount',
      displayName: '授课次数',
      description: '累计授课次数',
      type: 'number',
      aiExtract: false,
    },
    {
      name: 'isActive',
      displayName: '是否可用',
      description: '讲师是否处于可用状态',
      type: 'boolean',
      aiExtract: false,
    },
    {
      name: 'isVerified',
      displayName: '是否已审核',
      description: '是否经过人事处审核确认',
      type: 'boolean',
      aiExtract: false,
    },
  ],
  matchRule: {
    fields: ['name'],
    mode: 'exact',
  },
  auditConfig: {
    createdBy: true,
    createdByDepartment: true,
    verifiedBy: true,
    verifiedAt: true,
    verifyComment: true,
  },
};

/**
 * 场地表配置
 * 数据库表：venues
 */
export const venuesSchema: TableSchemaConfig = {
  tableName: 'venues',
  schemaKey: 'venues',
  displayName: '场地信息',
  description: '存储培训场地/会议室的基本信息',
  fields: [
    {
      name: 'name',
      displayName: '场地名称',
      description: '场地/会议室的名称',
      type: 'string',
      required: true,
      aiExtract: true,
      aiHint: '必须准确提取，如"第一会议室"、"学术报告厅"',
      validation: { maxLength: 200 },
    },
    {
      name: 'location',
      displayName: '位置',
      description: '场地的具体位置/地址',
      type: 'string',
      aiExtract: true,
      aiHint: '如"培训中心A栋3楼"',
      validation: { maxLength: 300 },
    },
    {
      name: 'capacity',
      displayName: '容纳人数',
      description: '场地可容纳的人数',
      type: 'number',
      aiExtract: true,
      aiHint: '提取数字，如"可容纳50人"，则填写50',
      validation: { min: 1 },
    },
    {
      name: 'dailyRate',
      displayName: '日租金',
      description: '场地每日租金，单位：元',
      type: 'number',
      aiExtract: true,
      aiHint: '提取数字即可',
      validation: { min: 0 },
    },
    {
      name: 'facilities',
      displayName: '配套设施',
      description: '场地配备的设施，如投影仪、白板、空调等',
      type: 'string',
      aiExtract: true,
      aiHint: '列举主要设施，如"投影仪、白板、空调、音响系统"',
    },
  ],
  matchRule: {
    fields: ['name'],
    mode: 'exact',
  },
  auditConfig: {
    createdBy: true,
    createdByDepartment: true,
  },
};

/**
 * 参访基地表配置
 * 数据库表：visit_sites
 */
export const visitSitesSchema: TableSchemaConfig = {
  tableName: 'visit_sites',
  schemaKey: 'visitSites',
  displayName: '参访基地',
  description: '存储可参观学习的企事业单位/基地信息',
  fields: [
    {
      name: 'name',
      displayName: '单位名称',
      description: '参访单位/基地的名称',
      type: 'string',
      required: true,
      aiExtract: true,
      validation: { maxLength: 200 },
    },
    {
      name: 'type',
      displayName: '单位类型',
      description: '参访单位的类型',
      type: 'enum',
      enumValues: [
        { value: 'enterprise', label: '企业' },
        { value: 'government', label: '政府部门' },
        { value: 'institution', label: '事业单位' },
        { value: 'other', label: '其他' },
      ],
      aiExtract: true,
      aiHint: '根据单位性质选择：enterprise(企业)、government(政府部门)、institution(事业单位)、other(其他)',
    },
    {
      name: 'industry',
      displayName: '行业领域',
      description: '参访单位所属行业',
      type: 'string',
      aiExtract: true,
      aiHint: '如"互联网"、"制造业"、"金融业"',
      validation: { maxLength: 100 },
    },
    {
      name: 'address',
      displayName: '详细地址',
      description: '参访单位的详细地址',
      type: 'string',
      aiExtract: true,
      validation: { maxLength: 300 },
    },
    {
      name: 'contactPerson',
      displayName: '联系人',
      description: '参访单位的联系人姓名',
      type: 'string',
      aiExtract: true,
      validation: { maxLength: 50 },
    },
    {
      name: 'contactPhone',
      displayName: '联系电话',
      description: '参访单位的联系电话',
      type: 'string',
      aiExtract: true,
      validation: { maxLength: 30 },
    },
    {
      name: 'contactEmail',
      displayName: '联系邮箱',
      description: '参访单位的联系邮箱',
      type: 'string',
      aiExtract: true,
      validation: { maxLength: 100 },
    },
    {
      name: 'description',
      displayName: '单位简介',
      description: '参访单位的简介说明',
      type: 'string',
      aiExtract: true,
    },
    {
      name: 'visitContent',
      displayName: '参观内容',
      description: '可参观学习的内容',
      type: 'string',
      aiExtract: true,
      aiHint: '描述可以参观哪些内容、学习什么知识',
    },
    {
      name: 'visitDuration',
      displayName: '建议参观时长',
      description: '建议参观时长，单位：小时',
      type: 'number',
      aiExtract: true,
      aiHint: '提取数字，单位为小时',
      validation: { min: 0.5 },
    },
    {
      name: 'maxVisitors',
      displayName: '最大接待人数',
      description: '单次最大接待人数',
      type: 'number',
      aiExtract: true,
      validation: { min: 1 },
    },
    {
      name: 'visitFee',
      displayName: '参观费用',
      description: '参观费用，单位：元/人',
      type: 'number',
      aiExtract: true,
      validation: { min: 0 },
    },
    {
      name: 'facilities',
      displayName: '配套设施',
      description: '参访单位的配套设施，如会议室、停车场等',
      type: 'string',
      aiExtract: true,
    },
    {
      name: 'requirements',
      displayName: '参观要求',
      description: '参观要求或注意事项',
      type: 'string',
      aiExtract: true,
    },
  ],
  matchRule: {
    fields: ['name'],
    mode: 'exact',
  },
  auditConfig: {
    createdBy: true,
    createdByDepartment: true,
    verifiedBy: true,
    verifiedAt: true,
    verifyComment: true,
  },
};

/**
 * 课程表配置（合并课程模板和项目课程）
 * 数据库表：courses
 * 
 * 设计说明：
 * - isTemplate=true 且 projectId=NULL → 课程模板（可复用的课程库）
 * - projectId NOT NULL → 项目课程（某项目的具体课程安排）
 */
export const coursesSchema: TableSchemaConfig = {
  tableName: 'courses',
  schemaKey: 'courses',
  displayName: '课程',
  description: '存储课程模板和项目课程安排。课程模板可复用于多个项目，项目课程是某项目的具体安排',
  fields: [
    // ========== 基础信息（所有课程通用）==========
    {
      name: 'name',
      displayName: '课程名称',
      description: '课程的名称',
      type: 'string',
      required: true,
      aiExtract: true,
      validation: { maxLength: 200 },
    },
    {
      name: 'category',
      displayName: '课程类别',
      description: '课程所属类别',
      type: 'enum',
      enumValues: [
        { value: '职业素养', label: '职业素养' },
        { value: '管理技能', label: '管理技能' },
        { value: '专业技能', label: '专业技能' },
        { value: '综合提升', label: '综合提升' },
      ],
      aiExtract: true,
      aiHint: '从以下类别中选择：职业素养、管理技能、专业技能、综合提升',
    },
    {
      name: 'description',
      displayName: '课程描述',
      description: '课程的描述说明',
      type: 'string',
      aiExtract: true,
    },
    {
      name: 'content',
      displayName: '课程内容',
      description: '课程内容大纲',
      type: 'string',
      aiExtract: true,
      aiHint: '提取课程的主要内容点或大纲',
    },
    {
      name: 'duration',
      displayName: '课时数',
      description: '课程的课时数，单位：课时（每课时40-60分钟）',
      type: 'number',
      aiExtract: true,
      aiHint: `课时自动折算规则（非常重要）：
- 1课时 = 40-60分钟
- 如果文件中写的是分钟数，必须折算成课时
- 例如：120分钟 → 2课时，90分钟 → 1.5课时，45分钟 → 1课时
- 例如：2小时 → 2课时，半天(3-4小时) → 3-4课时
- 提取课时数，保留一位小数`,
      validation: { min: 0.5 },
    },
    {
      name: 'targetAudience',
      displayName: '目标人群',
      description: '课程适合的人群',
      type: 'string',
      aiExtract: true,
      aiHint: '如"中高层管理人员"、"新入职员工"',
      validation: { maxLength: 100 },
    },
    {
      name: 'difficulty',
      displayName: '难度级别',
      description: '课程的难度级别',
      type: 'enum',
      enumValues: [
        { value: '初级', label: '初级' },
        { value: '中级', label: '中级' },
        { value: '高级', label: '高级' },
      ],
      aiExtract: true,
      aiHint: '从以下级别中选择：初级、中级、高级',
    },
    // ========== 项目关联字段（项目课程专用，模板时为空）==========
    {
      name: 'projectId',
      displayName: '所属项目',
      description: '所属项目ID。为空表示这是课程模板，有值表示这是项目课程',
      type: 'string',
      aiExtract: false,
    },
    {
      name: 'type',
      displayName: '课程类型',
      description: '本次安排的类型（项目课程专用）',
      type: 'enum',
      enumValues: [
        { value: 'course', label: '课程' },
        { value: 'visit', label: '参访' },
        { value: 'break', label: '休息' },
        { value: 'other', label: '其他' },
      ],
      aiExtract: true,
      aiHint: '从以下类型中选择：course(课程授课)、visit(参访活动)、break(休息时间)、other(其他)',
    },
    {
      name: 'day',
      displayName: '第几天',
      description: '培训第几天的安排（项目课程专用）',
      type: 'number',
      aiExtract: true,
      validation: { min: 1 },
    },
    {
      name: 'startTime',
      displayName: '开始时间',
      description: '课程开始时间（项目课程专用）',
      type: 'string',
      aiExtract: true,
      aiHint: '格式如"09:00"或"上午9点"',
      validation: { maxLength: 20 },
    },
    {
      name: 'endTime',
      displayName: '结束时间',
      description: '课程结束时间（项目课程专用）',
      type: 'string',
      aiExtract: true,
      aiHint: '格式如"12:00"或"中午12点"',
      validation: { maxLength: 20 },
    },
    {
      name: 'teacherId',
      displayName: '讲师',
      description: '授课讲师的ID（项目课程专用，关联teachers表）',
      type: 'string',
      aiExtract: false,
    },
    {
      name: 'visitSiteId',
      displayName: '参访基地',
      description: '参访地点的ID（项目课程专用，关联visit_sites表）',
      type: 'string',
      aiExtract: false,
    },
    {
      name: 'order',
      displayName: '排序',
      description: '排序序号（项目课程专用）',
      type: 'number',
      aiExtract: false,
    },
    // ========== 模板标识和统计字段 ==========
    {
      name: 'isTemplate',
      displayName: '是否为模板',
      description: '是否为课程模板。true=可复用的课程模板，false=项目课程实例',
      type: 'boolean',
      aiExtract: false,
    },
    {
      name: 'usageCount',
      displayName: '使用次数',
      description: '被引用的次数（模板专用）',
      type: 'number',
      aiExtract: false,
    },
    {
      name: 'avgRating',
      displayName: '平均评分',
      description: '课程评分（模板专用）',
      type: 'number',
      aiExtract: false,
    },
    {
      name: 'isActive',
      displayName: '是否可用',
      description: '课程是否处于可用状态',
      type: 'boolean',
      aiExtract: false,
    },
  ],
  matchRule: {
    fields: ['name'],
    mode: 'similar',
    threshold: 0.8,
  },
  auditConfig: {
    createdBy: true,
    createdByDepartment: true,
  },
};

// 兼容旧代码的别名（逐步废弃）
/** @deprecated 使用 coursesSchema 代替 */
export const courseTemplatesSchema = coursesSchema;
/** @deprecated 使用 coursesSchema 代替 */
export const projectCoursesSchema = coursesSchema;

/**
 * 项目信息表配置（字段更新用）
 * 数据库表：projects
 */
export const projectInfoSchema: TableSchemaConfig = {
  tableName: 'projects',
  schemaKey: 'projectInfo',
  displayName: '项目信息',
  description: '项目基本信息',
  fields: [
    {
      name: 'participantCount',
      displayName: '参训人数',
      description: '实际参加培训的人数',
      type: 'number',
      aiExtract: true,
      aiHint: '从学员名单中统计，或从文件中提取',
      validation: { min: 1 },
    },
    {
      name: 'trainingDays',
      displayName: '培训天数',
      description: '培训持续的天数',
      type: 'number',
      aiExtract: true,
      validation: { min: 1 },
    },
    {
      name: 'trainingHours',
      displayName: '培训课时',
      description: '培训总课时数',
      type: 'number',
      aiExtract: true,
      validation: { min: 1 },
    },
    {
      name: 'trainingPeriod',
      displayName: '培训周期',
      description: '培训的时间周期描述',
      type: 'string',
      aiExtract: true,
      validation: { maxLength: 50 },
    },
    {
      name: 'location',
      displayName: '培训地点',
      description: '培训举办的地点',
      type: 'string',
      aiExtract: true,
      validation: { maxLength: 200 },
    },
    {
      name: 'startDate',
      displayName: '开始日期',
      description: '培训开始日期',
      type: 'date',
      aiExtract: true,
      aiHint: '格式：YYYY-MM-DD',
    },
    {
      name: 'endDate',
      displayName: '结束日期',
      description: '培训结束日期',
      type: 'date',
      aiExtract: true,
      aiHint: '格式：YYYY-MM-DD',
    },
    {
      name: 'actualCost',
      displayName: '实际成本',
      description: '项目实际花费的总成本',
      type: 'number',
      aiExtract: true,
      validation: { min: 0 },
    },
    {
      name: 'avgSatisfaction',
      displayName: '平均满意度',
      description: '学员满意度评分的平均值（1-5分）',
      type: 'number',
      aiExtract: true,
      aiHint: '从满意度调查中计算平均值',
      validation: { min: 1, max: 5 },
    },
  ],
  matchRule: {
    fields: ['id'],
    mode: 'exact',
  },
  auditConfig: {},
};

// ==================== 汇总配置 ====================

/**
 * 所有表的Schema配置映射
 * 添加新表时，只需在此处添加映射
 */
export const dbSchemaConfig: Record<string, TableSchemaConfig> = {
  teachers: teachersSchema,
  venues: venuesSchema,
  visitSites: visitSitesSchema,
  courses: coursesSchema,
  // 兼容旧代码（逐步废弃）
  courseTemplates: coursesSchema,
  projectCourses: coursesSchema,
  projectInfo: projectInfoSchema,
};

// ==================== 工具函数 ====================

/**
 * 获取表的Schema配置
 */
export function getTableSchema(schemaKey: string): TableSchemaConfig | undefined {
  return dbSchemaConfig[schemaKey];
}

/**
 * 获取所有启用的表配置
 */
export function getAllEnabledSchemas(): TableSchemaConfig[] {
  return Object.values(dbSchemaConfig).filter(s => s.enabled !== false);
}

/**
 * 获取需要AI提取的字段列表
 */
export function getAIExtractFields(schemaKey: string): FieldDefinition[] {
  const schema = dbSchemaConfig[schemaKey];
  if (!schema) return [];
  return schema.fields.filter(f => f.aiExtract !== false);
}

/**
 * 生成AI提示词中的字段说明
 * @param schemaKey 表的schema键名
 * @returns 格式化的字段说明字符串
 */
export function generateAIFieldDescription(schemaKey: string): string {
  const schema = dbSchemaConfig[schemaKey];
  if (!schema) return '';

  const fields = schema.fields.filter(f => f.aiExtract !== false);
  
  let description = `### ${schema.displayName}\n`;
  description += `表说明：${schema.description}\n\n`;
  description += `| 字段名 | 显示名 | 类型 | 必填 | 说明 |\n`;
  description += `|--------|--------|------|------|------|\n`;
  
  for (const field of fields) {
    const typeStr = field.type === 'enum' && field.enumValues 
      ? `枚举(${field.enumValues.map(e => e.value).join('/')})`
      : field.type;
    const requiredStr = field.required ? '是' : '否';
    const hintStr = field.aiHint ? `。${field.aiHint}` : '';
    
    description += `| ${field.name} | ${field.displayName} | ${typeStr} | ${requiredStr} | ${field.description}${hintStr} |\n`;
  }

  // 添加匹配规则说明
  description += `\n**匹配规则**：`;
  if (schema.matchRule.mode === 'exact') {
    description += `根据${schema.matchRule.fields.join('、')}精确匹配判断是新增还是更新。\n`;
  } else {
    description += `根据${schema.matchRule.fields.join('、')}相似匹配（阈值${(schema.matchRule.threshold || 0.8) * 100}%），相似度超过阈值视为更新。\n`;
  }

  return description;
}

/**
 * 生成AI输出格式的JSON Schema
 * @param schemaKey 表的schema键名
 * @returns JSON格式的字段定义
 */
export function generateAIOutputSchema(schemaKey: string): object {
  const schema = dbSchemaConfig[schemaKey];
  if (!schema) return {};

  const fields = schema.fields.filter(f => f.aiExtract !== false);
  const properties: Record<string, object> = {};
  const required: string[] = [];

  for (const field of fields) {
    let typeDef: object;
    
    switch (field.type) {
      case 'number':
        typeDef = { type: 'number' };
        if (field.validation?.min !== undefined) {
          typeDef = { ...typeDef, minimum: field.validation.min };
        }
        if (field.validation?.max !== undefined) {
          typeDef = { ...typeDef, maximum: field.validation.max };
        }
        break;
      case 'boolean':
        typeDef = { type: 'boolean' };
        break;
      case 'enum':
        typeDef = { 
          type: 'string',
          enum: field.enumValues?.map(e => e.value) || [],
        };
        break;
      case 'array':
        typeDef = { type: 'array', items: { type: 'string' } };
        break;
      default:
        typeDef = { type: 'string' };
    }

    properties[field.name] = {
      ...typeDef,
      description: field.displayName + ': ' + field.description,
    };

    if (field.required) {
      required.push(field.name);
    }
  }

  return {
    type: 'object',
    properties,
    required: required.length > 0 ? required : undefined,
  };
}

/**
 * 获取数据对比时需要显示的字段
 * @param schemaKey 表的schema键名
 * @returns 用于显示对比的字段列表
 */
export function getComparisonFields(schemaKey: string): string[] {
  const schema = dbSchemaConfig[schemaKey];
  if (!schema) return [];
  
  // 返回需要AI提取的字段名
  return schema.fields
    .filter(f => f.aiExtract !== false)
    .map(f => f.name);
}

/**
 * 验证AI输出的数据是否符合Schema
 * @param schemaKey 表的schema键名
 * @param data AI输出的数据
 * @returns 验证结果
 */
export function validateAIData(schemaKey: string, data: Record<string, unknown>): { 
  valid: boolean; 
  errors: string[];
  cleanedData: Record<string, unknown>;
} {
  const schema = dbSchemaConfig[schemaKey];
  const errors: string[] = [];
  const cleanedData: Record<string, unknown> = {};

  if (!schema) {
    return { valid: false, errors: ['未找到表配置'], cleanedData: {} };
  }

  const fields = schema.fields.filter(f => f.aiExtract !== false);
  const fieldMap = new Map(fields.map(f => [f.name, f]));

  // 检查必填字段
  for (const field of fields) {
    if (field.required && (data[field.name] === undefined || data[field.name] === null || data[field.name] === '')) {
      errors.push(`必填字段 ${field.displayName}(${field.name}) 缺失`);
    }
  }

  // 验证并清理每个字段
  for (const [key, value] of Object.entries(data)) {
    const field = fieldMap.get(key);
    
    if (!field) {
      // 字段不在配置中，跳过（可能是多余字段）
      continue;
    }

    // 类型检查和清理
    if (value !== undefined && value !== null && value !== '') {
      switch (field.type) {
        case 'number':
          const numValue = Number(value);
          if (isNaN(numValue)) {
            errors.push(`字段 ${field.displayName} 应为数字，实际为: ${value}`);
          } else {
            cleanedData[key] = numValue;
          }
          break;
        case 'boolean':
          if (typeof value === 'boolean') {
            cleanedData[key] = value;
          } else if (value === 'true' || value === '1') {
            cleanedData[key] = true;
          } else if (value === 'false' || value === '0') {
            cleanedData[key] = false;
          } else {
            errors.push(`字段 ${field.displayName} 应为布尔值，实际为: ${value}`);
          }
          break;
        case 'enum':
          const validValues = field.enumValues?.map(e => e.value) || [];
          if (validValues.includes(String(value))) {
            cleanedData[key] = String(value);
          } else {
            errors.push(`字段 ${field.displayName} 值无效，有效值为: ${validValues.join(', ')}`);
          }
          break;
        default:
          cleanedData[key] = String(value);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    cleanedData,
  };
}

/**
 * 课时自动折算函数
 * 将分钟数或小时数折算成课时（1课时 = 40-60分钟）
 * 
 * @param value 输入值（可能是数字或字符串）
 * @param unit 输入单位：'minute'（分钟）、'hour'（小时）、'auto'（自动判断）
 * @returns 折算后的课时数
 * 
 * @example
 * convertToDuration(120, 'minute')  // 返回 2（120分钟 = 2课时）
 * convertToDuration(2, 'hour')      // 返回 2（2小时 = 2课时）
 * convertToDuration('90分钟', 'auto') // 返回 1.5
 * convertToDuration('2小时', 'auto')  // 返回 2
 */
export function convertToDuration(value: string | number | undefined | null, unit: 'minute' | 'hour' | 'auto' = 'auto'): number {
  if (value === undefined || value === null || value === '') return 0;
  
  const strValue = String(value).trim();
  let numValue: number;
  let detectedUnit: 'minute' | 'hour' | 'duration' = 'duration'; // 默认当做课时
  
  // 如果是纯数字
  if (/^-?\d+(\.\d+)?$/.test(strValue)) {
    numValue = parseFloat(strValue);
    // 根据传入的unit参数决定
    if (unit === 'minute') {
      detectedUnit = 'minute';
    } else if (unit === 'hour') {
      detectedUnit = 'hour';
    } else {
      // auto模式：根据数值大小判断
      // 如果数字很大（>24），可能是分钟
      // 如果数字在合理课时范围内（0.5-24），当做课时
      if (numValue > 24) {
        detectedUnit = 'minute';
      } else {
        detectedUnit = 'duration';
      }
    }
  } else {
    // 尝试从字符串中提取数字和单位
    const minutePatterns = [
      /(\d+(?:\.\d+)?)\s*分钟/,
      /(\d+(?:\.\d+)?)\s*min/i,
      /(\d+(?:\.\d+)?)\s*分/,
    ];
    const hourPatterns = [
      /(\d+(?:\.\d+)?)\s*小时/,
      /(\d+(?:\.\d+)?)\s*hour/i,
      /(\d+(?:\.\d+)?)\s*h/i,
      /(\d+(?:\.\d+)?)\s*时/,
    ];
    const durationPatterns = [
      /(\d+(?:\.\d+)?)\s*课时/,
      /(\d+(?:\.\d+)?)\s*节/,
      /(\d+(?:\.\d+)?)\s*学时/,
    ];
    
    // 检查分钟模式
    for (const pattern of minutePatterns) {
      const match = strValue.match(pattern);
      if (match) {
        numValue = parseFloat(match[1]);
        detectedUnit = 'minute';
        break;
      }
    }
    
    // 检查小时模式
    if (detectedUnit === 'duration') {
      for (const pattern of hourPatterns) {
        const match = strValue.match(pattern);
        if (match) {
          numValue = parseFloat(match[1]);
          detectedUnit = 'hour';
          break;
        }
      }
    }
    
    // 检查课时模式
    if (detectedUnit === 'duration') {
      for (const pattern of durationPatterns) {
        const match = strValue.match(pattern);
        if (match) {
          numValue = parseFloat(match[1]);
          detectedUnit = 'duration';
          break;
        }
      }
    }
    
    // 如果都没匹配到，尝试提取数字
    if (detectedUnit === 'duration') {
      const numMatch = strValue.match(/(\d+(?:\.\d+)?)/);
      if (numMatch) {
        numValue = parseFloat(numMatch[1]);
        // 根据数字大小判断
        if (numValue > 24) {
          detectedUnit = 'minute';
        }
      } else {
        return 0;
      }
    }
  }
  
  // 进行折算
  switch (detectedUnit) {
    case 'minute':
      // 分钟转课时：50分钟 ≈ 1课时（取中间值）
      return Math.round((numValue! / 50) * 10) / 10;
    case 'hour':
      // 小时转课时：1小时 = 1课时
      return Math.round(numValue! * 10) / 10;
    case 'duration':
    default:
      // 已经是课时，直接返回
      return Math.round(numValue! * 10) / 10;
  }
}

/**
 * 批量处理数据中的duration字段
 * 遍历数据，对duration字段进行自动折算
 * 
 * @param schemaKey 表的schema键名
 * @param data 数据对象或数组
 * @returns 处理后的数据
 */
export function processDurationField(schemaKey: string, data: Record<string, unknown> | Record<string, unknown>[]): Record<string, unknown> | Record<string, unknown>[] {
  const schema = dbSchemaConfig[schemaKey];
  if (!schema) return data;
  
  // 检查该表是否有duration字段
  const hasDurationField = schema.fields.some(f => f.name === 'duration');
  if (!hasDurationField) return data;
  
  const processItem = (item: Record<string, unknown>): Record<string, unknown> => {
    if (item.duration !== undefined && item.duration !== null) {
      return {
        ...item,
        duration: convertToDuration(item.duration as string | number, 'auto'),
      };
    }
    return item;
  };
  
  if (Array.isArray(data)) {
    return data.map(processItem);
  } else {
    return processItem(data);
  }
}
