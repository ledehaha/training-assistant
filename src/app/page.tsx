import MainLayout from '@/components/layout/main-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FolderKanban, Users, GraduationCap, CheckCircle, Clock, TrendingUp } from 'lucide-react';

// 模拟统计数据
const stats = [
  { name: '进行中项目', value: '12', icon: FolderKanban, color: 'bg-blue-500', change: '+2' },
  { name: '本月完成', value: '8', icon: CheckCircle, color: 'bg-green-500', change: '+3' },
  { name: '待审核', value: '3', icon: Clock, color: 'bg-yellow-500', change: '-1' },
  { name: '培训总人数', value: '1,256', icon: Users, color: 'bg-purple-500', change: '+156' },
];

const recentProjects = [
  { id: 1, name: '班组长能力提升培训', status: 'executing', participants: 50, progress: 75 },
  { id: 2, name: '新员工入职培训', status: 'designing', participants: 30, progress: 30 },
  { id: 3, name: '中层管理干部培训', status: 'designing', participants: 40, progress: 60 },
  { id: 4, name: '安全生产专题培训', status: 'completed', participants: 100, progress: 100 },
];

const statusMap: Record<string, { label: string; color: string }> = {
  draft: { label: '草稿', color: 'bg-gray-100 text-gray-700' },
  designing: { label: '设计中', color: 'bg-blue-100 text-blue-700' },
  executing: { label: '执行中', color: 'bg-indigo-100 text-indigo-700' },
  completed: { label: '已完成', color: 'bg-emerald-100 text-emerald-700' },
  archived: { label: '已归档', color: 'bg-gray-100 text-gray-500' },
};

export default function HomePage() {
  return (
    <MainLayout>
      <div className="space-y-6">
        {/* 页面标题 */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">仪表盘</h1>
          <p className="text-gray-500 mt-1">欢迎回来，查看您的培训项目概览</p>
        </div>

        {/* 统计卡片 */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat) => (
            <Card key={stat.name}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">{stat.name}</p>
                    <p className="text-2xl font-bold text-gray-900 mt-1">{stat.value}</p>
                    <p className="text-xs text-green-600 mt-1">{stat.change} 较上月</p>
                  </div>
                  <div className={`p-3 rounded-full ${stat.color}`}>
                    <stat.icon className="w-6 h-6 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* 最近项目 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>最近项目</CardTitle>
              <CardDescription>您最近的培训项目进度</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {recentProjects.map((project) => (
                  <div key={project.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-4">
                      <div className="p-2 bg-blue-100 rounded-lg">
                        <GraduationCap className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{project.name}</p>
                        <p className="text-sm text-gray-500">{project.participants}人参训</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="w-32">
                        <div className="flex justify-between text-xs text-gray-500 mb-1">
                          <span>进度</span>
                          <span>{project.progress}%</span>
                        </div>
                        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-blue-500 rounded-full"
                            style={{ width: `${project.progress}%` }}
                          />
                        </div>
                      </div>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusMap[project.status].color}`}>
                        {statusMap[project.status].label}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* 快速操作 */}
          <Card>
            <CardHeader>
              <CardTitle>快速操作</CardTitle>
              <CardDescription>常用功能入口</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <a
                  href="/design"
                  className="flex items-center gap-3 p-3 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors"
                >
                  <FolderKanban className="w-5 h-5" />
                  <span className="font-medium">新建培训项目</span>
                </a>
                <a
                  href="/query"
                  className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 text-gray-700 hover:bg-gray-100 transition-colors"
                >
                  <Users className="w-5 h-5" />
                  <span className="font-medium">查询历史项目</span>
                </a>
                <a
                  href="/summary"
                  className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 text-gray-700 hover:bg-gray-100 transition-colors"
                >
                  <TrendingUp className="w-5 h-5" />
                  <span className="font-medium">查看满意度报告</span>
                </a>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 业务流程提示 */}
        <Card>
          <CardHeader>
            <CardTitle>业务流程</CardTitle>
            <CardDescription>非学历培训全周期管理流程</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-4">
              {[
                { name: '需求分析', icon: '📝' },
                { name: '方案生成', icon: '📋' },
                { name: '项目申报', icon: '📄' },
                { name: '项目执行', icon: '🎯' },
                { name: '总结归档', icon: '📊' },
                { name: '数据分析', icon: '📈' },
              ].map((step, index) => (
                <div key={step.name} className="flex items-center">
                  <div className="flex flex-col items-center p-3 bg-white border rounded-lg shadow-sm min-w-[80px]">
                    <span className="text-2xl mb-1">{step.icon}</span>
                    <span className="text-xs font-medium text-gray-700">{step.name}</span>
                  </div>
                  {index < 5 && (
                    <div className="hidden sm:block w-4 h-px bg-gray-300 mx-1" />
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
