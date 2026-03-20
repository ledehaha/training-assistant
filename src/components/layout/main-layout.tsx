'use client';

import { ReactNode, useState, useEffect, memo } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  FolderKanban,
  FileText,
  ClipboardCheck,
  Search,
  Settings,
  Menu,
  X,
  GraduationCap,
  Database,
  Users,
  LogOut,
  ChevronDown,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useAuth, usePermission } from '@/contexts/AuthContext';

interface MainLayoutProps {
  children: ReactNode;
}

// 导航项组件 - 使用 memo 避免不必要的重新渲染
const NavigationItem = memo(function NavigationItem({
  item,
  isActive,
  onClick,
}: {
  item: { name: string; href: string; icon: React.ElementType };
  isActive: boolean;
  onClick?: () => void;
}) {
  return (
    <Link
      href={item.href}
      onClick={onClick}
      className={cn(
        'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
        isActive
          ? 'bg-blue-50 text-blue-700'
          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
      )}
    >
      <item.icon className="w-5 h-5" />
      {item.name}
    </Link>
  );
});

// 用户菜单组件 - 使用 memo
const UserMenu = memo(function UserMenu({
  user,
  onLogout,
}: {
  user: NonNullable<ReturnType<typeof useAuth>['user']>;
  onLogout: () => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  
  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors"
      >
        <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-sm font-medium">
          {user.name.charAt(0)}
        </div>
        <span className="text-sm font-medium text-gray-700 hidden sm:inline">{user.name}</span>
        <ChevronDown className="w-4 h-4 text-gray-400" />
      </button>
      
      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border z-20">
            <div className="p-3 border-b">
              <p className="text-sm font-medium text-gray-900">{user.name}</p>
              <p className="text-xs text-gray-500">{user.role?.name}</p>
              <p className="text-xs text-gray-400">{user.department?.name || '系统管理员'}</p>
            </div>
            <div className="p-2">
              <button
                onClick={() => {
                  onLogout();
                  setIsOpen(false);
                }}
                className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              >
                <LogOut className="w-4 h-4" />
                退出登录
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
});

// 侧边栏组件 - 使用 memo
const Sidebar = memo(function Sidebar({
  navigation,
  pathname,
  onItemClick,
}: {
  navigation: Array<{ name: string; href: string; icon: React.ElementType }>;
  pathname: string;
  onItemClick?: () => void;
}) {
  return (
    <nav className="flex-1 px-4 py-4 space-y-1">
      {navigation.map((item) => (
        <NavigationItem
          key={item.name}
          item={item}
          isActive={pathname === item.href}
          onClick={onItemClick}
        />
      ))}
    </nav>
  );
});

export default function MainLayout({ children }: MainLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, authenticated, loading, logout } = useAuth();
  const { canApproveUser, isAdmin } = usePermission();

  // 不需要登录的页面
  const publicPages = ['/login', '/register'];
  const isPublicPage = publicPages.includes(pathname);

  // 登录状态检查 - 只在状态变化时执行
  useEffect(() => {
    if (!loading && !authenticated && !isPublicPage) {
      router.push('/login');
    }
  }, [loading, authenticated, isPublicPage, router]);

  // 导航项 - 使用稳定的引用
  const navigation = [
    { name: '仪表盘', href: '/', icon: LayoutDashboard },
    { name: '项目设计', href: '/design', icon: FolderKanban },
    { name: '项目申报', href: '/declaration', icon: FileText },
    { name: '项目总结', href: '/summary', icon: ClipboardCheck },
    { name: '项目查询', href: '/query', icon: Search },
    { name: '数据管理', href: '/admin/data', icon: Database },
    ...(canApproveUser ? [{ name: '用户管理', href: '/admin/users', icon: Users }] : []),
  ];

  // 公共页面直接渲染，不需要布局
  if (isPublicPage) {
    return <>{children}</>;
  }

  // 加载中状态
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-sm text-gray-500">加载中...</p>
        </div>
      </div>
    );
  }

  // 未登录状态（等待跳转）
  if (!authenticated) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-sm text-gray-500">正在跳转到登录页面...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 移动端侧边栏遮罩 */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-gray-600 bg-opacity-75 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* 移动端侧边栏 */}
      <div
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-lg transform transition-transform duration-300 ease-in-out lg:hidden',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex items-center justify-between h-16 px-6 border-b">
          <div className="flex items-center gap-2">
            <GraduationCap className="w-6 h-6 text-blue-600" />
            <span className="font-semibold text-gray-900">培训助手</span>
          </div>
          <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(false)}>
            <X className="w-5 h-5" />
          </Button>
        </div>
        <Sidebar
          navigation={navigation}
          pathname={pathname}
          onItemClick={() => setSidebarOpen(false)}
        />
      </div>

      {/* 桌面端侧边栏 */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col">
        <div className="flex flex-col flex-1 bg-white border-r border-gray-200">
          <div className="flex items-center h-16 px-6 border-b">
            <GraduationCap className="w-6 h-6 text-blue-600" />
            <span className="ml-2 font-semibold text-gray-900">非学历培训助手</span>
          </div>
          <Sidebar navigation={navigation} pathname={pathname} />
          <div className="p-4 border-t">
            <Link
              href="/settings"
              className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors"
            >
              <Settings className="w-5 h-5" />
              设置
            </Link>
          </div>
          
          {/* 用户信息（桌面端） */}
          {user && (
            <div className="p-4 border-t">
              <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-gray-50">
                <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-sm font-medium">
                  {user.name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{user.name}</p>
                  <p className="text-xs text-gray-500 truncate">{user.department?.name || '系统管理员'}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 主内容区 */}
      <div className="lg:pl-64">
        {/* 顶部栏 */}
        <header className="sticky top-0 z-30 flex items-center h-16 px-4 bg-white border-b border-gray-200 lg:px-6">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="w-5 h-5" />
          </Button>
          <div className="flex-1 lg:flex-none" />
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-500 hidden sm:inline">
              非学历培训全周期管理系统
            </span>
            
            {/* 用户菜单 */}
            {user ? (
              <UserMenu user={user} onLogout={() => logout(true)} />
            ) : (
              <Link href="/login">
                <Button size="sm">登录</Button>
              </Link>
            )}
          </div>
        </header>

        {/* 页面内容 */}
        <main className="p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
