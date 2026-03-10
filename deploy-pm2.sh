#!/bin/bash
# ============================================
# 培训助手系统 - 一键部署脚本 (PM2)
# ============================================

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# 获取项目目录
PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "${PROJECT_DIR}"

# 端口设置
PORT=${PORT:-5900}

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}培训助手系统 - PM2 部署${NC}"
echo -e "${GREEN}========================================${NC}"

# 设置数据目录
export DATA_DIR="${PROJECT_DIR}/data"
export FILE_STORAGE_PATH="${PROJECT_DIR}/data/files"

# 创建数据目录
mkdir -p "${DATA_DIR}/db" "${DATA_DIR}/files"

# 检查 Node.js
if ! command -v node &> /dev/null; then
    echo -e "${RED}错误: 未安装 Node.js${NC}"
    echo -e "${YELLOW}请在群晖套件中心安装 Node.js v20 或 v22${NC}"
    exit 1
fi

echo -e "${GREEN}Node.js 版本: $(node -v)${NC}"
echo -e "${GREEN}项目目录: ${PROJECT_DIR}${NC}"
echo -e "${GREEN}数据目录: ${DATA_DIR}${NC}"
echo -e "${GREEN}端口: ${PORT}${NC}"

# 查找 pnpm
PNPM=""
if command -v pnpm &> /dev/null; then
    PNPM="pnpm"
elif [ -f "/usr/local/bin/pnpm" ]; then
    PNPM="/usr/local/bin/pnpm"
elif [ -f "$(dirname $(which node))/../lib/node_modules/corepack/dist/corepack.js" ]; then
    # 使用 corepack
    corepack enable 2>/dev/null
    PNPM="pnpm"
fi

# 安装 pnpm
if [ -z "$PNPM" ]; then
    echo -e "${YELLOW}正在安装 pnpm...${NC}"
    npm install -g pnpm
    PNPM="pnpm"
fi

echo -e "${GREEN}pnpm: $PNPM${NC}"

# 安装依赖
echo -e "${YELLOW}正在安装依赖...${NC}"
$PNPM install --frozen-lockfile 2>/dev/null || $PNPM install

# 构建
echo -e "${YELLOW}正在构建项目（首次构建需要几分钟）...${NC}"
$PNPM run build

# 复制静态文件到 standalone 目录
echo -e "${YELLOW}复制静态文件...${NC}"
cp -r public .next/standalone/ 2>/dev/null || true
cp -r .next/static .next/standalone/.next/ 2>/dev/null || true

# 停止旧进程
echo -e "${YELLOW}停止旧服务...${NC}"
pm2 stop training-assistant 2>/dev/null || true
pm2 delete training-assistant 2>/dev/null || true

# 创建启动脚本
cat > start-server.sh << EOF
#!/bin/bash
cd "${PROJECT_DIR}"
export DATA_DIR="${DATA_DIR}"
export FILE_STORAGE_PATH="${FILE_STORAGE_PATH}"
export PORT=${PORT}
node .next/standalone/server.js
EOF
chmod +x start-server.sh

# 启动服务
echo -e "${YELLOW}正在启动服务...${NC}"
pm2 start start-server.sh --name "training-assistant"

# 保存 PM2 配置
pm2 save 2>/dev/null || true

# 显示状态
echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}部署完成！${NC}"
echo -e "${GREEN}========================================${NC}"

# 获取 IP
IP=$(hostname -I 2>/dev/null | awk '{print $1}')
if [ -z "$IP" ]; then
    IP="你的NAS_IP"
fi

echo -e "访问地址: ${YELLOW}http://${IP}:${PORT}${NC}"
echo ""
pm2 status
