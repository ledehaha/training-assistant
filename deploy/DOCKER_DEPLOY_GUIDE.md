# 培训助手系统 - Docker 部署指南

## 架构说明

```
┌─────────────────────────────────────────────┐
│           群晖 NAS Docker                   │
├─────────────────────────────────────────────┤
│  ┌─────────────────┐    ┌─────────────────┐ │
│  │ training-postgres│◄───│ training-app    │ │
│  │ PostgreSQL 16   │    │ Next.js App     │ │
│  │ 端口: 5432      │    │ 端口: 5000      │ │
│  └─────────────────┘    └─────────────────┘ │
│         │                                   │
│         ▼                                   │
│  Docker Volume (数据持久化)                  │
└─────────────────────────────────────────────┘
```

---

## 一、准备工作

### 1. 安装 Docker

群晖套件中心搜索「Container Manager」或「Docker」并安装

### 2. SSH 连接到群晖

```bash
ssh admin@你的NAS_IP
```

---

## 二、首次部署

### 方式一：一键部署（推荐）

```bash
# 设置 GitHub 仓库地址
export GITHUB_REPO=https://github.com/你的用户名/training-assistant.git

# 下载并执行部署脚本
mkdir -p /volume1/docker/training-assistant
cd /volume1/docker/training-assistant

# 如果已克隆仓库
./deploy/docker-deploy.sh
```

### 方式二：手动部署

```bash
# 1. 克隆项目
cd /volume1/docker
git clone https://github.com/你的用户名/training-assistant.git
cd training-assistant

# 2. 创建环境变量
cp .env.example .env
nano .env  # 填入 API 密钥

# 3. 构建并启动
docker compose up -d --build

# 4. 查看状态
docker compose ps
```

---

## 三、环境变量配置

创建 `.env` 文件：

```env
# 数据库配置
DB_USER=training_user
DB_PASSWORD=your_secure_password
DB_NAME=training_db

# Coze API（必须配置）
COZE_API_KEY=your_coze_api_key
COZE_BUCKET_ENDPOINT_URL=your_s3_endpoint
COZE_BUCKET_NAME=your_bucket_name

# 应用配置
APP_URL=http://你的NAS_IP:5000
```

---

## 四、更新应用

### 从 GitHub 更新

```bash
cd /volume1/docker/training-assistant
./deploy/update.sh
```

或手动执行：

```bash
cd /volume1/docker/training-assistant

# 拉取最新代码
git pull

# 重新构建并启动
docker compose up -d --build
```

---

## 五、常用命令

```bash
# 查看运行状态
docker compose ps

# 查看日志
docker compose logs -f
docker compose logs -f app        # 只看应用日志
docker compose logs -f postgres   # 只看数据库日志

# 重启服务
docker compose restart

# 停止服务
docker compose down

# 启动服务
docker compose up -d

# 进入容器
docker exec -it training-app sh
docker exec -it training-postgres bash

# 连接数据库
docker exec -it training-postgres psql -U training_user -d training_db
```

---

## 六、数据备份

```bash
# 手动备份
./deploy/backup-docker.sh

# 定时备份（群晖任务计划）
# 控制面板 → 任务计划 → 新增 → 用户定义的脚本
# 设置每天凌晨 2:00 执行:
/volume1/docker/training-assistant/deploy/backup-docker.sh
```

---

## 七、数据恢复

```bash
# 从备份恢复
gunzip -c /volume1/backup/training-assistant/backup_xxx.sql.gz | \
  docker exec -i training-postgres psql -U training_user -d training_db
```

---

## 八、故障排除

### 查看日志
```bash
docker compose logs --tail 100
```

### 重启单个服务
```bash
docker compose restart app
docker compose restart postgres
```

### 完全重置
```bash
# ⚠️ 危险操作，会删除所有数据
docker compose down -v
docker compose up -d --build
```

### 数据库连接问题
```bash
# 检查数据库状态
docker exec training-postgres pg_isready

# 查看数据库日志
docker compose logs postgres
```

---

## 九、资源需求

- **内存**: 建议 2GB 以上
- **存储**: 约 2GB (应用 + 数据库)
- **端口**: 5000 (应用), 5432 (数据库)

---

## 十、安全建议

1. **修改默认密码**: 修改 `.env` 中的数据库密码
2. **不要暴露数据库端口**: 如无需外网访问，可删除 docker-compose.yml 中数据库的 ports 配置
3. **定期备份**: 设置定时备份任务
4. **使用 HTTPS**: 通过群晖反向代理配置 SSL
