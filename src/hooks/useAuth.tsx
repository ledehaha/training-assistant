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
    try {
      const res = await fetch('/api/auth/me');
      const data = await res.json();
      
      if (data.authenticated && data.user) {
        setUser(data.user);
        setAuthenticated(true);
        lastActivityRef.current = Date.now();
      } else {
        setUser(null);
        setAuthenticated(false);
      }
    } catch (error) {
      console.error('Fetch user error:', error);
      setUser(null);
      setAuthenticated(false);
    } finally {
      setLoading(false);
    }
  }, []);

  // 登出
  const logout = useCallback(async (redirectToLogin = true) => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (error) {
      console.error('Logout error:', error);
    }
    
    setUser(null);
    setAuthenticated(false);
    
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    
    if (redirectToLogin) {
      router.push('/login');
    }
  }, [router]);

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

// 需要登录的高阶组件
export function withAuth<P extends object>(Component: React.ComponentType<P>) {
  return function AuthenticatedComponent(props: P) {
    const { authenticated, loading } = useAuth();
    const router = useRouter();
    
    useEffect(() => {
      if (!loading && !authenticated) {
        router.push('/login');
      }
    }, [loading, authenticated, router]);
    
    if (loading) {
      return (
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      );
    }
    
    if (!authenticated) {
      return null;
    }
    
    return <Component {...props} />;
  };
}
