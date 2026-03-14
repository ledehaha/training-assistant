'use client';

import { useState, useEffect } from 'react';
import MainLayout from '@/components/layout/main-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Users, UserCheck, UserX, Clock, CheckCircle, XCircle, 
  Loader2, Search, RefreshCw, Shield, Building2
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth, usePermission, RoleCode } from '@/hooks/useAuth';

interface User {
  id: string;
  username: string;
  name: string;
  employeeId: string;
  phone?: string;
  email?: string;
  status: string;
  createdAt: string;
  approvedBy?: string;
  approvedAt?: string;
  department?: {
    id: string;
    name: string;
    code: string;
    type: string;
  };
  role?: {
    id: string;
    name: string;
    code: string;
  };
}

export default function UserManagementPage() {
  const { user, authenticated, loading: authLoading } = useAuth();
  const { canApproveUser, isAdmin } = usePermission(user, authenticated);
  
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('pending');
  const [searchTerm, setSearchTerm] = useState('');
  
  // 审批对话框
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [selectedRoleId, setSelectedRoleId] = useState('');
  const [approving, setApproving] = useState(false);
  
  // 角色列表
  const [roles, setRoles] = useState<Array<{id: string; name: string; code: string}>>([]);

  // 加载用户列表
  const loadUsers = async (status?: string) => {
    setLoading(true);
    try {
      let url = '/api/users';
      if (status) {
        url += `?status=${status}`;
      }
      const res = await fetch(url, { credentials: 'include' });
      const data = await res.json();
      
      if (data.data) {
        setUsers(data.data);
      } else if (data.error) {
        toast.error(data.error);
      }
    } catch (error) {
      console.error('Load users error:', error);
      toast.error('加载用户列表失败');
    } finally {
      setLoading(false);
    }
  };

  // 加载角色列表
  const loadRoles = async () => {
    try {
      const res = await fetch('/api/roles', { credentials: 'include' });
      const data = await res.json();
      if (data.data) {
        setRoles(data.data);
      }
    } catch (error) {
      console.error('Load roles error:', error);
    }
  };

  useEffect(() => {
    if (authenticated && canApproveUser) {
      loadUsers(activeTab === 'all' ? undefined : activeTab);
      loadRoles();
    }
  }, [authenticated, activeTab, canApproveUser]);

  // 权限检查
  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!authenticated) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-500">请先登录</p>
      </div>
    );
  }

  if (!canApproveUser) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Card className="max-w-md">
            <CardContent className="p-6 text-center">
              <Shield className="w-12 h-12 mx-auto text-red-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">无权限访问</h3>
              <p className="text-gray-500">只有管理员或人事处可以访问此页面</p>
            </CardContent>
          </Card>
        </div>
      </MainLayout>
    );
  }

  // 审批用户
  const handleApprove = async (action: 'approve' | 'reject') => {
    if (!selectedUser) return;
    
    setApproving(true);
    try {
      const res = await fetch('/api/users', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          userId: selectedUser.id,
          action,
          roleId: action === 'approve' ? selectedRoleId : undefined,
        }),
      });
      
      const data = await res.json();
      
      if (data.success) {
        toast.success(data.message);
        setShowApproveDialog(false);
        setSelectedUser(null);
        loadUsers(activeTab === 'all' ? undefined : activeTab);
      } else {
        toast.error(data.error);
      }
    } catch (error) {
      toast.error('操作失败');
    } finally {
      setApproving(false);
    }
  };

  // 快速审批
  const handleQuickAction = async (userId: string, action: 'approve' | 'reject' | 'disable' | 'enable') => {
    try {
      const res = await fetch('/api/users', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ userId, action }),
      });
      
      const data = await res.json();
      
      if (data.success) {
        toast.success(data.message);
        loadUsers(activeTab === 'all' ? undefined : activeTab);
      } else {
        toast.error(data.error);
      }
    } catch (error) {
      toast.error('操作失败');
    }
  };

  // 打开审批对话框
  const openApproveDialog = (user: User) => {
    setSelectedUser(user);
    // 默认选择当前角色
    setSelectedRoleId(user.role?.id || '');
    setShowApproveDialog(true);
  };

  // 过滤用户
  const filteredUsers = users.filter(u => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      u.name.toLowerCase().includes(term) ||
      u.username.toLowerCase().includes(term) ||
      u.employeeId.includes(term) ||
      u.department?.name.toLowerCase().includes(term)
    );
  });

  const statusColors: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-700',
    active: 'bg-green-100 text-green-700',
    disabled: 'bg-gray-100 text-gray-500',
  };

  const statusLabels: Record<string, string> = {
    pending: '待审批',
    active: '正常',
    disabled: '已禁用',
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* 页面标题 */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">用户管理</h1>
            <p className="text-gray-500 mt-1">管理用户账号和审批注册申请</p>
          </div>
          <Button variant="outline" onClick={() => loadUsers(activeTab === 'all' ? undefined : activeTab)}>
            <RefreshCw className="w-4 h-4 mr-2" />
            刷新
          </Button>
        </div>

        {/* 统计卡片 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="cursor-pointer hover:border-yellow-500" onClick={() => setActiveTab('pending')}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-yellow-100 flex items-center justify-center">
                  <Clock className="w-5 h-5 text-yellow-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">待审批</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {users.filter(u => u.status === 'pending').length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="cursor-pointer hover:border-green-500" onClick={() => setActiveTab('active')}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">正常用户</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {users.filter(u => u.status === 'active').length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="cursor-pointer hover:border-gray-500" onClick={() => setActiveTab('disabled')}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
                  <XCircle className="w-5 h-5 text-gray-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">已禁用</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {users.filter(u => u.status === 'disabled').length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 用户列表 */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>用户列表</CardTitle>
              <div className="flex items-center gap-3">
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="搜索用户..."
                    className="pl-9 pr-4 py-2 border rounded-md text-sm"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <Tabs value={activeTab} onValueChange={setActiveTab}>
                  <TabsList>
                    <TabsTrigger value="pending">待审批</TabsTrigger>
                    <TabsTrigger value="active">正常</TabsTrigger>
                    <TabsTrigger value="disabled">已禁用</TabsTrigger>
                    <TabsTrigger value="all">全部</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">
                <Loader2 className="w-6 h-6 mx-auto animate-spin text-blue-600" />
                <p className="mt-2 text-gray-500">加载中...</p>
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Users className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                <p>暂无用户数据</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>用户名</TableHead>
                    <TableHead>姓名</TableHead>
                    <TableHead>工号</TableHead>
                    <TableHead>部门</TableHead>
                    <TableHead>角色</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead>注册时间</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell className="font-medium">{u.username}</TableCell>
                      <TableCell>{u.name}</TableCell>
                      <TableCell>{u.employeeId}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Building2 className="w-4 h-4 text-gray-400" />
                          <span>{u.department?.name || '-'}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{u.role?.name || '-'}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={statusColors[u.status]}>
                          {statusLabels[u.status]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-gray-500 text-sm">
                        {new Date(u.createdAt).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">
                        {u.status === 'pending' && (
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              size="sm"
                              variant="default"
                              onClick={() => openApproveDialog(u)}
                            >
                              <UserCheck className="w-4 h-4 mr-1" />
                              审批
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleQuickAction(u.id, 'reject')}
                            >
                              <UserX className="w-4 h-4 mr-1" />
                              拒绝
                            </Button>
                          </div>
                        )}
                        {u.status === 'active' && u.id !== user?.id && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleQuickAction(u.id, 'disable')}
                          >
                            禁用
                          </Button>
                        )}
                        {u.status === 'disabled' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleQuickAction(u.id, 'enable')}
                          >
                            启用
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 审批对话框 */}
      <Dialog open={showApproveDialog} onOpenChange={setShowApproveDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>审批用户注册</DialogTitle>
            <DialogDescription>
              确认审批该用户注册申请，并为其分配合适的角色
            </DialogDescription>
          </DialogHeader>
          
          {selectedUser && (
            <div className="space-y-4 py-4">
              <div className="p-4 bg-gray-50 rounded-lg space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-500">用户名：</span>
                  <span className="font-medium">{selectedUser.username}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">姓名：</span>
                  <span className="font-medium">{selectedUser.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">工号：</span>
                  <span className="font-medium">{selectedUser.employeeId}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">部门：</span>
                  <span className="font-medium">{selectedUser.department?.name}</span>
                </div>
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium">分配角色</label>
                <Select value={selectedRoleId} onValueChange={setSelectedRoleId}>
                  <SelectTrigger>
                    <SelectValue placeholder="选择角色" />
                  </SelectTrigger>
                  <SelectContent>
                    {roles.map((role) => (
                      <SelectItem key={role.id} value={role.id}>
                        {role.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowApproveDialog(false)}>
              取消
            </Button>
            <Button variant="outline" onClick={() => handleApprove('reject')} disabled={approving}>
              拒绝
            </Button>
            <Button onClick={() => handleApprove('approve')} disabled={approving}>
              {approving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  处理中...
                </>
              ) : (
                <>
                  <UserCheck className="w-4 h-4 mr-2" />
                  通过
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
