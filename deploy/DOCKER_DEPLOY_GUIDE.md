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
│  /data/training.db                         │
└─────────────────────────────────────────────┘
```

---

## 一、准备工作

### 1. 安装 Container Manager

群晖套件中心搜索「**Container Manager**」并安装

> 注：Container Manager 是群晖 DSM 7.2+ 版本的容器管理工具，等同于 Docker

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
# Coze API（必须配置）
COZE_API_KEY=your_coze_api_key
COZE_BUCKET_ENDPOINT_URL=your_s3_endpoint
COZE_BUCKET_NAME=your_bucket_name

# 应用配置
APP_URL=http://你的NAS_IP:5000

# 数据库路径（可选，默认 /data/training.db）
DATABASE_PATH=/data/training.db
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

# 重启服务
docker compose restart

# 停止服务
docker compose down

# 启动服务
docker compose up -d

# 进入容器
docker exec -it training-app sh
```

---

## 七、数据备份

SQLite 数据库是单文件，备份非常简单：

```bash
# 手动备份
cp /volume1/docker/training-assistant/data/training.db \
   /volume1/backup/training-assistant/training_$(date +%Y%m%d).db

# 或使用备份脚本
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
# 1. 停止应用
docker compose stop app

# 2. 恢复数据库文件
cp /volume1/backup/training-assistant/training_YYYYMMDD.db \
   /volume1/docker/training-assistant/data/training.db

# 3. 重启应用
docker compose start app
```

---

## 九、故障排除

### 查看日志
```bash
docker compose logs --tail 100
```

### 重启服务
```bash
docker compose restart app
```

### 完全重置
```bash
# ⚠️ 危险操作，会删除所有数据
docker compose down -v
docker compose up -d --build
```

### 数据库问题
```bash
# 检查数据库文件是否存在
ls -la /volume1/docker/training-assistant/data/

# 检查文件权限
chmod 644 /volume1/docker/training-assistant/data/training.db
```

---

## 十、资源需求

- **内存**: 建议 2GB 以上
- **存储**: 约 1GB (应用 + 数据库)
- **端口**: 5000 (应用)

---

## 十一、安全建议

1. **定期备份**: 设置定时备份任务
2. **使用 HTTPS**: 通过群晖反向代理配置 SSL
3. **数据隔离**: 数据库文件存储在 Docker Volume 中，与其他应用隔离

---

## 十二、迁移指南

### 从 PostgreSQL 迁移

如果您之前使用 PostgreSQL 版本，迁移步骤：

1. **导出旧数据**
   ```bash
   # 从 PostgreSQL 导出数据为 JSON 或 CSV
   ```

2. **启动新版本**
   ```bash
   docker compose down
   docker compose up -d --build
   ```

3. **导入数据**
   - 通过「数据管理」页面的导入功能导入
   - 或使用 API 批量导入

---

## 十三、与 PostgreSQL 版本对比

| 特性 | SQLite 版本 | PostgreSQL 版本 |
|------|------------|-----------------|
| 部署复杂度 | 简单（单容器） | 复杂（双容器） |
| 内存占用 | ~300MB | ~800MB |
| 数据备份 | 复制文件即可 | 需要 pg_dump |
| 并发性能 | 适合中小规模 | 适合大规模 |
| 维护成本 | 低 | 高 |

**推荐使用 SQLite 版本**，除非您的并发用户超过 100 人或数据量超过 10GB。
