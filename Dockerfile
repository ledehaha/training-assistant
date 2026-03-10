# ============================================
# 培训助手系统 - Docker 部署方案
# ============================================

FROM node:20-alpine AS builder

# 安装编译依赖（better-sqlite3 需要）
RUN apk add --no-cache libc6-compat python3 make g++

WORKDIR /app

# 安装 pnpm
RUN npm install -g pnpm

# 复制 package 文件
COPY package.json pnpm-lock.yaml* ./

# 安装依赖
RUN pnpm install --frozen-lockfile

# 复制源代码
COPY . .

# 构建
RUN pnpm run build

# ============================================
# 生产镜像
# ============================================
FROM node:20-alpine AS runner

WORKDIR /app

# 安装运行时依赖（better-sqlite3 需要）
RUN apk add --no-cache libstdc++

# 设置环境变量
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# 创建非 root 用户
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# 创建数据和文件存储目录
RUN mkdir -p /data/db /data/files && chown -R nextjs:nodejs /data

# 复制构建产物
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# 复制数据库相关文件
COPY --from=builder /app/node_modules/better-sqlite3 ./node_modules/better-sqlite3
COPY --from=builder /app/src/storage ./src/storage
COPY --from=builder /app/drizzle.config.ts ./

# 设置权限
RUN chown -R nextjs:nodejs /app

USER nextjs

EXPOSE 5000

ENV PORT=5000
ENV HOSTNAME="0.0.0.0"
ENV DATA_DIR=/data/db
ENV FILE_STORAGE_PATH=/data/files

CMD ["node", "server.js"]
