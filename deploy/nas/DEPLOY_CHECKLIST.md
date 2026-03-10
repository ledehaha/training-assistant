# 培训助手系统 - 群晖 NAS 直接部署清单

## 📋 部署前检查清单

### 1️⃣ 群晖系统准备
- [ ] DSM 7.0 或更高版本
- [ ] 至少 2GB 可用内存
- [ ] 至少 10GB 可用存储空间
- [ ] 启用 SSH 服务（控制面板 → 终端机和 SNMP）

### 2️⃣ 安装软件（通过套件中心）
- [ ] **Node.js** v18 或 v20 LTS
- [ ] **PostgreSQL** 15 或 16
- [ ] **Git**（可选，用于代码更新）

### 3️⃣ 数据库配置
```bash
# SSH 连接到群晖
ssh admin@你的NAS_IP

# 连接 PostgreSQL
psql -U postgres

# 创建数据库和用户
CREATE DATABASE training_db;
CREATE USER training_user WITH ENCRYPTED PASSWORD '你的密码';
GRANT ALL PRIVILEGES ON DATABASE training_db TO training_user;
\q

# 初始化表结构
psql -U postgres -d training_db -f /volume1/web/training-assistant/deploy/nas/init-database.sql
```

### 4️⃣ 部署应用
```bash
# 创建目录
mkdir -p /volume1/web/training-assistant
cd /volume1/web/training-assistant

# 上传代码（选择一种方式）
# 方式1: Git
git clone https://github.com/你的用户名/training-assistant.git .

# 方式2: SCP（在本地执行）
scp -r ./dist/* admin@NAS_IP:/volume1/web/training-assistant/

# 安装 pnpm 和 PM2
npm install -g pnpm pm2

# 安装依赖
pnpm install --prod

# 构建
pnpm run build

# 创建环境变量
cp deploy/nas/.env.example .env
nano .env  # 填入实际配置
```

### 5️⃣ 配置环境变量
编辑 `.env` 文件：
```env
# 数据库
DATABASE_URL=postgresql://training_user:你的密码@localhost:5432/training_db

# Coze API（必填）
COZE_API_KEY=你的API密钥
COZE_BUCKET_ENDPOINT_URL=你的S3端点
COZE_BUCKET_NAME=你的存储桶名称

# 应用
NODE_ENV=production
PORT=5000
```

### 6️⃣ 启动服务
```bash
# 使用 PM2 启动
pm2 start deploy/nas/ecosystem.config.js

# 设置开机自启
pm2 startup
pm2 save

# 查看状态
pm2 status
```

### 7️⃣ 验证部署
- [ ] 访问 `http://NAS_IP:5000` 能打开页面
- [ ] 数据库连接正常
- [ ] AI 功能可用

---

## 🔧 快速命令

```bash
# 查看日志
pm2 logs training-assistant

# 重启服务
pm2 restart training-assistant

# 停止服务
pm2 stop training-assistant

# 更新应用
cd /volume1/web/training-assistant
git pull
pnpm install --prod
pnpm run build
pm2 restart training-assistant

# 备份数据库
./deploy/nas/backup-db.sh

# 迁移数据
./deploy/nas/migrate-db.sh
```

---

## 📁 文件说明

| 文件 | 说明 |
|------|------|
| `DIRECT_DEPLOY_GUIDE.md` | 详细部署指南 |
| `init-database.sql` | 数据库初始化脚本 |
| `ecosystem.config.js` | PM2 配置文件 |
| `deploy.sh` | 一键部署脚本 |
| `migrate-db.sh` | 数据迁移脚本 |
| `backup-db.sh` | 数据库备份脚本 |
| `.env.example` | 环境变量示例 |
