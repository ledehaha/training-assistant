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

// 认证状态
export interface AuthState {
  user: UserInfo | null;
  loading: boolean;
  authenticated: boolean;
  error: string | null;
}

// 自动登出时间（30分钟，单位毫秒）
const AUTO_LOGOUT_TIME = 30 * 60 * 1000;
// 检查间隔（1分钟）
const CHECK_INTERVAL = 60 * 1000;

// 获取当前用户信息
export function useAuth() {
  const router = useRouter();
  const [state, setState] = useState<AuthState>({
    user: null,
    loading: true,
    authenticated: false,
    error: null,
  });
  
  // 最后活动时间
  const lastActivityRef = useRef<number>(Date.now());
  // 定时器引用
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // 获取用户信息
  const fetchUser = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, loading: true, error: null }));
      
      const res = await fetch('/api/auth/me');
      const data = await res.json();
      
      if (data.authenticated && data.user) {
        setState({
          user: data.user,
          loading: false,
          authenticated: true,
          error: null,
        });
        lastActivityRef.current = Date.now();
      } else {
        setState({
          user: null,
          loading: false,
          authenticated: false,
          error: data.error || '未登录',
        });
      }
    } catch (error) {
      setState({
        user: null,
        loading: false,
        authenticated: false,
        error: '获取用户信息失败',
      });
    }
  }, []);

  // 登出
  const logout = useCallback(async (redirectToLogin = true) => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      
      setState({
        user: null,
        loading: false,
        authenticated: false,
        error: null,
      });
      
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      
      if (redirectToLogin) {
        router.push('/login');
      }
    } catch (error) {
      console.error('Logout error:', error);
    }
  }, [router]);

  // 初始化时获取用户信息
  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  // 设置自动登出检测
  useEffect(() => {
    if (!state.authenticated) {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    lastActivityRef.current = Date.now();

    // 监听用户活动事件
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
    const handleActivity = () => {
      lastActivityRef.current = Date.now();
    };

    events.forEach(event => {
      document.addEventListener(event, handleActivity, { passive: true });
    });

    // 启动定时检查
    timerRef.current = setInterval(() => {
      const now = Date.now();
      const timeDiff = now - lastActivityRef.current;
      
      if (timeDiff >= AUTO_LOGOUT_TIME) {
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
  }, [state.authenticated, logout]);

  return {
    ...state,
    refetch: fetchUser,
    logout,
  };
}

// 权限检查Hook - 接受 user 和 authenticated 参数
export function usePermission(user?: UserInfo | null, authenticated?: boolean) {
  
  // 检查是否有特定权限
  const hasPermission = useCallback((permissionCode: string): boolean => {
    if (!authenticated || !user?.role) return false;
    
    // 系统管理员拥有所有权限
    if (user.role.code === 'admin') return true;
    
    const rolePermissions: Record<string, string[]> = {
      dept_head: ['project:view', 'project:approve', 'data:view', 'data:export'],
      dept_staff: ['project:view', 'data:view'],
      college_admin: ['project:create', 'project:view', 'project:edit', 'project:summary', 'project:share', 'data:view', 'data:export', 'teacher:create', 'venue:create'],
      college_staff: ['project:create', 'project:view', 'project:edit', 'data:view', 'teacher:create', 'venue:create'],
      hr_auditor: ['project:view', 'teacher:create', 'teacher:verify', 'user:approve'],
    };
    
    const permissions = rolePermissions[user.role.code] || [];
    return permissions.includes(permissionCode);
  }, [authenticated, user]);
  
  const isAdmin = user?.role?.code === 'admin';
  const isManagement = user?.department?.type === 'management';
  const isCollege = user?.department?.type === 'college';
  const canApproveProject = hasPermission('project:approve');
  const canVerifyTeacher = hasPermission('teacher:verify');
  const canApproveUser = hasPermission('user:approve');
  
  const canEditProject = useCallback((projectDepartmentId?: string, projectCreatedById?: string): boolean => {
    if (!authenticated || !user) return false;
    if (isManagement) return false;
    if (projectDepartmentId === user.department?.id) return true;
    if (projectCreatedById === user.id) return true;
    return false;
  }, [authenticated, user, isManagement]);
  
  return {
    hasPermission,
    isAdmin,
    isManagement,
    isCollege,
    canApproveProject,
    canVerifyTeacher,
    canApproveUser,
    canEditProject,
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
