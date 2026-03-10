#!/bin/bash

# ============================================
# 从 GitHub 更新并重新部署
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

# 拉取最新代码
echo ""
echo ">>> 拉取最新代码..."
git fetch origin
OLD_COMMIT=$(git rev-parse HEAD)
git reset --hard origin/main 2>/dev/null || git reset --hard origin/master
NEW_COMMIT=$(git rev-parse HEAD)

if [ "$OLD_COMMIT" = "$NEW_COMMIT" ]; then
    echo -e "${YELLOW}代码已是最新${NC}"
else
    echo -e "${GREEN}代码已更新${NC}"
    echo ""
    git log --oneline $OLD_COMMIT..$NEW_COMMIT
fi

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
