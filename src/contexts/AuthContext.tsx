'use client';

import { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode, memo } from 'react';
import { useRouter, usePathname } from 'next/navigation';

// 用户信息类型
export interface UserInfo {
  id: string;
  username: string;
  name: string;
  employeeId: string;
  phone?: string;
  email?: string;
  avatar?: string;
  status: string;
  role: {
    id: string;
    name: string;
    code: string;
    level: number;
  } | null;
  department: {
    id: string;
    name: string;
    code: string;
    type: string;
    parentId?: string;
  } | null;
  lastLoginAt?: string;
}

// Context 类型
interface AuthContextType {
  user: UserInfo | null;
  loading: boolean;
  authenticated: boolean;
  refetch: () => Promise<void>;
  logout: (redirectToLogin?: boolean) => Promise<void>;
}

// 创建 Context
const AuthContext = createContext<AuthContextType | null>(null);

// 自动登出时间（30分钟）
const AUTO_LOGOUT_TIME = 30 * 60 * 1000;
const CHECK_INTERVAL = 60 * 1000;

// Provider 组件
export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const lastActivityRef = useRef<number>(Date.now());
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const fetchingRef = useRef(false);

  // 获取用户信息
  const fetchUser = useCallback(async () => {
    // 防止重复请求
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    
    try {
      const sessionToken = typeof window !== 'undefined' ? localStorage.getItem('session_token') : null;
      
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      
      if (sessionToken && sessionToken.trim() !== '') {
        headers['Authorization'] = `Bearer ${sessionToken}`;
      }
      
      const res = await fetch('/api/auth/me', {
        credentials: 'include',
        headers,
      });
      
      // 如果返回 401，清理本地状态
      if (res.status === 401) {
        setUser(null);
        setAuthenticated(false);
        if (typeof window !== 'undefined') {
          localStorage.removeItem('session_token');
        }
        return;
      }
      
      const contentType = res.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        setUser(null);
        setAuthenticated(false);
        return;
      }
      
      const text = await res.text();
      if (!text || text.trim() === '') {
        setUser(null);
        setAuthenticated(false);
        return;
      }
      
      let data;
      try {
        data = JSON.parse(text);
      } catch (parseError) {
        console.error('[AuthProvider] JSON parse error:', parseError, 'Response text:', text.substring(0, 100));
        setUser(null);
        setAuthenticated(false);
        return;
      }
      
      if (data.authenticated && data.user) {
        setUser(data.user);
        setAuthenticated(true);
        lastActivityRef.current = Date.now();
      } else {
        setUser(null);
        setAuthenticated(false);
        if (typeof window !== 'undefined') {
          localStorage.removeItem('session_token');
        }
      }
    } catch (error) {
      console.error('[AuthProvider] Fetch user error:', error);
      setUser(null);
      setAuthenticated(false);
    } finally {
      setLoading(false);
      fetchingRef.current = false;
    }
  }, []);

  // 登出
  const logout = useCallback(async (redirectToLogin = true) => {
    // 先清理本地状态，防止重复调用
    if (typeof window !== 'undefined') {
      localStorage.removeItem('session_token');
    }
    
    setUser(null);
    setAuthenticated(false);
    
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    
    // 然后尝试通知服务器
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000); // 3秒超时
      
      await fetch('/api/auth/logout', { 
        method: 'POST',
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
    } catch (error) {
      // 忽略登出错误，本地状态已清理
      console.log('Logout request failed (ignored):', error);
    }
    
    if (redirectToLogin) {
      // 使用 replace 而不是 href，避免浏览器历史记录问题
      window.location.replace('/login');
    }
  }, []);

  // 初始化：只在首次挂载时获取用户信息
  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  // 自动登出检测
  useEffect(() => {
    if (!authenticated) {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    const handleActivity = () => {
      lastActivityRef.current = Date.now();
    };

    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
    events.forEach(event => {
      document.addEventListener(event, handleActivity, { passive: true });
    });

    timerRef.current = setInterval(() => {
      if (Date.now() - lastActivityRef.current >= AUTO_LOGOUT_TIME) {
        // 清理定时器，防止重复触发
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
        
        // 清理本地状态
        if (typeof window !== 'undefined') {
          localStorage.removeItem('session_token');
        }
        setUser(null);
        setAuthenticated(false);
        
        // 先显示提示，延迟跳转让用户看到提示信息
        alert('由于长时间未操作，您已自动退出登录。即将跳转到登录页面...');
        
        // 延迟 500ms 后跳转，确保提示信息被显示
        setTimeout(() => {
          // 使用 replace 而不是 href，避免浏览器历史记录问题
          window.location.replace('/login');
        }, 500);
      }
    }, CHECK_INTERVAL);

    return () => {
      events.forEach(event => {
        document.removeEventListener(event, handleActivity);
      });
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [authenticated]);

  // Context 值使用 useMemo 缓存
  const contextValue = {
    user,
    loading,
    authenticated,
    refetch: fetchUser,
    logout,
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

// 使用 Auth Context 的 Hook
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

// 权限检查 Hook
export function usePermission() {
  const { user, authenticated } = useAuth();
  
  const hasPermission = useCallback((permissionCode: string): boolean => {
    if (!authenticated || !user?.role) return false;
    if (user.role.code === 'admin') return true;
    
    const rolePermissions: Record<string, string[]> = {
      dept_head: ['project:view', 'project:approve', 'data:view', 'data:export'],
      dept_staff: ['project:view', 'data:view'],
      college_admin: ['project:create', 'project:view', 'project:edit', 'project:summary', 'project:share', 'data:view', 'data:export', 'teacher:create', 'venue:create'],
      college_staff: ['project:create', 'project:view', 'project:edit', 'data:view', 'teacher:create', 'venue:create'],
      hr_auditor: ['project:view', 'teacher:create', 'teacher:verify', 'user:approve'],
    };
    
    return (rolePermissions[user.role.code] || []).includes(permissionCode);
  }, [authenticated, user]);
  
  const isAdmin = user?.role?.code === 'admin';
  const isManagement = user?.department?.type === 'management';
  const isCollege = user?.department?.type === 'college';
  
  const canEditProject = useCallback((projectDeptId?: string, projectCreatorId?: string): boolean => {
    if (!authenticated || !user) return false;
    if (isManagement) return false;
    return projectDeptId === user.department?.id || projectCreatorId === user.id;
  }, [authenticated, user, isManagement]);
  
  return {
    hasPermission,
    isAdmin,
    isManagement,
    isCollege,
    canApproveProject: hasPermission('project:approve'),
    canVerifyTeacher: hasPermission('teacher:verify'),
    canApproveUser: hasPermission('user:approve'),
    canEditProject,
    user,
    authenticated,
  };
}
