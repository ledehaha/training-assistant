# 项目脚本使用指南

本项目提供了一系列自动化脚本来管理项目依赖、诊断和修复环境问题。

## 脚本列表

### 1. prepare.sh - 项目准备脚本

**用途**: 检查和安装项目依赖，验证环境完整性

**运行方式**:
```bash
bash scripts/prepare.sh
# 或通过 coze CLI
coze init
```

**功能**:
- ✅ 检查 pnpm 版本（要求 >= 9.0.0）
- ✅ 检查 .pnpm-store 大小（超过 500MB 发出警告）
- ✅ 加载环境配置（支持多环境）
- ✅ 自动检测并安装缺失的依赖
- ✅ 验证关键依赖（Next.js, React, TypeScript 等）
- ✅ 检查可执行文件完整性
- ✅ 验证 lockfile 一致性
- ✅ 检查配置文件存在性
- ✅ 记录安装时间（性能监控）
- ✅ 提供详细的健康诊断报告

**增强功能**:
- **pnpm 版本监控**: 自动检测 pnpm 版本，拒绝过低版本
- **Store 大小监控**: 检测 .pnpm-store 大小，超过阈值提示清理
- **深度依赖验证**: 检查 9 个关键依赖包的完整性
- **可执行文件检查**: 验证 bin 文件是否存在且可执行
- **详细错误诊断**: 提供多个修复方案供选择
- **安装时间跟踪**: 自动记录每次依赖安装的时间
- **环境配置加载**: 支持加载不同环境的配置

---

### 2. recover.sh - 环境诊断与修复工具

**用途**: 诊断和修复项目环境问题

**运行方式**:
```bash
# 交互式诊断（推荐）
bash scripts/recover.sh

# 快速检查
bash scripts/recover.sh check

# 自动修复所有问题
bash scripts/recover.sh fix-all

# 仅修复 node_modules
bash scripts/recover.sh fix-modules

# 仅清理 .next 缓存
bash scripts/recover.sh fix-cache

# 仅释放端口
bash scripts/recover.sh fix-port
```

**功能**:
- ✅ 检查 pnpm 版本
- ✅ 检查 node_modules 完整性
- ✅ 检查 Next.js 可执行文件
- ✅ 检查运行中的进程
- ✅ 检查端口占用
- ✅ 检查 .next 缓存状态
- ✅ 提供多种修复方案

**增强功能**:
- **pnpm 版本检查**: 集成版本验证，拒绝过低版本
- **自动化修复**: 一键修复所有常见问题
- **进程清理**: 自动清理残留的 next 进程

---

### 3. clean-store.sh - pnpm Store 清理工具

**用途**: 清理 pnpm store 和项目缓存，释放磁盘空间

**运行方式**:
```bash
# 交互式清理（推荐）
bash scripts/clean-store.sh

# 查看当前状态
bash scripts/clean-store.sh status

# 仅清理 .pnpm-store
bash scripts/clean-store.sh clean-store

# 清理所有缓存
bash scripts/clean-store.sh clean-all
```

**功能**:
- ✅ 显示 node_modules、.pnpm-store、.next 的大小
- ✅ 清理 .pnpm-store 释放空间
- ✅ 清理所有缓存（.pnpm-store + .next + node_modules）
- ✅ 可选重新安装依赖
- ✅ 显示释放的空间大小

**使用场景**:
- 磁盘空间不足时
- .pnpm-store 过大时（> 500MB）
- 依赖缓存损坏时
- 切换 Git 分支前

---

### 4. auto-clean.sh - 自动清理脚本

**用途**: 定期清理 .pnpm-store 和缓存，保持项目环境健康

**运行方式**:
```bash
# 手动运行
bash scripts/auto-clean.sh

# 生成配置文件
bash scripts/auto-clean.sh --config

# 显示帮助
bash scripts/auto-clean.sh --help

# 定时任务（添加到 crontab）
crontab -e
# 每周日凌晨 2:00 自动清理
0 2 * * 0 cd /workspace/projects && bash scripts/auto-clean.sh >> /workspace/projects/logs/auto-clean.log 2>&1
```

**功能**:
- ✅ 自动检查 .pnpm-store 大小
- ✅ 自动检查 .next 缓存大小
- ✅ 超过阈值自动清理
- ✅ 清理 pnpm 全局缓存
- ✅ 记录清理日志
- ✅ 显示释放空间统计

**配置选项**:
- `MAX_STORE_SIZE_MB`: .pnpm-store 最大大小（默认 500MB）
- `MAX_NEXT_SIZE_MB`: .next 缓存最大大小（默认 1000MB）
- `AUTO_CLEAN_STORE`: 是否自动清理 .pnpm-store（默认 true）
- `AUTO_CLEAN_NEXT`: 是否自动清理 .next 缓存（默认 true）

---

### 5. check-updates.sh - 依赖更新检查脚本

**用途**: 定期检查项目依赖的更新，特别是安全更新

**运行方式**:
```bash
# 检查所有更新
bash scripts/check-updates.sh

# 仅检查安全更新
bash scripts/check-updates.sh --security

# 检查并尝试修复安全漏洞
bash scripts/check-updates.sh --fix

# 生成详细报告
bash scripts/check-updates.sh --report

# 定时任务
0 3 * * 0 cd /workspace/projects && bash scripts/check-updates.sh >> /workspace/projects/logs/check-updates.log 2>&1
```

**功能**:
- ✅ 检查过时的依赖（pnpm outdated）
- ✅ 检查安全漏洞（pnpm audit）
- ✅ 自动修复安全漏洞（pnpm audit fix）
- ✅ 生成详细的更新报告
- ✅ 记录检查日志

**使用场景**:
- 定期检查依赖更新
- 检查安全漏洞
- 自动修复安全问题
- 生成更新报告

---

### 6. performance-report.sh - 性能监控报告脚本

**用途**: 生成性能监控报告，分析依赖安装时间等性能指标

**运行方式**:
```bash
# 生成最新报告
bash scripts/performance-report.sh

# 生成完整历史报告
bash scripts/performance-report.sh --all

# 显示帮助
bash scripts/performance-report.sh --help

# 定时生成报告
0 0 * * 1 cd /workspace/projects && bash scripts/performance-report.sh >> /workspace/projects/logs/performance-report.log 2>&1
```

**功能**:
- ✅ 统计安装时间数据
- ✅ 计算平均/最快/最慢安装时间
- ✅ 生成安装时间趋势图
- ✅ 分析性能问题
- ✅ 提供优化建议
- ✅ 生成详细报告

**统计指标**:
- 总安装次数
- 平均安装时间
- 最快安装时间
- 最慢安装时间
- 安装时间趋势

---

### 7. load-env.sh - 环境加载脚本

**用途**: 根据环境变量加载对应的配置文件

**运行方式**:
```bash
# 加载开发环境配置
bash scripts/load-env.sh development

# 加载测试环境配置
bash scripts/load-env.sh test

# 加载生产环境配置
bash scripts/load-env.sh production

# 自动检测环境
bash scripts/load-env.sh

# 显示当前环境信息
bash scripts/load-env.sh --info

# 在其他脚本中使用
source scripts/load-env.sh production
```

**功能**:
- ✅ 自动检测环境
- ✅ 加载对应的环境配置
- ✅ 验证环境配置完整性
- ✅ 显示环境信息
- ✅ 导出环境变量

**支持的环境**:
- `development`: 开发环境
- `test`: 测试环境
- `production`: 生产环境

---

### 8. dev.sh - 开发服务器启动脚本

**用途**: 启动 Next.js 开发服务器

**运行方式**:
```bash
bash scripts/dev.sh
# 或通过 coze CLI
coze dev
```

**功能**:
- ✅ 自动检测端口占用
- ✅ 启动开发服务器
- ✅ 支持热更新（HMR）

---

### 9. build.sh - 生产构建脚本

**用途**: 构建生产版本

**运行方式**:
```bash
bash scripts/build.sh
# 或通过 coze CLI
coze build
```

**功能**:
- ✅ 清理旧构建
- ✅ 运行 TypeScript 类型检查
- ✅ 构建生产版本
- ✅ 生成优化后的静态文件

---

### 10. start.sh - 生产启动脚本

**用途**: 启动生产服务器

**运行方式**:
```bash
bash scripts/start.sh
# 或通过 coze CLI
coze start
```

**功能**:
- ✅ 启动生产服务器
- ✅ 使用优化后的构建文件

---

### 11. diagnose.sh - 诊断脚本

**用途**: 深度诊断项目环境问题

**运行方式**:
```bash
bash scripts/diagnose.sh
```

**功能**:
- ✅ 检查系统环境
- ✅ 检查 Node.js 版本
- ✅ 检查依赖安装状态
- ✅ 生成诊断报告

---

## 使用建议

### 日常开发流程

1. **首次克隆项目**:
   ```bash
   bash scripts/prepare.sh
   ```

2. **启动开发服务器**:
   ```bash
   coze dev
   ```

3. **遇到依赖问题**:
   ```bash
   # 第一步：快速诊断
   bash scripts/recover.sh check
   
   # 第二步：自动修复
   bash scripts/recover.sh fix-all
   ```

4. **磁盘空间不足**:
   ```bash
   # 查看占用
   bash scripts/clean-store.sh status
   
   # 清理 store
   bash scripts/clean-store.sh clean-store
   ```

5. **Git 切换分支后**:
   ```bash
   # 清理缓存
   bash scripts/clean-store.sh clean-all
   
   # 重新安装
   bash scripts/prepare.sh
   ```

### 部署前检查

1. **类型检查**:
   ```bash
   npx tsc --noEmit
   ```

2. **构建生产版本**:
   ```bash
   bash scripts/build.sh
   ```

3. **启动生产服务器**:
   ```bash
   bash scripts/start.sh
   ```

---

## 环境要求

### 必需

- **Node.js**: >= 20.0.0
- **pnpm**: >= 9.0.0（自动检测，过低版本会拒绝运行）

### 推荐

- **操作系统**: Linux / macOS / Windows (WSL2)
- **磁盘空间**: 至少 5GB 可用空间
- **内存**: 至少 4GB RAM

---

## 常见问题

### Q: 提示 "pnpm 版本过低" 怎么办？

**A**: 升级 pnpm 到 9.0.0+
```bash
npm install -g pnpm@latest
# 或使用 corepack
corepack enable && corepack prepare pnpm@latest --activate
```

### Q: node_modules/.bin/next 不存在怎么办？

**A**: 运行修复脚本
```bash
bash scripts/recover.sh fix-all
```

### Q: .pnpm-store 太大怎么办？

**A**: 运行清理脚本
```bash
bash scripts/clean-store.sh clean-store
```

### Q: 端口 5000 被占用怎么办？

**A**: 释放端口
```bash
bash scripts/recover.sh fix-port
```

### Q: 如何完全重置项目依赖？

**A**: 运行完整恢复
```bash
bash scripts/recover.sh fix-all
```

---

## 脚本改进记录

### v3.0 (2026-03-26)

#### 1. 自动化清理定时任务
- **改进**: 新增 auto-clean.sh 脚本
- **影响**: 所有环境
- **效果**:
  - 支持定时任务配置（crontab）
  - 自动检查 .pnpm-store 和 .next 大小
  - 超过阈值自动清理
  - 清理 pnpm 全局缓存
  - 生成清理日志

**定时任务示例**:
```bash
# 每周日凌晨 2:00 自动清理
0 2 * * 0 cd /workspace/projects && bash scripts/auto-clean.sh >> logs/auto-clean.log 2>&1
```

#### 2. 依赖更新检查
- **改进**: 新增 check-updates.sh 脚本
- **影响**: 所有环境
- **效果**:
  - 检查过时的依赖（pnpm outdated）
  - 检查安全漏洞（pnpm audit）
  - 自动修复安全漏洞（pnpm audit fix）
  - 生成详细的更新报告
  - 支持定时检查

**定时任务示例**:
```bash
# 每周日凌晨 3:00 检查更新
0 3 * * 0 cd /workspace/projects && bash scripts/check-updates.sh >> logs/check-updates.log 2>&1
```

#### 3. 性能监控
- **改进**: 新增 performance-report.sh 脚本
- **影响**: prepare.sh
- **效果**:
  - 记录每次依赖安装时间
  - 统计平均/最快/最慢安装时间
  - 生成安装时间趋势图
  - 分析性能问题
  - 提供优化建议

**性能指标**:
- 总安装次数
- 平均安装时间
- 最快安装时间
- 最慢安装时间
- 安装时间趋势

#### 4. 多环境支持
- **改进**: 新增 load-env.sh 脚本和环境配置文件
- **影响**: 所有脚本
- **效果**:
  - 支持开发/测试/生产环境
  - 独立的环境配置文件
  - 环境配置完整性验证
  - 特性开关支持
  - 统一的环境加载机制

**环境配置文件**:
- `.env.development` - 开发环境
- `.env.test` - 测试环境
- `.env.production` - 生产环境

**环境变量**:
- `NODE_ENV` - 环境名称
- `PORT` - 端口号
- `LOG_LEVEL` - 日志级别
- `FEATURE_AI_ENABLED` - AI 功能开关
- `FEATURE_AUTO_CLEAN` - 自动清理开关
- `FEATURE_AUTO_UPDATE_CHECK` - 自动更新检查开关
- `PERFORMANCE_MONITORING` - 性能监控开关
- `INSTALL_TIME_TRACKING` - 安装时间跟踪开关

---

## 定时任务配置

### 1. 自动清理（每周日凌晨 2:00）

```bash
crontab -e
# 添加以下行
0 2 * * 0 cd /workspace/projects && bash scripts/auto-clean.sh >> logs/auto-clean.log 2>&1
```

### 2. 依赖更新检查（每周日凌晨 3:00）

```bash
crontab -e
# 添加以下行
0 3 * * 0 cd /workspace/projects && bash scripts/check-updates.sh >> logs/check-updates.log 2>&1
```

### 3. 性能报告生成（每周一凌晨 0:00）

```bash
crontab -e
# 添加以下行
0 0 * * 1 cd /workspace/projects && bash scripts/performance-report.sh >> logs/performance-report.log 2>&1
```

---

## 环境配置使用

### 1. 在脚本中使用环境配置

```bash
#!/bin/bash

# 加载环境配置
source scripts/load-env.sh development

# 使用环境变量
echo "当前环境: $NODE_ENV"
echo "端口号: $PORT"
echo "AI 功能: $FEATURE_AI_ENABLED"
```

### 2. 在 package.json 中使用

```json
{
  "scripts": {
    "dev": "bash scripts/load-env.sh development && next dev",
    "dev:test": "bash scripts/load-env.sh test && next dev",
    "build:production": "bash scripts/load-env.sh production && next build"
  }
}
```

### 3. 在应用代码中使用

```typescript
// next.config.ts
const loadEnv = (env: string) => {
  const result = require('dotenv').config({ path: `.env.${env}` });
  if (result.error) {
    throw result.error;
  }
};

const env = process.env.NODE_ENV || 'development';
loadEnv(env);

export default {
  // ...其他配置
};
```

---

## 完整工作流程

### 1. 首次设置项目

```bash
# 1. 初始化项目
coze init

# 2. 准备环境
bash scripts/prepare.sh

# 3. 加载环境配置
bash scripts/load-env.sh development

# 4. 启动开发服务器
coze dev
```

### 2. 定期维护

```bash
# 每周执行一次
bash scripts/auto-clean.sh          # 自动清理
bash scripts/check-updates.sh        # 检查更新
bash scripts/performance-report.sh   # 生成报告
```

### 3. 遇到问题时

```bash
# 诊断问题
bash scripts/diagnose.sh

# 自动修复
bash scripts/recover.sh fix-all

# 手动清理
bash scripts/clean-store.sh clean-all
```

---

## 日志文件位置

所有脚本日志都存储在 `logs/` 目录下：

- `logs/auto-clean.log` - 自动清理日志
- `logs/check-updates.log` - 依赖更新检查日志
- `logs/performance.log` - 性能监控日志
- `logs/performance-report.log` - 性能报告日志
- `logs/prepare.log` - 环境准备日志
- `logs/recover.log` - 环境修复日志

---

### v2.0 (2026-03-26)

#### 1. 监控 pnpm 版本
- **改进**: 添加 pnpm 版本检查，要求 >= 9.0.0
- **影响**: prepare.sh, recover.sh
- **效果**: 自动检测和拒绝过低版本的 pnpm，避免依赖解析问题

#### 2. 定期清理 store
- **改进**: 新增 clean-store.sh 脚本
- **影响**: prepare.sh, clean-store.sh
- **效果**:
  - 监控 .pnpm-store 大小（超过 500MB 警告）
  - 提供交互式清理工具
  - 支持一键清理所有缓存
  - 显示释放的空间大小

#### 3. 增强错误处理
- **改进**: 添加 9 个关键依赖检查
- **影响**: prepare.sh, recover.sh
- **效果**:
  - 检查关键依赖包（Next.js, React, TypeScript 等）
  - 检查可执行文件完整性
  - 检查 lockfile 一致性
  - 检查配置文件存在性
  - 提供详细的健康诊断报告
  - 提供多个修复方案供选择

---

## 技术细节

### 版本比较算法

所有脚本使用统一的版本比较算法：
```bash
version_compare() {
    if [[ $1 == $2 ]]; then
        return 0  # 相等
    fi
    # ... 逐位比较版本号
    return 1     # $1 > $2
    return 2     # $1 < $2
}
```

### 依赖检查策略

1. **关键依赖**: 必须存在，否则报错
2. **可选依赖**: 缺失时警告，不报错
3. **配置文件**: 缺失时警告，不报错

### 清理策略

1. **pnpm-store**: 可安全删除，下次安装时自动重建
2. **.next**: 构建缓存，删除后重新构建
3. **node_modules**: 仅在确认 package.json 和 lockfile 存在时删除

---

## 贡献

如需添加新脚本或改进现有脚本：

1. 遵循统一的错误输出格式（RED/GREEN/YELLOW）
2. 添加详细的错误诊断信息
3. 提供多种修复方案
4. 在本文档中更新使用说明

---

## 许可证

MIT
