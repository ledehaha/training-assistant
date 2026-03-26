#!/bin/bash
set -Eeuo pipefail

# 获取项目目录
PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "${PROJECT_DIR}"

# 设置端口
PORT=${PORT:-5900}

echo "=========================================="
echo "培训助手系统启动中..."
echo "端口: ${PORT}"
echo "=========================================="

# 设置数据目录
export DATA_DIR="${PROJECT_DIR}/data"
export FILE_STORAGE_PATH="${PROJECT_DIR}/data/files"

# 创建数据目录
mkdir -p "${DATA_DIR}" "${FILE_STORAGE_PATH}"

# 使用 node 运行 Next.js
echo "Starting service on port ${PORT}..."
node .next/standalone/server.js
