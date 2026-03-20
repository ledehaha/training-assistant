import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/contexts/AuthContext';

export const metadata: Metadata = {
  title: {
    default: '非学历培训全周期助手',
    template: '%s | 非学历培训全周期助手',
  },
  description: '非学历培训全周期助手 - 从需求分析到项目总结的完整闭环管理系统',
  keywords: [
    '培训管理',
    '非学历培训',
    '培训方案',
    '项目管理',
    '满意度调查',
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const isDev = process.env.NODE_ENV === 'development';

  return (
    <html lang="zh-CN">
      <body className="antialiased">
        <AuthProvider>
          {isDev && process.env.NODE_ENV === 'development' && (
            <div suppressHydrationWarning />
          )}
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
