#!/bin/bash

# ============================================
# 数据库备份脚本 (Docker 版)
# ============================================

BACKUP_DIR="${BACKUP_DIR:-/volume1/backup/training-assistant}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
DB_USER="${DB_USER:-training_user}"
DB_NAME="${DB_NAME:-training_db}"
CONTAINER_NAME="${CONTAINER_NAME:-training-postgres}"

# 创建备份目录
mkdir -p "$BACKUP_DIR"

# 备份文件名
BACKUP_FILE="$BACKUP_DIR/backup_$(date +%Y%m%d_%H%M%S).sql"

echo "开始备份数据库: $(date)"

# 执行备份
docker exec $CONTAINER_NAME pg_dump -U $DB_USER -d $DB_NAME > "$BACKUP_FILE"

# 压缩备份
gzip "$BACKUP_FILE"
BACKUP_FILE="${BACKUP_FILE}.gz"

echo "备份完成: $BACKUP_FILE"
echo "文件大小: $(du -h "$BACKUP_FILE" | cut -f1)"

# 清理旧备份
find "$BACKUP_DIR" -name "backup_*.sql.gz" -type f -mtime +$RETENTION_DAYS -delete
echo "已清理 $RETENTION_DAYS 天前的旧备份"
