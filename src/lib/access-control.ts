/**
 * 用户访问权限检查工具
 * 实现基于角色和部门的数据隔离规则
 */

import { cookies } from 'next/headers';
import type { NextRequest } from 'next/server';
import { db, users, departments, eq, and, sql } from '@/storage/database';

// 用户信息类型
export interface UserInfo {
  userId: string;
  username?: string;
  name?: string;
  roleId?: string;
  roleCode?: string;
  roleName?: string;
  departmentId?: string | null;
  departmentType?: string; // 'college' | 'management'
}

// 角色级别定义
export const ROLE_LEVELS = {
  college_staff: 20,
  college_admin: 30,
  dept_staff: 40,
  hr_auditor: 45,
  dept_head: 50,
  admin: 100,
} as const;

// 项目状态定义
export type ProjectStatus = 
  | 'draft' 
  | 'designing' 
  | 'pending_approval' 
  | 'approved' 
  | 'executing' 
  | 'completed' 
  | 'archived';

// ==================== 用户信息获取 ====================

/**
 * 从请求中获取当前用户信息
 */
export async function getCurrentUser(request?: NextRequest): Promise<UserInfo | null> {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('session');
    const authHeader = request?.headers.get('authorization');
    
    let session: UserInfo | null = null;
    
    // 从 Cookie 获取
    if (sessionCookie?.value) {
      try {
        session = JSON.parse(sessionCookie.value);
      } catch {
        // 忽略解析错误
      }
    }
    
    // 从 Authorization header 获取
    if (!session && authHeader?.startsWith('Bearer ')) {
      try {
        const token = authHeader.substring(7);
        const decoded = Buffer.from(token, 'base64').toString('utf-8');
        session = JSON.parse(decoded);
      } catch {
        // 忽略解析错误
      }
    }
    
    // 补充部门类型信息
    if (session?.departmentId) {
      try {
        const dept = await db.select()
          .from(departments)
          .where(eq(departments.id, session.departmentId))
          .limit(1);
        if (dept[0]) {
          session.departmentType = dept[0].type;
        }
      } catch {
        // 忽略错误
      }
    }
    
    return session;
  } catch {
    return null;
  }
}

// ==================== 角色检查函数 ====================

/**
 * 检查用户是否是管理员
 */
export function isAdmin(user: UserInfo | null): boolean {
  return user?.roleCode === 'admin';
}

/**
 * 检查用户是否是学院用户（学院员工或学院负责人）
 */
export function isCollegeUser(user: UserInfo | null): boolean {
  return user?.roleCode === 'college_staff' || user?.roleCode === 'college_admin';
}

/**
 * 检查用户是否是学院负责人
 */
export function isCollegeAdmin(user: UserInfo | null): boolean {
  return user?.roleCode === 'college_admin';
}

/**
 * 检查用户是否是管理部门用户
 */
export function isManagementUser(user: UserInfo | null): boolean {
  return user?.departmentType === 'management';
}

/**
 * 检查用户是否是部门负责人
 */
export function isDeptHead(user: UserInfo | null): boolean {
  return user?.roleCode === 'dept_head';
}

/**
 * 检查用户是否有审批权限
 */
export function canApproveProject(user: UserInfo | null): boolean {
  return user?.roleCode === 'dept_head' || user?.roleCode === 'admin';
}

/**
 * 获取角色级别
 */
export function getRoleLevel(user: UserInfo | null): number {
  if (!user?.roleCode) return 0;
  return ROLE_LEVELS[user.roleCode as keyof typeof ROLE_LEVELS] || 0;
}

// ==================== 项目访问规则 ====================

/**
 * 检查用户是否可以查看项目列表
 * @param status 项目状态
 * @param user 当前用户
 * @param projectCreatorId 项目创建者ID
 * @param projectDeptId 项目所属部门ID
 */
export function canViewProject(
  status: ProjectStatus,
  user: UserInfo | null,
  projectCreatorId: string,
  projectDeptId?: string
): boolean {
  // 管理员可以看所有项目
  if (isAdmin(user)) return true;
  
  // 未登录用户不能看
  if (!user?.userId) return false;
  
  // 归档项目：所有人可见
  if (status === 'archived') return true;
  
  // 草稿和设计中：只有创建者可见
  if (status === 'draft' || status === 'designing') {
    return user.userId === projectCreatorId;
  }
  
  // 待审批、执行中、已完成：
  // - 创建者可见
  if (user.userId === projectCreatorId) return true;
  
  // - 学院负责人可见本学院项目
  if (isCollegeAdmin(user) && projectDeptId === user.departmentId) return true;
  
  // - 管理部门用户在待审批时可见（按审批职责）
  if (status === 'pending_approval' && isManagementUser(user)) return true;
  
  // - 部门负责人可以看
  if (isDeptHead(user)) return true;
  
  return false;
}

/**
 * 构建项目查询的WHERE条件
 * @param user 当前用户
 * @param statusFilter 状态过滤
 */
export function buildProjectQueryConditions(
  user: UserInfo | null,
  statusFilter?: ProjectStatus | ProjectStatus[]
): {
  canViewAll: boolean;
  departmentId?: string;
  userId?: string;
  statusRestrictions?: ProjectStatus[];
} {
  // 管理员可以看所有
  if (isAdmin(user)) {
    return { canViewAll: true };
  }
  
  // 未登录用户
  if (!user?.userId) {
    return { canViewAll: false, statusRestrictions: ['archived'] };
  }
  
  // 学院负责人：可看本学院项目 + 所有归档项目
  if (isCollegeAdmin(user)) {
    return {
      canViewAll: false,
      departmentId: user.departmentId || undefined,
      userId: user.userId, // 自己创建的项目
    };
  }
  
  // 部门负责人：可看所有非草稿/设计中的项目
  if (isDeptHead(user)) {
    return {
      canViewAll: false,
      statusRestrictions: ['pending_approval', 'approved', 'executing', 'completed', 'archived'],
    };
  }
  
  // 管理部门普通员工：可看待审批和归档项目
  if (isManagementUser(user)) {
    return {
      canViewAll: false,
      statusRestrictions: ['pending_approval', 'archived'],
    };
  }
  
  // 普通学院员工：只能看自己的项目 + 所有归档项目
  return {
    canViewAll: false,
    userId: user.userId,
  };
}

/**
 * 检查用户是否可以编辑项目
 */
export function canEditProject(
  user: UserInfo | null,
  projectCreatorId: string,
  projectDeptId?: string
): boolean {
  // 管理员可以编辑所有
  if (isAdmin(user)) return true;
  
  if (!user?.userId) return false;
  
  // 创建者可以编辑自己的项目
  if (user.userId === projectCreatorId) return true;
  
  // 学院负责人可以编辑本学院项目
  if (isCollegeAdmin(user) && projectDeptId === user.departmentId) return true;
  
  return false;
}

/**
 * 检查用户是否可以删除项目
 * @param status 项目状态
 */
export function canDeleteProject(
  status: ProjectStatus,
  user: UserInfo | null,
  projectCreatorId: string
): boolean {
  // 管理员可以删除所有
  if (isAdmin(user)) return true;
  
  if (!user?.userId) return false;
  
  // 归档后的项目：只有管理员可以删除
  if (status === 'archived') return false;
  
  // 设计和申报阶段：创建者可以删除
  if (status === 'draft' || status === 'designing') {
    return user.userId === projectCreatorId;
  }
  
  // 其他状态：创建者可以删除
  return user.userId === projectCreatorId;
}

// ==================== 归档项目详情访问 ====================

/**
 * 检查用户是否可以查看归档项目详情
 * 需要检查共享记录
 */
export async function canViewArchivedProjectDetail(
  projectId: string,
  user: UserInfo | null,
  projectCreatorId: string,
  projectDeptId?: string
): Promise<{ canView: boolean; reason: string }> {
  // 管理员可以看
  if (isAdmin(user)) {
    return { canView: true, reason: 'admin' };
  }
  
  // 创建者可以看
  if (user?.userId === projectCreatorId) {
    return { canView: true, reason: 'creator' };
  }
  
  // 学院负责人可以直接看本学院项目
  if (isCollegeAdmin(user) && projectDeptId === user?.departmentId) {
    return { canView: true, reason: 'college_admin' };
  }
  
  // 检查共享记录
  if (user?.userId) {
    try {
      const { projectShares } = await import('@/storage/database');
      const shares = await db.select()
        .from(projectShares)
        .where(and(
          eq(projectShares.projectId, projectId),
          eq(projectShares.sharedWith, user.userId),
          eq(projectShares.status, 'approved')
        ))
        .limit(1);
      
      if (shares.length > 0) {
        // 检查是否过期
        const share = shares[0];
        if (share.expiresAt) {
          const expiresAt = new Date(share.expiresAt);
          if (expiresAt > new Date()) {
            return { canView: true, reason: 'shared' };
          }
        } else {
          return { canView: true, reason: 'shared' };
        }
      }
    } catch {
      // 忽略错误
    }
  }
  
  return { canView: false, reason: 'no_permission' };
}

// ==================== 其他数据模块访问规则 ====================

/**
 * 检查是否可以添加/编辑数据（场地、课程模板、参访基地、讲师）
 */
export function canAddData(user: UserInfo | null): boolean {
  // 管理员、学院员工、学院负责人可以添加
  if (isAdmin(user)) return true;
  if (isCollegeUser(user)) return true;
  return false;
}

/**
 * 检查是否可以删除数据（场地、课程模板、参访基地、讲师）
 * 规则：创建者可以删除，管理员可以删除
 */
export function canDeleteData(
  user: UserInfo | null,
  creatorId: string
): boolean {
  if (isAdmin(user)) return true;
  if (!user?.userId) return false;
  return user.userId === creatorId;
}

/**
 * 检查是否可以编辑数据（场地、课程模板、参访基地、讲师）
 * 规则：创建者可以编辑，学院负责人可以编辑本学院的，管理员可以编辑所有
 */
export function canEditData(
  user: UserInfo | null,
  creatorId: string,
  deptId?: string
): boolean {
  if (isAdmin(user)) return true;
  if (!user?.userId) return false;
  if (user.userId === creatorId) return true;
  if (isCollegeAdmin(user) && deptId === user.departmentId) return true;
  return false;
}

/**
 * 检查是否可以访问满意度调查
 * 规则：仅同学院人员可访问
 */
export function canAccessSatisfactionSurvey(
  user: UserInfo | null,
  surveyDeptId?: string
): boolean {
  // 管理员可以访问所有
  if (isAdmin(user)) return true;
  
  if (!user?.userId) return false;
  
  // 必须是学院用户
  if (!isCollegeUser(user)) return false;
  
  // 同学院才能访问
  return user.departmentId === surveyDeptId;
}

/**
 * 检查是否可以删除满意度调查
 */
export function canDeleteSatisfactionSurvey(
  user: UserInfo | null,
  creatorId: string,
  surveyDeptId?: string
): boolean {
  // 管理员可以删除
  if (isAdmin(user)) return true;
  
  // 创建者可以删除
  if (user?.userId === creatorId) return true;
  
  // 学院负责人可以删除本学院的
  if (isCollegeAdmin(user) && surveyDeptId === user?.departmentId) return true;
  
  return false;
}

/**
 * 检查是否可以操作规范性文件
 * 规则：所有人可上传查看，仅创建者和管理员可删除
 */
export function canDeleteNormativeDocument(
  user: UserInfo | null,
  creatorId: string
): boolean {
  if (isAdmin(user)) return true;
  if (!user?.userId) return false;
  return user.userId === creatorId;
}

// ==================== 同学院检查 ====================

/**
 * 检查两个用户是否属于同一学院
 */
export async function isSameDepartment(
  userId1: string,
  userId2: string
): Promise<boolean> {
  try {
    const user1 = await db.select()
      .from(users)
      .where(eq(users.id, userId1))
      .limit(1);
    const user2 = await db.select()
      .from(users)
      .where(eq(users.id, userId2))
      .limit(1);
    
    return user1[0]?.departmentId === user2[0]?.departmentId;
  } catch {
    return false;
  }
}
