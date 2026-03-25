'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, LogIn, ChevronDown, ChevronUp } from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [showDebugAccount, setShowDebugAccount] = useState(false);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [formData, setFormData] = useState({
    employeeId: '',
    password: '',
  });

  // 检查是否已登录，如果已登录则跳转到首页
  useEffect(() => {
    const checkAuth = async () => {
      try {
        // 检查 URL 参数，判断是否是会话超时跳转
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('session') === 'expired') {
          setSessionExpired(true);
          // 清理 URL 参数
          window.history.replaceState({}, '', window.location.pathname);
        }
        
        const sessionToken = localStorage.getItem('session_token');
        if (!sessionToken || sessionToken.trim() === '') {
          setChecking(false);
          return;
        }

        const res = await fetch('/api/auth/me', {
          headers: {
            'Authorization': `Bearer ${sessionToken}`,
          },
        });
        
        // 检查响应是否有效
        const contentType = res.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
          localStorage.removeItem('session_token');
          setChecking(false);
          return;
        }
        
        const text = await res.text();
        if (!text || text.trim() === '') {
          localStorage.removeItem('session_token');
          setChecking(false);
          return;
        }
        
        let data;
        try {
          data = JSON.parse(text);
        } catch (parseError) {
          console.error('JSON parse error:', parseError);
          localStorage.removeItem('session_token');
          setChecking(false);
          return;
        }
        
        if (data.authenticated) {
          // 已登录，跳转到首页
          window.location.href = '/';
        } else {
          // 清除无效的 token
          localStorage.removeItem('session_token');
          setChecking(false);
        }
      } catch (error) {
        console.error('Auth check error:', error);
        localStorage.removeItem('session_token');
        setChecking(false);
      }
    };

    checkAuth();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.employeeId || !formData.password) {
      toast.error('请输入工号和密码');
      return;
    }
    
    // 工号只允许数字
    if (!/^\d+$/.test(formData.employeeId)) {
      toast.error('工号必须是纯数字');
      return;
    }
    
    // 工号补0到11位
    const paddedEmployeeId = formData.employeeId.padStart(11, '0');
    
    setLoading(true);
    
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employeeId: paddedEmployeeId, password: formData.password }),
      });
      
      // 安全解析 JSON
      const text = await res.text();
      if (!text || text.trim() === '') {
        toast.error('登录失败', { description: '服务器响应异常' });
        setLoading(false);
        return;
      }
      
      let data;
      try {
        data = JSON.parse(text);
      } catch (parseError) {
        console.error('JSON parse error:', parseError);
        toast.error('登录失败', { description: '服务器响应格式错误' });
        setLoading(false);
        return;
      }
      
      if (data.success) {
        // 存储 session token 到 localStorage
        if (data.sessionToken) {
          localStorage.setItem('session_token', data.sessionToken);
        }
        toast.success('登录成功', { description: `欢迎回来，${data.user.name}` });
        // 使用 window.location 进行完整页面刷新，确保 cookie 被正确读取
        window.location.href = '/';
      } else {
        toast.error('登录失败', { description: data.error });
        setLoading(false);
      }
    } catch (error) {
      toast.error('登录失败', { description: '网络错误，请稍后重试' });
      setLoading(false);
    }
    // 注意：登录成功时不调用 setLoading(false)，因为页面即将跳转
  };

  // 检查登录状态中
  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-sm text-gray-500">检查登录状态...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">培训项目管理系统</CardTitle>
          <CardDescription>请登录您的账号</CardDescription>
        </CardHeader>
        <CardContent>
          {/* 会话超时提示 */}
          {sessionExpired && (
            <div className="mb-4 p-3 bg-orange-50 border border-orange-200 rounded-lg">
              <p className="text-sm text-orange-700">
                由于长时间未操作，您的会话已超时，请重新登录。
              </p>
            </div>
          )}
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="employeeId">工号</Label>
              <Input
                id="employeeId"
                type="text"
                placeholder="请输入工号（如：0000001）"
                value={formData.employeeId}
                onChange={(e) => setFormData({ ...formData, employeeId: e.target.value.replace(/\D/g, '') })}
                onBlur={(e) => {
                  const value = e.target.value.replace(/\D/g, '');
                  if (value) {
                    setFormData({ ...formData, employeeId: value.padStart(11, '0') });
                  }
                }}
                disabled={loading}
                maxLength={11}
              />
              <p className="text-xs text-gray-400">输入数字，不足11位自动补0</p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="password">密码</Label>
              <Input
                id="password"
                type="password"
                placeholder="请输入密码"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                disabled={loading}
              />
            </div>
            
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  登录中...
                </>
              ) : (
                <>
                  <LogIn className="w-4 h-4 mr-2" />
                  登录
                </>
              )}
            </Button>
          </form>
          
          <div className="mt-6 text-center text-sm text-gray-500">
            还没有账号？{' '}
            <Link href="/register" className="text-blue-600 hover:underline">
              立即注册
            </Link>
          </div>
          
          <div className="mt-4">
            <button
              type="button"
              onClick={() => setShowDebugAccount(!showDebugAccount)}
              className="w-full flex items-center justify-between p-3 bg-muted/50 hover:bg-muted rounded-lg text-xs text-muted-foreground transition-colors"
            >
              <span className="font-medium">系统调试账号</span>
              {showDebugAccount ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </button>
            {showDebugAccount && (
              <div className="p-3 bg-blue-50 rounded-b-lg text-xs text-gray-600 border border-t-0 border-blue-100">
                <p>工号：00000000001</p>
                <p>密码：123456</p>
                <p className="mt-1 text-gray-400">（该账号仅供开发调试使用）</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
