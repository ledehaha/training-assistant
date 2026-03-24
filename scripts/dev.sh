#!/bin/bash
set -Eeuo pipefail

PROJECT_ROOT="${COZE_WORKSPACE_PATH:-$(pwd)}"
cd "${PROJECT_ROOT}"

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "========================================="
echo "启动开发服务器"
echo "========================================="
echo "工作目录: ${PROJECT_ROOT}"
echo ""

# 端口配置
PORT=5000
HOST="0.0.0.0"

# 检查依赖
if [[ ! -f "node_modules/.bin/next" ]]; then
    echo -e "${YELLOW}⚠  node_modules/.bin/next 不存在${NC}"
    echo "尝试自动修复..."
    
    # 检查 node_modules 目录
    if [[ ! -d "node_modules" ]]; then
        echo -e "${RED}✗ node_modules 不存在，请先运行: coze init${NC}"
        exit 1
    fi
    
    # 尝试重新安装
    echo "运行 pnpm install 修复..."
    if pnpm install --frozen-lockfile=false 2>&1 | tail -10; then
        echo ""
    else
        echo -e "${RED}✗ 修复失败，请运行: bash scripts/recover.sh${NC}"
        exit 1
    fi
    
    # 再次检查
    if [[ ! -f "node_modules/.bin/next" ]]; then
        echo -e "${RED}✗ 修复失败，node_modules/.bin/next 仍然不存在${NC}"
        echo ""
        echo "请运行完整恢复脚本："
        echo "  bash scripts/recover.sh"
        exit 1
    fi
    
    echo -e "${GREEN}✓ 依赖修复成功${NC}"
    echo ""
fi

# 检查端口占用
echo "检查端口 ${PORT}..."
if ss -tuln 2>/dev/null | grep -q ":${PORT}"; then
    echo -e "${YELLOW}⚠  端口 ${PORT} 已被占用${NC}"
    
    # 尝试优雅关闭现有服务
    echo "尝试关闭现有服务..."
    local pids=$(ss -H -lntp 2>/dev/null | awk -v port="${PORT}" '$4 ~ ":"port"$"' | grep -o 'pid=[0-9]*' | cut -d= -f2 | paste -sd' ' - || true)
    
    if [[ -n "$pids" ]]; then
        echo "发现进程: $pids"
        echo "$pids" | xargs -r kill -TERM 2>/dev/null || true
        
        # 等待进程退出
        local timeout=5
        while [[ $timeout -gt 0 ]] && ss -tuln 2>/dev/null | grep -q ":${PORT}"; do
            sleep 1
            timeout=$((timeout - 1))
        done
        
        # 如果还没退出，强制关闭
        if ss -tuln 2>/dev/null | grep -q ":${PORT}"; then
            echo -e "${YELLOW}优雅关闭失败，强制关闭...${NC}"
            echo "$pids" | xargs -r kill -9 2>/dev/null || true
            sleep 1
        fi
        
        echo -e "${GREEN}✓ 端口已释放${NC}"
    else
        echo -e "${RED}✗ 无法获取进程 ID${NC}"
        echo "请手动关闭占用端口的进程"
        exit 1
    fi
    echo ""
else
    echo -e "${GREEN}✓ 端口 ${PORT} 可用${NC}"
    echo ""
fi

# 清理 .next 缓存（如果损坏）
echo "检查 .next 缓存..."
if [[ -d ".next" ]] && [[ ! -f ".next/package.json" ]]; then
    echo -e "${YELLOW}⚠  .next 缓存可能损坏，正在清理...${NC}"
    rm -rf .next
    echo -e "${GREEN}✓ .next 缓存已清理${NC}"
    echo ""
else
    echo -e "${GREEN}✓ .next 缓存正常${NC}"
    echo ""
fi

# 确保日志目录存在
LOG_DIR="/app/work/logs/bypass"
mkdir -p "${LOG_DIR}"

# 检查 Next.js 可执行文件
echo "验证 Next.js 可执行文件..."
if [[ ! -x "node_modules/.bin/next" ]]; then
    echo -e "${YELLOW}⚠  next 文件不可执行，尝试修复权限...${NC}"
    chmod +x node_modules/.bin/next 2>/dev/null || true
fi

# 使用绝对路径
NEXT_BIN="${PROJECT_ROOT}/node_modules/.bin/next"

if [[ ! -f "$NEXT_BIN" ]]; then
    echo -e "${RED}✗ Next.js 可执行文件不存在: ${NEXT_BIN}${NC}"
    echo ""
    echo "请运行以下命令修复："
    echo "  bash scripts/recover.sh"
    exit 1
fi

echo -e "${GREEN}✓ Next.js 可执行文件: ${NEXT_BIN}${NC}"
echo ""

# 启动开发服务器
echo "========================================="
echo "启动 Next.js 开发服务器"
echo "========================================="
echo "命令: ${NEXT_BIN} dev"
echo "端口: ${PORT}"
echo "主机: ${HOST}"
echo "日志: ${LOG_DIR}/dev.log"
echo ""
echo "访问地址:"
if [[ -n "${COZE_PROJECT_DOMAIN_DEFAULT:-}" ]]; then
    echo "  https://${COZE_PROJECT_DOMAIN_DEFAULT}"
else
    echo "  http://localhost:${PORT}"
fi
echo ""
echo "按 Ctrl+C 停止服务"
echo "========================================="
echo ""

# 启动服务（前台运行，输出到控制台）
exec "${NEXT_BIN}" dev \
    --port "${PORT}" \
    --hostname "${HOST}" \
    2>&1 | tee -a "${LOG_DIR}/dev.log"
