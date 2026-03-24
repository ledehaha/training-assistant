#!/bin/bash
set -Eeuo pipefail

PORT=5000
COZE_WORKSPACE_PATH="${COZE_WORKSPACE_PATH:-$(pwd)}"
NODE_ENV=development
DEPLOY_RUN_PORT=5000

# 清理策略：可通过环境变量控制
# CLEAN_CACHE=auto (默认) - 检测到损坏时自动清理
# CLEAN_CACHE=always - 每次启动都清理
# CLEAN_CACHE=never - 从不清理
CLEAN_CACHE="${CLEAN_CACHE:-auto}"

cd "${COZE_WORKSPACE_PATH}"

# 检测 .next 缓存是否损坏
check_cache_health() {
    local next_dir="${COZE_WORKSPACE_PATH}/.next"
    
    # 如果不存在 .next 目录，认为健康（首次启动）
    if [[ ! -d "$next_dir" ]]; then
        echo "Cache: No .next directory found, will create fresh cache."
        return 0
    fi
    
    # 检查关键文件是否存在
    local required_files=(
        "package.json"
        "build-manifest.json"
    )
    
    for file in "${required_files[@]}"; do
        if [[ -f "$next_dir/$file" ]]; then
            return 0
        fi
    done
    
    # 如果没有关键文件，可能已损坏
    echo "Cache: .next directory exists but appears incomplete or corrupted."
    return 1
}

# 清理损坏的缓存
clean_corrupted_cache() {
    local next_dir="${COZE_WORKSPACE_PATH}/.next"
    
    echo "Cache: Cleaning corrupted .next directory..."
    rm -rf "$next_dir"
    echo "Cache: .next directory cleaned."
}

# 优雅关闭：捕获信号并清理
cleanup_on_exit() {
    local next_pid=$(pgrep -f "next dev" 2>/dev/null || true)
    if [[ -n "$next_pid" ]]; then
        echo "Shutting down Next.js gracefully (PID: $next_pid)..."
        kill -TERM "$next_pid" 2>/dev/null || true
        # 等待进程退出，最多5秒
        local count=0
        while [[ $count -lt 50 ]] && kill -0 "$next_pid" 2>/dev/null; do
            sleep 0.1
            ((count++))
        done
        # 如果还没退出，强制kill
        if kill -0 "$next_pid" 2>/dev/null; then
            echo "Force killing Next.js..."
            kill -KILL "$next_pid" 2>/dev/null || true
        fi
    fi
}

# 注册信号处理
trap cleanup_on_exit EXIT SIGTERM SIGINT

kill_port_if_listening() {
    local pids
    pids=$(ss -H -lntp 2>/dev/null | awk -v port="${DEPLOY_RUN_PORT}" '$4 ~ ":"port"$"' | grep -o 'pid=[0-9]*' | cut -d= -f2 | paste -sd' ' - || true)
    if [[ -z "${pids}" ]]; then
      echo "Port ${DEPLOY_RUN_PORT} is free."
      return
    fi
    echo "Port ${DEPLOY_RUN_PORT} in use by PIDs: ${pids} (SIGKILL)"
    echo "${pids}" | xargs -I {} kill -9 {}
    sleep 1
    pids=$(ss -H -lntp 2>/dev/null | awk -v port="${DEPLOY_RUN_PORT}" '$4 ~ ":"port"$"' | grep -o 'pid=[0-9]*' | cut -d= -f2 | paste -sd' ' - || true)
    if [[ -n "${pids}" ]]; then
      echo "Warning: port ${DEPLOY_RUN_PORT} still busy after SIGKILL, PIDs: ${pids}"
    else
      echo "Port ${DEPLOY_RUN_PORT} cleared."
    fi
}

echo "Clearing port ${PORT} before start."
kill_port_if_listening

# 缓存管理
case "$CLEAN_CACHE" in
    always)
        echo "Cache: CLEAN_CACHE=always, cleaning .next directory..."
        clean_corrupted_cache
        ;;
    never)
        echo "Cache: CLEAN_CACHE=never, skipping cache check."
        ;;
    auto|*)
        if ! check_cache_health; then
            echo "Cache: Detected corrupted cache, cleaning..."
            clean_corrupted_cache
        else
            echo "Cache: .next directory is healthy."
        fi
        ;;
esac

echo "Starting HTTP service on port ${PORT} for dev..."

npx next dev --webpack --port $PORT
