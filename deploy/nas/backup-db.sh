#!/bin/bash

# ============================================
# 数据库定时备份脚本
# ============================================

# 配置
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-training_db}"
DB_USER="${DB_USER:-training_user}"
DB_PASSWORD="${DB_PASSWORD:-}"

# 备份目录
BACKUP_DIR="${BACKUP_DIR:-/volume1/backup/training-assistant}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"

# 创建备份目录
mkdir -p "$BACKUP_DIR"

# 设置密码
export PGPASSWORD="$DB_PASSWORD"

# 备份文件名
BACKUP_FILE="$BACKUP_DIR/backup_$(date +%Y%m%d_%H%M%S).sql"

echo "开始备份数据库: $(date)"

# 执行备份
pg_dump \
    -h "$DB_HOST" \
    -p "$DB_PORT" \
    -U "$DB_USER" \
    -d "$DB_NAME" \
    --no-owner \
    --no-privileges \
    --format=plain \
    --verbose \
    > "$BACKUP_FILE" 2>&1

# 压缩备份
gzip "$BACKUP_FILE"
BACKUP_FILE="${BACKUP_FILE}.gz"

# 清理旧备份
find "$BACKUP_DIR" -name "backup_*.sql.gz" -type f -mtime +$RETENTION_DAYS -delete

echo "备份完成: $BACKUP_FILE"
echo "文件大小: $(du -h "$BACKUP_FILE" | cut -f1)"

# 清除密码
unset PGPASSWORD
