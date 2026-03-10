'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import MainLayout from '@/components/layout/main-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Loader2, Sparkles, Save, ArrowRight, User, MapPin, BookOpen, DollarSign, X, FolderOpen, Plus, Clock } from 'lucide-react';

interface ProjectFormData {
  name: string;
  trainingTarget: string;
  targetAudience: string;
  participantCount: number;
  trainingDays: number;
  trainingHours: number;
  trainingPeriod: string;
  budgetMin: number;
  budgetMax: number;
  location: string;
  specialRequirements: string;
}

interface Course {
  id: string;
  name: string;
  day: number;
  duration: number;
  description: string;
  category: string;
  teacherId?: string;
  teacherName?: string;
  teacherTitle?: string;
  location?: string;
}

interface Teacher {
  id: string;
  name: string;
  title: string;
  expertise: string;
  hourly_rate: string;
  rating: string;
}

interface Venue {
  id: string;
  name: string;
  location: string;
  capacity: number;
  daily_rate: string;
  rating: string;
}

const trainingTargets = [
  '企业内训',
  '技能培训',
  '管理培训',
  '安全生产培训',
  '新员工培训',
  '专项培训',
  '其他',
];

const targetAudiences = [
  '班组长',
  '中层管理',
  '高层管理',
  '新员工',
  '技术骨干',
  '全员',
  '其他',
];

const trainingPeriods = [
  '周末',
  '工作日',
  '连续',
  '分期',
  '其他',
];

export default function DesignPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('requirement');
  const [loading, setLoading] = useState(false);
  const [generateLoading, setGenerateLoading] = useState(false);
  const [projectId, setProjectId] = useState<string | null>(null);
  
  const [formData, setFormData] = useState<ProjectFormData>({
    name: '',
    trainingTarget: '',
    targetAudience: '',
    participantCount: 50,
    trainingDays: 4,
    trainingHours: 32,
    trainingPeriod: '',
    budgetMin: 8,
    budgetMax: 12,
    location: '',
    specialRequirements: '',
  });

  const [courses, setCourses] = useState<Course[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [selectedVenue, setSelectedVenue] = useState<Venue | null>(null);
  const [quotation, setQuotation] = useState<Record<string, unknown> | null>(null);
  
  // "其他"选项的文本输入
  const [otherTrainingTarget, setOtherTrainingTarget] = useState('');
  const [otherTargetAudience, setOtherTargetAudience] = useState('');
  const [analyzingTarget, setAnalyzingTarget] = useState(false);
  const [analyzingAudience, setAnalyzingAudience] = useState(false);
  
  // 培训周期"其他"选项
  const [otherTrainingPeriod, setOtherTrainingPeriod] = useState('');
  
  // 无预算范围选项
  const [noBudgetLimit, setNoBudgetLimit] = useState(true);
  
  // 方案修改意见
  const [modifySuggestion, setModifySuggestion] = useState('');
  
  // 智能需求分析
  const [smartRequirementText, setSmartRequirementText] = useState('');
  const [smartRequirementFile, setSmartRequirementFile] = useState<File | null>(null);
  const [analyzingRequirement, setAnalyzingRequirement] = useState(false);
  const [showSmartAnalysis, setShowSmartAnalysis] = useState(false);
  
  // 草稿项目管理
  const [draftProjects, setDraftProjects] = useState<Array<{
    id: string;
    name: string;
    created_at: string;
    updated_at: string;
    status: string;
    progress?: string;
  }>>([]);
  const [showDraftList, setShowDraftList] = useState(false);
  const [lastSaveTime, setLastSaveTime] = useState<Date | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  
  // 浏览器离开提示
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (formData.name?.trim() || projectId) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [formData.name, projectId]);

  // 加载讲师和场地数据
  useEffect(() => {
    const loadResources = async () => {
      try {
        const [teachersRes, venuesRes] = await Promise.all([
          fetch('/api/teachers'),
          fetch('/api/venues'),
        ]);
        const teachersData = await teachersRes.json();
        const venuesData = await venuesRes.json();
        
        if (teachersData.data) setTeachers(teachersData.data);
        if (venuesData.data) setVenues(venuesData.data);
      } catch (error) {
        console.error('Load resources error:', error);
      }
    };
    loadResources();
    
    // 加载草稿项目列表
    loadDraftProjects();
  }, []);

  // 加载草稿项目列表
  const loadDraftProjects = async () => {
    try {
      const res = await fetch('/api/projects?status=draft');
      const data = await res.json();
      if (data.data) {
        setDraftProjects(data.data.map((p: Record<string, unknown>) => ({
          id: p.id as string,
          name: (p.name as string) || '未命名项目',
          created_at: p.created_at as string,
          updated_at: p.updated_at as string,
          status: p.status as string,
          progress: calculateProgress(p),
        })));
      }
    } catch (error) {
      console.error('Load draft projects error:', error);
    }
  };

  // 计算项目进度
  const calculateProgress = (project: Record<string, unknown>): string => {
    if (project.status === 'draft') {
      if (project.name && project.participant_count && project.training_days) {
        return '需求填写';
      }
      return '新建';
    }
    return '设计中';
  };

  // 自动保存草稿（防抖2秒）
  useEffect(() => {
    if (!formData.name && !projectId) return; // 没有内容不保存
    
    const timer = setTimeout(() => {
      autoSaveDraft();
    }, 2000);

    return () => clearTimeout(timer);
  }, [formData, courses, selectedVenue]);

  // 自动保存草稿
  const autoSaveDraft = async () => {
    if (!formData.name?.trim() && !projectId) return; // 没有项目名称不保存
    
    setIsSaving(true);
    try {
      const dataToSave = {
        ...formData,
        budgetMin: noBudgetLimit ? null : formData.budgetMin,
        budgetMax: noBudgetLimit ? null : formData.budgetMax,
        trainingPeriod: formData.trainingPeriod === '其他' ? otherTrainingPeriod : formData.trainingPeriod,
        status: 'draft',
        courses,
        selectedVenueId: selectedVenue?.id,
      };

      if (projectId) {
        // 更新已有项目
        await fetch(`/api/projects/${projectId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(dataToSave),
        });
      } else {
        // 创建新项目
        const res = await fetch('/api/projects', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(dataToSave),
        });
        const data = await res.json();
        if (data.data?.id) {
          setProjectId(data.data.id);
        }
      }
      
      setLastSaveTime(new Date());
      loadDraftProjects(); // 刷新草稿列表
    } catch (error) {
      console.error('Auto save error:', error);
    } finally {
      setIsSaving(false);
    }
  };

  // 新建项目
  const handleNewProject = () => {
    setProjectId(null);
    setFormData({
      name: '',
      trainingTarget: '',
      targetAudience: '',
      participantCount: 50,
      trainingDays: 4,
      trainingHours: 32,
      trainingPeriod: '',
      budgetMin: 8,
      budgetMax: 12,
      location: '',
      specialRequirements: '',
    });
    setCourses([]);
    setSelectedVenue(null);
    setQuotation(null);
    setActiveTab('requirement');
    setShowDraftList(false);
    setOtherTrainingTarget('');
    setOtherTargetAudience('');
    setOtherTrainingPeriod('');
    setNoBudgetLimit(true);
    setModifySuggestion('');
  };

  // 加载草稿项目
  const handleLoadProject = async (id: string) => {
    try {
      const res = await fetch(`/api/projects/${id}`);
      const data = await res.json();
      
      if (data.data) {
        const project = data.data;
        setProjectId(project.id);
        setFormData({
          name: project.name || '',
          trainingTarget: project.training_target || '',
          targetAudience: project.target_audience || '',
          participantCount: project.participant_count || 50,
          trainingDays: project.training_days || 4,
          trainingHours: project.training_hours || 32,
          trainingPeriod: project.training_period || '',
          budgetMin: project.budget_min || 8,
          budgetMax: project.budget_max || 12,
          location: project.location || '',
          specialRequirements: project.special_requirements || '',
        });
        
        // 加载课程
        if (project.courses) {
          setCourses(project.courses);
        }
        
        // 加载场地
        if (project.selected_venue_id) {
          const venue = venues.find(v => v.id === project.selected_venue_id);
          if (venue) setSelectedVenue(venue);
        }
        
        setShowDraftList(false);
        setActiveTab('requirement');
      }
    } catch (error) {
      console.error('Load project error:', error);
    }
  };

  // 删除草稿
  const handleDeleteDraft = async (id: string) => {
    if (!confirm('确定要删除这个草稿吗？')) return;
    
    try {
      await fetch(`/api/projects/${id}`, {
        method: 'DELETE',
      });
      loadDraftProjects();
      
      // 如果删除的是当前项目，清空表单
      if (id === projectId) {
        handleNewProject();
      }
    } catch (error) {
      console.error('Delete draft error:', error);
    }
  };

  // 保存需求并创建项目
  const handleSaveRequirement = async () => {
    setLoading(true);
    try {
      const dataToSave = {
        ...formData,
        // 无预算范围时，设置为 null
        budgetMin: noBudgetLimit ? null : formData.budgetMin,
        budgetMax: noBudgetLimit ? null : formData.budgetMax,
        // 培训周期"其他"选项
        trainingPeriod: formData.trainingPeriod === '其他' ? otherTrainingPeriod : formData.trainingPeriod,
      };
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dataToSave),
      });
      const data = await res.json();
      if (data.data) {
        setProjectId(data.data.id);
        setActiveTab('scheme');
      }
    } catch (error) {
      console.error('Save requirement error:', error);
    } finally {
      setLoading(false);
    }
  };

  // 智能需求分析
  const handleSmartRequirementAnalysis = async () => {
    if (!smartRequirementText.trim() && !smartRequirementFile) {
      alert('请输入需求描述或上传需求文件');
      return;
    }
    
    setAnalyzingRequirement(true);
    try {
      let requirementContent = smartRequirementText;
      
      // 如果有文件，先解析文件
      if (smartRequirementFile) {
        const formDataToSend = new FormData();
        formDataToSend.append('file', smartRequirementFile);
        
        const parseRes = await fetch('/api/parse-document', {
          method: 'POST',
          body: formDataToSend,
        });
        const parseData = await parseRes.json();
        
        if (parseData.text) {
          requirementContent = requirementContent 
            ? `${requirementContent}\n\n文件内容：\n${parseData.text}`
            : parseData.text;
        }
      }
      
      // 调用AI分析需求
      const res = await fetch('/api/ai/analyze-requirement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requirementText: requirementContent }),
      });
      const data = await res.json();
      
      if (data.data) {
        // 填充表单
        const analysis = data.data;
        setFormData(prev => ({
          ...prev,
          name: analysis.name || prev.name,
          trainingTarget: analysis.trainingTarget || prev.trainingTarget,
          targetAudience: analysis.targetAudience || prev.targetAudience,
          participantCount: analysis.participantCount || prev.participantCount,
          trainingDays: analysis.trainingDays || prev.trainingDays,
          trainingHours: analysis.trainingHours || prev.trainingHours,
          trainingPeriod: analysis.trainingPeriod || prev.trainingPeriod,
          location: analysis.location || prev.location,
          specialRequirements: analysis.specialRequirements || prev.specialRequirements,
        }));
        
        // 如果培训类型或目标人群是其他，设置其他文本
        if (analysis.trainingTarget && !['企业内训', '技能培训', '管理培训', '安全生产培训', '新员工培训', '专项培训'].includes(analysis.trainingTarget)) {
          setFormData(prev => ({ ...prev, trainingTarget: '其他' }));
          setOtherTrainingTarget(analysis.trainingTarget);
        }
        if (analysis.targetAudience && !['班组长', '中层管理', '高层管理', '新员工', '技术骨干', '全员'].includes(analysis.targetAudience)) {
          setFormData(prev => ({ ...prev, targetAudience: '其他' }));
          setOtherTargetAudience(analysis.targetAudience);
        }
        
        setShowSmartAnalysis(false);
        setSmartRequirementText('');
        setSmartRequirementFile(null);
      }
    } catch (error) {
      console.error('Smart requirement analysis error:', error);
      alert('需求分析失败，请重试');
    } finally {
      setAnalyzingRequirement(false);
    }
  };

  // AI生成课程方案
  const handleGenerateScheme = async () => {
    if (!projectId) {
      alert('请先保存需求信息');
      return;
    }
    
    setGenerateLoading(true);
    try {
      const projectDataToSend = {
        ...formData,
        budgetMin: noBudgetLimit ? null : formData.budgetMin,
        budgetMax: noBudgetLimit ? null : formData.budgetMax,
        noBudgetLimit,
      };
      const res = await fetch('/api/ai/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'courses',
          projectData: projectDataToSend,
        }),
      });
      const data = await res.json();
      
      if (data.data?.courses) {
        setCourses(data.data.courses.map((c: Record<string, unknown>, index: number) => ({
          id: `temp-${index}`,
          name: c.name as string,
          day: c.day as number,
          duration: c.duration as number,
          description: c.description as string,
          category: c.category as string,
          teacherTitle: c.teacherTitle as string,
          location: c.location as string,
        })));
      }
    } catch (error) {
      console.error('Generate scheme error:', error);
    } finally {
      setGenerateLoading(false);
    }
  };

  // 根据修改意见重新生成方案
  const handleModifyScheme = async () => {
    if (!projectId || !modifySuggestion.trim()) return;
    
    setGenerateLoading(true);
    try {
      const projectDataToSend = {
        ...formData,
        budgetMin: noBudgetLimit ? null : formData.budgetMin,
        budgetMax: noBudgetLimit ? null : formData.budgetMax,
        noBudgetLimit,
        currentCourses: courses,
        modifySuggestion: modifySuggestion.trim(),
      };
      const res = await fetch('/api/ai/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'modify-courses',
          projectData: projectDataToSend,
        }),
      });
      const data = await res.json();
      
      if (data.data?.courses) {
        setCourses(data.data.courses.map((c: Record<string, unknown>, index: number) => ({
          id: `temp-${index}`,
          name: c.name as string,
          day: c.day as number,
          duration: c.duration as number,
          description: c.description as string,
          category: c.category as string,
          teacherTitle: c.teacherTitle as string,
          location: c.location as string,
        })));
        setModifySuggestion(''); // 清空修改意见
      }
    } catch (error) {
      console.error('Modify scheme error:', error);
    } finally {
      setGenerateLoading(false);
    }
  };

  // 保存课程方案
  const handleSaveScheme = async () => {
    if (!projectId) return;
    
    setLoading(true);
    try {
      // 先删除已有课程
      await fetch(`/api/projects/${projectId}/courses`, {
        method: 'DELETE',
      });
      
      // 添加新课程
      await fetch(`/api/projects/${projectId}/courses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(courses),
      });
      
      setActiveTab('resource');
    } catch (error) {
      console.error('Save scheme error:', error);
    } finally {
      setLoading(false);
    }
  };

  // 生成报价单
  const handleGenerateQuotation = async () => {
    if (!projectId) {
      alert('请先保存需求信息');
      return;
    }
    
    setGenerateLoading(true);
    try {
      const res = await fetch('/api/ai/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'quotation',
          projectData: {
            ...formData,
            courses,
            venue: selectedVenue,
            teachers: teachers.filter(t => courses.some(c => c.teacherId === t.id)),
          },
        }),
      });
      const data = await res.json();
      
      if (data.data) {
        setQuotation(data.data);
        setActiveTab('quotation');
      }
    } catch (error) {
      console.error('Generate quotation error:', error);
    } finally {
      setGenerateLoading(false);
    }
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* 页面标题 */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">项目设计</h1>
            <p className="text-gray-500 mt-1">录入培训需求，生成培训方案和报价单</p>
          </div>
          
          {/* 右侧操作区 */}
          <div className="flex items-center gap-4">
            {/* 自动保存提示 */}
            {lastSaveTime && (
              <span className="text-xs text-gray-400 flex items-center gap-1">
                {isSaving ? (
                  <>
                    <Loader2 className="w-3 h-3 animate-spin" />
                    保存中...
                  </>
                ) : (
                  <>
                    <Clock className="w-3 h-3" />
                    已保存 {lastSaveTime.toLocaleTimeString()}
                  </>
                )}
              </span>
            )}
            
            {/* 草稿项目按钮 */}
            <Button
              variant="outline"
              onClick={() => setShowDraftList(true)}
              className="gap-2"
            >
              <FolderOpen className="w-4 h-4" />
              进行中的项目
              {draftProjects.length > 0 && (
                <Badge variant="secondary" className="ml-1">
                  {draftProjects.length}
                </Badge>
              )}
            </Button>
          </div>
        </div>

        {/* 草稿项目列表弹窗 */}
        <Dialog open={showDraftList} onOpenChange={setShowDraftList}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center justify-between">
                <span>进行中的项目</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    handleNewProject();
                    setShowDraftList(false);
                  }}
                  className="gap-1"
                >
                  <Plus className="w-4 h-4" />
                  新建项目
                </Button>
              </DialogTitle>
              <DialogDescription>
                选择一个项目继续设计，或创建新项目
              </DialogDescription>
            </DialogHeader>
            
            <div className="max-h-96 overflow-y-auto">
              {draftProjects.length === 0 ? (
                <div className="py-8 text-center">
                  <FolderOpen className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                  <p className="text-gray-500 mb-4">暂无进行中的项目</p>
                  <Button
                    onClick={() => {
                      handleNewProject();
                      setShowDraftList(false);
                    }}
                  >
                    创建新项目
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  {draftProjects.map((project) => (
                    <div
                      key={project.id}
                      className={`p-4 border rounded-lg hover:bg-gray-50 cursor-pointer transition-colors ${
                        projectId === project.id ? 'border-blue-500 bg-blue-50' : ''
                      }`}
                      onClick={() => {
                        handleLoadProject(project.id);
                        setShowDraftList(false);
                      }}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-gray-900">
                              {project.name || '未命名项目'}
                            </p>
                            {projectId === project.id && (
                              <Badge variant="default" className="text-xs">
                                当前
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-3 mt-2 text-sm text-gray-500">
                            <Badge variant="outline" className="text-xs">
                              {project.progress}
                            </Badge>
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {new Date(project.updated_at).toLocaleString()}
                            </span>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteDraft(project.id);
                          }}
                          className="text-gray-400 hover:text-red-500"
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* 步骤指示器 */}
        <div className="flex items-center justify-between bg-white rounded-lg p-4 border">
          {[
            { key: 'requirement', label: '需求录入', icon: '📝' },
            { key: 'scheme', label: '方案生成', icon: '📋' },
            { key: 'resource', label: '资源匹配', icon: '🎯' },
            { key: 'quotation', label: '报价单', icon: '💰' },
          ].map((step, index) => (
            <div key={step.key} className="flex items-center">
              <button
                onClick={() => setActiveTab(step.key)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                  activeTab === step.key
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-500 hover:bg-gray-50'
                }`}
              >
                <span className="text-lg">{step.icon}</span>
                <span className="font-medium">{step.label}</span>
              </button>
              {index < 3 && <ArrowRight className="w-4 h-4 mx-4 text-gray-300" />}
            </div>
          ))}
        </div>

        {/* 主内容区 */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          {/* 需求录入 */}
          <TabsContent value="requirement">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>培训需求信息</CardTitle>
                    <CardDescription>请填写培训的基本需求和约束条件</CardDescription>
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => setShowSmartAnalysis(!showSmartAnalysis)}
                    className="gap-2"
                  >
                    <Sparkles className="w-4 h-4" />
                    {showSmartAnalysis ? '手动填写' : '智能分析'}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* 智能需求分析区域 */}
                {showSmartAnalysis && (
                  <div className="border rounded-lg p-4 bg-gradient-to-r from-purple-50 to-blue-50 mb-6">
                    <div className="flex items-center gap-2 mb-3">
                      <Sparkles className="w-5 h-5 text-purple-600" />
                      <span className="font-medium text-purple-700">智能需求分析</span>
                    </div>
                    <p className="text-sm text-gray-600 mb-4">
                      输入需求描述或上传需求文件，AI将自动分析并填充表单
                    </p>
                    
                    <div className="space-y-4">
                      {/* 文字输入 */}
                      <div>
                        <Label className="text-sm font-medium mb-2 block">需求描述</Label>
                        <Textarea
                          placeholder="请描述培训需求，如：我们公司有50名中层管理者需要参加管理能力提升培训，预计培训4天，地点在上海..."
                          value={smartRequirementText}
                          onChange={(e) => setSmartRequirementText(e.target.value)}
                          rows={4}
                        />
                      </div>
                      
                      <div className="flex items-center gap-4">
                        <span className="text-sm text-gray-500">或</span>
                        <div className="flex-1 border-t border-gray-200"></div>
                      </div>
                      
                      {/* 文件上传 */}
                      <div>
                        <Label className="text-sm font-medium mb-2 block">上传需求文件</Label>
                        <div className="flex gap-2">
                          <Input
                            type="file"
                            accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                setSmartRequirementFile(file);
                              }
                            }}
                            className="flex-1"
                          />
                          {smartRequirementFile && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setSmartRequirementFile(null)}
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                        {smartRequirementFile && (
                          <p className="text-xs text-gray-500 mt-1">
                            已选择: {smartRequirementFile.name}
                          </p>
                        )}
                      </div>
                      
                      {/* 分析按钮 */}
                      <Button
                        onClick={handleSmartRequirementAnalysis}
                        disabled={analyzingRequirement || (!smartRequirementText.trim() && !smartRequirementFile)}
                        className="w-full"
                      >
                        {analyzingRequirement ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            AI分析中...
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-4 h-4 mr-2" />
                            开始智能分析
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                )}
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="name">项目名称 *</Label>
                    <Input
                      id="name"
                      placeholder="如：班组长能力提升培训"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="trainingTarget">培训类型</Label>
                    <Select
                      value={formData.trainingTarget}
                      onValueChange={(value) => setFormData({ ...formData, trainingTarget: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="选择培训类型" />
                      </SelectTrigger>
                      <SelectContent>
                        {trainingTargets.map((target) => (
                          <SelectItem key={target} value={target}>
                            {target}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {formData.trainingTarget === '其他' && (
                      <div className="flex gap-2 mt-2">
                        <Input
                          placeholder="请输入培训类型，如：数字化转型培训、创新思维培训等"
                          value={otherTrainingTarget}
                          onChange={(e) => setOtherTrainingTarget(e.target.value)}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          disabled={!otherTrainingTarget.trim() || analyzingTarget}
                          onClick={async () => {
                            if (!otherTrainingTarget.trim()) return;
                            setAnalyzingTarget(true);
                            try {
                              const res = await fetch('/api/ai/analyze-input', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                  type: 'trainingTarget',
                                  input: otherTrainingTarget,
                                }),
                              });
                              const data = await res.json();
                              if (data.data?.value) {
                                setFormData(prev => ({ ...prev, trainingTarget: data.data.value }));
                                setOtherTrainingTarget('');
                              }
                            } catch (error) {
                              console.error('AI analyze error:', error);
                            } finally {
                              setAnalyzingTarget(false);
                            }
                          }}
                          title="AI智能分析"
                        >
                          {analyzingTarget ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Sparkles className="w-4 h-4" />
                          )}
                        </Button>
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="targetAudience">目标人群</Label>
                    <Select
                      value={formData.targetAudience}
                      onValueChange={(value) => setFormData({ ...formData, targetAudience: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="选择目标人群" />
                      </SelectTrigger>
                      <SelectContent>
                        {targetAudiences.map((audience) => (
                          <SelectItem key={audience} value={audience}>
                            {audience}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {formData.targetAudience === '其他' && (
                      <div className="flex gap-2 mt-2">
                        <Input
                          placeholder="请输入目标人群，如：项目经理、财务人员、销售人员等"
                          value={otherTargetAudience}
                          onChange={(e) => setOtherTargetAudience(e.target.value)}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          disabled={!otherTargetAudience.trim() || analyzingAudience}
                          onClick={async () => {
                            if (!otherTargetAudience.trim()) return;
                            setAnalyzingAudience(true);
                            try {
                              const res = await fetch('/api/ai/analyze-input', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                  type: 'targetAudience',
                                  input: otherTargetAudience,
                                }),
                              });
                              const data = await res.json();
                              if (data.data?.value) {
                                setFormData(prev => ({ ...prev, targetAudience: data.data.value }));
                                setOtherTargetAudience('');
                              }
                            } catch (error) {
                              console.error('AI analyze error:', error);
                            } finally {
                              setAnalyzingAudience(false);
                            }
                          }}
                          title="AI智能分析"
                        >
                          {analyzingAudience ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Sparkles className="w-4 h-4" />
                          )}
                        </Button>
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="participantCount">参训人数</Label>
                    <Input
                      id="participantCount"
                      type="number"
                      value={formData.participantCount}
                      onChange={(e) => setFormData({ ...formData, participantCount: parseInt(e.target.value) || 0 })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="trainingDays">培训天数</Label>
                    <Input
                      id="trainingDays"
                      type="number"
                      value={formData.trainingDays}
                      onChange={(e) => setFormData({ ...formData, trainingDays: parseInt(e.target.value) || 0 })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="trainingHours">培训课时</Label>
                    <Input
                      id="trainingHours"
                      type="number"
                      value={formData.trainingHours}
                      onChange={(e) => setFormData({ ...formData, trainingHours: parseInt(e.target.value) || 0 })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="trainingPeriod">培训周期</Label>
                    <Select
                      value={formData.trainingPeriod}
                      onValueChange={(value) => setFormData({ ...formData, trainingPeriod: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="选择培训周期" />
                      </SelectTrigger>
                      <SelectContent>
                        {trainingPeriods.map((period) => (
                          <SelectItem key={period} value={period}>
                            {period}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {formData.trainingPeriod === '其他' && (
                      <Input
                        placeholder="请输入培训周期，如：每周一次、隔周培训等"
                        value={otherTrainingPeriod}
                        onChange={(e) => setOtherTrainingPeriod(e.target.value)}
                        className="mt-2"
                      />
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="location">培训地点</Label>
                    <Input
                      id="location"
                      placeholder="如：上海浦东"
                      value={formData.location}
                      onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="budgetMin">预算范围（万元）</Label>
                    <div className="flex items-center gap-4 mb-2">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="budgetType"
                          checked={noBudgetLimit}
                          onChange={() => setNoBudgetLimit(true)}
                          className="w-4 h-4 text-purple-600"
                        />
                        <span className="text-sm">无预算范围</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="budgetType"
                          checked={!noBudgetLimit}
                          onChange={() => setNoBudgetLimit(false)}
                          className="w-4 h-4 text-purple-600"
                        />
                        <span className="text-sm">指定预算范围</span>
                      </label>
                    </div>
                    <div className="flex gap-2">
                      <Input
                        id="budgetMin"
                        type="number"
                        placeholder="最低"
                        value={formData.budgetMin}
                        onChange={(e) => setFormData({ ...formData, budgetMin: parseFloat(e.target.value) || 0 })}
                        disabled={noBudgetLimit}
                        className={noBudgetLimit ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : ''}
                      />
                      <span className="flex items-center text-gray-500">-</span>
                      <Input
                        type="number"
                        placeholder="最高"
                        value={formData.budgetMax}
                        onChange={(e) => setFormData({ ...formData, budgetMax: parseFloat(e.target.value) || 0 })}
                        disabled={noBudgetLimit}
                        className={noBudgetLimit ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : ''}
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="specialRequirements">特殊要求</Label>
                  <Textarea
                    id="specialRequirements"
                    placeholder="如：需要住宿、餐饮、交通安排等"
                    value={formData.specialRequirements}
                    onChange={(e) => setFormData({ ...formData, specialRequirements: e.target.value })}
                    rows={3}
                  />
                </div>

                <div className="flex justify-end gap-4">
                  <Button variant="outline">取消</Button>
                  <Button onClick={handleSaveRequirement} disabled={loading}>
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        保存中...
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4 mr-2" />
                        保存并继续
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* 方案生成 */}
          <TabsContent value="scheme">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>培训方案</CardTitle>
                    <CardDescription>AI智能生成课程安排方案</CardDescription>
                  </div>
                  <Button onClick={handleGenerateScheme} disabled={generateLoading}>
                    {generateLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        生成中...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 mr-2" />
                        AI生成方案
                      </>
                    )}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {courses.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <BookOpen className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                    <p>点击"AI生成方案"按钮，自动生成课程安排</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* 课程分类统计 */}
                    <div className="flex flex-wrap gap-2 mb-4">
                      <Badge variant="outline">职业素养类: 30%</Badge>
                      <Badge variant="outline">管理技能类: 30%</Badge>
                      <Badge variant="outline">专业技能类: 20%</Badge>
                      <Badge variant="outline">综合提升类: 20%</Badge>
                    </div>

                    {/* 课程表格 */}
                    <div className="border rounded-lg overflow-hidden">
                      <table className="w-full">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-3 text-left text-sm font-medium text-gray-600 w-16">天数</th>
                            <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">课程名称</th>
                            <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">课程介绍</th>
                            <th className="px-4 py-3 text-left text-sm font-medium text-gray-600 w-28">授课师资</th>
                            <th className="px-4 py-3 text-left text-sm font-medium text-gray-600 w-20">课时数</th>
                            <th className="px-4 py-3 text-left text-sm font-medium text-gray-600 w-28">上课地点</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {courses.map((course) => (
                            <tr key={course.id} className="hover:bg-gray-50">
                              <td className="px-4 py-3 text-sm">
                                <Badge variant="secondary">第{course.day}天</Badge>
                              </td>
                              <td className="px-4 py-3 text-sm font-medium text-gray-900">
                                {course.name}
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-600">
                                {course.description}
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-600">
                                {course.teacherTitle || '待定'}
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-600">
                                {course.duration}课时
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-600">
                                {course.location || '待定'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* 修改意见输入 */}
                    <div className="border rounded-lg p-4 bg-gray-50">
                      <Label className="text-sm font-medium text-gray-700 mb-2 block">
                        修改意见（可选）
                      </Label>
                      <div className="flex gap-2">
                        <Textarea
                          placeholder="请输入修改意见，如：增加实操课程、调整课程顺序、更换某些课程主题等..."
                          value={modifySuggestion}
                          onChange={(e) => setModifySuggestion(e.target.value)}
                          rows={2}
                          className="flex-1"
                        />
                        <Button
                          onClick={handleModifyScheme}
                          disabled={generateLoading || !modifySuggestion.trim()}
                          className="self-end"
                        >
                          {generateLoading ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              重新生成中...
                            </>
                          ) : (
                            <>
                              <Sparkles className="w-4 h-4 mr-2" />
                              重新生成
                            </>
                          )}
                        </Button>
                      </div>
                    </div>

                    <div className="flex justify-end gap-4 mt-6">
                      <Button variant="outline" onClick={() => setActiveTab('requirement')}>
                        返回修改需求
                      </Button>
                      <Button onClick={handleSaveScheme} disabled={loading}>
                        {loading ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            保存中...
                          </>
                        ) : (
                          '保存方案并继续'
                        )}
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* 资源匹配 */}
          <TabsContent value="resource">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* 讲师匹配 */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <User className="w-5 h-5" />
                    讲师资源
                  </CardTitle>
                  <CardDescription>为课程匹配合适的讲师</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {teachers.map((teacher) => (
                      <div
                        key={teacher.id}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                      >
                        <div>
                          <p className="font-medium text-gray-900">{teacher.name}</p>
                          <p className="text-sm text-gray-500">
                            {teacher.title} · {teacher.expertise}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium text-gray-900">
                            ¥{teacher.hourly_rate}/课时
                          </p>
                          <p className="text-xs text-gray-500">评分: {teacher.rating}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* 场地选择 */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MapPin className="w-5 h-5" />
                    场地资源
                  </CardTitle>
                  <CardDescription>选择合适的培训场地</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {venues.map((venue) => (
                      <div
                        key={venue.id}
                        className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors ${
                          selectedVenue?.id === venue.id
                            ? 'bg-blue-50 border-2 border-blue-500'
                            : 'bg-gray-50 hover:bg-gray-100'
                        }`}
                        onClick={() => setSelectedVenue(venue)}
                      >
                        <div>
                          <p className="font-medium text-gray-900">{venue.name}</p>
                          <p className="text-sm text-gray-500">
                            {venue.location} · 容量{venue.capacity}人
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium text-gray-900">
                            ¥{venue.daily_rate}/天
                          </p>
                          <p className="text-xs text-gray-500">评分: {venue.rating}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="flex justify-end gap-4 mt-6">
              <Button variant="outline" onClick={() => setActiveTab('scheme')}>
                返回修改方案
              </Button>
              <Button onClick={handleGenerateQuotation} disabled={generateLoading}>
                {generateLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    生成中...
                  </>
                ) : (
                  '生成报价单'
                )}
              </Button>
            </div>
          </TabsContent>

          {/* 报价单 */}
          <TabsContent value="quotation">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="w-5 h-5" />
                  培训项目报价单
                </CardTitle>
                <CardDescription>项目费用明细和成本测算</CardDescription>
              </CardHeader>
              <CardContent>
                {quotation ? (
                  <div className="space-y-6">
                    {/* 费用明细表 */}
                    <div className="border rounded-lg overflow-hidden">
                      <table className="w-full">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-3 text-left text-sm font-medium text-gray-900">费用类别</th>
                            <th className="px-4 py-3 text-left text-sm font-medium text-gray-900">费用名称</th>
                            <th className="px-4 py-3 text-right text-sm font-medium text-gray-900">单价</th>
                            <th className="px-4 py-3 text-right text-sm font-medium text-gray-900">数量</th>
                            <th className="px-4 py-3 text-right text-sm font-medium text-gray-900">金额(元)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {(quotation.items as Array<Record<string, unknown>>)?.map((item, index) => (
                            <tr key={index} className="hover:bg-gray-50">
                              <td className="px-4 py-3 text-sm text-gray-900">{item.category as string}</td>
                              <td className="px-4 py-3 text-sm text-gray-500">{item.name as string}</td>
                              <td className="px-4 py-3 text-sm text-right text-gray-900">
                                ¥{(item.unitPrice as number)?.toLocaleString()}
                              </td>
                              <td className="px-4 py-3 text-sm text-right text-gray-500">
                                {item.quantity as number} {item.unit as string}
                              </td>
                              <td className="px-4 py-3 text-sm text-right font-medium text-gray-900">
                                ¥{(item.amount as number)?.toLocaleString()}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* 合计 */}
                    <div className="flex justify-end">
                      <div className="w-64 space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-500">小计</span>
                          <span className="font-medium">¥{(quotation.subtotal as number)?.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-500">管理费(15%)</span>
                          <span className="font-medium">¥{(quotation.managementFee as number)?.toLocaleString()}</span>
                        </div>
                        <Separator />
                        <div className="flex justify-between text-lg font-bold">
                          <span>合计</span>
                          <span className="text-blue-600">¥{(quotation.total as number)?.toLocaleString()}</span>
                        </div>
                      </div>
                    </div>

                    {/* 合规性检查 */}
                    {(quotation.compliance as Record<string, unknown>)?.compliant ? (
                      <div className="flex items-center gap-2 p-4 bg-green-50 text-green-700 rounded-lg">
                        <span className="text-lg">✅</span>
                        <span>费用符合规范要求</span>
                      </div>
                    ) : (
                      <div className="p-4 bg-yellow-50 rounded-lg">
                        <p className="text-yellow-700 font-medium mb-2">⚠️ 存在合规性问题</p>
                        <ul className="text-sm text-yellow-600 list-disc list-inside">
                          {((quotation.compliance as Record<string, unknown>)?.issues as string[])?.map((issue, i) => (
                            <li key={i}>{issue}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <div className="flex justify-end gap-4">
                      <Button variant="outline">导出报价单</Button>
                      <Button onClick={() => router.push('/declaration')}>
                        提交项目申报
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12 text-gray-500">
                    <DollarSign className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                    <p>请先完成资源匹配，然后生成报价单</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}
