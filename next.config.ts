import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  allowedDevOrigins: ['*.dev.coze.site'],
  serverExternalPackages: ['pdf2json', 'sql.js'],
  // 移除 output: 'standalone'，避免静态资源 404 问题
  // 部署环境已配置好 Node.js 和依赖，无需 standalone 模式
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'lf-coze-web-cdn.coze.cn',
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;
