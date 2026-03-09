#!/bin/bash

# ============================================
# 阿里云 ECS 一键初始化脚本
# 用于部署非学历培训全周期助手
# 使用方式: curl -fsSL https://raw.githubusercontent.com/ledehaha/training-assistant/main/init-ecs.sh | bash
# ============================================

set -e

echo "============================================"
echo "🚀 开始初始化 ECS 服务器..."
echo "============================================"

# 检测操作系统
if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS=$ID
else
    echo "❌ 无法检测操作系统"
    exit 1
fi

echo "📋 操作系统: $OS"

# 1. 更新系统包
echo ""
echo "📦 更新系统包..."
if [ "$OS" = "ubuntu" ] || [ "$OS" = "debian" ]; then
    apt-get update -y
    apt-get upgrade -y
elif [ "$OS" = "centos" ] || [ "$OS" = "rhel" ]; then
    yum update -y
fi

# 2. 安装基础工具
echo ""
echo "🔧 安装基础工具..."
if [ "$OS" = "ubuntu" ] || [ "$OS" = "debian" ]; then
    apt-get install -y curl wget git build-essential
elif [ "$OS" = "centos" ] || [ "$OS" = "rhel" ]; then
    yum install -y curl wget git gcc-c++ make
fi

# 3. 安装 Node.js 20
echo ""
echo "📦 安装 Node.js 20..."
if ! command -v node &> /dev/null; then
    if [ "$OS" = "ubuntu" ] || [ "$OS" = "debian" ]; then
        curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
        apt-get install -y nodejs
    elif [ "$OS" = "centos" ] || [ "$OS" = "rhel" ]; then
        curl -fsSL https://rpm.nodesource.com/setup_20.x | bash -
        yum install -y nodejs
    fi
fi

echo "✅ Node.js 版本: $(node -v)"
echo "✅ NPM 版本: $(npm -v)"

# 4. 安装 pnpm
echo ""
echo "📦 安装 pnpm..."
if ! command -v pnpm &> /dev/null; then
    npm install -g pnpm
fi
echo "✅ pnpm 版本: $(pnpm -v)"

# 5. 安装 PM2
echo ""
echo "📦 安装 PM2..."
if ! command -v pm2 &> /dev/null; then
    npm install -g pm2
fi
echo "✅ PM2 版本: $(pm2 -v)"

# 6. 创建项目目录
echo ""
echo "📁 创建项目目录..."
mkdir -p /var/www
cd /var/www

# 7. 克隆项目
echo ""
echo "📦 克隆项目代码..."
if [ -d "training-assistant" ]; then
    echo "项目目录已存在，更新代码..."
    cd training-assistant
    git pull origin main
else
    echo "克隆新项目..."
    git clone https://github.com/ledehaha/training-assistant.git
    cd training-assistant
fi

# 8. 检查环境变量文件
echo ""
echo "⚙️ 检查环境变量配置..."
if [ ! -f ".env.production" ]; then
    echo ""
    echo "⚠️  .env.production 文件不存在！"
    echo "请创建环境变量文件："
    echo ""
    echo "  nano /var/www/training-assistant/.env.production"
    echo ""
    echo "添加以下内容："
    echo "---"
    echo "PORT=5000"
    echo "NODE_ENV=production"
    echo "DATABASE_URL=你的Supabase数据库连接字符串"
    echo "NEXT_PUBLIC_SUPABASE_URL=你的Supabase URL"
    echo "NEXT_PUBLIC_SUPABASE_ANON_KEY=你的Supabase匿名密钥"
    echo "---"
    echo ""
    read -p "是否现在配置环境变量？(y/n): " config_env
    if [ "$config_env" = "y" ] || [ "$config_env" = "Y" ]; then
        echo "请输入 DATABASE_URL:"
        read -r db_url
        echo "请输入 NEXT_PUBLIC_SUPABASE_URL:"
        read -r supabase_url
        echo "请输入 NEXT_PUBLIC_SUPABASE_ANON_KEY:"
        read -r supabase_key
        
        cat > .env.production << EOF
PORT=5000
NODE_ENV=production
DATABASE_URL=$db_url
NEXT_PUBLIC_SUPABASE_URL=$supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=$supabase_key
EOF
        echo "✅ 环境变量已配置"
    else
        echo "⚠️  请稍后手动配置环境变量后再运行部署"
        exit 0
    fi
else
    echo "✅ .env.production 已存在"
fi

# 9. 安装依赖
echo ""
echo "📦 安装项目依赖..."
pnpm install --frozen-lockfile

# 10. 构建项目
echo ""
echo "🔨 构建项目..."
pnpm run build

# 11. 启动服务
echo ""
echo "🚀 启动服务..."
if pm2 list | grep -q "training-assistant"; then
    pm2 restart training-assistant
else
    pm2 start pnpm --name "training-assistant" -- start
fi

# 12. 配置开机自启
echo ""
echo "⚙️ 配置开机自启..."
pm2 save
pm2 startup | tail -1 | bash 2>/dev/null || true

# 13. 显示状态
echo ""
echo "============================================"
echo "✅ 初始化完成！"
echo "============================================"
echo ""
echo "📊 服务状态:"
pm2 status
echo ""
echo "🌐 访问地址: http://$(curl -s ifconfig.me):5000"
echo ""
echo "📝 常用命令:"
echo "  查看日志: pm2 logs training-assistant"
echo "  重启服务: pm2 restart training-assistant"
echo "  停止服务: pm2 stop training-assistant"
echo ""
