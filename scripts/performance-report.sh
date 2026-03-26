#!/bin/bash
set -Eeuo pipefail

# ============================================================
# 性能监控报告脚本 - 分析性能数据
# ============================================================
# 
# 用途：生成性能监控报告，分析依赖安装时间等性能指标
# 
# 使用方法：
#   bash scripts/performance-report.sh             # 生成最新报告
#   bash scripts/performance-report.sh --all       # 生成完整历史报告
#   bash scripts/performance-report.sh --help      # 显示帮助信息
#
# ============================================================

echo "========================================="
echo "性能监控报告"
echo "========================================="
echo "报告时间: $(date '+%Y-%m-%d %H:%M:%S')"
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
PERF_LOG="${PROJECT_ROOT}/logs/performance.log"
REPORT_DIR="${PROJECT_ROOT}/reports"

# 创建报告目录
mkdir -p "$REPORT_DIR"

# 检查日志文件
check_log_file() {
    if [[ ! -f "$PERF_LOG" ]]; then
        echo -e "${YELLOW}警告: 性能日志文件不存在${NC}"
        echo "路径: $PERF_LOG"
        echo "请先运行 prepare.sh 安装依赖以生成性能数据"
        exit 1
    fi
    
    if [[ ! -s "$PERF_LOG" ]]; then
        echo -e "${YELLOW}警告: 性能日志文件为空${NC}"
        exit 1
    fi
}

# 提取安装时间数据
extract_install_data() {
    grep "依赖安装" "$PERF_LOG" | awk '
    {
        timestamp = $1
        sub(/\[/, "", timestamp)
        sub(/\]/, "", timestamp)
        
        # 查找耗时
        for (i = 1; i <= NF; i++) {
            if ($i == "耗时:") {
                duration = $(i+1)
                sub(/秒/, "", duration)
                print timestamp "," duration
                break
            }
        }
    }'
}

# 计算统计数据
calculate_statistics() {
    local data_file=$1
    
    echo "安装时间统计"
    echo "==========================="
    
    # 总安装次数
    local total=$(wc -l < "$data_file")
    echo "总安装次数: $total"
    
    # 平均安装时间
    local avg=$(awk -F, '{ sum += $2; count++ } END { if (count > 0) print int(sum/count) }' "$data_file")
    local avg_minutes=$((avg / 60))
    local avg_seconds=$((avg % 60))
    echo "平均安装时间: ${avg_minutes}分${avg_seconds}秒"
    
    # 最快安装时间
    local min=$(sort -t, -k2 -n "$data_file" | head -1)
    local min_timestamp=$(echo "$min" | cut -d, -f1)
    local min_duration=$(echo "$min" | cut -d, -f2)
    local min_minutes=$((min_duration / 60))
    local min_seconds=$((min_duration % 60))
    echo "最快安装时间: ${min_minutes}分${min_seconds}秒 ($min_timestamp)"
    
    # 最慢安装时间
    local max=$(sort -t, -k2 -nr "$data_file" | head -1)
    local max_timestamp=$(echo "$max" | cut -d, -f1)
    local max_duration=$(echo "$max" | cut -d, -f2)
    local max_minutes=$((max_duration / 60))
    local max_seconds=$((max_duration % 60))
    echo "最慢安装时间: ${max_minutes}分${max_seconds}秒 ($max_timestamp)"
    
    echo ""
}

# 生成图表数据（简单的文本图表）
generate_chart() {
    local data_file=$1
    
    echo "安装时间趋势（最近10次）"
    echo "==========================="
    
    tail -10 "$data_file" | nl -v 1 | while read -r line; do
        local timestamp=$(echo "$line" | cut -d, -f1 | awk '{print $1}')
        local duration=$(echo "$line" | cut -d, -f2)
        local minutes=$((duration / 60))
        local seconds=$((duration % 60))
        
        # 生成简单的条形图（每分钟 1 个字符）
        local bar=""
        for ((i=0; i<minutes; i++)); do
            bar="${bar}█"
        done
        if [[ $minutes -eq 0 ]]; then
            bar="░"
        fi
        
        printf "%-8s %-20s %s %02d分%02d秒\n" \
            "$(echo "$line" | cut -d' ' -f1)" \
            "$timestamp" \
            "$bar" \
            "$minutes" "$seconds"
    done
    
    echo ""
}

# 生成完整报告
generate_full_report() {
    local data_file="$1"
    local report_file="$REPORT_DIR/performance-report-$(date '+%Y%m%d-%H%M%S').txt"
    
    cat > "$report_file" << EOF
========================================
性能监控报告
========================================

报告时间: $(date '+%Y-%m-%d %H:%M:%S')
项目路径: $PROJECT_ROOT

========================================
统计摘要
========================================
EOF
    
    # 添加统计信息
    calculate_statistics "$data_file" >> "$report_file"
    
    # 添加图表
    cat >> "$report_file" << EOF
========================================
安装历史（所有记录）
========================================
EOF
    
    tail -20 "$data_file" | while read -r line; do
        local timestamp=$(echo "$line" | cut -d, -f1)
        local duration=$(echo "$line" | cut -d, -f2)
        local minutes=$((duration / 60))
        local seconds=$((duration % 60))
        printf "%s  %02d分%02d秒\n" "$timestamp" "$minutes" "$seconds"
    done >> "$report_file"
    
    # 添加建议
    cat >> "$report_file" << EOF

========================================
优化建议
========================================
EOF
    
    # 分析并给出建议
    local avg=$(awk -F, '{ sum += $2; count++ } END { if (count > 0) print int(sum/count) }' "$data_file")
    
    if [[ $avg -gt 300 ]]; then
        echo "- 安装时间较长（超过5分钟），建议：" >> "$report_file"
        echo "  1. 定期清理 .pnpm-store 以避免缓存问题" >> "$report_file"
        echo "  2. 考虑使用 --prefer-offline 参数加速安装" >> "$report_file"
        echo "  3. 检查网络连接是否稳定" >> "$report_file"
    elif [[ $avg -gt 180 ]]; then
        echo "- 安装时间正常，建议：" >> "$report_file"
        echo "  1. 定期运行 pnpm store prune 清理缓存" >> "$report_file"
        echo "  2. 保持依赖更新以获得最佳性能" >> "$report_file"
    else
        echo "- 安装时间较快，建议：" >> "$report_file"
        echo "  1. 保持当前配置" >> "$report_file"
        echo "  2. 定期检查依赖更新" >> "$report_file"
    fi
    
    cat >> "$report_file" << EOF

========================================
报告结束
========================================
EOF
    
    echo -e "${GREEN}报告已生成: $report_file${NC}"
}

# 显示帮助
show_help() {
    cat << EOF
性能监控报告脚本 - 用法

命令:
  bash scripts/performance-report.sh              # 生成最新报告
  bash scripts/performance-report.sh --all        # 生成完整历史报告
  bash scripts/performance-report.sh --help       # 显示帮助信息

日志文件: $PERF_LOG
报告目录: $REPORT_DIR

使用场景:
  1. 诊断依赖安装性能问题
  2. 分析安装时间趋势
  3. 获取优化建议

定时报告:
  # 每周一生成性能报告
  0 0 * * 1 cd $PROJECT_ROOT && bash scripts/performance-report.sh >> logs/performance-report.log 2>&1
EOF
}

# 主函数
main() {
    local show_all=false
    
    # 解析参数
    while [[ $# -gt 0 ]]; do
        case $1 in
            --all|-a)
                show_all=true
                shift
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
    
    # 检查日志文件
    check_log_file
    
    # 提取数据到临时文件
    local temp_data=$(mktemp)
    extract_install_data > "$temp_data"
    
    # 检查是否有数据
    if [[ ! -s "$temp_data" ]]; then
        echo -e "${YELLOW}未找到有效的安装数据${NC}"
        rm -f "$temp_data"
        exit 1
    fi
    
    # 显示统计信息
    calculate_statistics "$temp_data"
    
    # 显示图表
    generate_chart "$temp_data"
    
    # 生成完整报告
    if [[ "$show_all" == "true" ]]; then
        generate_full_report "$temp_data"
    fi
    
    # 清理临时文件
    rm -f "$temp_data"
    
    echo -e "${GREEN}=========================================${NC}"
    echo -e "${GREEN}报告完成${NC}"
    echo -e "${GREEN}=========================================${NC}"
}

# 运行主函数
main "$@"
