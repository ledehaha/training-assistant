# 非学历培训全周期助手 - 项目文档

## 项目概览

非学历培训全周期助手系统，是一个面向培训机构和学校管理的综合平台，实现从需求分析到项目总结的完整闭环管理。

### 核心模块

1. **项目设计模块** - 课程安排、讲师配置、场地选择、费用预算
2. **项目申报模块** - 生成申报材料、预算对比
3. **项目总结模块** - 生成总结报告、成果统计
4. **项目查询模块** - 查询历史项目、导出数据
5. **数据管理模块** - 管理讲师、场地、参访基地等基础数据
6. **用户管理模块** - 用户权限管理、部门管理

### 技术栈

- **前端框架**: Next.js 16 (App Router)
- **核心库**: React 19
- **开发语言**: TypeScript 5
- **数据库**: sql.js (纯 JS SQLite)
- **UI 组件**: shadcn/ui (基于 Radix UI)
- **样式**: Tailwind CSS 4
- **集成 SDK**: coze-coding-dev-sdk (LLM & S3Storage & FetchClient)
- **包管理器**: pnpm (强制要求，禁止使用 npm 或 yarn)

## 开发规范

### 1. 包管理

```bash
# 安装依赖
pnpm install

# 添加生产依赖
pnpm add <package>

# 添加开发依赖
pnpm add -D <package>

# 移除依赖
pnpm remove <package>
```

**重要**: 禁止使用 `npm` 或 `yarn` 命令。

### 2. 代码风格

- 使用 ESLint 进行代码检查
- 遵循 TypeScript 严格模式
- 使用 Prettier 进行代码格式化
- 组件命名使用 PascalCase
- 函数命名使用 camelCase

### 3. UI 开发

- 使用 shadcn/ui 组件库
- 遵循 Tailwind CSS 4 规范
- 响应式设计优先
- 支持深色模式（通过 CSS 变量）

### 4. 数据库操作

- 使用 Drizzle ORM 进行数据库操作
- 数据库文件存储在 `/workspace/projects/data/training.db`
- 使用 `saveDatabaseImmediate()` 立即保存更改
- 所有数据库操作前必须调用 `ensureDatabaseReady()`

### 5. 权限控制

- 使用 `/src/lib/access-control.ts` 中的权限控制函数
- 角色类型: admin, dean_office, college_head, college_admin, teacher
- 使用 `getCurrentUser()` 获取当前用户信息
- 使用 `isAdmin()`, `isCollegeAdmin()` 等辅助函数检查权限

### 6. 集成服务

所有集成服务通过 `coze-coding-dev-sdk` 调用：

```typescript
import { createLLMClient, createS3StorageClient, createFetchClient } from 'coze-coding-dev-sdk';

// LLM 调用
const llmClient = createLLMClient();

// S3 存储
const s3Client = createS3StorageClient();

// HTTP 请求
const fetchClient = createFetchClient();
```

### 7. 环境变量

项目运行在云端沙箱中，通过环境变量获取运行时信息：

- `COZE_WORKSPACE_PATH`: 项目工作目录（默认 `/workspace/projects/`）
- `COZE_PROJECT_DOMAIN_DEFAULT`: 对外访问域名
- `DEPLOY_RUN_PORT`: 服务监听端口（必须使用 5000）
- `COZE_PROJECT_ENV`: 开发环境（`DEV`）或生产环境（`PROD`）

**禁止硬编码**这些值，必须通过 `process.env` 读取。

### 8. 端口规范

- Web 服务**必须且只能**运行在 **5000** 端口
- 禁止使用 9000 端口（系统保留）
- 启动服务使用后台运行模式: `coze dev > /app/work/logs/bypass/dev.log 2>&1 &`

### 9. 文件存储

- **生成文件（文件、图片、视频等）**: 优先存储到对象存储
- **本地可写目录**:
  - 开发环境: `${COZE_WORKSPACE_PATH}/public`（默认）
  - 生产环境: `/tmp`（临时目录，数据可能被清理）
- **临时文件**: 统一存储到 `/tmp` 目录

### 10. 日志规范

所有日志文件写入 `/app/work/logs/bypass/` 目录：

- `console.log`: 浏览器控制台日志（前端/端侧问题）
- `app.log`: 主流程 + 关键错误（后端/服务问题）
- `dev.log`: 补充调试信息

**禁止**: 读取日志目录以外的文件。

## 核心业务逻辑

### 费用计算

#### 管理费计算公式

```
管理费 = 基础费用总和 / (1 - 15%) * 15%
```

- 管理费率为 15%
- 基数为基础费用总和（师资费 + 场地费 + 参访费 + 餐饮费 + 茶歇费 + 资料费等）
- 管理费不可删除

#### 税费计算公式

```
税费 = (基础费用 + 管理费) * 3%
```

- 税率为 3%
- 基数为基础费用总和加管理费
- 税费不可删除

#### 餐饮费和茶歇费计算

```
餐饮费 = 人数 × 天数 × 餐数/天 × 单价
茶歇费 = 人数 × 天数 × 次数/天 × 单价
```

- 餐饮费默认: 人数 × 天数 × 1餐/天 × ¥80/人次
- 茶歇费默认: 人数 × 天数 × 2次/天 × ¥30/人次

### 师资费计算

基于专业技术岗位等级对照表判断讲师级别：

| 等级 | 职称 | 课时费 |
|------|------|--------|
| 院士级 | 院士、院士级教授 | ¥6000/课时 |
| 教授级 | 教授、研究员 | ¥4000/课时 |
| 副高级 | 副教授、副研究员 | ¥3000/课时 |
| 其他 | 其他职称 | ¥2000/课时 |

**注意**:
- 使用 `startsWith` 而非 `includes` 判断职称，避免误判（如"副教授"被误判为"教授"）
- 优先从讲师库查询实际职称

### 参访基地收费方式

支持两种收费方式：

1. **按人头收费 (per_person)**: 费用 = 参访人数 × 单价
2. **按次收费 (per_visit)**: 费用 = 1 × 单价

### 场地费匹配

- 去除空格后进行模糊匹配
- 比较课程地点与场地库中的 `name` 和 `location` 字段
- 匹配失败时使用默认单价 ¥2000/课时

### 预算对比

- 预算范围单位: 元（数据库存储为万元，显示时乘以10000）
- 添加"无预算限制"选项
- 只有未勾选"无预算限制"时才显示预算对比

## 常见问题排查

### 1. 页面报错或服务启动失败

**优先级**: `console.log` → `app.log` → `dev.log`

```bash
# 查看最新日志
tail -n 50 /app/work/logs/bypass/console.log

# 搜索错误
grep -nE "Error|Exception|Traceback|WARN|ERROR" /app/work/logs/bypass/app.log | tail -n 50
```

### 2. 类型检查失败

```bash
npx tsc --noEmit
```

### 3. 服务未响应

```bash
# 检查端口
ss -tuln | grep -E ':5000[[:space:]]' | grep -q LISTEN

# 检查 HTTP 响应
curl -I --max-time 3 http://localhost:5000
```

### 4. 构建失败

```bash
# 重新构建
pnpm run build

# 清理缓存
rm -rf .next node_modules
pnpm install
```

## 关键文件说明

### 前端页面

- `src/app/design/page.tsx`: 项目设计页面（核心页面）
- `src/app/declaration/page.tsx`: 项目申报页面
- `src/app/summary/page.tsx`: 项目总结页面
- `src/app/admin/data/page.tsx`: 数据管理页面
- `src/app/admin/users/page.tsx`: 用户管理页面

### API 路由

- `src/app/api/courses/route.ts`: 课程管理 API
- `src/app/api/teachers/route.ts`: 讲师管理 API
- `src/app/api/venues/route.ts`: 场地管理 API
- `src/app/api/visit-sites/route.ts`: 参访基地管理 API
- `src/app/api/projects/route.ts`: 项目管理 API

### 数据库

- `src/storage/database/schema.ts`: 数据库表结构定义
- `src/storage/database/index.ts`: 数据库初始化和操作
- `/workspace/projects/data/training.db`: SQLite 数据库文件

### 权限控制

- `src/lib/access-control.ts`: 权限控制函数

### UI 组件

- `src/components/ui/`: shadcn/ui 组件库

## 版本信息

- Next.js: 16
- React: 19
- TypeScript: 5
- Tailwind CSS: 4
- Node.js: 24

## 联系方式

如有问题，请查看日志文件或联系开发团队。
