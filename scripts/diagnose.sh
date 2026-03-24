#!/bin/bash

# 快速诊断脚本
# 用于快速检查环境状态和常见问题

PROJECT_ROOT="${COZE_WORKSPACE_PATH:-$(pwd)}"
cd "${PROJECT_ROOT}"

echo "========================================="
echo "环境快速诊断"
echo "========================================="
echo "时间: $(date '+%Y-%m-%d %H:%M:%S')"
echo "目录: ${PROJECT_ROOT}"
echo ""

# 颜色
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# 统计
TOTAL_CHECKS=0
PASSED_CHECKS=0
WARNING_CHECKS=0
FAILED_CHECKS=0

# 检查函数
check() {
    local name=$1
    local condition=$2
    local severity=$3  # pass, warn, fail
    
    TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
    
    case $severity in
        pass)
            PASSED_CHECKS=$((PASSED_CHECKS + 1))
            echo -e "${GREEN}✓${NC} ${name}"
            ;;
        warn)
            WARNING_CHECKS=$((WARNING_CHECKS + 1))
            echo -e "${YELLOW}!${NC} ${name}"
            ;;
        fail)
            FAILED_CHECKS=$((FAILED_CHECKS + 1))
            echo -e "${RED}✗${NC} ${name}"
            ;;
    esac
}

echo "1. 文件系统检查"
echo "-----------------------------------------"

# 检查关键文件
[[ -f "package.json" ]] && check "package.json 存在" "true" "pass" || check "package.json 存在" "true" "fail"
[[ -f "pnpm-lock.yaml" ]] && check "pnpm-lock.yaml 存在" "true" "pass" || check "pnpm-lock.yaml 存在" "true" "fail"
[[ -f ".coze" ]] && check ".coze 配置文件存在" "true" "pass" || check ".coze 配置文件存在" "true" "fail"
[[ -f "tsconfig.json" ]] && check "tsconfig.json 存在" "true" "pass" || check "tsconfig.json 存在" "true" "fail"

echo ""
echo "2. 依赖检查"
echo "-----------------------------------------"

# 检查 node_modules
[[ -d "node_modules" ]] && check "node_modules 目录存在" "true" "pass" || check "node_modules 目录存在" "true" "fail"
[[ -f "node_modules/.bin/next" ]] && check "node_modules/.bin/next 存在" "true" "pass" || check "node_modules/.bin/next 存在" "true" "fail"
[[ -x "node_modules/.bin/next" ]] && check "next 可执行" "true" "pass" || check "next 可执行" "true" "warn"
[[ -d "node_modules/react" ]] && check "React 已安装" "true" "pass" || check "React 已安装" "true" "fail"
[[ -d "node_modules/typescript" ]] && check "TypeScript 已安装" "true" "pass" || check "TypeScript 已安装" "true" "fail"
[[ -d "node_modules/@radix-ui" ]] && check "Radix UI 已安装" "true" "pass" || check "Radix UI 已安装" "true" "warn"

echo ""
echo "3. 构建配置检查"
echo "-----------------------------------------"

# 检查配置文件
[[ -f "next.config.ts" ]] && check "next.config.ts 存在" "true" "pass" || check "next.config.ts 存在" "true" "fail"
# 注意：本项目使用 Tailwind CSS v4，不需要 tailwind.config.ts 配置文件
[[ -d "src/app" ]] && check "src/app 目录存在" "true" "pass" || check "src/app 目录存在" "true" "fail"

echo ""
echo "4. 运行时检查"
echo "-----------------------------------------"

# 检查 .next 缓存
if [[ -d ".next" ]]; then
    if [[ -f ".next/package.json" ]]; then
        check ".next 缓存正常" "true" "pass"
    else
        check ".next 缓存可能损坏" "true" "warn"
    fi
else
    check ".next 缓存不存在（正常）" "true" "pass"
fi

# 检查端口占用
if ss -tuln 2>/dev/null | grep -q ":5000"; then
    check "端口 5000 被占用" "true" "warn"
else
    check "端口 5000 可用" "true" "pass"
fi

# 检查进程
if pgrep -f "next dev" > /dev/null 2>&1; then
    count=$(pgrep -f "next dev" 2>/dev/null | wc -l || echo 0)
    check "有 ${count} 个 next 进程运行中" "true" "warn"
else
    check "没有 next 进程运行" "true" "pass"
fi

echo ""
echo "5. 磁盘空间"
echo "-----------------------------------------"

# 检查磁盘空间
free_space=$(df -h "${PROJECT_ROOT}" 2>/dev/null | awk 'NR==2 {print $4}' || echo "N/A")
free_percent=$(df -h "${PROJECT_ROOT}" 2>/dev/null | awk 'NR==2 {print $5}' | tr -d '%' || echo "N/A")

echo "可用空间: ${free_space}"
echo "使用率: ${free_percent}%"

if [[ "${free_percent}" != "N/A" ]] && [[ ${free_percent} -gt 90 ]]; then
    check "磁盘空间不足" "true" "fail"
else
    check "磁盘空间充足" "true" "pass"
fi

echo ""
echo "6. Next.js 版本"
echo "-----------------------------------------"

if [[ -f "node_modules/next/package.json" ]]; then
    next_version=$(node -e "console.log(require('./node_modules/next/package.json').version)" 2>/dev/null || echo "N/A")
    echo "Next.js 版本: ${next_version}"
    check "Next.js 版本可读取" "true" "pass"
else
    check "Next.js 版本不可读取" "true" "fail"
fi

echo ""
echo "========================================="
echo "诊断总结"
echo "========================================="
echo -e "总检查项: ${TOTAL_CHECKS}"
echo -e "${GREEN}通过: ${PASSED_CHECKS}${NC}"
echo -e "${YELLOW}警告: ${WARNING_CHECKS}${NC}"
echo -e "${RED}失败: ${FAILED_CHECKS}${NC}"
echo ""

# 建议
if [[ ${FAILED_CHECKS} -gt 0 ]]; then
    echo -e "${RED}发现问题，建议执行以下操作:${NC}"
    echo "  bash scripts/recover.sh"
    echo ""
fi

if [[ ${WARNING_CHECKS} -gt 0 ]]; then
    echo -e "${YELLOW}发现警告，可能需要关注:${NC}"
    echo ""
fi

if [[ ${FAILED_CHECKS} -eq 0 ]] && [[ ${WARNING_CHECKS} -eq 0 ]]; then
    echo -e "${GREEN}环境状态良好！${NC}"
    echo "可以运行: coze dev"
    echo ""
fi

echo "========================================="
