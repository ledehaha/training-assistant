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

## 二、上传代码

### 方式一：下载 ZIP 包上传（推荐）

1. **下载代码包**
   - 在 GitHub 仓库页面点击「Code」→「Download ZIP」
   - 或从本地开发环境打包

2. **上传到群晖**
   ```bash
   # 创建目录
   mkdir -p /volume1/docker/training-assistant
   
   # 方式A: 通过 SCP 上传（在本地执行）
   scp training-assistant.zip admin@NAS_IP:/volume1/docker/
   
   # 方式B: 通过群晖 File Station 上传
   # 打开 File Station → 导航到 /docker/ → 上传 ZIP 文件
   ```

3. **解压文件**
   ```bash
   cd /volume1/docker
   # 如果有 unzip
   unzip training-assistant.zip -d training-assistant
   
   # 如果没有 unzip，通过 File Station 右键解压
   ```

### 方式二：Git 克隆（需安装 Git）

```bash
# 安装 Git（套件中心搜索 Git Server 并安装）
cd /volume1/docker
git clone https://github.com/你的用户名/training-assistant.git
```

---

## 三、首次部署

```bash
# 1. 进入项目目录
cd /volume1/docker/training-assistant

# 2. 创建环境变量
cp .env.example .env
nano .env  # 填入 Coze API 密钥

# 3. 启动服务
docker compose up -d --build

# 4. 查看状态
docker compose ps
```

---

## 四、环境变量配置

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

## 五、更新应用

### 重新上传代码后更新

```bash
# 1. 上传新代码到服务器（覆盖原文件）

# 2. 重新构建
cd /volume1/docker/training-assistant
./deploy/update.sh
```

或手动执行：
```bash
docker compose up -d --build
```

---

## 六、常用命令

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

## 七、数据备份

```bash
# 手动备份
./deploy/backup-docker.sh

# 定时备份（群晖任务计划）
# 控制面板 → 任务计划 → 新增 → 用户定义的脚本
# 设置每天凌晨 2:00 执行:
/volume1/docker/training-assistant/deploy/backup-docker.sh
```

---

## 八、数据恢复

```bash
# 从备份恢复
gunzip -c /volume1/backup/training-assistant/backup_xxx.sql.gz | \
  docker exec -i training-postgres psql -U training_user -d training_db
```

---

## 九、故障排除

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

## 十、资源需求

- **内存**: 建议 2GB 以上
- **存储**: 约 2GB (应用 + 数据库)
- **端口**: 5000 (应用), 5432 (数据库)

---

## 十一、安全建议

1. **修改默认密码**: 修改 `.env` 中的数据库密码
2. **不要暴露数据库端口**: 如无需外网访问，可删除 docker-compose.yml 中数据库的 ports 配置
3. **定期备份**: 设置定时备份任务
4. **使用 HTTPS**: 通过群晖反向代理配置 SSL
