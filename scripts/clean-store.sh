#!/bin/bash
set -Eeuo pipefail

echo "========================================="
echo "pnpm Store 清理工具"
echo "========================================="
echo ""

PROJECT_ROOT="${COZE_WORKSPACE_PATH:-$(pwd)}"
cd "${PROJECT_ROOT}"

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 计算目录大小的函数
get_dir_size() {
    local dir=$1
    if [[ -d "$dir" ]]; then
        du -sh "$dir" 2>/dev/null | awk '{print $1}' || echo "0B"
    else
        echo "0B"
    fi
}

# 显示 store 状态
show_store_status() {
    echo "========================================="
    echo "当前 Store 状态"
    echo "========================================="
    
    local node_modules_size=$(get_dir_size "node_modules")
    local pnpm_store_size=$(get_dir_size ".pnpm-store")
    local next_cache_size=$(get_dir_size ".next")
    
    echo "node_modules:     $node_modules_size"
    echo ".pnpm-store:      $pnpm_store_size"
    echo ".next (缓存):     $next_cache_size"
    echo ""
}

# 清理函数
clean_pnpm_store() {
    echo "========================================="
    echo "清理 .pnpm-store..."
    echo "========================================="
    
    if [[ ! -d ".pnpm-store" ]]; then
        echo -e "${YELLOW}.pnpm-store 不存在，无需清理${NC}"
        return 0
    fi
    
    local old_size=$(get_dir_size ".pnpm-store")
    echo "当前大小: $old_size"
    
    # 停止相关进程
    echo "停止相关进程..."
    pkill -f "next" 2>/dev/null || true
    pkill -f "node" 2>/dev/null || true
    sleep 2
    
    # 备份当前状态
    if [[ -f "package.json" ]] && [[ -f "pnpm-lock.yaml" ]]; then
        echo -e "${GREEN}✓ package.json 和 pnpm-lock.yaml 存在，可以安全清理${NC}"
    else
        echo -e "${RED}错误: package.json 或 pnpm-lock.yaml 不存在${NC}"
        echo "无法安全清理，终止操作"
        return 1
    fi
    
    # 清理 store
    echo "删除 .pnpm-store..."
    rm -rf .pnpm-store
    
    local new_size=$(get_dir_size ".pnpm-store" 2>/dev/null || echo "0B")
    echo -e "${GREEN}✓ .pnpm-store 已清理${NC}"
    echo "释放空间: $old_size"
    echo ""
    
    # 可选：重新安装依赖
    read -p "是否重新安装依赖? (y/N) [默认N]: " reinstall
    reinstall=${reinstall:-n}
    
    if [[ $reinstall =~ ^[Yy]$ ]]; then
        echo ""
        echo "========================================="
        echo "重新安装依赖..."
        echo "========================================="
        pnpm install
    else
        echo -e "${YELLOW}跳过依赖重新安装${NC}"
        echo ""
        echo -e "${BLUE}提示: 下次运行 prepare.sh 或 dev.sh 时会自动安装依赖${NC}"
    fi
    
    return 0
}

# 清理所有缓存
clean_all_caches() {
    echo "========================================="
    echo "清理所有缓存..."
    echo "========================================="
    
    echo "停止相关进程..."
    pkill -f "next" 2>/dev/null || true
    pkill -f "node" 2>/dev/null || true
    sleep 2
    
    local total_saved=0
    
    # 清理 .pnpm-store
    if [[ -d ".pnpm-store" ]]; then
        local size=$(du -sb .pnpm-store 2>/dev/null | awk '{print $1}')
        echo "清理 .pnpm-store..."
        rm -rf .pnpm-store
        total_saved=$((total_saved + size))
        echo -e "${GREEN}✓ .pnpm-store 已清理${NC}"
    fi
    
    # 清理 .next
    if [[ -d ".next" ]]; then
        local size=$(du -sb .next 2>/dev/null | awk '{print $1}')
        echo "清理 .next 缓存..."
        rm -rf .next
        total_saved=$((total_saved + size))
        echo -e "${GREEN}✓ .next 已清理${NC}"
    fi
    
    # 清理 node_modules（可选）
    read -p "是否同时清理 node_modules? (y/N) [默认N]: " clean_modules
    clean_modules=${clean_modules:-n}
    
    if [[ $clean_modules =~ ^[Yy]$ ]]; then
        if [[ -d "node_modules" ]]; then
            local size=$(du -sb node_modules 2>/dev/null | awk '{print $1}')
            echo "清理 node_modules..."
            rm -rf node_modules
            total_saved=$((total_saved + size))
            echo -e "${GREEN}✓ node_modules 已清理${NC}"
        fi
    fi
    
    # 显示释放空间
    local total_saved_mb=$((total_saved / 1024 / 1024))
    echo ""
    echo -e "${GREEN}=========================================${NC}"
    echo -e "${GREEN}✓ 清理完成！${NC}"
    echo -e "${GREEN}=========================================${NC}"
    echo "释放空间: ${total_saved_mb} MB"
    echo ""
    
    # 提示重新安装
    if [[ $clean_modules =~ ^[Yy]$ ]]; then
        read -p "是否立即重新安装依赖? (y/N) [默认N]: " reinstall
        reinstall=${reinstall:-n}
        
        if [[ $reinstall =~ ^[Yy]$ ]]; then
            echo ""
            echo "重新安装依赖..."
            pnpm install
        else
            echo -e "${BLUE}提示: 运行 'bash scripts/prepare.sh' 来重新安装依赖${NC}"
        fi
    fi
}

# 主菜单
main() {
    show_store_status
    
    echo "========================================="
    echo "请选择操作："
    echo "========================================="
    echo "  1. 清理 .pnpm-store（推荐）"
    echo "  2. 清理所有缓存（.pnpm-store + .next + node_modules）"
    echo "  3. 仅查看状态"
    echo "  4. 退出"
    echo ""
    read -p "请输入选项 (1-4) [默认1]: " choice
    choice=${choice:-1}
    
    case $choice in
        1)
            echo ""
            clean_pnpm_store
            ;;
        2)
            echo ""
            clean_all_caches
            ;;
        3)
            echo ""
            show_store_status
            ;;
        4)
            echo "退出"
            exit 0
            ;;
        *)
            echo -e "${RED}无效选项${NC}"
            exit 1
            ;;
    esac
    
    echo ""
    echo -e "${GREEN}=========================================${NC}"
    echo -e "${GREEN}完成！${NC}"
    echo -e "${GREEN}=========================================${NC}"
}

# 命令行参数支持
case "${1:-}" in
    status)
        show_store_status
        ;;
    clean-store)
        clean_pnpm_store
        ;;
    clean-all)
        clean_all_caches
        ;;
    *)
        main
        ;;
esac
