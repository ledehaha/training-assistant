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
else
  export DATA_DIR="${PROJECT_DIR}/data"
  export FILE_STORAGE_PATH="${PROJECT_DIR}/data/files"
  export DATABASE_PATH="${PROJECT_DIR}/data/training.db"
fi

# 创建数据目录（使用 -p 选项，如果目录已存在则不报错）
mkdir -p "${DATA_DIR}" "${FILE_STORAGE_PATH}"

# 设置 NODE_ENV
export NODE_ENV=${COZE_PROJECT_ENV:-development}

# 使用 node 运行 Next.js
echo "Starting service on port ${PORT}..."
# standalone 模式下，server.js 在 .next/standalone/workspace/projects/server.js
if [ -f ".next/standalone/workspace/projects/server.js" ]; then
  node .next/standalone/workspace/projects/server.js
else
  node .next/standalone/server.js
fi
