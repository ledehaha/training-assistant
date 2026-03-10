# 培训助手系统 - Docker 部署指南

## 架构说明

```
┌─────────────────────────────────────────────┐
│           群晖 NAS Docker                   │
├─────────────────────────────────────────────┤
│  ┌────────────────────────────────────────┐ │
│  │ training-app                           │ │
│  │ Next.js App + SQLite                   │ │
│  │ 端口: 5000                             │ │
│  └────────────────────────────────────────┘ │
│         │                                   │
│         ▼                                   │
│  Docker Volume (数据持久化)                  │
│  /data/db/training.db  (数据库)             │
│  /data/files/          (上传文件)           │
└─────────────────────────────────────────────┘
```

## 数据存储

所有数据都存储在本地，无需外部服务：

| 数据类型 | 存储位置 | 说明 |
|---------|---------|------|
| 业务数据 | `/data/db/training.db` | SQLite 数据库 |
| 规范性文件 | `/data/files/normative_docs/` | 上传的 PDF、Word 等 |
| 导出文件 | `/data/files/exports/` | Excel 导出文件 |

---

## 一、快速部署

### 方式一：下载项目包部署

```bash
# 1. 创建目录
mkdir -p /volume1/docker/training-assistant
cd /volume1/docker/training-assistant

# 2. 下载项目包（替换为实际下载链接）
wget -O training-assistant.tar.gz "下载链接"

# 3. 解压
tar -xzvf training-assistant.tar.gz

# 4. 配置环境变量（可选）
cat > .env << 'EOF'
# AI 功能（可选）
COZE_API_KEY=your_coze_api_key

# 应用配置
APP_URL=http://你的NAS_IP:5000
EOF

# 5. 启动服务
docker compose up -d --build

# 6. 查看日志
docker compose logs -f
```

### 方式二：GitHub 自动部署

配置 GitHub Actions 实现推送代码后自动部署到 NAS。

---

## 二、GitHub Actions 自动部署配置

### 步骤 1：生成 SSH 密钥对

在本地电脑执行：
```bash
ssh-keygen -t rsa -b 4096 -C "github-actions" -f github_actions_key -N ""
```

生成两个文件：
- `github_actions_key` - 私钥（配置到 GitHub Secrets）
- `github_actions_key.pub` - 公钥（配置到 NAS）

### 步骤 2：将公钥添加到 NAS

```bash
# 在 NAS 上执行
echo "你的公钥内容" >> ~/.ssh/authorized_keys
```

### 步骤 3：配置 GitHub Secrets

进入 GitHub 仓库 → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**

添加以下 Secrets：

| Secret 名称 | 说明 | 示例值 |
|------------|------|--------|
| `NAS_HOST` | NAS 公网 IP 或域名 | `192.168.1.100` |
| `NAS_USERNAME` | SSH 登录用户名 | `admin` |
| `NAS_SSH_KEY` | SSH 私钥内容 | `-----BEGIN RSA PRIVATE KEY-----...` |
| `NAS_SSH_PORT` | SSH 端口 | `22` |
| `NAS_PROJECT_PATH` | 项目路径 | `/volume1/docker/training-assistant` |

### 步骤 4：工作流文件

项目已包含 `.github/workflows/deploy.yml`，推送代码后会自动部署。

---

## 三、常用命令

```bash
# 查看运行状态
docker compose ps

# 查看日志
docker compose logs -f

# 重启服务
docker compose restart

# 停止服务
docker compose down

# 更新应用（拉取新代码后）
docker compose up -d --build

# 进入容器
docker exec -it training-app sh
```

---

## 四、数据备份

### 手动备份

```bash
# 备份整个数据目录
tar -czvf training-backup-$(date +%Y%m%d).tar.gz /volume1/docker/training-assistant/data

# 或只备份数据库
cp /volume1/docker/training-assistant/data/db/training.db \
   /volume1/backup/training_$(date +%Y%m%d).db
```

### 定时备份（群晖任务计划）

1. 控制面板 → 任务计划 → 新增 → 用户定义的脚本
2. 设置每天凌晨 2:00 执行：
```bash
#!/bin/bash
BACKUP_DIR=/volume1/backup/training-assistant
mkdir -p $BACKUP_DIR
tar -czvf $BACKUP_DIR/backup_$(date +\%Y\%m\%d_\%H\%M\%S).tar.gz \
    /volume1/docker/training-assistant/data
# 保留最近 30 天的备份
find $BACKUP_DIR -name "backup_*.tar.gz" -mtime +30 -delete
```

---

## 五、数据恢复

```bash
# 停止服务
docker compose down

# 恢复数据
tar -xzvf training-backup-YYYYMMDD.tar.gz -C /

# 重启服务
docker compose up -d
```

---

## 六、环境变量说明

| 变量名 | 必填 | 说明 |
|-------|------|------|
| `DATA_DIR` | 否 | 数据库存储目录，默认 `/data/db` |
| `FILE_STORAGE_PATH` | 否 | 文件存储目录，默认 `/data/files` |
| `COZE_API_KEY` | 否 | AI 功能 API Key，不配置则 AI 功能不可用 |
| `APP_URL` | 否 | 应用访问地址 |

---

## 七、功能说明

### 核心功能（无需配置）
- ✅ 项目设计、申报、总结、查询
- ✅ 讲师、场地、课程模板管理
- ✅ 数据导出（Excel 格式）
- ✅ Excel 文件导入数据

### AI 功能（需要配置 COZE_API_KEY）
- 🤖 智能推荐课程/讲师/场地
- 🤖 AI 解析 PDF/Word/PPT 文件导入数据
- 🤖 智能分析培训需求

---

## 八、故障排除

### 查看日志
```bash
docker compose logs --tail 100
```

### 重启服务
```bash
docker compose restart
```

### 检查数据目录权限
```bash
ls -la /volume1/docker/training-assistant/data
```

### 完全重置（会删除所有数据）
```bash
docker compose down -v
docker compose up -d --build
```

---

## 九、资源需求

- **内存**: 建议 2GB 以上
- **存储**: 约 1GB（应用 + 初始数据）
- **端口**: 5000

---

## 十、迁移指南

### 从其他服务器迁移

只需打包 `/data` 目录，在新服务器解压即可：

```bash
# 源服务器
tar -czvf training-data.tar.gz /volume1/docker/training-assistant/data

# 传输到新服务器
scp training-data.tar.gz admin@新NAS_IP:/volume1/docker/training-assistant/

# 新服务器
cd /volume1/docker/training-assistant
tar -xzvf training-data.tar.gz --strip-components=3
docker compose up -d
```
