# 阿里云部署指南

## 前提条件

1. 阿里云账号
2. 已购买云服务器 ECS
3. 服务器已安装 Node.js 20+、pnpm、pm2、git

---

## 步骤 1：准备阿里云 ECS 服务器

```bash
# 1. 购买阿里云 ECS（推荐配置）
# - 规格：2vCPU 4GB 内存
# - 系统：Ubuntu 22.04 或 CentOS 8
# - 带宽：5Mbps 以上
# - 安全组：开放 5000 端口

# 2. SSH 登录服务器
ssh root@your-ecs-ip

# 3. 安装依赖
# Ubuntu
apt update && apt install -y git curl

# CentOS
yum install -y git curl

# 4. 安装 Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# 5. 安装 pnpm
npm install -g pnpm

# 6. 安装 pm2
npm install -g pm2

# 7. 创建项目目录
mkdir -p /var/www/training-assistant
cd /var/www/training-assistant

# 8. 克隆代码
git clone https://github.com/你的用户名/training-assistant.git .

# 9. 首次安装和构建
pnpm install
pnpm run build

# 10. 启动服务
pm2 start pnpm --name "training-assistant" -- start

# 11. 设置开机自启
pm2 startup
pm2 save
```

---

## 步骤 2：配置 GitHub Secrets

在 GitHub 仓库的 `Settings` → `Secrets and variables` → `Actions` 中添加：

| Secret 名称 | 说明 | 示例 |
|------------|------|------|
| `ECS_HOST` | ECS 公网 IP | `123.45.67.89` |
| `ECS_USERNAME` | SSH 用户名 | `root` |
| `ECS_SSH_KEY` | SSH 私钥 | 见下方说明 |
| `ECS_SSH_PORT` | SSH 端口 | `22`（可选） |
| `ECS_PROJECT_PATH` | 项目路径 | `/var/www/training-assistant`（可选） |

### 获取 SSH 私钥

```bash
# 在本地生成密钥对（如果没有）
ssh-keygen -t ed25519 -C "github-actions" -f ~/.ssh/aliyun_deploy

# 将公钥添加到阿里云 ECS
ssh-copy-id -i ~/.ssh/aliyun_deploy.pub root@your-ecs-ip

# 复制私钥内容，添加到 GitHub Secrets
cat ~/.ssh/aliyun_deploy
```

### 在 GitHub 添加 Secrets

1. 进入仓库页面 → `Settings` → `Secrets and variables` → `Actions`
2. 点击 `New repository secret`
3. 依次添加：
   - `ECS_HOST`: 你的 ECS 公网 IP
   - `ECS_USERNAME`: `root`
   - `ECS_SSH_KEY`: 私钥完整内容（包括 `-----BEGIN` 和 `-----END` 行）

---

## 步骤 3：触发部署

```bash
# 方式 1：推送代码到 main 分支自动触发
git push origin main

# 方式 2：在 GitHub Actions 页面手动触发
# 进入 Actions → Deploy to Aliyun ECS → Run workflow
```

---

## 阿里云安全组配置

在阿里云控制台配置安全组规则：

| 授权策略 | 协议类型 | 端口范围 | 授权对象 | 说明 |
|---------|---------|---------|---------|------|
| 允许 | TCP | 22 | 你的IP/32 | SSH |
| 允许 | TCP | 5000 | 0.0.0.0/0 | 应用端口 |
| 允许 | TCP | 80 | 0.0.0.0/0 | HTTP（可选） |
| 允许 | TCP | 443 | 0.0.0.0/0 | HTTPS（可选） |

---

## 配置域名和 HTTPS（可选）

### 使用 Nginx 反向代理

```bash
# 安装 Nginx
apt install -y nginx

# 创建配置文件
cat > /etc/nginx/sites-available/training-assistant << 'EOF'
server {
    listen 80;
    server_name your-domain.com;
    
    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF

# 启用配置
ln -s /etc/nginx/sites-available/training-assistant /etc/nginx/sites-enabled/
nginx -t
systemctl reload nginx
```

### 配置 HTTPS (Let's Encrypt)

```bash
# 安装 certbot
apt install -y certbot python3-certbot-nginx

# 获取证书
certbot --nginx -d your-domain.com

# 自动续期测试
certbot renew --dry-run
```

---

## 数据持久化

### 挂载数据盘（推荐）

```bash
# 1. 在阿里云控制台购买数据盘
# 2. 格式化并挂载
fdisk -l  # 查看磁盘名称，如 /dev/vdb
mkfs.ext4 /dev/vdb
mkdir -p /data
mount /dev/vdb /data

# 3. 设置开机自动挂载
echo '/dev/vdb /data ext4 defaults 0 0' >> /etc/fstab

# 4. 创建数据目录
mkdir -p /data/training-assistant

# 5. 停止服务，迁移数据
pm2 stop training-assistant
mv /var/www/training-assistant/data/* /data/training-assistant/

# 6. 设置环境变量
cd /var/www/training-assistant
echo 'DATA_DIR=/data/training-assistant/db' > .env.local

# 7. 重启服务
pm2 restart training-assistant
```

### 定期备份

```bash
# 创建备份脚本
cat > /root/backup.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/data/backup"
DATE=$(date +%Y%m%d_%H%M%S)
mkdir -p $BACKUP_DIR
cp -r /var/www/training-assistant/data $BACKUP_DIR/data_$DATE
# 保留最近 7 天的备份
find $BACKUP_DIR -name "data_*" -mtime +7 -delete
echo "备份完成: $BACKUP_DIR/data_$DATE"
EOF

chmod +x /root/backup.sh

# 添加定时任务（每天凌晨 3 点备份）
crontab -e
# 添加：0 3 * * * /root/backup.sh >> /var/log/backup.log 2>&1
```

---

## 常见问题

### 1. 端口无法访问
```bash
# 检查服务状态
pm2 status
pm2 logs training-assistant

# 检查端口
netstat -tlnp | grep 5000

# 检查防火墙
ufw status
ufw allow 5000  # 如果开启了防火墙
```

### 2. 构建失败
```bash
# 检查 Node.js 版本
node -v  # 需要 20+

# 清理缓存重新构建
rm -rf node_modules .next
pnpm install
pnpm run build
```

### 3. 数据丢失
```bash
# 确保 DATA_DIR 环境变量正确
cat .env.local

# 检查数据文件
ls -la /var/www/training-assistant/data/
```

### 4. GitHub Actions 部署失败
```bash
# 检查 SSH 连接
ssh -i ~/.ssh/aliyun_deploy root@your-ecs-ip

# 检查 pm2 进程
pm2 list
pm2 logs training-assistant
```

---

## 部署检查清单

- [ ] 阿里云 ECS 服务器已购买
- [ ] Node.js 20+ 已安装
- [ ] pnpm 已安装 (`npm install -g pnpm`)
- [ ] pm2 已安装 (`npm install -g pm2`)
- [ ] 代码已克隆到服务器
- [ ] 首次构建成功 (`pnpm run build`)
- [ ] 服务正常启动 (`pm2 start ...`)
- [ ] 安全组端口 5000 已开放
- [ ] GitHub Secrets 已配置
- [ ] 自动部署流程正常

---

## 快速命令参考

```bash
# 查看服务状态
pm2 status

# 查看日志
pm2 logs training-assistant

# 重启服务
pm2 restart training-assistant

# 停止服务
pm2 stop training-assistant

# 手动部署
cd /var/www/training-assistant
git pull
pnpm install
pnpm run build
pm2 restart training-assistant
```
