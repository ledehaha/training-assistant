'use client';

import { useState, useEffect } from 'react';
import MainLayout from '@/components/layout/main-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { 
  ClipboardCheck, 
  Send, 
  BarChart3, 
  MessageSquare, 
  Star, 
  Archive,
  TrendingUp,
  Users,
  Loader2,
  Plus
} from 'lucide-react';

interface Project {
  id: string;
  name: string;
  status: string;
  participant_count: number;
  avg_satisfaction: string | null;
  survey_response_rate: string | null;
  created_at: string;
}

const statusMap: Record<string, { label: string; color: string }> = {
  executing: { label: '执行中', color: 'bg-indigo-100 text-indigo-700' },
  completed: { label: '已完成', color: 'bg-emerald-100 text-emerald-700' },
  archived: { label: '已归档', color: 'bg-gray-100 text-gray-500' },
};

export default function SummaryPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [surveyLoading, setSurveyLoading] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    try {
      const res = await fetch('/api/projects?status=executing,completed');
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

  const handleCreateSurvey = async () => {
    if (!selectedProject) return;
    
    setSurveyLoading(true);
    try {
      const res = await fetch('/api/surveys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: selectedProject.id,
          title: `${selectedProject.name} - 满意度调查`,
          questions: defaultQuestions,
        }),
      });
      const data = await res.json();
      if (data.data) {
        alert('满意度调查已创建并发送！');
      }
    } catch (error) {
      console.error('Create survey error:', error);
    } finally {
      setSurveyLoading(false);
    }
  };

  const handleArchiveProject = async () => {
    if (!selectedProject) return;
    
    try {
      await fetch(`/api/projects/${selectedProject.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'archived' }),
      });
      loadProjects();
      alert('项目已归档！');
    } catch (error) {
      console.error('Archive project error:', error);
    }
  };

  const handleAnalyzeSatisfaction = async () => {
    if (!selectedProject) return;
    
    setSurveyLoading(true);
    try {
      const res = await fetch('/api/ai/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'satisfaction-analysis',
          projectData: {
            projectName: selectedProject.name,
            responseCount: 45,
            responseRate: 90,
            avgSatisfaction: 4.5,
            courseSatisfaction: 4.6,
            teacherSatisfaction: 4.7,
            venueSatisfaction: 4.3,
            cateringSatisfaction: 4.2,
            feedback: sampleFeedback,
          },
        }),
      });
      const data = await res.json();
      if (data.data) {
        setAnalysisResult(data.data);
      }
    } catch (error) {
      console.error('Analyze satisfaction error:', error);
    } finally {
      setSurveyLoading(false);
    }
  };

  // 默认问卷题目
  const defaultQuestions = [
    { id: 'q1', type: 'rating', question: '您对本次培训的整体满意度如何？', required: true },
    { id: 'q2', type: 'rating', question: '课程内容是否满足您的学习需求？', required: true },
    { id: 'q3', type: 'rating', question: '讲师授课水平如何？', required: true },
    { id: 'q4', type: 'rating', question: '培训场地和设施是否满意？', required: true },
    { id: 'q5', type: 'rating', question: '餐饮服务是否满意？', required: true },
    { id: 'q6', type: 'text', question: '您对本次培训有什么建议？', required: false },
  ];

  // 示例反馈
  const sampleFeedback = `
    学员A：课程内容很实用，讲师水平很高，收获很大。
    学员B：场地设施一般，空调效果不好，建议改善。
    学员C：餐饮安排合理，口味不错。
    学员D：希望增加更多实操环节。
    学员E：整体很满意，希望以后多举办类似培训。
  `;

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* 页面标题 */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">项目总结</h1>
          <p className="text-gray-500 mt-1">满意度调查、数据分析和项目归档</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 项目列表 */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>待总结项目</CardTitle>
                  <CardDescription>选择需要总结的项目</CardDescription>
                </div>
                <Button 
                  size="sm" 
                  onClick={() => window.location.href = '/design'}
                >
                  <Plus className="w-4 h-4 mr-1" />
                  新建项目
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8 text-gray-500">加载中...</div>
              ) : projects.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <ClipboardCheck className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                  <p className="mb-4">暂无待总结项目</p>
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
                            {project.participant_count}人参训
                          </p>
                        </div>
                        <Badge className={statusMap[project.status]?.color}>
                          {statusMap[project.status]?.label}
                        </Badge>
                      </div>
                      {project.avg_satisfaction && (
                        <div className="mt-2 flex items-center gap-2">
                          <Star className="w-4 h-4 text-yellow-500" />
                          <span className="text-sm text-gray-600">
                            满意度: {project.avg_satisfaction}/5
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* 总结内容 */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>项目总结</CardTitle>
              <CardDescription>满意度调查与分析</CardDescription>
            </CardHeader>
            <CardContent>
              {selectedProject ? (
                <Tabs defaultValue="survey">
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="survey">满意度调查</TabsTrigger>
                    <TabsTrigger value="analysis">数据分析</TabsTrigger>
                    <TabsTrigger value="archive">归档管理</TabsTrigger>
                  </TabsList>

                  {/* 满意度调查 */}
                  <TabsContent value="survey" className="space-y-4">
                    <div className="p-6 bg-gray-50 rounded-lg">
                      <h4 className="font-medium text-gray-900 mb-4">调查问卷预览</h4>
                      <div className="space-y-4">
                        {defaultQuestions.map((q, index) => (
                          <div key={q.id} className="flex items-start gap-3">
                            <span className="text-sm text-gray-500 w-6">{index + 1}.</span>
                            <div>
                              <p className="text-sm text-gray-900">{q.question}</p>
                              <p className="text-xs text-gray-500 mt-1">
                                类型: {q.type === 'rating' ? '评分题' : '文本题'}
                                {q.required && ' (必填)'}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <Users className="w-5 h-5 text-blue-600" />
                        <div>
                          <p className="font-medium text-gray-900">调查对象</p>
                          <p className="text-sm text-gray-500">
                            将发送给 {selectedProject.participant_count} 名学员
                          </p>
                        </div>
                      </div>
                      <Button onClick={handleCreateSurvey} disabled={surveyLoading}>
                        {surveyLoading ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            发送中...
                          </>
                        ) : (
                          <>
                            <Send className="w-4 h-4 mr-2" />
                            发送问卷
                          </>
                        )}
                      </Button>
                    </div>
                  </TabsContent>

                  {/* 数据分析 */}
                  <TabsContent value="analysis" className="space-y-4">
                    {analysisResult ? (
                      <div className="space-y-4">
                        <div className="p-4 bg-green-50 rounded-lg">
                          <div className="flex items-center gap-2 mb-2">
                            <TrendingUp className="w-5 h-5 text-green-600" />
                            <span className="font-medium text-green-700">整体评价</span>
                          </div>
                          <p className="text-gray-700">{analysisResult.summary as string}</p>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div className="p-4 border rounded-lg">
                            <h5 className="font-medium text-gray-900 mb-2">优势</h5>
                            <ul className="text-sm text-gray-600 space-y-1">
                              {(analysisResult.analysis as Record<string, string[]>)?.strengths?.map((s, i) => (
                                <li key={i}>✓ {s}</li>
                              ))}
                            </ul>
                          </div>
                          <div className="p-4 border rounded-lg">
                            <h5 className="font-medium text-gray-900 mb-2">不足</h5>
                            <ul className="text-sm text-gray-600 space-y-1">
                              {(analysisResult.analysis as Record<string, string[]>)?.weaknesses?.map((w, i) => (
                                <li key={i}>• {w}</li>
                              ))}
                            </ul>
                          </div>
                        </div>

                        <div className="p-4 border rounded-lg">
                          <h5 className="font-medium text-gray-900 mb-2">改进建议</h5>
                          <ul className="text-sm text-gray-600 space-y-2">
                            {(analysisResult.recommendations as string[])?.map((r, i) => (
                              <li key={i} className="flex items-start gap-2">
                                <span className="text-blue-500">→</span>
                                {r}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-8">
                        <BarChart3 className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                        <p className="text-gray-500 mb-4">点击下方按钮进行满意度分析</p>
                        <Button onClick={handleAnalyzeSatisfaction} disabled={surveyLoading}>
                          {surveyLoading ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              分析中...
                            </>
                          ) : (
                            <>
                              <BarChart3 className="w-4 h-4 mr-2" />
                              AI分析满意度
                            </>
                          )}
                        </Button>
                      </div>
                    )}
                  </TabsContent>

                  {/* 归档管理 */}
                  <TabsContent value="archive" className="space-y-4">
                    <div className="p-6 bg-gray-50 rounded-lg">
                      <h4 className="font-medium text-gray-900 mb-4">归档清单</h4>
                      <div className="space-y-2">
                        {[
                          { name: '项目申报表', status: '已生成' },
                          { name: '培训方案', status: '已生成' },
                          { name: '成本测算表', status: '已生成' },
                          { name: '满意度调查问卷', status: '已生成' },
                          { name: '满意度报告', status: '待生成' },
                          { name: '项目总结报告', status: '待生成' },
                        ].map((doc) => (
                          <div key={doc.name} className="flex items-center justify-between p-3 bg-white rounded">
                            <span className="text-sm text-gray-700">{doc.name}</span>
                            <Badge variant={doc.status === '已生成' ? 'default' : 'outline'}>
                              {doc.status}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="flex justify-end gap-3">
                      <Button variant="outline">导出归档包</Button>
                      <Button onClick={handleArchiveProject}>
                        <Archive className="w-4 h-4 mr-2" />
                        归档项目
                      </Button>
                    </div>
                  </TabsContent>
                </Tabs>
              ) : (
                <div className="text-center py-12 text-gray-500">
                  <ClipboardCheck className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                  <p>请从左侧选择一个项目</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </MainLayout>
  );
}
