# 群晖 NAS 直接部署文件说明

## 文件清单

```
deploy/nas/
├── DIRECT_DEPLOY_GUIDE.md  # 详细部署指南（本文档）
├── ecosystem.config.js     # PM2 配置文件
├── deploy.sh               # 一键部署脚本
├── migrate-db.sh           # 数据库迁移脚本
└── backup-db.sh            # 数据库备份脚本
```

## 快速开始

### 1. 准备工作

通过群晖套件中心安装：
- Node.js v18 或 v20 LTS
- PostgreSQL 15 或 16

### 2. 上传代码

将项目代码上传到 `/volume1/web/training-assistant/` 目录

### 3. 运行部署脚本

```bash
# SSH 连接到群晖
ssh admin@你的NAS_IP

# 进入项目目录
cd /volume1/web/training-assistant

# 赋予执行权限
chmod +x deploy/nas/*.sh

# 执行部署脚本
./deploy/nas/deploy.sh
```

### 4. 配置环境变量

编辑 `.env` 文件，填入正确的 API 密钥：
```bash
nano .env
```

### 5. 重启服务

```bash
pm2 restart training-assistant
```

## 数据库迁移

如果需要从 Supabase 迁移数据：

```bash
./deploy/nas/migrate-db.sh
```

按提示输入源数据库和目标数据库信息即可。

## 定时备份

在群晖任务计划中添加定时任务：

1. 控制面板 → 任务计划 → 新增 → 计划的任务 → 用户定义的脚本
2. 常规：设置任务名称
3. 计划：选择每天凌晨 2:00 执行
4. 任务设置 → 用户定义的脚本：
   ```bash
   /volume1/web/training-assistant/deploy/nas/backup-db.sh
   ```

## 访问应用

部署完成后，通过以下地址访问：
```
http://你的NAS_IP:5000
```

## 故障排除

查看应用日志：
```bash
pm2 logs training-assistant
```

查看数据库日志：
```bash
tail -f /var/log/pgsql.log
```

## 详细文档

请参考 [DIRECT_DEPLOY_GUIDE.md](./DIRECT_DEPLOY_GUIDE.md) 获取完整的部署指南。
