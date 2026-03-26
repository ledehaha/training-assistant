#!/bin/bash
set -Eeuo pipefail

# ============================================================
# 环境加载脚本 - 加载不同环境的配置
# ============================================================
# 
# 用途：根据环境变量加载对应的配置文件
# 
# 使用方法：
#   bash scripts/load-env.sh development    # 加载开发环境配置
#   bash scripts/load-env.sh test           # 加载测试环境配置
#   bash scripts/load-env.sh production     # 加载生产环境配置
#   bash scripts/load-env.sh                # 自动检测环境
#
# 在其他脚本中使用：
#   source scripts/load-env.sh production
#
# ============================================================

PROJECT_ROOT="${COZE_WORKSPACE_PATH:-$(pwd)}"
cd "${PROJECT_ROOT}"

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 检测当前环境
detect_environment() {
    local env
    
    # 优先使用参数指定的环境
    if [[ -n "${1:-}" ]]; then
        env="$1"
    # 其次使用 NODE_ENV 环境变量
    elif [[ -n "${NODE_ENV:-}" ]]; then
        env="$NODE_ENV"
    # 最后使用默认环境（开发）
    else
        env="development"
    fi
    
    echo "$env"
}

# 验证环境名称
validate_environment() {
    local env=$1
    
    case $env in
        development|test|production)
            return 0
            ;;
        *)
            echo -e "${RED}错误: 无效的环境名称 '$env'${NC}"
            echo "支持的环境: development, test, production"
            return 1
            ;;
    esac
}

# 加载环境配置
load_environment_config() {
    local env=$1
    local env_file=".env.$env"
    
    if [[ ! -f "$env_file" ]]; then
        echo -e "${YELLOW}警告: 环境配置文件不存在: $env_file${NC}"
        echo "使用默认配置"
        return 0
    fi
    
    echo -e "${BLUE}加载环境配置: $env${NC}"
    
    # 加载配置文件
    set -a
    source "$env_file"
    set +a
    
    echo -e "${GREEN}✓ 环境配置已加载${NC}"
}

# 显示当前环境信息
show_environment_info() {
    local env=$1
    
    echo ""
    echo "========================================="
    echo "当前环境: $env"
    echo "========================================="
    echo "NODE_ENV: ${NODE_ENV:-未设置}"
    echo "PORT: ${PORT:-未设置}"
    echo "API_BASE_URL: ${API_BASE_URL:-未设置}"
    echo "LOG_LEVEL: ${LOG_LEVEL:-未设置}"
    echo "FEATURE_AI_ENABLED: ${FEATURE_AI_ENABLED:-未设置}"
    echo "========================================="
    echo ""
}

# 导出环境变量到进程
export_environment() {
    local env=$1
    
    # 导出关键环境变量
    export NODE_ENV="${NODE_ENV:-$env}"
    export PORT="${PORT:-5000}"
    export HOST="${HOST:-localhost}"
    export API_BASE_URL="${API_BASE_URL:-http://localhost:${PORT:-5000}/api}"
    export LOG_LEVEL="${LOG_LEVEL:-info}"
    export LOG_DIR="${LOG_DIR:-./logs}"
    
    # 导出特性开关
    export FEATURE_AI_ENABLED="${FEATURE_AI_ENABLED:-true}"
    export FEATURE_AUTO_CLEAN="${FEATURE_AUTO_CLEAN:-false}"
    export FEATURE_AUTO_UPDATE_CHECK="${FEATURE_AUTO_UPDATE_CHECK:-false}"
    
    # 导出性能配置
    export PERFORMANCE_MONITORING="${PERFORMANCE_MONITORING:-true}"
    export INSTALL_TIME_TRACKING="${INSTALL_TIME_TRACKING:-true}"
}

# 检查环境配置完整性
check_environment_completeness() {
    local env=$1
    local missing_vars=()
    
    # 检查必需的环境变量
    local required_vars=("NODE_ENV" "PORT")
    
    for var in "${required_vars[@]}"; do
        if [[ -z "${!var:-}" ]]; then
            missing_vars+=("$var")
        fi
    done
    
    if [[ ${#missing_vars[@]} -gt 0 ]]; then
        echo -e "${YELLOW}警告: 以下环境变量未设置: ${missing_vars[*]}${NC}"
        return 1
    fi
    
    echo -e "${GREEN}✓ 环境配置完整${NC}"
    return 0
}

# 显示帮助
show_help() {
    cat << EOF
环境加载脚本 - 用法

命令:
  bash scripts/load-env.sh              # 自动检测环境
  bash scripts/load-env.sh development  # 加载开发环境
  bash scripts/load-env.sh test         # 加载测试环境
  bash scripts/load-env.sh production   # 加载生产环境
  bash scripts/load-env.sh --info       # 显示当前环境信息
  bash scripts/load-env.sh --help       # 显示帮助信息

在其他脚本中使用:
  source scripts/load-env.sh production

环境配置文件:
  - .env.development  (开发环境)
  - .env.test         (测试环境)
  - .env.production   (生产环境)

环境变量:
  NODE_ENV                      环境名称
  PORT                          端口号
  HOST                          主机地址
  API_BASE_URL                  API 基础 URL
  LOG_LEVEL                     日志级别
  FEATURE_AI_ENABLED            AI 功能开关
  FEATURE_AUTO_CLEAN            自动清理开关
  FEATURE_AUTO_UPDATE_CHECK     自动更新检查开关
  PERFORMANCE_MONITORING        性能监控开关
  INSTALL_TIME_TRACKING         安装时间跟踪开关
EOF
}

# 主函数
main() {
    local env
    local show_info_only=false
    
    # 解析参数
    while [[ $# -gt 0 ]]; do
        case $1 in
            --info|-i)
                show_info_only=true
                shift
                ;;
            --help|-h)
                show_help
                exit 0
                ;;
            *)
                env="$1"
                shift
                ;;
        esac
    done
    
    # 检测环境
    env=$(detect_environment "$env")
    
    # 验证环境
    if ! validate_environment "$env"; then
        exit 1
    fi
    
    # 加载配置
    load_environment_config "$env"
    
    # 导出环境变量
    export_environment "$env"
    
    # 显示信息
    if [[ "$show_info_only" == "true" ]]; then
        show_environment_info "$env"
    fi
    
    # 检查完整性
    check_environment_completeness "$env"
}

# 如果直接运行此脚本，执行主函数
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
else
    # 如果被 source，不执行主函数
    : 
fi
