'use client';

import { useState, useEffect } from 'react';
import MainLayout from '@/components/layout/main-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FileText, Download, Send, Eye, CheckCircle, Clock, Plus } from 'lucide-react';

interface Project {
  id: string;
  name: string;
  status: string;
  participant_count: number;
  training_days: number;
  total_budget: string;
  created_at: string;
}

const statusMap: Record<string, { label: string; color: string }> = {
  draft: { label: '草稿', color: 'bg-gray-100 text-gray-700' },
  designing: { label: '设计中', color: 'bg-blue-100 text-blue-700' },
  executing: { label: '执行中', color: 'bg-indigo-100 text-indigo-700' },
  completed: { label: '已完成', color: 'bg-emerald-100 text-emerald-700' },
  archived: { label: '已归档', color: 'bg-gray-100 text-gray-500' },
};

export default function DeclarationPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    try {
      const res = await fetch('/api/projects?status=designing');
      const data = await res.json();
      if (data.data) {
        setProjects(data.data);
      }
    } catch (error) {
      console.error('Load projects error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitForExecution = async (projectId: string) => {
    try {
      await fetch(`/api/projects/${projectId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'executing' }),
      });
      loadProjects();
    } catch (error) {
      console.error('Submit for execution error:', error);
    }
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* 页面标题 */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">项目申报</h1>
          <p className="text-gray-500 mt-1">生成项目申报表和成本测算表，提交审批</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 项目列表 */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>待申报项目</CardTitle>
                  <CardDescription>选择需要申报的项目</CardDescription>
                </div>
                {projects.length > 0 && (
                  <Button 
                    size="sm" 
                    onClick={() => window.location.href = '/design'}
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    新建项目
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8 text-gray-500">加载中...</div>
              ) : projects.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <FileText className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                  <p className="mb-4">暂无待申报项目</p>
                  <Button 
                    size="sm" 
                    onClick={() => window.location.href = '/design'}
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    新建项目
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {projects.map((project) => (
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
                            {project.participant_count}人 · {project.training_days}天
                          </p>
                        </div>
                        <Badge className={statusMap[project.status]?.color}>
                          {statusMap[project.status]?.label}
                        </Badge>
                      </div>
                      <div className="mt-2 text-sm text-gray-500">
                        预算: ¥{parseFloat(project.total_budget || '0').toLocaleString()}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* 文档生成 */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>申报文档</CardTitle>
              <CardDescription>生成项目申报表和成本测算表</CardDescription>
            </CardHeader>
            <CardContent>
              {selectedProject ? (
                <Tabs defaultValue="declaration">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="declaration">项目申报表</TabsTrigger>
                    <TabsTrigger value="cost">成本测算表</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="declaration" className="space-y-4">
                    <div className="p-6 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                      <div className="text-center mb-6">
                        <h3 className="text-lg font-bold text-gray-900">非学历培训项目申报表</h3>
                      </div>
                      
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-sm text-gray-500">项目名称</p>
                            <p className="font-medium text-gray-900">{selectedProject.name}</p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-500">培训人数</p>
                            <p className="font-medium text-gray-900">{selectedProject.participant_count}人</p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-500">培训天数</p>
                            <p className="font-medium text-gray-900">{selectedProject.training_days}天</p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-500">培训预算</p>
                            <p className="font-medium text-gray-900">¥{parseFloat(selectedProject.total_budget || '0').toLocaleString()}</p>
                          </div>
                        </div>

                        <div className="border-t pt-4">
                          <p className="text-sm text-gray-500 mb-2">课程安排</p>
                          <div className="bg-white rounded p-3 text-sm">
                            <p className="text-gray-600">（根据培训方案自动填充课程安排）</p>
                          </div>
                        </div>

                        <div className="border-t pt-4">
                          <p className="text-sm text-gray-500 mb-2">合规性说明</p>
                          <div className="bg-white rounded p-3 text-sm">
                            <p className="text-gray-600">本培训项目符合《XXX培训管理办法》相关规定</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-end gap-3">
                      <Button variant="outline">
                        <Eye className="w-4 h-4 mr-2" />
                        预览
                      </Button>
                      <Button variant="outline">
                        <Download className="w-4 h-4 mr-2" />
                        导出
                      </Button>
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="cost" className="space-y-4">
                    <div className="p-6 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                      <div className="text-center mb-6">
                        <h3 className="text-lg font-bold text-gray-900">培训项目成本测算表</h3>
                      </div>
                      
                      <table className="w-full">
                        <thead>
                          <tr className="border-b">
                            <th className="py-2 text-left text-sm font-medium text-gray-700">项目</th>
                            <th className="py-2 text-right text-sm font-medium text-gray-700">金额(元)</th>
                            <th className="py-2 text-right text-sm font-medium text-gray-700">占比</th>
                          </tr>
                        </thead>
                        <tbody className="text-sm">
                          <tr className="border-b">
                            <td className="py-2 text-gray-600">讲师费</td>
                            <td className="py-2 text-right">-</td>
                            <td className="py-2 text-right">-</td>
                          </tr>
                          <tr className="border-b">
                            <td className="py-2 text-gray-600">场地费</td>
                            <td className="py-2 text-right">-</td>
                            <td className="py-2 text-right">-</td>
                          </tr>
                          <tr className="border-b">
                            <td className="py-2 text-gray-600">餐饮费</td>
                            <td className="py-2 text-right">-</td>
                            <td className="py-2 text-right">-</td>
                          </tr>
                          <tr className="border-b">
                            <td className="py-2 text-gray-600">资料费</td>
                            <td className="py-2 text-right">-</td>
                            <td className="py-2 text-right">-</td>
                          </tr>
                          <tr className="border-b">
                            <td className="py-2 text-gray-600">其他费用</td>
                            <td className="py-2 text-right">-</td>
                            <td className="py-2 text-right">-</td>
                          </tr>
                          <tr className="border-b bg-blue-50">
                            <td className="py-2 font-medium text-gray-900">合计</td>
                            <td className="py-2 text-right font-bold">¥{parseFloat(selectedProject.total_budget || '0').toLocaleString()}</td>
                            <td className="py-2 text-right font-medium">100%</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    <div className="flex justify-end gap-3">
                      <Button variant="outline">
                        <Eye className="w-4 h-4 mr-2" />
                        预览
                      </Button>
                      <Button variant="outline">
                        <Download className="w-4 h-4 mr-2" />
                        导出
                      </Button>
                    </div>
                  </TabsContent>
                </Tabs>
              ) : (
                <div className="text-center py-12 text-gray-500">
                  <FileText className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                  <p>请从左侧选择一个项目</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* 项目流程 */}
        <Card>
          <CardHeader>
            <CardTitle>项目流程</CardTitle>
            <CardDescription>项目当前进度</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              {[
                { step: 1, label: '项目设计', icon: FileText, status: 'completed' },
                { step: 2, label: '项目申报', icon: Send, status: 'current' },
                { step: 3, label: '项目执行', icon: CheckCircle, status: 'pending' },
                { step: 4, label: '项目完成', icon: CheckCircle, status: 'pending' },
              ].map((step, index) => (
                <div key={step.step} className="flex items-center">
                  <div className={`flex flex-col items-center ${
                    step.status === 'completed' ? 'text-green-600' : 
                    step.status === 'current' ? 'text-blue-600' : 'text-gray-400'
                  }`}>
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      step.status === 'completed' ? 'bg-green-100' : 
                      step.status === 'current' ? 'bg-blue-100' : 'bg-gray-100'
                    }`}>
                      {step.status === 'completed' ? (
                        <CheckCircle className="w-5 h-5" />
                      ) : (
                        <step.icon className="w-5 h-5" />
                      )}
                    </div>
                    <span className="text-xs mt-2">{step.label}</span>
                  </div>
                  {index < 3 && (
                    <div className="w-20 h-px bg-gray-200 mx-4" />
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
