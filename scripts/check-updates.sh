#!/bin/bash
set -Eeuo pipefail

# ============================================================
# 依赖更新检查脚本 - 检查依赖是否有安全更新
# ============================================================
# 
# 用途：定期检查项目依赖的更新，特别是安全更新
# 
# 使用方法：
#   bash scripts/check-updates.sh              # 检查所有更新
#   bash scripts/check-updates.sh --security   # 仅检查安全更新
#   bash scripts/check-updates.sh --help       # 显示帮助信息
#
# ============================================================

echo "========================================="
echo "依赖更新检查"
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
LOG_FILE="${LOG_DIR}/check-updates.log"

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

# 检查 pnpm 是否可用
check_pnpm() {
    if ! command -v pnpm &> /dev/null; then
        log ERROR "pnpm 未安装"
        exit 1
    fi
    log INFO "pnpm 版本: $(pnpm --version)"
}

# 检查过时的依赖
check_outdated() {
    log INFO "检查过时的依赖..."
    
    # 使用 pnpm outdated 检查
    local outdated_output
    outdated_output=$(pnpm outdated --long 2>&1 || true)
    
    if [[ -z "$outdated_output" ]]; then
        log SUCCESS "所有依赖都是最新的"
        return 0
    fi
    
    # 解析输出
    local count=0
    echo ""
    echo "========================================="
    echo "可更新的依赖"
    echo "========================================="
    echo "$outdated_output" | grep -v "Package" | grep -v "Wanted" | grep -v "Latest" | grep -v "---" | while read -r line; do
        if [[ -n "$line" ]]; then
            echo "$line"
            count=$((count + 1))
        fi
    done
    
    if [[ $count -gt 0 ]]; then
        log WARNING "发现 $count 个可更新的依赖"
    fi
    echo ""
}

# 检查安全漏洞
check_audits() {
    log INFO "检查安全漏洞..."
    
    # 使用 pnpm audit 检查
    local audit_output
    audit_output=$(pnpm audit --json 2>&1 || echo '{"vulnerabilities":{}}')
    
    # 提取漏洞信息
    local vulnerabilities
    vulnerabilities=$(echo "$audit_output" | grep -o '"vulnerabilities"' || echo "")
    
    if [[ -z "$vulnerabilities" ]]; then
        log SUCCESS "未发现安全漏洞"
        return 0
    fi
    
    # 解析漏洞数量
    local total_vulns=$(echo "$audit_output" | grep -o '"metadata"' -A 10 | grep -o '"vulnerabilities":' -A 1 | grep -o '[0-9]*' | head -1 || echo "0")
    
    if [[ "$total_vulns" -eq 0 ]]; then
        log SUCCESS "未发现安全漏洞"
        return 0
    fi
    
    log ERROR "发现 $total_vulns 个安全漏洞！"
    echo ""
    echo "========================================="
    echo "安全漏洞详情"
    echo "========================================="
    echo "$audit_output" | grep -o '"advisoryPath"' -A 20 | head -100
    echo ""
    
    log WARNING "请运行以下命令修复漏洞："
    echo "  pnpm audit fix"
    echo ""
}

# 生成更新报告
generate_report() {
    log INFO "生成更新报告..."
    
    local report_file="${LOG_DIR}/update-report-$(date '+%Y%m%d-%H%M%S').txt"
    
    cat > "$report_file" << EOF
依赖更新检查报告
===============================

检查时间: $(date '+%Y-%m-%d %H:%M:%S')
项目路径: $PROJECT_ROOT
pnpm 版本: $(pnpm --version)

================================
过时的依赖
================================
$(pnpm outdated --long 2>&1 || echo "无")

================================
安全检查
================================
$(pnpm audit --json 2>&1 | grep -o '"metadata"' -A 10 || echo "无")

================================
建议
================================
1. 定期运行 'pnpm outdated' 查看可更新的依赖
2. 定期运行 'pnpm audit' 检查安全漏洞
3. 使用 'pnpm update' 更新依赖
4. 使用 'pnpm audit fix' 修复安全漏洞

===============================
报告结束
===============================
EOF
    
    log SUCCESS "报告已生成: $report_file"
}

# 自动修复安全漏洞
fix_vulnerabilities() {
    log INFO "尝试自动修复安全漏洞..."
    
    # pnpm audit fix 会自动修复漏洞
    pnpm audit fix 2>&1 | tee -a "$LOG_FILE"
    
    if [[ $? -eq 0 ]]; then
        log SUCCESS "安全漏洞已自动修复"
    else
        log WARNING "部分漏洞需要手动修复"
    fi
}

# 显示帮助
show_help() {
    cat << EOF
依赖更新检查脚本 - 用法

命令:
  bash scripts/check-updates.sh              # 检查所有更新
  bash scripts/check-updates.sh --security   # 仅检查安全更新
  bash scripts/check-updates.sh --fix        # 检查并尝试修复安全漏洞
  bash scripts/check-updates.sh --report     # 生成详细报告
  bash scripts/check-updates.sh --help       # 显示帮助信息

日志文件: $LOG_FILE

定时任务示例:
  # 每周日凌晨 3:00 检查更新
  0 3 * * 0 cd $PROJECT_ROOT && bash scripts/check-updates.sh >> $LOG_FILE 2>&1
  
  # 每天凌晨 4:00 检查安全更新
  0 4 * * * cd $PROJECT_ROOT && bash scripts/check-updates.sh --security >> $LOG_FILE 2>&1
EOF
}

# 主函数
main() {
    # 检查 pnpm
    check_pnpm
    
    # 解析参数
    local mode="all"
    local auto_fix=false
    
    while [[ $# -gt 0 ]]; do
        case $1 in
            --security)
                mode="security"
                shift
                ;;
            --fix)
                auto_fix=true
                shift
                ;;
            --report)
                generate_report
                exit 0
                ;;
            --help|-h)
                show_help
                exit 0
                ;;
            *)
                shift
                ;;
        esac
    done
    
    # 根据模式执行检查
    case $mode in
        security)
            check_audits
            if [[ "$auto_fix" == "true" ]]; then
                fix_vulnerabilities
            fi
            ;;
        all)
            check_outdated
            check_audits
            if [[ "$auto_fix" == "true" ]]; then
                fix_vulnerabilities
            fi
            ;;
    esac
    
    # 输出总结
    echo ""
    log SUCCESS "========================================="
    log SUCCESS "检查完成"
    log SUCCESS "========================================="
    log SUCCESS "完成时间: $(date '+%Y-%m-%d %H:%M:%S')"
    echo ""
}

# 运行主函数
main "$@"
