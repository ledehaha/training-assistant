#!/bin/bash
set -Eeuo pipefail

echo "========================================="
echo "项目环境诊断与修复工具"
echo "========================================="
echo ""

PROJECT_ROOT="${COZE_WORKSPACE_PATH:-$(pwd)}"
cd "${PROJECT_ROOT}"

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 检查 pnpm 版本
check_pnpm_version() {
    echo "检查 pnpm 版本..."
    
    if ! command -v pnpm &> /dev/null; then
        echo -e "${RED}✗ pnpm 未安装${NC}"
        return 1
    fi
    
    PNPM_VERSION=$(pnpm --version)
    MIN_PNPM_VERSION="9.0.0"
    
    # 版本比较
    version_compare() {
        if [[ $1 == $2 ]]; then
            return 0
        fi
        local IFS=.
        local i ver1=($1) ver2=($2)
        for ((i=${#ver1[@]}; i<${#ver2[@]}; i++)); do
            ver1[i]=0
        done
        for ((i=0; i<${#ver1[@]}; i++)); do
            if [[ -z ${ver2[i]} ]]; then
                ver2[i]=0
            fi
            if ((10#${ver1[i]} > 10#${ver2[i]})); then
                return 1
            fi
            if ((10#${ver1[i]} < 10#${ver2[i]})); then
                return 2
            fi
        done
        return 0
    }
    
    version_compare "$PNPM_VERSION" "$MIN_PNPM_VERSION"
    VERSION_COMPARE_RESULT=$?
    
    if [[ $VERSION_COMPARE_RESULT -eq 2 ]]; then
        echo -e "${YELLOW}! pnpm 版本过低: $PNPM_VERSION (要求 >= $MIN_PNPM_VERSION)${NC}"
        echo "  建议: npm install -g pnpm@latest"
        return 1
    fi
    
    echo -e "${GREEN}✓ pnpm 版本: $PNPM_VERSION${NC}"
    return 0
}

# 检查函数
check_node_modules() {
    echo "检查 node_modules..."
    if [[ ! -d "node_modules" ]] || [[ ! -f "node_modules/.bin/next" ]]; then
        echo -e "${RED}✗ node_modules 不完整或缺失${NC}"
        return 1
    else
        echo -e "${GREEN}✓ node_modules 正常${NC}"
        return 0
    fi
}

check_next_binary() {
    echo "检查 Next.js 可执行文件..."
    if [[ ! -f "node_modules/.bin/next" ]]; then
        echo -e "${RED}✗ node_modules/.bin/next 不存在${NC}"
        return 1
    else
        echo -e "${GREEN}✓ Next.js 可执行文件存在${NC}"
        return 0
    fi
}

check_processes() {
    echo "检查运行中的进程..."
    local count=$(pgrep -f "next dev" 2>/dev/null | wc -l || echo 0)
    if [[ $count -gt 0 ]]; then
        echo -e "${YELLOW}! 发现 $count 个 next 进程正在运行${NC}"
        return 1
    else
        echo -e "${GREEN}✓ 没有 next 进程残留${NC}"
        return 0
    fi
}

check_port() {
    echo "检查端口 5000..."
    if ss -tuln 2>/dev/null | grep -q ":5000"; then
        echo -e "${YELLOW}! 端口 5000 被占用${NC}"
        ss -lntp 2>/dev/null | grep ":5000" | head -5
        return 1
    else
        echo -e "${GREEN}✓ 端口 5000 可用${NC}"
        return 0
    fi
}

check_cache() {
    echo "检查 .next 缓存..."
    if [[ -d ".next" ]]; then
        if [[ -f ".next/package.json" ]] && [[ -f ".next/build-manifest.json" ]]; then
            echo -e "${GREEN}✓ .next 缓存正常${NC}"
            return 0
        else
            echo -e "${YELLOW}! .next 缓存可能损坏${NC}"
            return 1
        fi
    else
        echo -e "${GREEN}✓ .next 缓存不存在（正常）${NC}"
        return 0
    fi
}

# 修复函数
fix_node_modules() {
    echo ""
    echo "========================================="
    echo "修复 node_modules..."
    echo "========================================="
    
    echo "停止所有相关进程..."
    pkill -f "next" 2>/dev/null || true
    pkill -f "node" 2>/dev/null || true
    sleep 2
    
    echo "删除 node_modules 和 pnpm store..."
    rm -rf node_modules .pnpm-store
    
    echo "重新安装依赖..."
    pnpm install 2>&1 | tail -20
    
    if [[ -f "node_modules/.bin/next" ]]; then
        echo -e "${GREEN}✓ node_modules 修复成功${NC}"
        return 0
    else
        echo -e "${RED}✗ node_modules 修复失败${NC}"
        return 1
    fi
}

fix_cache() {
    echo ""
    echo "========================================="
    echo "修复 .next 缓存..."
    echo "========================================="
    
    echo "停止服务..."
    pkill -f "next dev" 2>/dev/null || true
    sleep 2
    
    echo "删除 .next 缓存..."
    rm -rf .next
    
    echo -e "${GREEN}✓ .next 缓存已清理${NC}"
}

fix_port() {
    echo ""
    echo "========================================="
    echo "释放端口 5000..."
    echo "========================================="
    
    local pids=$(ss -H -lntp 2>/dev/null | awk -v port="5000" '$4 ~ ":"port"$"' | grep -o 'pid=[0-9]*' | cut -d= -f2 | paste -sd' ' - || true)
    
    if [[ -n "$pids" ]]; then
        echo "终止占用端口的进程: $pids"
        echo "$pids" | xargs -r kill -9 2>/dev/null || true
        sleep 1
        echo -e "${GREEN}✓ 端口已释放${NC}"
    else
        echo -e "${GREEN}✓ 端口未被占用${NC}"
    fi
}

# 快速修复（全部问题）
fix_all() {
    echo ""
    echo "========================================="
    echo "执行完整修复..."
    echo "========================================="
    
    fix_port
    fix_cache
    fix_node_modules
    
    echo ""
    echo -e "${GREEN}=========================================${NC}"
    echo -e "${GREEN}修复完成！${NC}"
    echo -e "${GREEN}=========================================${NC}"
    echo ""
    echo "请运行以下命令启动服务："
    echo "  coze dev"
    echo ""
}

# 主逻辑
main() {
    echo ""
    echo "开始诊断..."
    echo ""
    
    local has_issues=0
    
    check_pnpm_version || has_issues=1
    check_node_modules || has_issues=1
    check_next_binary || has_issues=1
    check_processes || has_issues=1
    check_port || has_issues=1
    check_cache || has_issues=1
    
    echo ""
    echo "========================================="
    if [[ $has_issues -eq 0 ]]; then
        echo -e "${GREEN}✓ 所有检查通过，环境正常${NC}"
        echo ""
        echo "您可以直接运行以下命令启动服务："
        echo "  coze dev"
    else
        echo -e "${YELLOW}! 发现环境问题${NC}"
        echo ""
        echo "请选择修复方案："
        echo "  1. 自动修复所有问题（推荐）"
        echo "  2. 仅修复 node_modules"
        echo "  3. 仅清理 .next 缓存"
        echo "  4. 仅释放端口"
        echo ""
        read -p "请输入选项 (1-4) [默认1]: " choice
        choice=${choice:-1}
        
        case $choice in
            1)
                fix_all
                ;;
            2)
                fix_node_modules
                ;;
            3)
                fix_cache
                ;;
            4)
                fix_port
                ;;
            *)
                echo "无效选项，退出"
                exit 1
                ;;
        esac
    fi
    echo "========================================="
}

# 如果有参数，执行对应操作
case "${1:-}" in
    check)
        check_pnpm_version
        check_node_modules
        check_next_binary
        check_processes
        check_port
        check_cache
        ;;
    fix-all)
        fix_all
        ;;
    fix-modules)
        fix_node_modules
        ;;
    fix-cache)
        fix_cache
        ;;
    fix-port)
        fix_port
        ;;
    *)
        main
        ;;
esac
