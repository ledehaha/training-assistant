#!/bin/bash
set -Eeuo pipefail

# 获取项目目录
PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "${PROJECT_DIR}"

# 设置端口（默认使用 5000）
PORT=${PORT:-5000}

echo "=========================================="
echo "培训助手系统启动中..."
echo "端口: ${PORT}"
echo "=========================================="

# 设置数据目录（生产环境使用 /tmp，开发环境使用项目目录）
if [ "${COZE_PROJECT_ENV:-}" = "PROD" ]; then
  export DATA_DIR="/tmp/data"
  export FILE_STORAGE_PATH="/tmp/files"
  export DATABASE_PATH="/tmp/training.db"
  echo "生产环境模式"
  echo "DATA_DIR: ${DATA_DIR}"
  echo "DATABASE_PATH: ${DATABASE_PATH}"
else
  export DATA_DIR="${PROJECT_DIR}/data"
  export FILE_STORAGE_PATH="${PROJECT_DIR}/data/files"
  export DATABASE_PATH="${PROJECT_DIR}/data/training.db"
  echo "开发环境模式"
  echo "DATA_DIR: ${DATA_DIR}"
  echo "DATABASE_PATH: ${DATABASE_PATH}"
fi

# 创建数据目录（使用 -p 选项，如果目录已存在则不报错）
mkdir -p "${DATA_DIR}" "${FILE_STORAGE_PATH}"

# 生产环境：复制初始数据库文件（如果不存在）
if [ "${COZE_PROJECT_ENV:-}" = "PROD" ]; then
  if [ ! -f "${DATABASE_PATH}" ] && [ -f "${PROJECT_DIR}/data/training.db" ]; then
    echo "复制初始数据库文件到生产环境..."
    cp "${PROJECT_DIR}/data/training.db" "${DATABASE_PATH}"
    echo "数据库文件复制完成"
  fi
fi

# 设置 NODE_ENV
export NODE_ENV=${COZE_PROJECT_ENV:-development}
echo "NODE_ENV: ${NODE_ENV}"

# 使用 next start 启动生产服务器
echo "Starting service on port ${PORT}..."
NODE_ENV=${NODE_ENV} PORT=${PORT} DATA_DIR=${DATA_DIR} DATABASE_PATH=${DATABASE_PATH} FILE_STORAGE_PATH=${FILE_STORAGE_PATH} npx next start -p ${PORT}
