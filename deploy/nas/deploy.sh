#!/bin/bash

# ============================================
# 培训助手系统 - 群晖 NAS 快速部署脚本
# ============================================

set -e

# 配置变量
PROJECT_DIR="${PROJECT_DIR:-/volume1/web/training-assistant}"
DB_NAME="${DB_NAME:-training_db}"
DB_USER="${DB_USER:-training_user}"
DB_PASSWORD="${DB_PASSWORD:-training_pass_2024}"
PORT="${PORT:-5000}"

echo "========================================"
echo "  培训助手系统 - 快速部署脚本"
echo "========================================"

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${GREEN}[✓]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[!]${NC} $1"
}

print_error() {
    echo -e "${RED}[✗]${NC} $1"
}

# 检查是否为 root 用户
if [ "$EUID" -ne 0 ]; then
    print_warning "建议使用 root 权限运行此脚本"
fi

# 1. 检查必要软件
echo ""
echo ">>> 检查系统环境..."

check_command() {
    if command -v $1 &> /dev/null; then
        print_status "$1 已安装: $(command -v $1)"
        return 0
    else
        print_error "$1 未安装"
        return 1
    fi
}

NEED_INSTALL=0

if ! check_command node; then
    NEED_INSTALL=1
fi

if ! check_command pnpm; then
    print_warning "pnpm 未安装，将自动安装"
fi

if ! check_command psql; then
    NEED_INSTALL=1
fi

if [ $NEED_INSTALL -eq 1 ]; then
    print_error "请先安装缺失的软件："
    echo "  - Node.js: 通过套件中心安装"
    echo "  - PostgreSQL: 通过套件中心安装"
    exit 1
fi

# 2. 安装 pnpm
echo ""
echo ">>> 安装 pnpm..."
if ! command -v pnpm &> /dev/null; then
    npm install -g pnpm
    print_status "pnpm 安装完成"
else
    print_status "pnpm 已安装: $(pnpm -v)"
fi

# 3. 安装 PM2
echo ""
echo ">>> 检查 PM2..."
if ! command -v pm2 &> /dev/null; then
    npm install -g pm2
    print_status "PM2 安装完成"
else
    print_status "PM2 已安装"
fi

# 4. 创建项目目录
echo ""
echo ">>> 创建项目目录..."
mkdir -p "$PROJECT_DIR"
mkdir -p /var/log/training-assistant
print_status "目录创建完成: $PROJECT_DIR"

# 5. 检查 PostgreSQL 服务
echo ""
echo ">>> 检查 PostgreSQL..."
if synoservicectl --status pgsql &> /dev/null; then
    print_status "PostgreSQL 服务运行中"
else
    print_warning "尝试启动 PostgreSQL..."
    synoservicectl --start pgsql || {
        print_error "无法启动 PostgreSQL，请通过套件中心检查"
        exit 1
    }
fi

# 6. 创建数据库和用户
echo ""
echo ">>> 配置数据库..."
print_warning "请输入 PostgreSQL postgres 用户密码（如果有）: "

# 检查数据库是否存在
DB_EXISTS=$(psql -U postgres -tAc "SELECT 1 FROM pg_database WHERE datname='$DB_NAME'" 2>/dev/null || echo "0")

if [ "$DB_EXISTS" = "1" ]; then
    print_status "数据库 $DB_NAME 已存在"
else
    print_warning "创建数据库..."
    psql -U postgres -c "CREATE DATABASE $DB_NAME;" 2>/dev/null || {
        print_error "创建数据库失败，请手动创建"
    }
    print_status "数据库创建完成: $DB_NAME"
fi

# 检查用户是否存在
USER_EXISTS=$(psql -U postgres -tAc "SELECT 1 FROM pg_roles WHERE rolname='$DB_USER'" 2>/dev/null || echo "0")

if [ "$USER_EXISTS" = "1" ]; then
    print_status "用户 $DB_USER 已存在"
else
    print_warning "创建数据库用户..."
    psql -U postgres -c "CREATE USER $DB_USER WITH ENCRYPTED PASSWORD '$DB_PASSWORD';" 2>/dev/null || {
        print_error "创建用户失败，请手动创建"
    }
    psql -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;" 2>/dev/null
    print_status "用户创建完成: $DB_USER"
fi

# 7. 创建环境变量文件
echo ""
echo ">>> 创建环境变量文件..."
if [ -f "$PROJECT_DIR/.env" ]; then
    print_warning ".env 文件已存在，跳过"
else
    cat > "$PROJECT_DIR/.env" << EOF
# 数据库配置
DATABASE_URL=postgresql://${DB_USER}:${DB_PASSWORD}@localhost:5432/${DB_NAME}

# Coze API 配置（请替换为实际值）
COZE_API_KEY=your_coze_api_key_here
COZE_BUCKET_ENDPOINT_URL=your_s3_endpoint_url
COZE_BUCKET_NAME=your_bucket_name

# 应用配置
NODE_ENV=production
PORT=$PORT
NEXT_PUBLIC_APP_URL=http://localhost:$PORT
EOF
    print_status ".env 文件创建完成"
    print_warning "请编辑 .env 文件，填入正确的 API 密钥"
fi

# 8. 部署应用
echo ""
echo ">>> 部署应用..."

if [ -f "$PROJECT_DIR/package.json" ]; then
    cd "$PROJECT_DIR"
    
    # 安装依赖
    print_warning "安装依赖（这可能需要几分钟）..."
    pnpm install --prod
    
    # 构建应用
    if [ -f "next.config.js" ] || [ -f "next.config.mjs" ]; then
        print_warning "构建应用..."
        pnpm run build
    fi
    
    print_status "应用部署完成"
else
    print_error "未找到 package.json，请先上传代码到 $PROJECT_DIR"
    echo ""
    echo "上传代码方式："
    echo "  1. Git: git clone <repo_url> $PROJECT_DIR"
    echo "  2. SCP: scp -r ./dist/* admin@NAS_IP:$PROJECT_DIR/"
    echo "  3. File Station: 上传到 $PROJECT_DIR"
    exit 1
fi

# 9. 启动服务
echo ""
echo ">>> 启动服务..."

# 检查是否已在运行
if pm2 describe training-assistant &> /dev/null; then
    print_warning "应用已在运行，正在重启..."
    pm2 restart training-assistant
else
    pm2 start ecosystem.config.js --env production
    pm2 save
fi

print_status "服务启动完成"

# 10. 设置开机自启
echo ""
echo ">>> 配置开机自启..."
PM2_STARTUP=$(pm2 startup 2>&1 | grep "sudo" || true)
if [ -n "$PM2_STARTUP" ]; then
    print_warning "请执行以下命令配置开机自启："
    echo "$PM2_STARTUP"
else
    print_status "PM2 开机自启已配置"
fi

# 完成
echo ""
echo "========================================"
echo "  部署完成！"
echo "========================================"
echo ""
echo "应用地址: http://$(hostname -I | awk '{print $1}'):$PORT"
echo ""
echo "常用命令："
echo "  查看状态: pm2 status"
echo "  查看日志: pm2 logs training-assistant"
echo "  重启服务: pm2 restart training-assistant"
echo "  停止服务: pm2 stop training-assistant"
echo ""
