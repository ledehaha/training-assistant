#!/bin/bash

# ============================================
# 重新构建并部署
# ============================================

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

PROJECT_DIR="${PROJECT_DIR:-/volume1/docker/training-assistant}"

echo "========================================"
echo "  更新应用"
echo "========================================"

cd "$PROJECT_DIR"

# 重新构建并启动
echo ""
echo ">>> 重新构建并启动..."
docker compose up -d --build

echo ""
echo "========================================"
echo -e "${GREEN}  更新完成！${NC}"
echo "========================================"
echo ""
docker compose ps
echo ""
echo "提示: 如需更新代码，请先手动上传新代码到服务器"
echo "  然后再次运行此脚本"
