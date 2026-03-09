#!/bin/bash

# ============================================
# 阿里云 ECS 部署脚本
# 使用方式: ./deploy.sh
# ============================================

set -e

echo "🚀 开始部署..."

# 1. 拉取最新代码
echo "📦 拉取最新代码..."
git pull origin main

# 2. 安装依赖
echo "📥 安装依赖..."
pnpm install

# 3. 构建项目
echo "🔨 构建项目..."
pnpm run build

# 4. 重启服务
echo "🔄 重启服务..."
if pm2 list | grep -q "training-assistant"; then
    pm2 restart training-assistant
else
    pm2 start pnpm --name "training-assistant" -- start
fi

echo "✅ 部署完成！"
echo "🌐 访问地址: http://$(curl -s ifconfig.me):5000"
