'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';

interface Department {
  id: string;
  name: string;
  code: string;
  type: string;
  parentId: string | null;
}

export default function RegisterPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [formData, setFormData] = useState({
    password: '',
    confirmPassword: '',
    name: '',
    employeeId: '',
    departmentId: '',
    phone: '',
    email: '',
  });

  // 加载部门列表
  useEffect(() => {
    fetch('/api/departments')
      .then(res => res.json())
      .then(data => {
        if (data.data) {
          setDepartments(data.data);
        }
      })
      .catch(error => {
        console.error('Load departments error:', error);
      });
  }, []);

  // 按类型分组部门
  const managementDepts = departments.filter(d => d.type === 'management');
  const collegeDepts = departments.filter(d => d.type === 'college');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // 验证
    if (!formData.password || !formData.name || !formData.employeeId || !formData.departmentId) {
      toast.error('请填写必填信息');
      return;
    }
    
    if (formData.password !== formData.confirmPassword) {
      toast.error('两次输入的密码不一致');
      return;
    }
    
    // 工号验证：必须是数字，不足11位自动补0
    if (!/^\d+$/.test(formData.employeeId)) {
      toast.error('工号必须是纯数字');
      return;
    }
    
    if (formData.password.length < 6) {
      toast.error('密码长度至少6位');
      return;
    }
    
    // 工号补0到11位
    const paddedEmployeeId = formData.employeeId.padStart(11, '0');
    
    setLoading(true);
    
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: paddedEmployeeId, // 工号作为用户名
          password: formData.password,
          name: formData.name,
          employeeId: paddedEmployeeId,
          departmentId: formData.departmentId,
          phone: formData.phone || undefined,
          email: formData.email || undefined,
        }),
      });
      
      const data = await res.json();
      
      if (data.success) {
        toast.success('注册成功', { description: '请等待管理员审批后登录' });
        router.push('/login');
      } else {
        toast.error('注册失败', { description: data.error });
      }
    } catch (error) {
      toast.error('注册失败', { description: '网络错误，请稍后重试' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-8">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">用户注册</CardTitle>
          <CardDescription>注册后需等待管理员审批</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">姓名 *</Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="真实姓名"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  disabled={loading}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="employeeId">工号 *</Label>
                <Input
                  id="employeeId"
                  type="text"
                  placeholder="如：0000001"
                  value={formData.employeeId}
                  onChange={(e) => setFormData({ ...formData, employeeId: e.target.value.replace(/\D/g, '') })}
                  disabled={loading}
                  maxLength={11}
                />
                <p className="text-xs text-gray-500">输入数字，不足11位自动补0</p>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="departmentId">所属部门 *</Label>
              <Select
                value={formData.departmentId}
                onValueChange={(value) => setFormData({ ...formData, departmentId: value })}
                disabled={loading}
              >
                <SelectTrigger>
                  <SelectValue placeholder="请选择所属部门" />
                </SelectTrigger>
                <SelectContent>
                  {managementDepts.length > 0 && (
                    <optgroup label="管理部门">
                      {managementDepts.map(dept => (
                        <SelectItem key={dept.id} value={dept.id}>
                          {dept.name}
                        </SelectItem>
                      ))}
                    </optgroup>
                  )}
                  {collegeDepts.length > 0 && (
                    <optgroup label="学院">
                      {collegeDepts.map(dept => (
                        <SelectItem key={dept.id} value={dept.id}>
                          {dept.name}
                        </SelectItem>
                      ))}
                    </optgroup>
                  )}
                </SelectContent>
              </Select>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="password">密码 *</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="至少6位"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  disabled={loading}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">确认密码 *</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="再次输入密码"
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                  disabled={loading}
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="phone">手机号</Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="手机号码"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  disabled={loading}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="email">邮箱</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="电子邮箱"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  disabled={loading}
                />
              </div>
            </div>
            
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  注册中...
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4 mr-2" />
                  注册
                </>
              )}
            </Button>
          </form>
          
          <div className="mt-6 text-center text-sm text-gray-500">
            已有账号？{' '}
            <Link href="/login" className="text-blue-600 hover:underline">
              立即登录
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
