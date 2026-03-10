#!/bin/bash

# ============================================
# 培训助手系统 - Docker 一键部署脚本
# ============================================

set -e

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_status() { echo -e "${GREEN}[✓]${NC} $1"; }
print_warning() { echo -e "${YELLOW}[!]${NC} $1"; }
print_error() { echo -e "${RED}[✗]${NC} $1"; }
print_info() { echo -e "${BLUE}[i]${NC} $1"; }

# 配置
PROJECT_DIR="${PROJECT_DIR:-/volume1/docker/training-assistant}"

echo "========================================"
echo "  培训助手系统 - Docker 部署"
echo "========================================"

# ============================================
# 1. 检查 Docker
# ============================================
echo ""
echo ">>> 检查 Docker..."

if ! command -v docker &> /dev/null; then
    print_error "Docker 未安装"
    echo ""
    echo "请先安装 Docker："
    echo "1. 打开群晖套件中心"
    echo "2. 搜索 'Container Manager' 或 'Docker'"
    echo "3. 安装后重新运行此脚本"
    exit 1
fi

if ! docker compose version &> /dev/null; then
    print_error "Docker Compose 未安装"
    exit 1
fi

print_status "Docker 已安装: $(docker --version)"

# ============================================
# 2. 检查代码目录
# ============================================
echo ""
echo ">>> 检查代码目录..."

if [ ! -d "$PROJECT_DIR" ]; then
    print_error "项目目录不存在: $PROJECT_DIR"
    echo ""
    echo "请先上传代码到该目录，或设置环境变量："
    echo "  export PROJECT_DIR=/你的实际路径"
    exit 1
fi

cd "$PROJECT_DIR"

# 检查必要文件
if [ ! -f "docker-compose.yml" ]; then
    print_error "未找到 docker-compose.yml 文件"
    exit 1
fi

print_status "项目目录: $PROJECT_DIR"

# ============================================
# 3. 配置环境变量
# ============================================
echo ""
echo ">>> 配置环境变量..."

if [ ! -f ".env" ]; then
    print_info "创建 .env 文件..."
    
    # 生成随机密码
    DB_PASSWORD=$(openssl rand -base64 16 | tr -dc 'a-zA-Z0-9' | head -c 20)
    
    cat > .env << EOF
# ============================================
# 数据库配置
# ============================================
DB_USER=training_user
DB_PASSWORD=$DB_PASSWORD
DB_NAME=training_db

# ============================================
# Coze API 配置（必须填写）
# ============================================
COZE_API_KEY=your_coze_api_key_here
COZE_BUCKET_ENDPOINT_URL=your_s3_endpoint_url
COZE_BUCKET_NAME=your_bucket_name

# ============================================
# 应用配置
# ============================================
APP_URL=http://localhost:5000
EOF
    
    print_status ".env 文件已创建"
    print_warning "请编辑 .env 文件，填入正确的 API 密钥！"
    echo ""
    echo "  编辑命令: nano $PROJECT_DIR/.env"
    echo ""
    read -p "已配置好 API 密钥？按回车继续..."
else
    print_status ".env 文件已存在"
fi

# ============================================
# 4. 停止旧容器
# ============================================
echo ""
echo ">>> 停止旧容器..."

if docker ps | grep -q training-app; then
    docker compose down
    print_status "旧容器已停止"
else
    print_info "无运行中的容器"
fi

# ============================================
# 5. 构建并启动
# ============================================
echo ""
echo ">>> 构建并启动容器..."

docker compose up -d --build

print_status "容器启动成功"

# ============================================
# 6. 等待服务就绪
# ============================================
echo ""
echo ">>> 等待服务就绪..."

# 等待数据库
print_info "等待数据库..."
for i in {1..30}; do
    if docker exec training-postgres pg_isready -U training_user -d training_db &> /dev/null; then
        print_status "数据库就绪"
        break
    fi
    echo -n "."
    sleep 1
done
echo ""

# 等待应用
print_info "等待应用启动..."
sleep 10

for i in {1..30}; do
    if curl -s http://localhost:5000 > /dev/null 2>&1; then
        print_status "应用就绪"
        break
    fi
    echo -n "."
    sleep 1
done
echo ""

# ============================================
# 7. 显示状态
# ============================================
echo ""
echo "========================================"
echo "  部署完成！"
echo "========================================"
echo ""

docker compose ps

echo ""
echo "访问地址: http://$(hostname -I | awk '{print $1}'):5000"
echo ""
echo "常用命令："
echo "  查看日志: docker compose logs -f"
echo "  重启服务: docker compose restart"
echo "  停止服务: docker compose down"
echo ""
