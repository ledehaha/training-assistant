#!/bin/bash
# ============================================
# 培训助手系统 - PM2 部署脚本
# ============================================

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}培训助手系统 - PM2 部署${NC}"
echo -e "${GREEN}========================================${NC}"

# 检查 Node.js
if ! command -v node &> /dev/null; then
    echo -e "${RED}错误: 未安装 Node.js${NC}"
    echo -e "${YELLOW}请在群晖套件中心安装 Node.js v20 或 v22${NC}"
    exit 1
fi

echo -e "${GREEN}Node.js 版本: $(node -v)${NC}"

# 检查 pnpm
if ! command -v pnpm &> /dev/null; then
    echo -e "${YELLOW}正在安装 pnpm...${NC}"
    npm install -g pnpm
fi

# 检查 PM2
if ! command -v pm2 &> /dev/null; then
    echo -e "${YELLOW}正在安装 PM2...${NC}"
    npm install -g pm2
fi

# 设置数据目录
export DATA_DIR="$(pwd)/data"
export FILE_STORAGE_PATH="$(pwd)/data/files"

# 创建数据目录
mkdir -p data/db data/files

# 安装依赖
echo -e "${YELLOW}正在安装依赖...${NC}"
pnpm install

# 构建
echo -e "${YELLOW}正在构建项目...${NC}"
pnpm run build

# 停止旧进程
pm2 stop training-assistant 2>/dev/null
pm2 delete training-assistant 2>/dev/null

# 启动服务
echo -e "${YELLOW}正在启动服务...${NC}"
PORT=5900 pm2 start pnpm --name "training-assistant" -- start

# 保存 PM2 配置
pm2 save

# 显示状态
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}部署完成！${NC}"
echo -e "${GREEN}========================================${NC}"
echo -e "访问地址: ${YELLOW}http://$(hostname -I | awk '{print $1}'):5900${NC}"
echo ""
pm2 status
