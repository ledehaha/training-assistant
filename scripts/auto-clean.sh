#!/bin/bash
set -Eeuo pipefail

# ============================================================
# 自动清理脚本 - 可用于定时任务
# ============================================================
# 
# 用途：定期清理 .pnpm-store 和缓存，保持项目环境健康
# 
# 使用方法：
#   1. 手动运行: bash scripts/auto-clean.sh
#   2. 定时任务: 添加到 crontab
#      crontab -e
#      # 每周日凌晨 2:00 自动清理
#      0 2 * * 0 cd /workspace/projects && bash scripts/auto-clean.sh >> /workspace/projects/logs/auto-clean.log 2>&1
#
# ============================================================

echo "========================================="
echo "自动清理任务"
echo "========================================="
echo "开始时间: $(date '+%Y-%m-%d %H:%M:%S')"
echo ""

PROJECT_ROOT="${COZE_WORKSPACE_PATH:-$(pwd)}"
cd "${PROJECT_ROOT}"

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 日志文件
LOG_DIR="${PROJECT_ROOT}/logs"
LOG_FILE="${LOG_DIR}/auto-clean.log"

# 创建日志目录
mkdir -p "$LOG_DIR"

# 日志函数
log() {
    local level=$1
    local message=$2
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    
    case $level in
        INFO)
            echo -e "${BLUE}[INFO]${NC} $message"
            echo "[$timestamp] [INFO] $message" >> "$LOG_FILE"
            ;;
        SUCCESS)
            echo -e "${GREEN}[SUCCESS]${NC} $message"
            echo "[$timestamp] [SUCCESS] $message" >> "$LOG_FILE"
            ;;
        WARNING)
            echo -e "${YELLOW}[WARNING]${NC} $message"
            echo "[$timestamp] [WARNING] $message" >> "$LOG_FILE"
            ;;
        ERROR)
            echo -e "${RED}[ERROR]${NC} $message"
            echo "[$timestamp] [ERROR] $message" >> "$LOG_FILE"
            ;;
    esac
}

# 计算目录大小的函数
get_dir_size() {
    local dir=$1
    if [[ -d "$dir" ]]; then
        du -sb "$dir" 2>/dev/null | awk '{print $1}' || echo "0"
    else
        echo "0"
    fi
}

# 格式化大小函数
format_size() {
    local bytes=$1
    if [[ $bytes -lt 1024 ]]; then
        echo "${bytes}B"
    elif [[ $bytes -lt 1048576 ]]; then
        echo "$((bytes / 1024))KB"
    elif [[ $bytes -lt 1073741824 ]]; then
        echo "$((bytes / 1048576))MB"
    else
        echo "$((bytes / 1073741824))GB"
    fi
}

# 清理配置
AUTO_CLEAN_CONFIG="${PROJECT_ROOT}/.auto-clean-config"

# 加载配置
load_config() {
    local max_store_size_mb=500
    local max_next_size_mb=1000
    local auto_clean_store=true
    local auto_clean_next=true
    local auto_install_deps=true  # 清理后自动重新安装依赖
    
    if [[ -f "$AUTO_CLEAN_CONFIG" ]]; then
        source "$AUTO_CLEAN_CONFIG"
        log INFO "已加载配置文件: $AUTO_CLEAN_CONFIG"
    else
        log WARNING "配置文件不存在，使用默认配置"
    fi
    
    echo "MAX_STORE_SIZE_MB=${max_store_size_mb}"
    echo "MAX_NEXT_SIZE_MB=${max_next_size_mb}"
    echo "AUTO_CLEAN_STORE=${auto_clean_store}"
    echo "AUTO_CLEAN_NEXT=${auto_clean_next}"
    echo "AUTO_INSTALL_DEPS=${auto_install_deps}"
}

# 执行清理
do_clean() {
    local total_cleaned=0
    local cleaned_items=0
    
    # 1. 清理 .pnpm-store
    if [[ "$AUTO_CLEAN_STORE" == "true" ]]; then
        log INFO "检查 .pnpm-store..."
        
        if [[ -d ".pnpm-store" ]]; then
            local store_size=$(get_dir_size ".pnpm-store")
            local store_size_mb=$((store_size / 1048576))
            
            log INFO ".pnpm-store 大小: $(format_size $store_size)"
            
            if [[ $store_size_mb -ge $max_store_size_mb ]]; then
                log WARNING ".pnpm-store 超过阈值 ($max_store_size_mb MB)，开始清理..."
                
                # 停止相关进程
                pkill -f "next" 2>/dev/null || true
                pkill -f "node" 2>/dev/null || true
                sleep 2
                
                # 备份状态
                if [[ -f "package.json" ]] && [[ -f "pnpm-lock.yaml" ]]; then
                    rm -rf .pnpm-store
                    local freed=$store_size
                    total_cleaned=$((total_cleaned + freed))
                    cleaned_items=$((cleaned_items + 1))
                    log SUCCESS ".pnpm-store 已清理，释放: $(format_size $freed)"
                else
                    log ERROR "package.json 或 pnpm-lock.yaml 不存在，跳过清理"
                fi
            else
                log INFO ".pnpm-store 大小正常，无需清理"
            fi
        else
            log INFO ".pnpm-store 不存在，无需清理"
        fi
    else
        log INFO "AUTO_CLEAN_STORE=false，跳过 .pnpm-store 清理"
    fi
    
    # 2. 清理 .next 缓存
    if [[ "$AUTO_CLEAN_NEXT" == "true" ]]; then
        log INFO "检查 .next 缓存..."
        
        if [[ -d ".next" ]]; then
            local next_size=$(get_dir_size ".next")
            local next_size_mb=$((next_size / 1048576))
            
            log INFO ".next 大小: $(format_size $next_size)"
            
            if [[ $next_size_mb -ge $max_next_size_mb ]]; then
                log WARNING ".next 缓存超过阈值 ($max_next_size_mb MB)，开始清理..."
                
                rm -rf .next
                local freed=$next_size
                total_cleaned=$((total_cleaned + freed))
                cleaned_items=$((cleaned_items + 1))
                log SUCCESS ".next 缓存已清理，释放: $(format_size $freed)"
            else
                log INFO ".next 缓存大小正常，无需清理"
            fi
        else
            log INFO ".next 缓存不存在，无需清理"
        fi
    else
        log INFO "AUTO_CLEAN_NEXT=false，跳过 .next 缓存清理"
    fi
    
    # 3. 清理 pnpm 缓存
    log INFO "清理 pnpm 全局缓存..."
    pnpm store prune 2>&1 | grep -E "removing|removed|pruned" || true
    log SUCCESS "pnpm 全局缓存已清理"
    
    # 4. 检查并重新安装依赖
    if [[ "$AUTO_INSTALL_DEPS" == "true" ]]; then
        if [[ ! -d "node_modules" ]] || [[ ! -f "node_modules/.bin/next" ]]; then
            log WARNING "检测到 node_modules 不完整或不存在，开始重新安装依赖..."
            
            # 记录安装开始时间
            local install_start_time=$(date +%s)
            
            if pnpm install; then
                local install_end_time=$(date +%s)
                local install_duration=$((install_end_time - install_start_time))
                local install_minutes=$((install_duration / 60))
                local install_seconds=$((install_duration % 60))
                
                log SUCCESS "依赖安装成功，耗时: ${install_minutes}分${install_seconds}秒"
            else
                log ERROR "依赖安装失败，请手动运行: pnpm install"
            fi
        else
            log INFO "node_modules 完整，无需重新安装依赖"
        fi
    else
        log INFO "AUTO_INSTALL_DEPS=false，跳过依赖安装"
    fi
    
    # 输出总结
    echo ""
    log SUCCESS "========================================="
    log SUCCESS "清理完成"
    log SUCCESS "========================================="
    log SUCCESS "清理项目数: $cleaned_items"
    log SUCCESS "释放空间: $(format_size $total_cleaned)"
    log SUCCESS "完成时间: $(date '+%Y-%m-%d %H:%M:%S')"
    
    # 记录到日志文件
    echo "" >> "$LOG_FILE"
    echo "=========================================" >> "$LOG_FILE"
    echo "清理总结" >> "$LOG_FILE"
    echo "=========================================" >> "$LOG_FILE"
    echo "清理项目数: $cleaned_items" >> "$LOG_FILE"
    echo "释放空间: $(format_size $total_cleaned)" >> "$LOG_FILE"
    echo "完成时间: $(date '+%Y-%m-%d %H:%M:%S')" >> "$LOG_FILE"
    echo "" >> "$LOG_FILE"
}

# 生成默认配置
generate_config() {
    cat > "$AUTO_CLEAN_CONFIG" << 'EOF'
# 自动清理配置文件
# 此文件控制 auto-clean.sh 的行为

# .pnpm-store 最大大小（MB），超过此值自动清理
MAX_STORE_SIZE_MB=500

# .next 缓存最大大小（MB），超过此值自动清理
MAX_NEXT_SIZE_MB=1000

# 是否自动清理 .pnpm-store
AUTO_CLEAN_STORE=true

# 是否自动清理 .next 缓存
AUTO_CLEAN_NEXT=true

# 清理后是否自动重新安装依赖（推荐设置为 true）
# 设置为 true 可以避免 "node_modules/.bin/next 不存在" 的问题
AUTO_INSTALL_DEPS=true
EOF
    
    log SUCCESS "已生成默认配置文件: $AUTO_CLEAN_CONFIG"
}

# 显示帮助
show_help() {
    cat << EOF
自动清理脚本 - 用法

命令:
  bash scripts/auto-clean.sh              # 执行自动清理
  bash scripts/auto-clean.sh --config     # 生成默认配置文件
  bash scripts/auto-clean.sh --help       # 显示帮助信息

配置文件: $AUTO_CLEAN_CONFIG

定时任务示例:
  # 每周日凌晨 2:00 自动清理
  0 2 * * 0 cd $PROJECT_ROOT && bash scripts/auto-clean.sh >> $LOG_FILE 2>&1
  
  # 每天凌晨 3:00 自动清理
  0 3 * * * cd $PROJECT_ROOT && bash scripts/auto-clean.sh >> $LOG_FILE 2>&1
  
  # 每月1号凌晨 1:00 自动清理
  0 1 1 * * cd $PROJECT_ROOT && bash scripts/auto-clean.sh >> $LOG_FILE 2>&1

日志文件: $LOG_FILE
EOF
}

# 主函数
main() {
    case "${1:-}" in
        --help|-h)
            show_help
            exit 0
            ;;
        --config)
            generate_config
            exit 0
            ;;
        *)
            # 加载配置
            eval "$(load_config)"
            
            # 执行清理
            do_clean
            ;;
    esac
}

# 运行主函数
main "$@"
