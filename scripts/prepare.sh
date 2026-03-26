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

# 加载环境配置
if [[ -f "scripts/load-env.sh" ]]; then
    source scripts/load-env.sh
    echo ""
fi

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

# 检查 pnpm 版本
PNPM_VERSION=$(pnpm --version)
MIN_PNPM_VERSION="9.0.0"

# 版本比较函数
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
    echo -e "${RED}错误: pnpm 版本过低${NC}"
    echo "当前版本: $PNPM_VERSION"
    echo "要求版本: >= $MIN_PNPM_VERSION"
    echo ""
    echo "请升级 pnpm: npm install -g pnpm@latest"
    echo "或使用 corepack: corepack enable && corepack prepare pnpm@latest --activate"
    exit 1
fi

echo "pnpm 版本: $PNPM_VERSION ✓"
echo ""

# 检查 package.json
if [[ ! -f "package.json" ]]; then
    echo -e "${RED}错误: package.json 不存在${NC}"
    exit 1
fi

# 检查 pnpm lockfile
if [[ ! -f "pnpm-lock.yaml" ]]; then
    echo -e "${YELLOW}警告: pnpm-lock.yaml 不存在，将生成新的锁文件${NC}"
fi

# 检查 .pnpm-store 大小
MAX_STORE_SIZE_MB=500  # 超过 500MB 自动清理
if [[ -d ".pnpm-store" ]]; then
    STORE_SIZE_MB=$(du -sm .pnpm-store 2>/dev/null | awk '{print $1}' || echo "0")
    if [[ $STORE_SIZE_MB -gt $MAX_STORE_SIZE_MB ]]; then
        echo -e "${YELLOW}警告: .pnpm-store 过大 (${STORE_SIZE_MB}MB)，超过阈值 (${MAX_STORE_SIZE_MB}MB)${NC}"
        echo "建议清理以节省磁盘空间"
        echo ""
    fi
fi

# 检查 node_modules 是否需要重新安装
NEED_INSTALL=0
NEED_CLEAN=0
if [[ ! -d "node_modules" ]]; then
    echo "node_modules 不存在，需要安装"
    NEED_INSTALL=1
elif [[ ! -f "node_modules/.bin/next" ]]; then
    echo -e "${YELLOW}node_modules/.bin/next 不存在，需要重新安装${NC}"
    NEED_INSTALL=1
    NEED_CLEAN=1  # 标记需要清理
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
    if [[ $NEED_CLEAN -eq 1 ]] && [[ -d "node_modules" ]]; then
        echo -e "${YELLOW}检测到损坏的 node_modules，正在清理...${NC}"
        rm -rf node_modules .pnpm-store
        echo ""
    fi
    
    # 性能监控：记录开始时间
    local start_time=$(date +%s)
    
    # 使用不带 --prefer-frozen-lockfile 的安装，更灵活
    echo "运行: pnpm install"
    echo ""
    
    if pnpm install; then
        # 性能监控：计算安装时间
        local end_time=$(date +%s)
        local install_duration=$((end_time - start_time))
        local install_minutes=$((install_duration / 60))
        local install_seconds=$((install_duration % 60))
        
        echo ""
        echo -e "${GREEN}=========================================${NC}"
        echo -e "${GREEN}✓ 依赖安装成功${NC}"
        echo -e "${GREEN}=========================================${NC}"
        echo -e "${BLUE}安装耗时: ${install_minutes}分${install_seconds}秒${NC}"
        
        # 记录性能数据
        mkdir -p logs
        local perf_log="logs/performance.log"
        {
            echo "[$(date '+%Y-%m-%d %H:%M:%S')] 依赖安装"
            echo "  耗时: ${install_duration}秒 (${install_minutes}分${install_seconds}秒)"
            echo "  pnpm 版本: $PNPM_VERSION"
            echo "  Node 版本: $(node --version)"
            echo "---"
        } >> "$perf_log"
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

# 定义关键依赖列表
declare -A CRITICAL_DEPENDENCIES
CRITICAL_DEPENDENCIES=(
    ["next"]="Next.js 框架"
    ["react"]="React 核心库"
    ["react-dom"]="React DOM 渲染器"
    ["typescript"]="TypeScript 编译器"
    ["@types/react"]="React 类型定义"
    ["@types/react-dom"]="React DOM 类型定义"
    ["tailwindcss"]="Tailwind CSS"
    ["@radix-ui/react-dialog"]="Radix UI Dialog"
    ["coze-coding-dev-sdk"]="Coze SDK"
)

# 检查关键依赖
for pkg in "${!CRITICAL_DEPENDENCIES[@]}"; do
    if [[ -d "node_modules/$pkg" ]]; then
        echo -e "${GREEN}✓ ${CRITICAL_DEPENDENCIES[$pkg]} 已安装${NC}"
    else
        echo -e "${RED}✗ ${CRITICAL_DEPENDENCIES[$pkg]} 未安装${NC}"
        VERIFY_ERRORS=1
    fi
done

echo ""

# 检查 bin 文件完整性
echo "检查可执行文件..."

BIN_FILES=(
    "next:Next.js CLI"
    "tsc:TypeScript 编译器"
    "eslint:ESLint"
)

for bin_info in "${BIN_FILES[@]}"; do
    IFS=":" read -r bin_name bin_desc <<< "$bin_info"
    if [[ -f "node_modules/.bin/$bin_name" ]]; then
        if [[ -x "node_modules/.bin/$bin_name" ]]; then
            echo -e "${GREEN}✓ $bin_desc 可执行${NC}"
        else
            echo -e "${YELLOW}! $bin_desc 存在但不可执行${NC}"
            chmod +x "node_modules/.bin/$bin_name"
        fi
    else
        echo -e "${RED}✗ $bin_desc 未安装${NC}"
        VERIFY_ERRORS=1
    fi
done

echo ""

# 检查 package.json 和 pnpm-lock.yaml 的一致性
if [[ -f "package.json" ]] && [[ -f "pnpm-lock.yaml" ]]; then
    echo "检查 lockfile 一致性..."
    
    # 提取 package.json 中的依赖版本
    EXPECTED_VERSIONS=$(grep -E '"(next|react|react-dom|typescript)"' package.json | grep -o '"[^"]*"' | paste -sd' ')
    
    # 检查 lockfile 是否存在
    if [[ -s "pnpm-lock.yaml" ]]; then
        echo -e "${GREEN}✓ pnpm-lock.yaml 存在且非空${NC}"
    else
        echo -e "${YELLOW}! pnpm-lock.yaml 为空，可能需要重新生成${NC}"
        VERIFY_ERRORS=1
    fi
else
    echo -e "${RED}✗ package.json 或 pnpm-lock.yaml 缺失${NC}"
    VERIFY_ERRORS=1
fi

echo ""

# 检查关键配置文件
CONFIG_FILES=(
    "tsconfig.json:TypeScript 配置"
    "next.config.ts:Next.js 配置"
    "tailwind.config.ts:Tailwind 配置"
)

for config_info in "${CONFIG_FILES[@]}"; do
    IFS=":" read -r config_file config_desc <<< "$config_info"
    if [[ -f "$config_file" ]]; then
        echo -e "${GREEN}✓ $config_desc 存在${NC}"
    else
        echo -e "${YELLOW}! $config_desc 不存在${NC}"
        # 配置文件不是致命错误，不设置 VERIFY_ERRORS
    fi
done

echo ""

# 详细错误诊断
if [[ $VERIFY_ERRORS -ne 0 ]]; then
    echo -e "${RED}=========================================${NC}"
    echo -e "${RED}错误: 关键依赖缺失或不完整${NC}"
    echo -e "${RED}=========================================${NC}"
    echo ""
    echo "诊断信息："
    
    # 检查 node_modules 是否为空
    if [[ -d "node_modules" ]]; then
        local file_count=$(find node_modules -maxdepth 1 -type d | wc -l)
        echo "  - node_modules 目录数: $file_count"
        
        if [[ $file_count -lt 10 ]]; then
            echo -e "  ${RED}✗ node_modules 可能未完全安装${NC}"
        fi
    fi
    
    # 检查磁盘空间
    local available_space=$(df -h . | awk 'NR==2 {print $4}')
    echo "  - 可用磁盘空间: $available_space"
    
    echo ""
    echo "建议的修复方案："
    echo "  1. 完全清理并重新安装: bash scripts/recover.sh fix-all"
    echo "  2. 仅修复依赖: bash scripts/recover.sh fix-modules"
    echo "  3. 清理 store 后重试: bash scripts/clean-store.sh clean-store && pnpm install"
    echo "  4. 手动清理: rm -rf node_modules .pnpm-store && pnpm install"
    echo ""
    
    exit 1
fi

# 健康检查通过，显示摘要
echo -e "${GREEN}=========================================${NC}"
echo -e "${GREEN}✓ 所有检查通过，环境健康${NC}"
echo -e "${GREEN}=========================================${NC}"
echo ""
echo "环境摘要："
echo "  - pnpm 版本: $PNPM_VERSION"
echo "  - 关键依赖: 已安装"
echo "  - 可执行文件: 完整"
echo "  - 配置文件: 正常"
echo ""
echo "下一步："
echo "  运行开发服务器: coze dev"
echo "  构建生产版本: coze build"
