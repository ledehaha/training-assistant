import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';

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

// 自动登出时间（30分钟）
const AUTO_LOGOUT_TIME = 30 * 60 * 1000;
const CHECK_INTERVAL = 60 * 1000;

// 获取当前用户信息
export function useAuth() {
  const router = useRouter();
  const [user, setUser] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const lastActivityRef = useRef<number>(Date.now());
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // 获取用户信息
  const fetchUser = useCallback(async () => {
    console.log('[useAuth] fetchUser called');
    
    try {
      // 从 localStorage 获取 session token
      const sessionToken = typeof window !== 'undefined' ? localStorage.getItem('session_token') : null;
      
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      
      // 如果有 token，添加到 Authorization header
      if (sessionToken && sessionToken.trim() !== '') {
        headers['Authorization'] = `Bearer ${sessionToken}`;
        console.log('[useAuth] Using token from localStorage');
      }
      
      const res = await fetch('/api/auth/me', {
        credentials: 'include',
        headers,
      });
      
      // 安全解析 JSON
      const contentType = res.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        console.log('[useAuth] Response is not JSON');
        setUser(null);
        setAuthenticated(false);
        return;
      }
      
      const text = await res.text();
      if (!text || text.trim() === '') {
        console.log('[useAuth] Empty response');
        setUser(null);
        setAuthenticated(false);
        return;
      }
      
      const data = JSON.parse(text);
      
      console.log('[useAuth] API response:', data);
      
      if (data.authenticated && data.user) {
        setUser(data.user);
        setAuthenticated(true);
        lastActivityRef.current = Date.now();
      } else {
        setUser(null);
        setAuthenticated(false);
        // 清除无效的 token
        if (typeof window !== 'undefined') {
          localStorage.removeItem('session_token');
        }
      }
    } catch (error) {
      console.error('[useAuth] Fetch user error:', error);
      setUser(null);
      setAuthenticated(false);
    } finally {
      setLoading(false);
      console.log('[useAuth] Loading set to false');
    }
  }, []);

  // 登出
  const logout = useCallback(async (redirectToLogin = true) => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (error) {
      console.error('Logout error:', error);
    }
    
    // 清除 localStorage 中的 token
    if (typeof window !== 'undefined') {
      localStorage.removeItem('session_token');
    }
    
    setUser(null);
    setAuthenticated(false);
    
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    
    if (redirectToLogin) {
      // 使用 window.location 进行完整页面刷新，避免状态混乱
      window.location.href = '/login';
    }
  }, []);

  // 初始化获取用户信息
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
        logout(true);
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
  }, [authenticated, logout]);

  return {
    user,
    loading,
    authenticated,
    refetch: fetchUser,
    logout,
  };
}

// 权限检查Hook
export function usePermission(user?: UserInfo | null, authenticated?: boolean) {
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
  
  return {
    hasPermission,
    isAdmin,
    isManagement,
    isCollege,
    canApproveProject: hasPermission('project:approve'),
    canVerifyTeacher: hasPermission('teacher:verify'),
    canApproveUser: hasPermission('user:approve'),
    canEditProject: useCallback((projectDeptId?: string, projectCreatorId?: string): boolean => {
      if (!authenticated || !user) return false;
      if (isManagement) return false;
      return projectDeptId === user.department?.id || projectCreatorId === user.id;
    }, [authenticated, user, isManagement]),
    user,
    authenticated,
  };
}
