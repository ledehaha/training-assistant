'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
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
import { Loader2, Sparkles, Save, ArrowRight, User, MapPin, BookOpen, DollarSign, X, FolderOpen, Plus, Clock, Check, AlertCircle } from 'lucide-react';
import ApiKeyCheckDialog, { checkApiKeyConfigured } from '@/components/api-key-check-dialog';

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

// 保存状态类型
type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

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
  
  // API Key 检查
  const [apiKeyCheckOpen, setApiKeyCheckOpen] = useState(false);
  const [apiKeyConfigured, setApiKeyConfigured] = useState<boolean | null>(null);
  const [pendingAiAction, setPendingAiAction] = useState<(() => void) | null>(null);
  
  // ===== 优化：保存状态管理 =====
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [lastSaveTime, setLastSaveTime] = useState<Date | null>(null);
  
  // 使用 ref 存储防抖定时器和上一次保存的数据
  const saveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedDataRef = useRef<string>('');
  
  // 手动保存（用户点击保存按钮时立即保存）
  const handleManualSave = useCallback(async () => {
    await performSave();
  }, []);

  // 实际执行保存的函数
  const performSave = useCallback(async () => {
    // 检查是否有内容需要保存
    if (!formData.name?.trim() && !projectId) return;
    
    // 检查数据是否变化
    const currentData = JSON.stringify({
      formData,
      courses,
      selectedVenueId: selectedVenue?.id,
    });
    
    if (currentData === lastSavedDataRef.current) {
      return; // 数据没变化，不保存
    }
    
    setSaveStatus('saving');
    
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
        await fetch(`/api/projects/${projectId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(dataToSave),
        });
      } else {
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
      
      // 更新保存状态
      lastSavedDataRef.current = currentData;
      setLastSaveTime(new Date());
      setSaveStatus('saved');
      
      // 3秒后恢复 idle 状态
      setTimeout(() => setSaveStatus('idle'), 3000);
      
    } catch (error) {
      console.error('Auto save error:', error);
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 3000);
    }
  }, [formData, courses, selectedVenue, projectId, noBudgetLimit, otherTrainingPeriod]);

  // 优化后的自动保存：防抖 3 秒，且只在数据变化时保存
  useEffect(() => {
    // 清除之前的定时器
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }
    
    // 没有内容不保存
    if (!formData.name?.trim() && !projectId) return;
    
    // 设置新的定时器（3秒防抖）
    saveTimerRef.current = setTimeout(() => {
      performSave();
    }, 3000);

    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
    };
  }, [formData, courses, selectedVenue, performSave, projectId]);

  // 保存状态指示器组件
  const SaveIndicator = () => {
    if (saveStatus === 'idle' && !lastSaveTime) return null;
    
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        {saveStatus === 'saving' && (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>保存中...</span>
          </>
        )}
        {saveStatus === 'saved' && (
          <>
            <Check className="h-4 w-4 text-green-500" />
            <span>已保存</span>
          </>
        )}
        {saveStatus === 'error' && (
          <>
            <AlertCircle className="h-4 w-4 text-red-500" />
            <span>保存失败</span>
          </>
        )}
        {saveStatus === 'idle' && lastSaveTime && (
          <span className="text-xs">
            上次保存: {lastSaveTime.toLocaleTimeString()}
          </span>
        )}
      </div>
    );
  };

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
    loadDraftProjects();
    // 检查 API Key 状态
    checkApiKeyConfigured().then(setApiKeyConfigured);
  }, []);

  // 加载草稿项目列表（只在初始化和用户手动操作时调用）
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

  const calculateProgress = (project: Record<string, unknown>): string => {
    if (project.status === 'draft') {
      if (project.name && project.participant_count && project.training_days) {
        return '需求填写';
      }
      return '新建';
    }
    return '设计中';
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
    lastSavedDataRef.current = '';
    setSaveStatus('idle');
    setLastSaveTime(null);
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
        
        if (project.courses) {
          setCourses(project.courses);
        }
        
        if (project.selected_venue_id) {
          const venue = venues.find(v => v.id === project.selected_venue_id);
          if (venue) setSelectedVenue(venue);
        }
        
        // 更新已保存数据引用
        lastSavedDataRef.current = JSON.stringify({
          formData: {
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
          },
          courses: project.courses || [],
          selectedVenueId: project.selected_venue_id,
        });
        
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
        budgetMin: noBudgetLimit ? null : formData.budgetMin,
        budgetMax: noBudgetLimit ? null : formData.budgetMax,
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
    
    // 检查 API Key
    if (apiKeyConfigured === false) {
      setPendingAiAction(() => doSmartRequirementAnalysis);
      setApiKeyCheckOpen(true);
      return;
    }
    
    await doSmartRequirementAnalysis();
  };

  // 实际执行智能需求分析
  const doSmartRequirementAnalysis = async () => {
    setAnalyzingRequirement(true);
    try {
      let requirementContent = smartRequirementText;
      
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
      
      const res = await fetch('/api/ai/analyze-requirement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requirementText: requirementContent }),
      });
      const data = await res.json();
      
      if (data.data) {
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
        
        if (analysis.trainingTarget && !trainingTargets.includes(analysis.trainingTarget)) {
          setFormData(prev => ({ ...prev, trainingTarget: '其他' }));
          setOtherTrainingTarget(analysis.trainingTarget);
        }
        if (analysis.targetAudience && !targetAudiences.includes(analysis.targetAudience)) {
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

  // 更新单个表单字段（优化：使用函数式更新）
  const updateFormField = <K extends keyof ProjectFormData>(
    field: K,
    value: ProjectFormData[K]
  ) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <MainLayout>
      <div className="container mx-auto py-6 px-4 max-w-6xl">
        {/* 顶部操作栏 */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold">项目设计</h1>
            <SaveIndicator />
          </div>
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => loadDraftProjects()}
            >
              <FolderOpen className="h-4 w-4 mr-2" />
              草稿箱
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleNewProject}
            >
              <Plus className="h-4 w-4 mr-2" />
              新建项目
            </Button>
            <Button 
              size="sm" 
              onClick={handleManualSave}
              disabled={saveStatus === 'saving'}
            >
              {saveStatus === 'saving' ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              保存
            </Button>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="requirement">需求录入</TabsTrigger>
            <TabsTrigger value="scheme">方案设计</TabsTrigger>
            <TabsTrigger value="venue">场地选择</TabsTrigger>
            <TabsTrigger value="quotation">费用预算</TabsTrigger>
          </TabsList>

          <TabsContent value="requirement" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>培训需求</span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowSmartAnalysis(true)}
                  >
                    <Sparkles className="h-4 w-4 mr-2" />
                    智能分析
                  </Button>
                </CardTitle>
                <CardDescription>
                  请填写培训项目的基本需求信息
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* 项目名称 */}
                <div className="space-y-2">
                  <Label htmlFor="name">项目名称 *</Label>
                  <Input
                    id="name"
                    placeholder="例如：2024年中层管理人员能力提升培训"
                    value={formData.name}
                    onChange={(e) => updateFormField('name', e.target.value)}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* 培训类型 */}
                  <div className="space-y-2">
                    <Label>培训类型</Label>
                    <Select
                      value={formData.trainingTarget}
                      onValueChange={(v) => updateFormField('trainingTarget', v)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="请选择培训类型" />
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
                      <Input
                        placeholder="请输入培训类型"
                        value={otherTrainingTarget}
                        onChange={(e) => setOtherTrainingTarget(e.target.value)}
                        className="mt-2"
                      />
                    )}
                  </div>

                  {/* 目标人群 */}
                  <div className="space-y-2">
                    <Label>目标人群</Label>
                    <Select
                      value={formData.targetAudience}
                      onValueChange={(v) => updateFormField('targetAudience', v)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="请选择目标人群" />
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
                      <Input
                        placeholder="请输入目标人群"
                        value={otherTargetAudience}
                        onChange={(e) => setOtherTargetAudience(e.target.value)}
                        className="mt-2"
                      />
                    )}
                  </div>

                  {/* 参训人数 */}
                  <div className="space-y-2">
                    <Label htmlFor="participantCount">参训人数</Label>
                    <Input
                      id="participantCount"
                      type="number"
                      value={formData.participantCount}
                      onChange={(e) => updateFormField('participantCount', parseInt(e.target.value) || 0)}
                    />
                  </div>

                  {/* 培训天数 */}
                  <div className="space-y-2">
                    <Label htmlFor="trainingDays">培训天数</Label>
                    <Input
                      id="trainingDays"
                      type="number"
                      value={formData.trainingDays}
                      onChange={(e) => updateFormField('trainingDays', parseInt(e.target.value) || 0)}
                    />
                  </div>

                  {/* 培训课时 */}
                  <div className="space-y-2">
                    <Label htmlFor="trainingHours">培训课时</Label>
                    <Input
                      id="trainingHours"
                      type="number"
                      value={formData.trainingHours}
                      onChange={(e) => updateFormField('trainingHours', parseInt(e.target.value) || 0)}
                    />
                  </div>

                  {/* 培训周期 */}
                  <div className="space-y-2">
                    <Label>培训周期</Label>
                    <Select
                      value={formData.trainingPeriod}
                      onValueChange={(v) => updateFormField('trainingPeriod', v)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="请选择培训周期" />
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
                        placeholder="请输入培训周期"
                        value={otherTrainingPeriod}
                        onChange={(e) => setOtherTrainingPeriod(e.target.value)}
                        className="mt-2"
                      />
                    )}
                  </div>
                </div>

                {/* 预算范围 */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>预算范围（万元）</Label>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={noBudgetLimit}
                        onChange={(e) => setNoBudgetLimit(e.target.checked)}
                        className="rounded"
                      />
                      无预算限制
                    </label>
                  </div>
                  {!noBudgetLimit && (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-xs text-muted-foreground">最低</Label>
                        <Input
                          type="number"
                          value={formData.budgetMin}
                          onChange={(e) => updateFormField('budgetMin', parseFloat(e.target.value) || 0)}
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">最高</Label>
                        <Input
                          type="number"
                          value={formData.budgetMax}
                          onChange={(e) => updateFormField('budgetMax', parseFloat(e.target.value) || 0)}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* 培训地点 */}
                <div className="space-y-2">
                  <Label htmlFor="location">培训地点</Label>
                  <Input
                    id="location"
                    placeholder="例如：上海市浦东新区"
                    value={formData.location}
                    onChange={(e) => updateFormField('location', e.target.value)}
                  />
                </div>

                {/* 特殊要求 */}
                <div className="space-y-2">
                  <Label htmlFor="specialRequirements">特殊要求</Label>
                  <Textarea
                    id="specialRequirements"
                    placeholder="请输入其他特殊要求..."
                    value={formData.specialRequirements}
                    onChange={(e) => updateFormField('specialRequirements', e.target.value)}
                    rows={4}
                  />
                </div>

                <div className="flex justify-end">
                  <Button 
                    onClick={() => setActiveTab('scheme')}
                    disabled={!formData.name}
                  >
                    下一步：方案设计
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* 方案设计、场地选择、费用预算的 Tab 内容省略，保持原有逻辑 */}
          <TabsContent value="scheme" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>培训方案</CardTitle>
                <CardDescription>设计培训课程安排</CardDescription>
              </CardHeader>
              <CardContent>
                {courses.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground mb-4">暂无课程安排</p>
                    <Button onClick={() => setActiveTab('requirement')}>
                      返回填写需求
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {courses.map((course, index) => (
                      <Card key={course.id || index}>
                        <CardContent className="p-4">
                          <div className="flex justify-between items-start">
                            <div>
                              <h4 className="font-medium">{course.name}</h4>
                              <p className="text-sm text-muted-foreground">
                                第{course.day}天 · {course.duration}课时
                              </p>
                              {course.teacherName && (
                                <p className="text-sm">
                                  讲师：{course.teacherName} ({course.teacherTitle})
                                </p>
                              )}
                            </div>
                            <Badge>{course.category}</Badge>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="venue" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>场地选择</CardTitle>
                <CardDescription>选择合适的培训场地</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {venues.map((venue) => (
                    <Card 
                      key={venue.id}
                      className={`cursor-pointer transition-all ${
                        selectedVenue?.id === venue.id 
                          ? 'ring-2 ring-primary' 
                          : 'hover:shadow-md'
                      }`}
                      onClick={() => setSelectedVenue(venue)}
                    >
                      <CardContent className="p-4">
                        <h4 className="font-medium">{venue.name}</h4>
                        <p className="text-sm text-muted-foreground">
                          <MapPin className="h-4 w-4 inline mr-1" />
                          {venue.location}
                        </p>
                        <p className="text-sm">
                          容纳人数：{venue.capacity}人
                        </p>
                        <p className="text-sm">
                          日租金：¥{venue.daily_rate}
                        </p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="quotation" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>费用预算</CardTitle>
                <CardDescription>培训项目费用明细</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8">
                  <p className="text-muted-foreground">费用预算功能开发中...</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* 智能分析对话框 */}
        <Dialog open={showSmartAnalysis} onOpenChange={setShowSmartAnalysis}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>智能需求分析</DialogTitle>
              <DialogDescription>
                输入或上传需求描述，AI 将自动分析并填充表单
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <Textarea
                placeholder="请描述您的培训需求..."
                value={smartRequirementText}
                onChange={(e) => setSmartRequirementText(e.target.value)}
                rows={6}
              />
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowSmartAnalysis(false)}>
                  取消
                </Button>
                <Button 
                  onClick={handleSmartRequirementAnalysis}
                  disabled={analyzingRequirement}
                >
                  {analyzingRequirement ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      分析中...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 mr-2" />
                      开始分析
                    </>
                  )}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* 草稿列表对话框 */}
        <Dialog open={showDraftList} onOpenChange={setShowDraftList}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>草稿项目</DialogTitle>
              <DialogDescription>
                选择一个草稿项目继续编辑
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {draftProjects.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">暂无草稿项目</p>
              ) : (
                draftProjects.map((project) => (
                  <Card 
                    key={project.id}
                    className="cursor-pointer hover:bg-accent"
                    onClick={() => handleLoadProject(project.id)}
                  >
                    <CardContent className="p-4 flex justify-between items-center">
                      <div>
                        <h4 className="font-medium">{project.name}</h4>
                        <p className="text-sm text-muted-foreground">
                          创建于 {new Date(project.created_at).toLocaleString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{project.progress}</Badge>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteDraft(project.id);
                          }}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* API Key 检查对话框 */}
        <ApiKeyCheckDialog
          open={apiKeyCheckOpen}
          onOpenChange={setApiKeyCheckOpen}
          onConfirm={() => {
            if (pendingAiAction) {
              pendingAiAction();
              setPendingAiAction(null);
            }
          }}
          title="需要配置 API Key"
          description="智能分析功能需要配置 AI API Key。您可以前往设置页面配置，或手动填写信息。"
        />
      </div>
    </MainLayout>
  );
}
