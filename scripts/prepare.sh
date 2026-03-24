#!/bin/bash
set -Eeuo pipefail

# 项目根目录
PROJECT_ROOT="${COZE_WORKSPACE_PATH:-$(pwd)}"
cd "${PROJECT_ROOT}"

echo "========================================="
echo "项目依赖安装"
echo "========================================="
echo "工作目录: ${PROJECT_ROOT}"
echo ""

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 检查 pnpm
if ! command -v pnpm &> /dev/null; then
    echo -e "${RED}错误: pnpm 未安装${NC}"
    echo "请先安装 pnpm: npm install -g pnpm"
    exit 1
fi

echo "pnpm 版本: $(pnpm --version)"
echo ""

# 检查 package.json
if [[ ! -f "package.json" ]]; then
    echo -e "${RED}错误: package.json 不存在${NC}"
    exit 1
fi

# 检查 lockfile
if [[ ! -f "pnpm-lock.yaml" ]]; then
    echo -e "${YELLOW}警告: pnpm-lock.yaml 不存在，将生成新的锁文件${NC}"
fi

# 检查 node_modules 是否需要重新安装
NEED_INSTALL=0
if [[ ! -d "node_modules" ]]; then
    echo "node_modules 不存在，需要安装"
    NEED_INSTALL=1
elif [[ ! -f "node_modules/.bin/next" ]]; then
    echo -e "${YELLOW}node_modules/.bin/next 不存在，需要重新安装${NC}"
    NEED_INSTALL=1
elif [[ ! -f "package.json" ]] || [[ ! -f "pnpm-lock.yaml" ]]; then
    echo -e "${YELLOW}package.json 或 pnpm-lock.yaml 已更改，需要重新安装${NC}"
    NEED_INSTALL=1
else
    echo "node_modules 已存在且完整"
fi

echo ""

# 安装依赖
if [[ $NEED_INSTALL -eq 1 ]]; then
    echo "========================================="
    echo "开始安装依赖..."
    echo "========================================="
    
    # 清理旧的 node_modules（如果存在但可能损坏）
    if [[ -d "node_modules" ]] && [[ ! -f "node_modules/.bin/next" ]]; then
        echo -e "${YELLOW}检测到损坏的 node_modules，正在清理...${NC}"
        rm -rf node_modules .pnpm-store
        echo ""
    fi
    
    # 使用不带 --prefer-frozen-lockfile 的安装，更灵活
    echo "运行: pnpm install"
    echo ""
    
    if pnpm install; then
        echo ""
        echo -e "${GREEN}=========================================${NC}"
        echo -e "${GREEN}✓ 依赖安装成功${NC}"
        echo -e "${GREEN}=========================================${NC}"
    else
        echo ""
        echo -e "${RED}=========================================${NC}"
        echo -e "${RED}✗ 依赖安装失败${NC}"
        echo -e "${RED}=========================================${NC}"
        echo ""
        echo "尝试以下修复方案："
        echo "  1. 运行恢复脚本: bash scripts/recover.sh"
        echo "  2. 手动清理: rm -rf node_modules pnpm-lock.yaml && pnpm install"
        exit 1
    fi
else
    echo "依赖已是最新，跳过安装"
fi

echo ""

# 验证关键依赖
echo "========================================="
echo "验证关键依赖..."
echo "========================================="

VERIFY_ERRORS=0

# 检查 Next.js
if [[ -f "node_modules/.bin/next" ]]; then
    echo -e "${GREEN}✓ Next.js 已安装${NC}"
else
    echo -e "${RED}✗ Next.js 未安装${NC}"
    VERIFY_ERRORS=1
fi

# 检查 React
if [[ -d "node_modules/react" ]]; then
    echo -e "${GREEN}✓ React 已安装${NC}"
else
    echo -e "${RED}✗ React 未安装${NC}"
    VERIFY_ERRORS=1
fi

# 检查 TypeScript
if [[ -d "node_modules/typescript" ]]; then
    echo -e "${GREEN}✓ TypeScript 已安装${NC}"
else
    echo -e "${RED}✗ TypeScript 未安装${NC}"
    VERIFY_ERRORS=1
fi

# 检查 shadcn/ui 相关包
if [[ -d "node_modules/@radix-ui" ]]; then
    echo -e "${GREEN}✓ Radix UI (shadcn/ui) 已安装${NC}"
else
    echo -e "${YELLOW}! Radix UI 未安装${NC}"
fi

echo ""

if [[ $VERIFY_ERRORS -ne 0 ]]; then
    echo -e "${RED}错误: 关键依赖缺失${NC}"
    echo ""
    echo "请运行以下命令重新安装："
    echo "  bash scripts/recover.sh"
    exit 1
fi

echo -e "${GREEN}=========================================${NC}"
echo -e "${GREEN}✓ 准备工作完成${NC}"
echo -e "${GREEN}=========================================${NC}"
echo ""
echo "下一步：运行开发服务器"
echo "  coze dev"
