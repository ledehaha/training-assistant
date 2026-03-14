import { useState, useEffect, useCallback } from 'react';
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

// 获取当前用户信息
export function useAuth() {
  const router = useRouter();
  const [state, setState] = useState<AuthState>({
    user: null,
    loading: true,
    authenticated: false,
    error: null,
  });

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
  const logout = useCallback(async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      setState({
        user: null,
        loading: false,
        authenticated: false,
        error: null,
      });
      router.push('/login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  }, [router]);

  // 初始化时获取用户信息
  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  return {
    ...state,
    refetch: fetchUser,
    logout,
  };
}

// 权限检查Hook
export function usePermission() {
  const { user, authenticated } = useAuth();
  
  // 检查是否有特定权限
  const hasPermission = useCallback((permissionCode: string): boolean => {
    if (!authenticated || !user?.role) return false;
    
    // 系统管理员拥有所有权限
    if (user.role.code === 'admin') return true;
    
    // 这里可以根据实际的权限配置进行检查
    // 目前使用简单的角色判断
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
  
  // 检查是否是管理员
  const isAdmin = user?.role?.code === 'admin';
  
  // 检查是否是管理部门
  const isManagement = user?.department?.type === 'management';
  
  // 检查是否是学院
  const isCollege = user?.department?.type === 'college';
  
  // 检查是否可以审批项目
  const canApproveProject = hasPermission('project:approve');
  
  // 检查是否可以审核师资
  const canVerifyTeacher = hasPermission('teacher:verify');
  
  // 检查是否可以审批用户
  const canApproveUser = hasPermission('user:approve');
  
  // 检查是否可以编辑项目（自己的项目）
  const canEditProject = useCallback((projectDepartmentId?: string, projectCreatedById?: string): boolean => {
    if (!authenticated || !user) return false;
    
    // 管理部门不能编辑项目，只能审批
    if (isManagement) return false;
    
    // 学院用户可以编辑自己部门的项目
    if (projectDepartmentId === user.department?.id) return true;
    
    // 项目创建者可以编辑
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

// 角色代码枚举
export const RoleCode = {
  ADMIN: 'admin',
  DEPT_HEAD: 'dept_head',
  DEPT_STAFF: 'dept_staff',
  COLLEGE_ADMIN: 'college_admin',
  COLLEGE_STAFF: 'college_staff',
  HR_AUDITOR: 'hr_auditor',
} as const;

// 部门类型枚举
export const DepartmentType = {
  MANAGEMENT: 'management',
  COLLEGE: 'college',
} as const;
