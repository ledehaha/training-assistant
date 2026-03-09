'use client';

import { useState, useEffect } from 'react';
import MainLayout from '@/components/layout/main-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Search, 
  Filter, 
  Download, 
  BarChart3, 
  TrendingUp,
  Users,
  Calendar,
  DollarSign,
  Star,
  FileText
} from 'lucide-react';

interface Project {
  id: string;
  name: string;
  status: string;
  training_target: string;
  target_audience: string;
  participant_count: number;
  training_days: number;
  total_budget: string;
  avg_satisfaction: string | null;
  created_at: string;
}

const statusMap: Record<string, { label: string; color: string }> = {
  draft: { label: '草稿', color: 'bg-gray-100 text-gray-700' },
  designing: { label: '设计中', color: 'bg-blue-100 text-blue-700' },
  pending_approval: { label: '待审批', color: 'bg-yellow-100 text-yellow-700' },
  approved: { label: '已批准', color: 'bg-green-100 text-green-700' },
  executing: { label: '执行中', color: 'bg-indigo-100 text-indigo-700' },
  completed: { label: '已完成', color: 'bg-emerald-100 text-emerald-700' },
  archived: { label: '已归档', color: 'bg-gray-100 text-gray-500' },
};

export default function QueryPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [filteredProjects, setFilteredProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);

  useEffect(() => {
    loadProjects();
  }, []);

  useEffect(() => {
    filterProjects();
  }, [searchTerm, statusFilter, projects]);

  const loadProjects = async () => {
    try {
      const res = await fetch('/api/projects');
      const data = await res.json();
      if (data.data) {
        setProjects(data.data);
        setFilteredProjects(data.data);
      }
    } catch (error) {
      console.error('Load projects error:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterProjects = () => {
    let filtered = projects;

    if (searchTerm) {
      filtered = filtered.filter((p) =>
        p.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter((p) => p.status === statusFilter);
    }

    setFilteredProjects(filtered);
  };

  // 统计数据
  const stats = {
    total: projects.length,
    completed: projects.filter((p) => p.status === 'completed' || p.status === 'archived').length,
    totalParticipants: projects.reduce((sum, p) => sum + (p.participant_count || 0), 0),
    totalBudget: projects.reduce((sum, p) => sum + parseFloat(p.total_budget || '0'), 0),
    avgSatisfaction: projects.filter((p) => p.avg_satisfaction).length > 0
      ? (projects
          .filter((p) => p.avg_satisfaction)
          .reduce((sum, p) => sum + parseFloat(p.avg_satisfaction || '0'), 0) /
          projects.filter((p) => p.avg_satisfaction).length
        ).toFixed(2)
      : '-',
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* 页面标题 */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">项目查询</h1>
          <p className="text-gray-500 mt-1">查询项目数据、生成统计报表</p>
        </div>

        {/* 统计概览 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <FileText className="w-4 h-4 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">总项目数</p>
                  <p className="text-xl font-bold text-gray-900">{stats.total}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <TrendingUp className="w-4 h-4 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">已完成</p>
                  <p className="text-xl font-bold text-gray-900">{stats.completed}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <Users className="w-4 h-4 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">培训总人数</p>
                  <p className="text-xl font-bold text-gray-900">{stats.totalParticipants.toLocaleString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-yellow-100 rounded-lg">
                  <DollarSign className="w-4 h-4 text-yellow-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">总预算(万)</p>
                  <p className="text-xl font-bold text-gray-900">{(stats.totalBudget / 10000).toFixed(1)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-100 rounded-lg">
                  <Star className="w-4 h-4 text-orange-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">平均满意度</p>
                  <p className="text-xl font-bold text-gray-900">{stats.avgSatisfaction}/5</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 查询面板 */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle>查询条件</CardTitle>
              <CardDescription>设置筛选条件查询项目</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>关键词搜索</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    placeholder="搜索项目名称..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>项目状态</Label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="全部状态" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部状态</SelectItem>
                    {Object.entries(statusMap).map(([key, value]) => (
                      <SelectItem key={key} value={key}>
                        {value.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="pt-4 flex gap-2">
                <Button 
                  variant="outline" 
                  className="flex-1"
                  onClick={() => {
                    setSearchTerm('');
                    setStatusFilter('all');
                  }}
                >
                  <Filter className="w-4 h-4 mr-2" />
                  重置
                </Button>
                <Button className="flex-1">
                  <Download className="w-4 h-4 mr-2" />
                  导出
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* 项目列表 */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>查询结果</CardTitle>
              <CardDescription>
                共找到 {filteredProjects.length} 个项目
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8 text-gray-500">加载中...</div>
              ) : filteredProjects.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Search className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                  <p>未找到匹配的项目</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {filteredProjects.map((project) => (
                    <div
                      key={project.id}
                      className={`p-4 rounded-lg cursor-pointer transition-colors ${
                        selectedProject?.id === project.id
                          ? 'bg-blue-50 border-2 border-blue-500'
                          : 'bg-gray-50 hover:bg-gray-100'
                      }`}
                      onClick={() => setSelectedProject(project)}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-medium text-gray-900">{project.name}</p>
                          <p className="text-sm text-gray-500 mt-1">
                            {project.training_target} · {project.target_audience}
                          </p>
                        </div>
                        <Badge className={statusMap[project.status]?.color}>
                          {statusMap[project.status]?.label}
                        </Badge>
                      </div>
                      <div className="mt-2 flex items-center gap-4 text-sm text-gray-500">
                        <span className="flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          {project.participant_count}人
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {project.training_days}天
                        </span>
                        <span className="flex items-center gap-1">
                          <DollarSign className="w-3 h-3" />
                          ¥{parseFloat(project.total_budget || '0').toLocaleString()}
                        </span>
                        {project.avg_satisfaction && (
                          <span className="flex items-center gap-1">
                            <Star className="w-3 h-3 text-yellow-500" />
                            {project.avg_satisfaction}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* 数据分析 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5" />
              数据分析
            </CardTitle>
            <CardDescription>项目数据统计与分析报表</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="overview">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="overview">项目统计</TabsTrigger>
                <TabsTrigger value="satisfaction">满意度分析</TabsTrigger>
                <TabsTrigger value="cost">成本分析</TabsTrigger>
                <TabsTrigger value="resource">资源分析</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="pt-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* 状态分布 */}
                  <div className="p-4 border rounded-lg">
                    <h4 className="font-medium text-gray-900 mb-4">项目状态分布</h4>
                    <div className="space-y-2">
                      {Object.entries(statusMap).map(([key, value]) => {
                        const count = projects.filter((p) => p.status === key).length;
                        const percentage = projects.length > 0 
                          ? ((count / projects.length) * 100).toFixed(1) 
                          : 0;
                        return (
                          <div key={key} className="flex items-center justify-between">
                            <span className="text-sm text-gray-600">{value.label}</span>
                            <div className="flex items-center gap-2">
                              <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-blue-500 rounded-full"
                                  style={{ width: `${percentage}%` }}
                                />
                              </div>
                              <span className="text-xs text-gray-500 w-8">{count}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* 培训类型分布 */}
                  <div className="p-4 border rounded-lg">
                    <h4 className="font-medium text-gray-900 mb-4">培训类型分布</h4>
                    <div className="space-y-2">
                      {['企业内训', '管理培训', '技能培训', '新员工培训'].map((type) => {
                        const count = projects.filter((p) => p.training_target === type).length;
                        return (
                          <div key={type} className="flex items-center justify-between text-sm">
                            <span className="text-gray-600">{type}</span>
                            <span className="font-medium text-gray-900">{count} 个</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* 月度趋势 */}
                  <div className="p-4 border rounded-lg">
                    <h4 className="font-medium text-gray-900 mb-4">月度趋势</h4>
                    <div className="flex items-end justify-between h-24 gap-1">
                      {[65, 80, 45, 90, 70, 85].map((height, i) => (
                        <div key={i} className="flex-1 flex flex-col items-center">
                          <div
                            className="w-full bg-blue-200 rounded-t"
                            style={{ height: `${height}%` }}
                          />
                          <span className="text-xs text-gray-500 mt-1">{i + 1}月</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="satisfaction" className="pt-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 border rounded-lg">
                    <h4 className="font-medium text-gray-900 mb-4">满意度评分分布</h4>
                    <div className="space-y-2">
                      {['5分(非常满意)', '4分(满意)', '3分(一般)', '2分(不满意)', '1分(非常不满意)'].map((label, i) => (
                        <div key={label} className="flex items-center gap-2">
                          <span className="text-sm text-gray-600 w-28">{label}</span>
                          <div className="flex-1 h-4 bg-gray-200 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-yellow-500 rounded-full"
                              style={{ width: `${[30, 45, 15, 7, 3][i]}%` }}
                            />
                          </div>
                          <span className="text-xs text-gray-500 w-10">{[30, 45, 15, 7, 3][i]}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <h4 className="font-medium text-gray-900 mb-4">高频反馈关键词</h4>
                    <div className="flex flex-wrap gap-2">
                      {['实用', '专业', '互动性强', '收获大', '场地舒适', '餐饮满意', '讲师水平高', '时间紧凑'].map((word) => (
                        <Badge key={word} variant="secondary" className="text-sm">
                          {word}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="cost" className="pt-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 border rounded-lg">
                    <h4 className="font-medium text-gray-900 mb-4">成本构成分析</h4>
                    <div className="space-y-2">
                      {[
                        { name: '讲师费', percent: 35 },
                        { name: '场地费', percent: 20 },
                        { name: '餐饮费', percent: 15 },
                        { name: '资料费', percent: 10 },
                        { name: '管理费', percent: 15 },
                        { name: '其他', percent: 5 },
                      ].map((item) => (
                        <div key={item.name} className="flex items-center justify-between">
                          <span className="text-sm text-gray-600">{item.name}</span>
                          <div className="flex items-center gap-2">
                            <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-green-500 rounded-full"
                                style={{ width: `${item.percent}%` }}
                              />
                            </div>
                            <span className="text-xs text-gray-500 w-8">{item.percent}%</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <h4 className="font-medium text-gray-900 mb-4">预算vs实际</h4>
                    <div className="text-center py-4">
                      <p className="text-sm text-gray-500 mb-2">平均预算执行率</p>
                      <p className="text-3xl font-bold text-green-600">92.5%</p>
                      <p className="text-sm text-gray-500 mt-2">预算控制良好</p>
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="resource" className="pt-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 border rounded-lg">
                    <h4 className="font-medium text-gray-900 mb-4">热门讲师 TOP 5</h4>
                    <div className="space-y-2">
                      {[
                        { name: '张教授', count: 12, rating: 4.9 },
                        { name: '李主任', count: 10, rating: 4.8 },
                        { name: '王老师', count: 8, rating: 4.7 },
                        { name: '赵专家', count: 7, rating: 4.6 },
                        { name: '刘博士', count: 6, rating: 4.5 },
                      ].map((teacher, i) => (
                        <div key={teacher.name} className="flex items-center justify-between text-sm">
                          <span className="text-gray-600">
                            {i + 1}. {teacher.name}
                          </span>
                          <div className="flex items-center gap-4">
                            <span className="text-gray-500">{teacher.count}次授课</span>
                            <span className="text-yellow-500">★ {teacher.rating}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <h4 className="font-medium text-gray-900 mb-4">热门场地 TOP 5</h4>
                    <div className="space-y-2">
                      {[
                        { name: '阳光培训中心', count: 15, rating: 4.7 },
                        { name: '城市会议厅', count: 12, rating: 4.6 },
                        { name: '科技园培训室', count: 10, rating: 4.5 },
                        { name: '企业大学礼堂', count: 8, rating: 4.4 },
                        { name: '党校培训楼', count: 6, rating: 4.3 },
                      ].map((venue, i) => (
                        <div key={venue.name} className="flex items-center justify-between text-sm">
                          <span className="text-gray-600">
                            {i + 1}. {venue.name}
                          </span>
                          <div className="flex items-center gap-4">
                            <span className="text-gray-500">{venue.count}次使用</span>
                            <span className="text-yellow-500">★ {venue.rating}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
