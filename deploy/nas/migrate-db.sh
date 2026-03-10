#!/bin/bash

# ============================================
# 数据库迁移脚本：Supabase → 群晖 PostgreSQL
# ============================================

set -e

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

print_status() {
    echo -e "${GREEN}[✓]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[!]${NC} $1"
}

print_error() {
    echo -e "${RED}[✗]${NC} $1"
}

echo "========================================"
echo "  数据库迁移：Supabase → 群晖 PostgreSQL"
echo "========================================"

# 配置变量
echo ""
echo "请输入源数据库（Supabase）信息："
read -p "数据库主机 (如 db.xxxxx.supabase.co): " SOURCE_HOST
read -p "数据库端口 [5432]: " SOURCE_PORT
SOURCE_PORT=${SOURCE_PORT:-5432}
read -p "数据库名称 [postgres]: " SOURCE_DB
SOURCE_DB=${SOURCE_DB:-postgres}
read -p "用户名 [postgres]: " SOURCE_USER
SOURCE_USER=${SOURCE_USER:-postgres}
read -sp "密码: " SOURCE_PASSWORD
echo ""

echo ""
echo "请输入目标数据库（群晖）信息："
read -p "数据库主机 [localhost]: " TARGET_HOST
TARGET_HOST=${TARGET_HOST:-localhost}
read -p "数据库端口 [5432]: " TARGET_PORT
TARGET_PORT=${TARGET_PORT:-5432}
read -p "数据库名称 [training_db]: " TARGET_DB
TARGET_DB=${TARGET_DB:-training_db}
read -p "用户名 [training_user]: " TARGET_USER
TARGET_USER=${TARGET_USER:-training_user}
read -sp "密码: " TARGET_PASSWORD
echo ""

# 备份目录
BACKUP_DIR="/volume1/backup/training-assistant"
BACKUP_FILE="$BACKUP_DIR/supabase_backup_$(date +%Y%m%d_%H%M%S).sql"

mkdir -p "$BACKUP_DIR"

echo ""
echo ">>> 步骤 1: 导出 Supabase 数据..."
echo ""

export PGPASSWORD="$SOURCE_PASSWORD"

pg_dump \
    -h "$SOURCE_HOST" \
    -p "$SOURCE_PORT" \
    -U "$SOURCE_USER" \
    -d "$SOURCE_DB" \
    --no-owner \
    --no-privileges \
    --clean \
    --if-exists \
    > "$BACKUP_FILE"

print_status "数据导出完成: $BACKUP_FILE"
echo "文件大小: $(du -h "$BACKUP_FILE" | cut -f1)"

unset PGPASSWORD

echo ""
echo ">>> 步骤 2: 验证备份文件..."
echo ""

if [ -s "$BACKUP_FILE" ]; then
    LINES=$(wc -l < "$BACKUP_FILE")
    print_status "备份文件有效，共 $LINES 行"
else
    print_error "备份文件为空，请检查源数据库连接"
    exit 1
fi

echo ""
echo ">>> 步骤 3: 导入数据到群晖 PostgreSQL..."
echo ""

export PGPASSWORD="$TARGET_PASSWORD"

# 先创建数据库（如果不存在）
psql \
    -h "$TARGET_HOST" \
    -p "$TARGET_PORT" \
    -U postgres \
    -c "CREATE DATABASE $TARGET_DB;" 2>/dev/null || true

# 授予权限
psql \
    -h "$TARGET_HOST" \
    -p "$TARGET_PORT" \
    -U postgres \
    -c "GRANT ALL PRIVILEGES ON DATABASE $TARGET_DB TO $TARGET_USER;" 2>/dev/null || true

# 导入数据
psql \
    -h "$TARGET_HOST" \
    -p "$TARGET_PORT" \
    -U "$TARGET_USER" \
    -d "$TARGET_DB" \
    -f "$BACKUP_FILE"

print_status "数据导入完成"

unset PGPASSWORD

echo ""
echo ">>> 步骤 4: 验证迁移结果..."
echo ""

export PGPASSWORD="$TARGET_PASSWORD"

# 检查表数量
TABLE_COUNT=$(psql \
    -h "$TARGET_HOST" \
    -p "$TARGET_PORT" \
    -U "$TARGET_USER" \
    -d "$TARGET_DB" \
    -tAc "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';")

print_status "迁移完成！共迁移 $TABLE_COUNT 张表"

# 显示表列表
echo ""
echo "数据表列表："
psql \
    -h "$TARGET_HOST" \
    -p "$TARGET_PORT" \
    -U "$TARGET_USER" \
    -d "$TARGET_DB" \
    -c "\dt"

unset PGPASSWORD

echo ""
echo "========================================"
echo "  迁移成功！"
echo "========================================"
echo ""
echo "备份文件: $BACKUP_FILE"
echo ""
echo "请更新应用的环境变量："
echo "  DATABASE_URL=postgresql://${TARGET_USER}:****@${TARGET_HOST}:${TARGET_PORT}/${TARGET_DB}"
echo ""
