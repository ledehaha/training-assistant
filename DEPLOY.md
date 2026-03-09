# 阿里云 ECS 部署指南

本文档介绍如何通过 GitHub 方式将项目部署到阿里云 ECS。

## 一、ECS 服务器准备

### 1. 购买 ECS 实例
- **推荐配置**：2核4G 或以上
- **操作系统**：Ubuntu 22.04 LTS 或 CentOS 8+
- **安全组**：开放 22 (SSH)、80 (HTTP)、443 (HTTPS)、5000 (应用端口)

### 2. 连接服务器
```bash
ssh root@your-ecs-ip
```

## 二、服务器环境配置

### 1. 安装 Node.js (v20+)
```bash
# Ubuntu
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# CentOS
curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
sudo yum install -y nodejs

# 验证安装
node -v
npm -v
```

### 2. 安装 pnpm
```bash
npm install -g pnpm
```

### 3. 安装 PM2 (进程管理)
```bash
npm install -g pm2
```

### 4. 安装 Git
```bash
# Ubuntu
sudo apt-get install -y git

# CentOS
sudo yum install -y git
```

## 三、项目部署

### 1. 克隆代码
```bash
# 创建应用目录
mkdir -p /var/www
cd /var/www

# 克隆项目 (替换为您的 GitHub 仓库地址)
git clone https://github.com/YOUR_USERNAME/YOUR_REPO.git training-assistant
cd training-assistant
```

### 2. 配置环境变量
```bash
# 创建生产环境配置文件
nano .env.production
```

填入以下内容：
```env
PORT=5000
NODE_ENV=production

# Supabase 数据库配置
DATABASE_URL=postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres
NEXT_PUBLIC_SUPABASE_URL=https://[PROJECT-REF].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

### 3. 安装依赖并构建
```bash
# 安装依赖
pnpm install

# 构建项目
pnpm run build
```

### 4. 启动服务
```bash
# 使用 PM2 启动
pm2 start pnpm --name "training-assistant" -- start

# 查看运行状态
pm2 status

# 查看日志
pm2 logs training-assistant

# 设置开机自启
pm2 startup
pm2 save
```

### 5. 验证部署
```bash
# 检查端口是否监听
curl http://localhost:5000

# 或通过公网 IP 访问
curl http://your-ecs-ip:5000
```

## 四、配置域名和 HTTPS (可选)

### 1. 安装 Nginx
```bash
# Ubuntu
sudo apt-get install -y nginx

# CentOS
sudo yum install -y nginx
```

### 2. 配置 Nginx 反向代理
```bash
sudo nano /etc/nginx/sites-available/training-assistant
```

添加以下内容：
```nginx
server {
    listen 80;
    server_name your-domain.com;  # 替换为您的域名

    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

启用配置：
```bash
sudo ln -s /etc/nginx/sites-available/training-assistant /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### 3. 配置 HTTPS (使用 Let's Encrypt)
```bash
# 安装 Certbot
sudo apt-get install -y certbot python3-certbot-nginx

# 申请证书
sudo certbot --nginx -d your-domain.com

# 自动续期
sudo certbot renew --dry-run
```

## 五、GitHub Actions 自动部署

### 步骤 1：生成 SSH 密钥对

在本地电脑执行：
```bash
# 生成新的 SSH 密钥对（用于 GitHub Actions）
ssh-keygen -t rsa -b 4096 -C "github-actions" -f github_actions_key -N ""

# 会生成两个文件：
# github_actions_key       - 私钥（配置到 GitHub Secrets）
# github_actions_key.pub   - 公钥（配置到 ECS 服务器）
```

### 步骤 2：将公钥添加到 ECS 服务器

```bash
# 在 ECS 服务器上执行
echo "你复制的公钥内容" >> ~/.ssh/authorized_keys

# 或者直接复制文件
# 本地执行：ssh-copy-id -i github_actions_key.pub root@your-ecs-ip
```

### 步骤 3：配置 GitHub Secrets

进入 GitHub 仓库 → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**

添加以下 Secrets：

| Secret 名称 | 说明 | 示例值 |
|------------|------|--------|
| `ECS_HOST` | ECS 公网 IP 地址 | `123.45.67.89` |
| `ECS_USERNAME` | SSH 登录用户名 | `root` |
| `ECS_SSH_KEY` | SSH 私钥内容（完整内容，包括 BEGIN/END 行） | 见下方示例 |
| `ECS_SSH_PORT` | SSH 端口（可选，默认 22） | `22` |
| `ECS_PROJECT_PATH` | 项目路径（可选，默认 /var/www/training-assistant） | `/var/www/training-assistant` |

**ECS_SSH_KEY 示例：**
```
-----BEGIN RSA PRIVATE KEY-----
MIIEpAIBAAKCAQEA...
...私钥内容...
-----END RSA PRIVATE KEY-----
```

### 步骤 4：验证配置

1. 推送代码到 `main` 分支：
```bash
git add .
git commit -m "test: 测试自动部署"
git push origin main
```

2. 在 GitHub 仓库的 **Actions** 标签页查看部署进度

3. 部署成功后访问 `http://your-ecs-ip:5000`

### 工作流文件说明

项目已包含两个工作流配置：

| 文件 | 说明 |
|------|------|
| `.github/workflows/deploy.yml` | 基础版，简洁快速 |
| `.github/workflows/deploy-with-summary.yml` | 增强版，包含部署摘要和状态检查 |

**推荐使用 `deploy.yml`，如需增强功能可切换到 `deploy-with-summary.yml`。**

### 手动触发部署

在 GitHub 仓库 → **Actions** → 选择工作流 → **Run workflow**

---

## 六、手动更新（备用方案）

如果自动部署失败，可以手动执行：
```bash
cd /var/www/training-assistant
git pull origin main
pnpm install
pnpm run build
pm2 restart training-assistant
```

## 七、常用运维命令

```bash
# 查看应用状态
pm2 status

# 查看实时日志
pm2 logs training-assistant

# 重启应用
pm2 restart training-assistant

# 停止应用
pm2 stop training-assistant

# 查看 Nginx 状态
sudo systemctl status nginx

# 重启 Nginx
sudo systemctl restart nginx

# 查看防火墙状态
sudo ufw status
```

## 八、注意事项

1. **数据库连接**：确保 ECS 能访问 Supabase 或阿里云 RDS
2. **安全组配置**：开放必要的端口
3. **定期备份**：建议定期备份数据库
4. **日志监控**：可使用 PM2 Plus 或阿里云监控服务
