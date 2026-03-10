# 培训助手系统 - 群晖 NAS 直接部署指南

## 一、环境要求

- 群晖 DSM 7.0 或更高版本
- DS423+ (ARM 架构)
- 至少 2GB 可用内存
- 至少 10GB 可用存储空间

---

## 二、安装 Node.js

### 方法一：套件中心安装（推荐）

1. 打开「套件中心」
2. 搜索「Node.js」
3. 选择 v20.x 或 v18.x LTS 版本安装

### 方法二：手动安装

如果套件中心没有 Node.js：

```bash
# SSH 连接到群晖
ssh admin@你的NAS_IP

# 使用 opkg 安装（需要先安装 Entware）
opkg install node
```

### 验证安装
```bash
node -v
# 应输出 v20.x.x 或 v18.x.x

npm -v
# 应输出 npm 版本号
```

---

## 三、安装 PostgreSQL

### 方法一：套件中心安装（推荐）

1. 打开「套件中心」
2. 搜索「PostgreSQL」
3. 安装 PostgreSQL 16 或 15

### 方法二：通过 SSH 安装

```bash
# 使用 opkg 安装
opkg install postgresql

# 初始化数据库
initdb -D /volume1/database/postgresql

# 启动服务
pg_ctl -D /volume1/database/postgresql -l logfile start
```

### 配置 PostgreSQL

```bash
# 连接数据库
psql -U postgres

# 创建数据库和用户
CREATE DATABASE training_db;
CREATE USER training_user WITH ENCRYPTED PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE training_db TO training_user;

# 退出
\q
```

### 配置远程访问（可选）

编辑 `/var/lib/pgsql/data/pg_hba.conf`：
```
# 添加以下行
host    all    all    127.0.0.1/32    md5
```

编辑 `/var/lib/pgsql/data/postgresql.conf`：
```
listen_addresses = 'localhost'
```

重启 PostgreSQL：
```bash
synoservicectl --restart pgsql
```

---

## 四、安装 PM2

```bash
# 全局安装 PM2
npm install -g pm2

# 设置 PM2 开机自启
pm2 startup

# 记录输出的命令并执行
```

---

## 五、部署应用

### 1. 创建项目目录

```bash
# 创建目录
mkdir -p /volume1/web/training-assistant
cd /volume1/web/training-assistant
```

### 2. 上传代码

方式一：Git 克隆
```bash
git clone https://github.com/你的用户名/training-assistant.git .
```

方式二：SCP 上传
```bash
# 在本地执行
scp -r ./dist/* admin@NAS_IP:/volume1/web/training-assistant/
```

方式三：群晖文件管理器上传
- 打开 File Station
- 导航到 /web/training-assistant
- 上传项目文件

### 3. 安装依赖

```bash
cd /volume1/web/training-assistant

# 安装 pnpm
npm install -g pnpm

# 安装依赖
pnpm install --prod
```

### 4. 配置环境变量

创建 `.env` 文件：
```bash
nano .env
```

内容：
```env
# 数据库配置
DATABASE_URL=postgresql://training_user:your_secure_password@localhost:5432/training_db

# Coze API 配置
COZE_API_KEY=your_coze_api_key
COZE_BUCKET_ENDPOINT_URL=your_s3_endpoint
COZE_BUCKET_NAME=your_bucket_name

# 应用配置
NODE_ENV=production
PORT=5000
NEXT_PUBLIC_APP_URL=http://你的NAS_IP:5000
```

### 5. 初始化数据库

```bash
# 运行数据库迁移
pnpm run db:migrate

# 或者手动执行 SQL
psql -U training_user -d training_db -f schema.sql
```

### 6. 构建应用

```bash
# 构建
pnpm run build
```

### 7. 启动服务

```bash
# 使用 PM2 启动
pm2 start pnpm --name "training-assistant" -- start

# 或者使用自定义启动脚本
pm2 start ecosystem.config.js

# 保存 PM2 配置
pm2 save
```

---

## 六、配置群辰反向代理（可选）

### 使用群晖自带反向代理

1. 控制面板 → 登录门户 → 高级
2. 点击「反向代理服务器」
3. 新增配置：
   - 描述：Training Assistant
   - 来源协议：HTTP
   - 来源主机名：自定义域名或留空
   - 来源端口：5000
   - 目的地协议：HTTP
   - 目的地主机名：localhost
   - 目的地端口：5000

---

## 七、常用命令

```bash
# 查看应用状态
pm2 status

# 查看日志
pm2 logs training-assistant

# 重启应用
pm2 restart training-assistant

# 停止应用
pm2 stop training-assistant

# 更新应用
cd /volume1/web/training-assistant
git pull
pnpm install --prod
pnpm run build
pm2 restart training-assistant

# 备份数据库
pg_dump -U training_user training_db > backup_$(date +%Y%m%d).sql

# 恢复数据库
psql -U training_user training_db < backup.sql
```

---

## 八、数据迁移

### 从 Supabase 导出

```bash
# 导出 Supabase 数据
pg_dump "postgresql://user:pass@host:5432/db" > supabase_backup.sql
```

### 导入到群晖

```bash
# 上传备份文件到群晖
# 然后导入
psql -U training_user -d training_db < supabase_backup.sql
```

---

## 九、故障排除

### Node.js 相关问题

```bash
# 检查 Node.js 版本
node -v

# 检查 npm 全局包
npm list -g --depth=0

# 清理 npm 缓存
npm cache clean --force
```

### PostgreSQL 相关问题

```bash
# 检查 PostgreSQL 状态
synoservicectl --status pgsql

# 查看 PostgreSQL 日志
tail -f /var/log/pgsql.log

# 重启 PostgreSQL
synoservicectl --restart pgsql
```

### PM2 相关问题

```bash
# 查看 PM2 日志
pm2 logs

# 查看 PM2 监控
pm2 monit

# 重置 PM2
pm2 kill
pm2 start ecosystem.config.js
```

---

## 十、安全建议

1. **修改默认端口**：不要使用默认端口
2. **设置防火墙**：只开放必要端口
3. **使用 HTTPS**：配置 SSL 证书
4. **定期备份**：设置定时备份任务
5. **更新系统**：定期更新群晖 DSM
