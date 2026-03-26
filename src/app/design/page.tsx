'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import MainLayout from '@/components/layout/main-layout';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
import { Loader2, Sparkles, Save, ArrowRight, User, MapPin, BookOpen, DollarSign, X, FolderOpen, Plus, Clock, Check, CheckCircle, AlertCircle, Wand2, RefreshCw, Info } from 'lucide-react';
import ApiKeyCheckDialog, { checkApiKeyConfigured } from '@/components/api-key-check-dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

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
  // 是否来自课程模板
  isFromTemplate?: boolean;
  templateId?: string;
  // 参访相关字段
  type?: 'course' | 'visit' | 'break' | 'other';
  visitSiteId?: string;
  visitSiteName?: string;
  visitSiteAddress?: string;
  visitDuration?: number;
  visitFee?: number;
  // 是否来自参访基地库
  isFromVisitLibrary?: boolean;
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
  hourly_rate: string;
  rating: string;
}

interface VisitSite {
  id: string;
  name: string;
  type: string;
  industry: string;
  address: string;
  contactPerson: string;
  contactPhone: string;
  description: string;
  visitContent: string;
  visitDuration: number;
  maxVisitors: number;
  visitFee: number;
  facilities: string;
  requirements: string;
  rating: number;
  visitCount: number;
  isActive: boolean;
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

// Toast 消息类型
interface ToastMessage {
  type: 'success' | 'error' | 'info';
  text: string;
}

export default function DesignPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('requirement');
  const [loading, setLoading] = useState(false);
  const [generateLoading, setGenerateLoading] = useState(false);
  const [projectId, setProjectId] = useState<string | null>(null);
  
  // Toast 消息状态
  const [toast, setToast] = useState<ToastMessage | null>(null);
  
  // 显示 toast 消息 - 使用 useCallback 避免重复创建
  const showToast = useCallback((type: ToastMessage['type'], text: string) => {
    setToast({ type, text });
    setTimeout(() => setToast(null), 3000);
  }, []);
  
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
  const [visitSites, setVisitSites] = useState<VisitSite[]>([]);
  const [selectedVenue, setSelectedVenue] = useState<Venue | null>(null);
  const [selectedVisitSites, setSelectedVisitSites] = useState<VisitSite[]>([]);
  const [quotation, setQuotation] = useState<Record<string, unknown> | null>(null);
  
  // 导入原有方案
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [completedProjects, setCompletedProjects] = useState<Array<{
    id: string;
    name: string;
    trainingTarget?: string;
    targetAudience?: string;
    participantCount?: number;
    trainingDays?: number;
    trainingHours?: number;
    completedAt?: string;
    courses: Course[];
  }>>([]);
  const [importLoading, setImportLoading] = useState(false);
  const [selectedImportProject, setSelectedImportProject] = useState<string | null>(null);
  
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
  
  // 课程编辑
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [editingCourseIndex, setEditingCourseIndex] = useState<number | null>(null);
  const [showEditCourseDialog, setShowEditCourseDialog] = useState(false);
  
  // 课程编辑 - AI调整和课程库选择
  const [aiAdjustText, setAiAdjustText] = useState('');
  const [aiAdjusting, setAiAdjusting] = useState(false);
  const [showCourseLibrary, setShowCourseLibrary] = useState(false);
  const [courseLibraryList, setCourseLibraryList] = useState<Course[]>([]);
  const [visitSiteLibraryList, setVisitSiteLibraryList] = useState<VisitSite[]>([]);
  const [loadingCourseLibrary, setLoadingCourseLibrary] = useState(false);
  
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
  
  // 使用 ref 存储防抖定时器和上一次保存的数据
  const saveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedDataRef = useRef<string>('');
  
  // 使用 ref 存储最新的表单数据，确保 AI 生成时使用最新值
  const formDataRef = useRef(formData);
  const coursesRef = useRef(courses);
  const projectIdRef = useRef(projectId);
  const selectedVenueRef = useRef(selectedVenue);
  
  // 保存状态管理
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [lastSaveTime, setLastSaveTime] = useState<Date | null>(null);
  
  // 更新 ref（批量更新，减少 useEffect 数量）
  useEffect(() => {
    formDataRef.current = formData;
    coursesRef.current = courses;
    projectIdRef.current = projectId;
    selectedVenueRef.current = selectedVenue;
  }, [formData, courses, projectId, selectedVenue]);
  
  // 记录原始加载的项目名称，用于判断是否需要新建项目
  const [originalProjectName, setOriginalProjectName] = useState<string>('');
  const [showSaveAsNewDialog, setShowSaveAsNewDialog] = useState(false);
  const [pendingAction, setPendingAction] = useState<'next' | 'save' | null>(null);
  
  // 实际执行保存的函数（必须在 handleManualSave 之前定义）
  const performSave = useCallback(async (force = false) => {
    // 使用 ref 获取最新数据，避免闭包问题
    const currentFormData = formDataRef.current;
    const currentCourses = coursesRef.current;
    const currentProjectId = projectIdRef.current;
    const currentSelectedVenue = selectedVenueRef.current;
    
    // 检查是否有内容需要保存
    if (!currentFormData.name?.trim() && !currentProjectId) return;
    
    // 检查数据是否变化（非强制保存时才检查）
    const currentData = JSON.stringify({
      formData: currentFormData,
      courses: currentCourses,
      selectedVenueId: currentSelectedVenue?.id,
    });
    
    if (!force && currentData === lastSavedDataRef.current) {
      return; // 数据没变化且不是强制保存，不保存
    }
    
    setSaveStatus('saving');
    
    try {
      const dataToSave = {
        ...currentFormData,
        budgetMin: noBudgetLimit ? null : currentFormData.budgetMin,
        budgetMax: noBudgetLimit ? null : currentFormData.budgetMax,
        trainingPeriod: currentFormData.trainingPeriod === '其他' ? otherTrainingPeriod : currentFormData.trainingPeriod,
        status: 'draft',
        courses: currentCourses,
        selectedVenueId: currentSelectedVenue?.id,
      };

      console.log('Saving data:', dataToSave);
      console.log('Project ID:', currentProjectId);
      console.log('Has courses:', currentCourses.length);

      // 获取session token
      const sessionToken = typeof window !== 'undefined' ? localStorage.getItem('session_token') : null;
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (sessionToken) {
        headers['Authorization'] = `Bearer ${sessionToken}`;
      }
      
      if (currentProjectId) {
        // 更新现有项目
        const res = await fetch(`/api/projects/${currentProjectId}`, {
          method: 'PUT',
          headers,
          body: JSON.stringify(dataToSave),
        });
        
        if (!res.ok) {
          const errorData = await res.json();
          throw new Error(errorData.error || '保存失败');
        }
        
        const data = await res.json();
        console.log('Update project success:', data);
      } else {
        // 创建新项目
        const res = await fetch('/api/projects', {
          method: 'POST',
          headers,
          body: JSON.stringify(dataToSave),
        });
        
        if (!res.ok) {
          const errorData = await res.json();
          throw new Error(errorData.error || '保存失败');
        }
        
        const data = await res.json();
        console.log('Create project success:', data);
        
        if (data.data?.id) {
          setProjectId(data.data.id);
          projectIdRef.current = data.data.id; // 立即更新 ref
          // 更新 URL 添加项目 ID
          const url = new URL(window.location.href);
          url.searchParams.set('id', data.data.id);
          window.history.replaceState({}, '', url.toString());
          console.log('URL updated:', url.toString());
        }
      }
      
      // 更新保存状态
      lastSavedDataRef.current = currentData;
      setLastSaveTime(new Date());
      setSaveStatus('saved');
      
      const saveMessage = currentProjectId 
        ? '项目已更新' 
        : '项目已保存';
      showToast('success', saveMessage);
      
      // 3秒后恢复 idle 状态
      setTimeout(() => setSaveStatus('idle'), 3000);
      
    } catch (error) {
      console.error('Save error:', error);
      setSaveStatus('error');
      const errorMessage = error instanceof Error ? error.message : '保存失败，请重试';
      showToast('error', errorMessage);
      setTimeout(() => setSaveStatus('idle'), 3000);
    }
  }, [noBudgetLimit, otherTrainingPeriod, showToast]);

  // 手动保存（用户点击保存按钮时立即保存）
  const handleManualSave = useCallback(async () => {
    await performSave(true); // 强制保存，即使数据没有变化也保存
  }, [performSave]);

  // 优化后的自动保存：防抖 30 秒，且只在数据变化时保存
  useEffect(() => {
    // 清除之前的定时器
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }
    
    // 没有内容不保存（使用 ref 获取最新值）
    const currentFormData = formDataRef.current;
    const currentProjectId = projectIdRef.current;
    if (!currentFormData.name?.trim() && !currentProjectId) return;
    
    // 设置新的定时器（30秒防抖）
    saveTimerRef.current = setTimeout(() => {
      performSave();
    }, 30000);

    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
    };
  }, [formData, courses, performSave]);

  // 保存状态指示器（使用 useMemo 避免重新创建）
  const saveIndicator = useMemo(() => {
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
  }, [saveStatus, lastSaveTime]);

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

  // 从 URL 参数加载项目数据
  useEffect(() => {
    const loadProjectFromUrl = async () => {
      if (typeof window === 'undefined') return;
      
      const urlParams = new URLSearchParams(window.location.search);
      const projectIdFromUrl = urlParams.get('id');
      
      if (projectIdFromUrl) {
        try {
          // 获取session token
          const sessionToken = localStorage.getItem('session_token');
          const headers: Record<string, string> = { 'Content-Type': 'application/json' };
          if (sessionToken) {
            headers['Authorization'] = `Bearer ${sessionToken}`;
          }

          const res = await fetch(`/api/projects/${projectIdFromUrl}`, { headers });
          const data = await res.json();
          
          if (data.data) {
            const project = data.data;
            
            // 恢复表单数据
            setFormData({
              name: project.name || '',
              trainingTarget: project.trainingTarget || '',
              targetAudience: project.targetAudience || '',
              participantCount: project.participantCount || 50,
              trainingDays: project.trainingDays || 4,
              trainingHours: project.trainingHours || 32,
              trainingPeriod: project.trainingPeriod || '',
              budgetMin: project.budgetMin || 8,
              budgetMax: project.budgetMax || 12,
              location: project.location || '',
              specialRequirements: project.specialRequirements || '',
            });
            
            // 恢复课程数据
            if (project.courses && Array.isArray(project.courses)) {
              setCourses(project.courses);
            }
            
            // 设置项目 ID
            setProjectId(projectIdFromUrl);
            setOriginalProjectName(project.name || '');
            
            console.log('Loaded project from URL:', project.name);
          }
        } catch (error) {
          console.error('Load project from URL error:', error);
        }
      }
    };
    
    loadProjectFromUrl();
  }, []); // 只在组件挂载时执行一次

  // 加载讲师和场地数据
  useEffect(() => {
    const loadResources = async () => {
      try {
        // 获取session token
        const sessionToken = typeof window !== 'undefined' ? localStorage.getItem('session_token') : null;
        const headers: Record<string, string> = {};
        if (sessionToken) {
          headers['Authorization'] = `Bearer ${sessionToken}`;
        }

        const [teachersRes, venuesRes, visitSitesRes] = await Promise.all([
          fetch('/api/teachers', { headers }),
          fetch('/api/venues', { headers }),
          fetch('/api/admin/data?table=visit_sites', { headers }),
        ]);
        const teachersData = await teachersRes.json();
        const venuesData = await venuesRes.json();
        const visitSitesData = await visitSitesRes.json();
        
        console.log('Venues response:', venuesData); // 调试信息
        
        if (venuesData.error) {
          console.error('Load venues error:', venuesData.error);
          // 不在 useEffect 中调用 showToast，避免依赖问题
        } else if (venuesData.data) {
          setVenues(venuesData.data);
          console.log('Loaded venues:', venuesData.data.length); // 调试信息
        }
        
        if (teachersData.data) setTeachers(teachersData.data);
        if (visitSitesData.data) setVisitSites(visitSitesData.data.filter((s: VisitSite) => s.isActive));
      } catch (error) {
        console.error('Load resources error:', error);
      }
    };
    loadResources();
    loadDraftProjects();
    // 检查 API Key 状态
    checkApiKeyConfigured().then(setApiKeyConfigured);
  }, []); // 依赖数组保持为空，只在组件挂载时执行一次

  // 加载草稿项目列表（只在初始化和用户手动操作时调用）
  const loadDraftProjects = async () => {
    try {
      // 获取session token
      const sessionToken = typeof window !== 'undefined' ? localStorage.getItem('session_token') : null;
      const headers: Record<string, string> = {};
      if (sessionToken) {
        headers['Authorization'] = `Bearer ${sessionToken}`;
      }
      
      const res = await fetch('/api/projects?status=draft', { headers });
      const data = await res.json();
      if (data.data) {
        setDraftProjects(data.data.map((p: Record<string, unknown>) => ({
          id: p.id as string,
          name: (p.name as string) || '未命名项目',
          created_at: (p.createdAt as string) || (p.created_at as string),
          updated_at: (p.updatedAt as string) || (p.updated_at as string),
          status: p.status as string,
          progress: calculateProgress(p),
        })));
      }
    } catch (error) {
      console.error('Load draft projects error:', error);
    }
  };

  // 加载已完成项目列表（用于导入原有方案）
  const loadCompletedProjects = async () => {
    setImportLoading(true);
    try {
      // 获取session token
      const sessionToken = typeof window !== 'undefined' ? localStorage.getItem('session_token') : null;
      const headers: Record<string, string> = {};
      if (sessionToken) {
        headers['Authorization'] = `Bearer ${sessionToken}`;
      }
      
      const res = await fetch('/api/projects/completed', { headers });
      const data = await res.json();
      if (data.data) {
        setCompletedProjects(data.data);
      }
    } catch (error) {
      console.error('Load completed projects error:', error);
      showToast('error', '加载已完成项目失败');
    } finally {
      setImportLoading(false);
    }
  };

  // 导入原有培训方案
  const handleImportScheme = (projectId: string) => {
    const project = completedProjects.find(p => p.id === projectId);
    if (project && project.courses) {
      // 导入课程方案
      const importedCourses: Course[] = project.courses.map((c, index) => ({
        id: `imported-${Date.now()}-${index}`,
        name: c.name,
        day: c.day || 1,
        duration: c.duration || 4,
        description: c.description || '',
        category: c.category || '',
        teacherId: c.teacherId,
        teacherName: c.teacherName,
        teacherTitle: c.teacherTitle,
      }));
      setCourses(importedCourses);
      showToast('success', `已导入 ${importedCourses.length} 门课程`);
      setShowImportDialog(false);
      setSelectedImportProject(null);
    }
  };

  // 打开导入对话框
  const handleOpenImportDialog = () => {
    setShowImportDialog(true);
    loadCompletedProjects();
  };

  const calculateProgress = (project: Record<string, unknown>): string => {
    if (project.status === 'draft') {
      if (project.name && (project.participantCount || project.participant_count) && (project.trainingDays || project.training_days)) {
        return '需求填写';
      }
      return '新建';
    }
    return '设计中';
  };

  // 新建项目
  const handleNewProject = () => {
    // 清除项目 ID
    setProjectId(null);
    projectIdRef.current = null;
    
    // 清空原始项目名称
    setOriginalProjectName('');
    
    // 重置表单数据
    const emptyFormData = {
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
    };
    setFormData(emptyFormData);
    formDataRef.current = emptyFormData; // 立即更新 ref
    
    // 清空课程、场地、费用预算
    setCourses([]);
    coursesRef.current = []; // 立即更新 ref
    setSelectedVenue(null);
    setQuotation(null);
    
    // 重置其他状态
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
      // 获取session token
      const sessionToken = typeof window !== 'undefined' ? localStorage.getItem('session_token') : null;
      const headers: Record<string, string> = {};
      if (sessionToken) {
        headers['Authorization'] = `Bearer ${sessionToken}`;
      }
      
      const res = await fetch(`/api/projects/${id}`, { headers });
      const data = await res.json();
      
      if (data.data) {
        const project = data.data;
        
        // 先准备好所有数据，然后一次性更新状态
        const newFormData = {
          name: project.name || '',
          trainingTarget: project.trainingTarget || project.training_target || '',
          targetAudience: project.targetAudience || project.target_audience || '',
          participantCount: project.participantCount || project.participant_count || 50,
          trainingDays: project.trainingDays || project.training_days || 4,
          trainingHours: project.trainingHours || project.training_hours || 32,
          trainingPeriod: project.trainingPeriod || project.training_period || '',
          budgetMin: project.budgetMin ?? project.budget_min ?? 8,
          budgetMax: project.budgetMax ?? project.budget_max ?? 12,
          location: project.location || '',
          specialRequirements: project.specialRequirements || project.special_requirements || '',
        };
        
        const newCourses = project.courses && Array.isArray(project.courses) ? project.courses : [];
        
        const venueId = project.venueId || project.selected_venue_id || project.venue_id;
        const venue = venueId ? venues.find(v => v.id === venueId) : null;
        
        // 更新已保存数据引用（用于后续比较是否需要保存）
        lastSavedDataRef.current = JSON.stringify({
          formData: newFormData,
          courses: newCourses,
          selectedVenueId: venueId,
        });
        
        // 批量更新所有状态（React 18 会自动批量处理）
        setProjectId(project.id);
        projectIdRef.current = project.id;
        setOriginalProjectName(project.name || '');
        setFormData(newFormData);
        formDataRef.current = newFormData;
        setCourses(newCourses);
        coursesRef.current = newCourses;
        setSelectedVenue(venue || null);
        selectedVenueRef.current = venue || null;
        setQuotation(null);
        setModifySuggestion('');
        setCheckResult(null);
        setCoursesToSplit([]);
        setShowDraftList(false);
      }
    } catch (error) {
      console.error('Load project error:', error);
    }
  };

  // 删除草稿
  const handleDeleteDraft = async (id: string) => {
    if (!confirm('确定要删除这个草稿吗？')) return;
    
    try {
      // 获取session token
      const sessionToken = typeof window !== 'undefined' ? localStorage.getItem('session_token') : null;
      const headers: Record<string, string> = {};
      if (sessionToken) {
        headers['Authorization'] = `Bearer ${sessionToken}`;
      }
      
      await fetch(`/api/projects/${id}`, {
        method: 'DELETE',
        headers,
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
      
      // 获取session token
      const sessionToken = typeof window !== 'undefined' ? localStorage.getItem('session_token') : null;
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (sessionToken) {
        headers['Authorization'] = `Bearer ${sessionToken}`;
      }
      
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers,
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
          name: analysis.name && analysis.name.trim() ? analysis.name : prev.name,
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
        
        showToast('success', '需求分析完成，已自动填充表单');
        setShowSmartAnalysis(false);
        setSmartRequirementText('');
        setSmartRequirementFile(null);
      }
    } catch (error) {
      console.error('Smart requirement analysis error:', error);
      showToast('error', '需求分析失败，请重试');
    } finally {
      setAnalyzingRequirement(false);
    }
  };

  // AI 智能生成培训方案
  const handleGenerateScheme = async () => {
    // 检查 API Key（null 表示还在检查中，false 表示未配置）
    if (apiKeyConfigured === null) {
      // 先检查 API Key 配置状态
      const configured = await checkApiKeyConfigured();
      setApiKeyConfigured(configured);
      if (!configured) {
        setPendingAiAction(() => doGenerateScheme);
        setApiKeyCheckOpen(true);
        return;
      }
    } else if (apiKeyConfigured === false) {
      setPendingAiAction(() => doGenerateScheme);
      setApiKeyCheckOpen(true);
      return;
    }
    
    await doGenerateScheme();
  };

  // 实际执行生成方案
  const doGenerateScheme = async () => {
    // 使用 ref 获取最新的表单数据，避免闭包问题
    const currentFormData = formDataRef.current;
    const currentCourses = coursesRef.current;
    
    setGenerateLoading(true);
    try {
      // 添加超时控制（60秒）
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000);
      
      const res = await fetch('/api/ai/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'courses',
          projectData: {
            ...currentFormData,
            budgetMin: noBudgetLimit ? null : currentFormData.budgetMin,
            budgetMax: noBudgetLimit ? null : currentFormData.budgetMax,
            trainingPeriod: currentFormData.trainingPeriod === '其他' ? otherTrainingPeriod : currentFormData.trainingPeriod,
            noBudgetLimit,
          },
        }),
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      const data = await res.json();
      
      if (data.data?.courses) {
        const generatedCourses: Course[] = data.data.courses.map((c: Record<string, unknown>, index: number) => ({
          id: `course-${Date.now()}-${index}`,
          name: c.name as string || `课程${index + 1}`,
          day: c.day as number || Math.floor(index / 2) + 1,
          duration: c.duration as number || 4,
          description: c.description as string || '',
          category: c.category as string || '综合提升类',
          teacherId: c.teacherId as string,
          teacherTitle: c.teacherTitle as string,
          teacherName: c.teacherName as string,
          location: c.location as string,
          isFromTemplate: c.isFromTemplate as boolean || false,
          templateId: c.templateId as string,
          // 参访相关字段
          type: (c.type as 'course' | 'visit' | 'break' | 'other') || 'course',
          visitSiteId: c.visitSiteId as string,
          visitSiteName: c.visitSiteName as string,
          visitSiteAddress: c.visitSiteAddress as string,
          isFromVisitLibrary: c.isFromVisitLibrary as boolean || false,
        }));
        
        setCourses(generatedCourses);
      } else if (data.data?.raw) {
        // AI 返回了内容但无法解析
        console.error('AI response parse error:', data.data.raw);
        alert('AI 响应格式异常，请重试');
      } else if (data.error) {
        alert(data.error);
      } else {
        console.error('Unexpected response:', data);
        alert('生成方案失败，请重试');
      }
    } catch (error) {
      console.error('Generate scheme error:', error);
      if (error instanceof Error && error.name === 'AbortError') {
        alert('生成超时，请重试');
      } else {
        alert('生成方案失败，请重试');
      }
    } finally {
      setGenerateLoading(false);
    }
  };

  // 根据修改意见重新生成方案
  const handleModifyScheme = async () => {
    if (!modifySuggestion.trim()) {
      alert('请输入修改意见');
      return;
    }
    
    // 检查 API Key（null 表示还在检查中，false 表示未配置）
    if (apiKeyConfigured === null) {
      const configured = await checkApiKeyConfigured();
      setApiKeyConfigured(configured);
      if (!configured) {
        setPendingAiAction(() => doModifyScheme);
        setApiKeyCheckOpen(true);
        return;
      }
    } else if (apiKeyConfigured === false) {
      setPendingAiAction(() => doModifyScheme);
      setApiKeyCheckOpen(true);
      return;
    }
    
    await doModifyScheme();
  };

  const doModifyScheme = async () => {
    setGenerateLoading(true);
    try {
      const res = await fetch('/api/ai/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'modify-courses',
          projectData: {
            ...formData,
            budgetMin: noBudgetLimit ? null : formData.budgetMin,
            budgetMax: noBudgetLimit ? null : formData.budgetMax,
            trainingPeriod: formData.trainingPeriod === '其他' ? otherTrainingPeriod : formData.trainingPeriod,
            noBudgetLimit,
            currentCourses: courses,
            modifySuggestion,
          },
        }),
      });
      
      const data = await res.json();
      
      if (data.data?.courses) {
        const generatedCourses: Course[] = data.data.courses.map((c: Record<string, unknown>, index: number) => ({
          id: `course-${Date.now()}-${index}`,
          name: c.name as string || `课程${index + 1}`,
          day: c.day as number || Math.floor(index / 2) + 1,
          duration: c.duration as number || 4,
          description: c.description as string || '',
          category: c.category as string || '综合提升类',
          teacherId: c.teacherId as string,
          teacherTitle: c.teacherTitle as string,
          teacherName: c.teacherName as string,
          location: c.location as string,
          isFromTemplate: c.isFromTemplate as boolean || false,
          templateId: c.templateId as string,
          // 参访相关字段
          type: (c.type as 'course' | 'visit' | 'break' | 'other') || 'course',
          visitSiteId: c.visitSiteId as string,
          visitSiteName: c.visitSiteName as string,
          visitSiteAddress: c.visitSiteAddress as string,
          isFromVisitLibrary: c.isFromVisitLibrary as boolean || false,
        }));
        
        setCourses(generatedCourses);
        setModifySuggestion(''); // 清空修改意见
      } else if (data.error) {
        alert(data.error);
      }
    } catch (error) {
      console.error('Modify scheme error:', error);
      alert('修改方案失败，请重试');
    } finally {
      setGenerateLoading(false);
    }
  };

  // 打开编辑课程对话框
  const handleEditCourse = (course: Course, index: number) => {
    setEditingCourse({ ...course });
    setEditingCourseIndex(index);
    setShowEditCourseDialog(true);
  };

  // 新增课程/参访
  const handleAddCourse = (type: 'course' | 'visit' = 'course') => {
    // 计算新课程的天数（默认最后一天的下一天，或最后一天）
    const lastDay = courses.length > 0 
      ? Math.max(...courses.map(c => c.day || 1)) 
      : 1;
    const lastDayCourses = courses.filter(c => c.day === lastDay);
    const lastDayTotalDuration = lastDayCourses.reduce((sum, c) => sum + (c.duration || 0), 0);
    
    // 如果最后一天课时数>=8，则新增到下一天
    const newDay = lastDayTotalDuration >= 8 ? lastDay + 1 : lastDay;
    
    if (type === 'visit') {
      // 新增参访
      const newCourse: Course = {
        id: `visit-${Date.now()}`,
        name: '',
        day: newDay,
        duration: 4,
        description: '',
        category: '参访',
        type: 'visit',
      };
      setEditingCourse(newCourse);
      setEditingCourseIndex(courses.length); // 添加到末尾
    } else {
      // 新增课程
      const newCourse: Course = {
        id: `course-${Date.now()}`,
        name: '',
        day: newDay,
        duration: 4,
        description: '',
        category: '综合提升类',
        type: 'course',
      };
      setEditingCourse(newCourse);
      setEditingCourseIndex(courses.length); // 添加到末尾
    }
    
    setShowEditCourseDialog(true);
  };

  // 保存编辑的课程
  const handleSaveEditedCourse = () => {
    if (editingCourse && editingCourseIndex !== null) {
      // 验证必填字段
      if (!editingCourse.name || editingCourse.name.trim() === '') {
        showToast('error', '请输入课程名称');
        return;
      }
      
      // 验证课时范围
      if (editingCourse.duration < 1 || editingCourse.duration > 8) {
        showToast('error', '课时必须在1-8之间');
        return;
      }
      
      const newCourses = [...courses];
      if (editingCourseIndex >= courses.length) {
        // 新增课程
        newCourses.push(editingCourse);
        showToast('success', editingCourse.type === 'visit' ? '参访活动已添加' : '课程已添加');
      } else {
        // 编辑课程
        newCourses[editingCourseIndex] = editingCourse;
        showToast('success', '课程已更新');
      }
      
      // 按天数排序课程
      newCourses.sort((a, b) => a.day - b.day);
      
      setCourses(newCourses);
      setShowEditCourseDialog(false);
      setEditingCourse(null);
      setEditingCourseIndex(null);
      setAiAdjustText(''); // 清空AI调整输入
    }
  };

  // AI调整单个课程
  const handleAiAdjustCourse = async () => {
    if (!aiAdjustText.trim()) {
      showToast('error', '请输入调整需求');
      return;
    }
    
    if (!editingCourse) {
      showToast('error', '请先填写基本信息');
      return;
    }
    
    // 检查 API Key
    const isConfigured = await checkApiKeyConfigured();
    if (!isConfigured) {
      setPendingAiAction(() => handleAiAdjustCourse);
      setApiKeyCheckOpen(true);
      return;
    }
    
    setAiAdjusting(true);
    try {
      const response = await fetch('/api/ai/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'adjust-single-course',
          projectData: {
            currentCourse: editingCourse,
            adjustRequirement: aiAdjustText,
            trainingTarget: formData.trainingTarget,
            targetAudience: formData.targetAudience,
          },
        }),
      });

      if (!response.ok) {
        throw new Error('AI调整失败');
      }

      const responseData = await response.json();
      
      if (responseData.data?.course) {
        // 保留原课程的day和其他必要字段
        setEditingCourse({
          ...editingCourse,
          ...responseData.data.course,
          day: editingCourse.day, // 保持原天数
        });
        showToast('success', '课程已根据需求调整');
      } else if (responseData.data?.raw) {
        // 尝试从 raw 内容中提取 JSON
        try {
          const jsonMatch = responseData.data.raw.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            if (parsed.course) {
              setEditingCourse({
                ...editingCourse,
                ...parsed.course,
                day: editingCourse.day,
              });
              showToast('success', '课程已根据需求调整');
            }
          }
        } catch {
          showToast('error', 'AI返回格式异常，请重试');
        }
      } else {
        showToast('error', 'AI返回格式异常，请重试');
      }
    } catch (error) {
      console.error('AI调整失败:', error);
      showToast('error', 'AI调整失败，请重试');
    } finally {
      setAiAdjusting(false);
    }
  };

  // 加载课程库或参访基地库
  const loadCourseLibrary = async () => {
    setLoadingCourseLibrary(true);
    try {
      // 根据课程类型加载不同的数据
      if (editingCourse?.type === 'visit') {
        // 加载参访基地列表
        const response = await fetch('/api/admin/data?table=visit_sites');
        if (!response.ok) {
          throw new Error('加载参访基地库失败');
        }
        const data = await response.json();
        const activeSites = (data.data || []).filter((s: VisitSite) => s.isActive);
        setVisitSiteLibraryList(activeSites);
        setCourseLibraryList([]); // 清空课程模板列表
        setShowCourseLibrary(true);
      } else {
        // 加载课程模板列表
        const response = await fetch('/api/courses/templates');
        if (!response.ok) {
          throw new Error('加载课程库失败');
        }
        const data = await response.json();
        setCourseLibraryList(data.templates || []);
        setVisitSiteLibraryList([]); // 清空参访基地列表
        setShowCourseLibrary(true);
      }
    } catch (error) {
      console.error('加载库失败:', error);
      showToast('error', editingCourse?.type === 'visit' ? '加载参访基地库失败' : '加载课程库失败');
    } finally {
      setLoadingCourseLibrary(false);
    }
  };

  // 从课程库选择
  const handleSelectFromLibrary = (template: Course) => {
    if (editingCourse) {
      setEditingCourse({
        ...editingCourse,
        name: template.name,
        duration: template.duration || 4,
        description: template.description || '',
        category: template.category || '',
        teacherId: template.teacherId,
        teacherName: template.teacherName || '',
        teacherTitle: template.teacherTitle || '',
        isFromTemplate: true,
        templateId: template.id,
      });
      setShowCourseLibrary(false);
      showToast('success', `已选择课程：${template.name}`);
    }
  };

  // 从参访基地库选择
  const handleSelectFromVisitLibrary = (site: VisitSite) => {
    if (editingCourse) {
      setEditingCourse({
        ...editingCourse,
        name: `参访：${site.name}`,
        duration: site.visitDuration || 3,
        description: site.visitContent || site.description || '',
        category: '参访',
        visitSiteId: site.id,
        visitSiteName: site.name,
        visitSiteAddress: site.address,
        visitDuration: site.visitDuration,
        visitFee: site.visitFee,
        location: site.address,
        isFromVisitLibrary: true,
      });
      setShowCourseLibrary(false);
      showToast('success', `已选择参访基地：${site.name}`);
    }
  };

  // 删除课程
  const handleDeleteCourse = (index: number) => {
    if (confirm('确定要删除这门课程吗？')) {
      const newCourses = courses.filter((_, i) => i !== index);
      setCourses(newCourses);
    }
  };

  // 上移课程
  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    const newCourses = [...courses];
    [newCourses[index - 1], newCourses[index]] = [newCourses[index], newCourses[index - 1]];
    setCourses(newCourses);
  };

  // 下移课程
  const handleMoveDown = (index: number) => {
    if (index === courses.length - 1) return;
    const newCourses = [...courses];
    [newCourses[index], newCourses[index + 1]] = [newCourses[index + 1], newCourses[index]];
    setCourses(newCourses);
  };

  // 检查课程序号是否正确
  const [checkResult, setCheckResult] = useState<{ valid: boolean; issues: string[]; canAutoFix: boolean } | null>(null);
  const [showCheckResult, setShowCheckResult] = useState(false);
  const [coursesToSplit, setCoursesToSplit] = useState<Array<{idx: number; name: string; duration: number; suggestion: string}>>([]);

  const handleCheckCourses = () => {
    const issues: string[] = [];
    let canAutoFix = true;
    const totalDays = formData.trainingDays || 1;
    const totalHours = formData.trainingHours || 0;
    
    // 1. 检查天数是否连续且在范围内
    const days = courses.map(c => c.day);
    const uniqueDays = [...new Set(days)].sort((a, b) => a - b);
    const maxDay = days.length > 0 ? Math.max(...days) : 0;
    
    if (maxDay > totalDays) {
      issues.push(`存在第${maxDay}天的课程，但培训总天数为${totalDays}天`);
    }
    
    // 检查天数是否有跳过
    for (let d = 1; d <= Math.min(maxDay, totalDays); d++) {
      if (!uniqueDays.includes(d)) {
        issues.push(`第${d}天没有安排课程`);
      }
    }
    
    // 2. 检查课时总数
    const totalCourseHours = courses.reduce((sum, c) => sum + (c.duration || 0), 0);
    if (totalHours > 0 && totalCourseHours !== totalHours) {
      issues.push(`课程总课时为${totalCourseHours}，与设定课时${totalHours}不符`);
      canAutoFix = false; // 课时总数问题无法自动修复
    }
    
    // 3. 检查每天课时是否合理（每天不超过12课时）
    const hoursByDay: Record<number, number> = {};
    courses.forEach(c => {
      hoursByDay[c.day] = (hoursByDay[c.day] || 0) + (c.duration || 0);
    });
    
    const overDays: number[] = [];
    Object.entries(hoursByDay).forEach(([day, hours]) => {
      if (hours > 12) {
        issues.push(`第${day}天课时为${hours}，超过每日12课时上限`);
        overDays.push(parseInt(day));
      }
    });
    
    // 检查是否可以自动修复（需要计算是否能在设定天数内安排完）
    if (overDays.length > 0) {
      const neededDays = Math.ceil(totalCourseHours / 12);
      if (neededDays > totalDays) {
        issues.push(`提示：按每天12课时计算，当前课程需要${neededDays}天，但培训总天数仅为${totalDays}天`);
        canAutoFix = false;
      }
    }
    
    // 4. 检查是否有重复课程
    const courseNames = courses.map(c => c.name);
    const duplicates = courseNames.filter((name, idx) => courseNames.indexOf(name) !== idx);
    if (duplicates.length > 0) {
      issues.push(`存在重复课程：${[...new Set(duplicates)].join('、')}`);
      canAutoFix = false; // 重复课程无法自动修复
    }
    
    // 5. 检查课程是否有名称
    courses.forEach((c, idx) => {
      if (!c.name || c.name.trim() === '') {
        issues.push(`第${idx + 1}个课程没有名称`);
        canAutoFix = false; // 空名称无法自动修复
      }
    });
    
    // 6. 检查是否有单门课程超过4课时（需要拆分）
    const coursesNeedSplit: Array<{idx: number; name: string; duration: number; suggestion: string}> = [];
    courses.forEach((c, idx) => {
      const duration = c.duration || 4;
      if (duration > 4) {
        let suggestion = '';
        if (duration === 6) {
          suggestion = '建议拆分为4+2课时，课程名称分为上下';
        } else if (duration === 8) {
          suggestion = '建议拆分为4+4课时，课程名称分为上下';
        } else if (duration === 10) {
          suggestion = '建议拆分为4+4+2课时，课程名称分为上中下';
        } else if (duration === 12) {
          suggestion = '建议拆分为4+4+4课时，课程名称分为上中下';
        } else {
          suggestion = `建议拆分为多个4课时或2课时的课程`;
        }
        coursesNeedSplit.push({ idx: idx + 1, name: c.name, duration, suggestion });
        issues.push(`第${idx + 1}门课程"${c.name}"课时为${duration}，${suggestion}`);
      }
    });
    
    // 记录需要拆分的课程，用于自动修复
    setCoursesToSplit(coursesNeedSplit);
    if (coursesNeedSplit.length > 0) {
      canAutoFix = true; // 可以自动拆分
    }
    
    // 7. 检查每天课时是否均匀分配
    if (totalDays > 0 && totalCourseHours > 0) {
      const avgHoursPerDay = totalCourseHours / totalDays;
      // 允许的浮动范围：平均值的±50%，或者至少±2课时
      const tolerance = Math.max(avgHoursPerDay * 0.5, 2);
      
      Object.entries(hoursByDay).forEach(([day, hours]) => {
        const dayNum = parseInt(day);
        if (dayNum <= totalDays) {
          const diff = Math.abs(hours - avgHoursPerDay);
          if (diff > tolerance) {
            if (hours > avgHoursPerDay) {
              issues.push(`第${day}天课时为${hours}，高于平均值${avgHoursPerDay.toFixed(1)}较多，建议均衡安排`);
            } else {
              issues.push(`第${day}天课时为${hours}，低于平均值${avgHoursPerDay.toFixed(1)}较多，建议均衡安排`);
            }
          }
        }
      });
    }
    
    setCheckResult({
      valid: issues.length === 0,
      issues,
      canAutoFix
    });
    setShowCheckResult(true);
  };

  // 拆分课程函数：将超4课时课程拆分为4课时单位
  const splitCourse = (course: Course): Course[] => {
    const duration = course.duration || 4;
    
    if (duration <= 4) {
      return [course];
    }
    
    const result: Course[] = [];
    
    // 根据课时决定拆分方式和命名
    if (duration === 6) {
      // 4+2，分上下
      result.push({
        ...course,
        id: `${course.id}-1`,
        name: `${course.name}（上）`,
        duration: 4,
      });
      result.push({
        ...course,
        id: `${course.id}-2`,
        name: `${course.name}（下）`,
        duration: 2,
      });
    } else if (duration === 8) {
      // 4+4，分上下
      result.push({
        ...course,
        id: `${course.id}-1`,
        name: `${course.name}（上）`,
        duration: 4,
      });
      result.push({
        ...course,
        id: `${course.id}-2`,
        name: `${course.name}（下）`,
        duration: 4,
      });
    } else if (duration === 10) {
      // 4+4+2，分上中下
      result.push({
        ...course,
        id: `${course.id}-1`,
        name: `${course.name}（上）`,
        duration: 4,
      });
      result.push({
        ...course,
        id: `${course.id}-2`,
        name: `${course.name}（中）`,
        duration: 4,
      });
      result.push({
        ...course,
        id: `${course.id}-3`,
        name: `${course.name}（下）`,
        duration: 2,
      });
    } else if (duration === 12) {
      // 4+4+4，分上中下
      result.push({
        ...course,
        id: `${course.id}-1`,
        name: `${course.name}（上）`,
        duration: 4,
      });
      result.push({
        ...course,
        id: `${course.id}-2`,
        name: `${course.name}（中）`,
        duration: 4,
      });
      result.push({
        ...course,
        id: `${course.id}-3`,
        name: `${course.name}（下）`,
        duration: 4,
      });
    } else {
      // 其他情况：按4课时拆分，剩余部分作为最后一个课程
      const fullParts = Math.floor(duration / 4);
      const remainder = duration % 4;
      
      const suffixes = ['（上）', '（中）', '（下）', '（四）', '（五）', '（六）'];
      
      for (let i = 0; i < fullParts; i++) {
        result.push({
          ...course,
          id: `${course.id}-${i + 1}`,
          name: `${course.name}${suffixes[i] || `（第${i + 1}部分）`}`,
          duration: 4,
        });
      }
      
      if (remainder > 0) {
        result.push({
          ...course,
          id: `${course.id}-${fullParts + 1}`,
          name: `${course.name}${suffixes[fullParts] || `（第${fullParts + 1}部分）`}`,
          duration: remainder,
        });
      }
    }
    
    return result;
  };

  // 自动修复：拆分课程并重新分配天数
  const handleAutoFix = () => {
    if (!checkResult || checkResult.valid || !checkResult.canAutoFix) return;
    
    // 第一步：拆分所有超过4课时的课程
    const splitCourses: Course[] = [];
    for (const course of courses) {
      const split = splitCourse(course);
      splitCourses.push(...split);
    }
    
    // 第二步：按每天最多12课时重新分配课程天数
    const maxHoursPerDay = 12;
    
    let currentDay = 1;
    let currentDayHours = 0;
    const fixedCourses: Course[] = [];
    
    // 按顺序分配课程到每天，确保每天不超过12课时
    for (const course of splitCourses) {
      const courseHours = course.duration || 4;
      
      // 如果当前课程加到当天会超过12课时，移到下一天
      if (currentDayHours + courseHours > maxHoursPerDay && currentDayHours > 0) {
        currentDay++;
        currentDayHours = 0;
      }
      
      fixedCourses.push({ ...course, day: currentDay });
      currentDayHours += courseHours;
    }
    
    setCourses(fixedCourses);
    setCoursesToSplit([]);
    setCheckResult(null);
    setShowCheckResult(false);
    showToast('success', `已自动拆分并重新分配课程，共${fixedCourses.length}门课程`);
  };

  // 处理"下一步：方案设计"按钮点击
  const handleNextToScheme = async () => {
    // 使用 ref 获取最新状态
    const currentFormData = formDataRef.current;
    const currentCourses = coursesRef.current;
    const currentProjectId = projectIdRef.current;
    
    // 判断是否需要询问用户（项目名称变化了）
    if (currentProjectId && originalProjectName && currentFormData.name && currentFormData.name !== originalProjectName) {
      setPendingAction('next');
      setShowSaveAsNewDialog(true);
      return;
    }
    
    // 先保存数据
    if (currentFormData.name?.trim()) {
      await performSave();
    }
    
    // 如果已有方案，直接切换到方案设计tab显示
    if (currentCourses.length > 0) {
      setActiveTab('scheme');
      showToast('success', `已加载现有方案，共${currentCourses.length}门课程`);
    } 
    // 如果没有课程但有项目名称，自动生成方案
    else if (currentFormData.name) {
      setActiveTab('scheme');
      handleGenerateScheme();
    }
    // 如果连项目名称都没有，提示用户
    else {
      showToast('error', '请先填写项目名称');
    }
  };
  
  // 处理"另存为新项目"
  const handleSaveAsNewProject = async () => {
    const currentFormData = formDataRef.current;
    
    // 清除原项目ID，作为新项目保存
    setProjectId(null);
    projectIdRef.current = null; // 立即更新 ref，确保 performSave 使用正确值
    setOriginalProjectName(currentFormData.name || '');
    lastSavedDataRef.current = ''; // 强制保存
    
    setShowSaveAsNewDialog(false);
    
    // 执行保存
    await performSave();
    
    // 如果之前是点击"下一步"，继续执行
    if (pendingAction === 'next') {
      const currentCourses = coursesRef.current;
      if (currentCourses.length > 0) {
        setActiveTab('scheme');
        showToast('success', `已保存为新项目，共${currentCourses.length}门课程`);
      } else if (currentFormData.name) {
        setActiveTab('scheme');
        handleGenerateScheme();
      }
    }
    
    setPendingAction(null);
  };
  
  // 处理"更新原项目"
  const handleUpdateOriginalProject = async () => {
    const currentFormData = formDataRef.current;
    const currentProjectId = projectIdRef.current;
    
    // 更新原始项目名称
    setOriginalProjectName(currentFormData.name || '');
    
    setShowSaveAsNewDialog(false);
    
    // 执行保存
    await performSave();
    
    // 如果之前是点击"下一步"，继续执行
    if (pendingAction === 'next') {
      const currentCourses = coursesRef.current;
      if (currentCourses.length > 0) {
        setActiveTab('scheme');
        showToast('success', `已更新原项目，共${currentCourses.length}门课程`);
      } else if (currentFormData.name) {
        setActiveTab('scheme');
        handleGenerateScheme();
      }
    }
    
    setPendingAction(null);
  };

  // 更新单个表单字段（优化：使用函数式更新）
  const updateFormField = <K extends keyof ProjectFormData>(
    field: K,
    value: ProjectFormData[K]
  ) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // 当前编辑项目提示（使用 useMemo 避免重新创建）
  const currentProjectBanner = useMemo(() => {
    if (!projectId || !originalProjectName) return null;
    
    return (
      <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-center gap-2">
        <FolderOpen className="h-4 w-4 text-blue-600" />
        <span className="text-sm text-blue-800">
          正在编辑项目：<strong>{originalProjectName}</strong>
          {formData.name !== originalProjectName && (
            <span className="ml-2 text-orange-600">（名称已修改）</span>
          )}
        </span>
      </div>
    );
  }, [projectId, originalProjectName, formData.name]);

  return (
    <MainLayout>
      {/* Toast 消息 */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 animate-in slide-in-from-right ${
          toast.type === 'success' ? 'bg-green-500 text-white' :
          toast.type === 'error' ? 'bg-red-500 text-white' :
          'bg-blue-500 text-white'
        }`}>
          {toast.type === 'success' && <Check className="h-4 w-4" />}
          {toast.type === 'error' && <AlertCircle className="h-4 w-4" />}
          <span>{toast.text}</span>
        </div>
      )}
      
      <div className="container mx-auto py-6 px-4 max-w-6xl">
        {/* 顶部操作栏 */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold">项目设计</h1>
            {saveIndicator}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => {
                loadDraftProjects();
                setShowDraftList(true);
              }}
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

        <Tabs value={activeTab} onValueChange={(value) => {
          // 切换 Tab 前先尝试保存
          if (formData.name?.trim()) {
            performSave();
          }
          setActiveTab(value);
        }}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="requirement">需求录入</TabsTrigger>
            <TabsTrigger value="scheme">方案设计</TabsTrigger>
            <TabsTrigger value="venue">场地选择</TabsTrigger>
            <TabsTrigger value="quotation">费用预算</TabsTrigger>
          </TabsList>

          <TabsContent value="requirement" className="mt-6">
            {/* 当前编辑项目提示 */}
            {currentProjectBanner}
            <Card>
              <CardHeader>
                <CardTitle>培训需求</CardTitle>
                <CardDescription>
                  请填写培训项目的基本需求信息，或使用智能分析自动填充
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

                {/* 智能需求分析区域 */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-5 w-5 text-blue-600" />
                      <span className="font-medium text-blue-800">智能需求分析</span>
                    </div>
                    <span className="text-xs text-blue-600">输入描述，AI 自动填充表单</span>
                  </div>
                  <div className="space-y-3">
                    <Textarea
                      placeholder="请描述您的培训需求，例如：我们需要为中层管理人员举办一期为期3天的领导力提升培训，目标是提升团队管理和沟通协调能力，预计50人参加..."
                      value={smartRequirementText}
                      onChange={(e) => setSmartRequirementText(e.target.value)}
                      rows={3}
                      className="border-blue-200 focus:border-blue-400"
                    />
                    <div className="flex items-center gap-3">
                      <Button
                        onClick={handleSmartRequirementAnalysis}
                        disabled={analyzingRequirement || !smartRequirementText.trim()}
                        className="bg-blue-600 hover:bg-blue-700"
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
                      {smartRequirementText.trim() && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSmartRequirementText('')}
                          className="text-blue-600"
                        >
                          清空
                        </Button>
                      )}
                    </div>
                  </div>
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
                    onClick={handleNextToScheme}
                    disabled={!formData.name}
                  >
                    {courses.length > 0 ? '下一步：查看方案' : '下一步：生成方案'}
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* 方案设计、场地选择、费用预算的 Tab 内容省略，保持原有逻辑 */}
          <TabsContent value="scheme" className="mt-6">
            {currentProjectBanner}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>培训方案</span>
                  <div className="flex items-center gap-2">
                    {courses.length > 0 && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleCheckCourses}
                        className="text-blue-600 border-blue-200 hover:bg-blue-50"
                      >
                        <AlertCircle className="h-4 w-4 mr-2" />
                        检查方案
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleGenerateScheme}
                      disabled={generateLoading || !formData.name}
                    >
                      {generateLoading ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          生成中...
                        </>
                      ) : courses.length === 0 ? (
                        <>
                          <Wand2 className="h-4 w-4 mr-2" />
                          智能生成方案
                        </>
                      ) : (
                        <>
                          <RefreshCw className="h-4 w-4 mr-2" />
                          重新生成
                        </>
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleOpenImportDialog}
                      className="text-green-600 border-green-200 hover:bg-green-50"
                    >
                      <BookOpen className="h-4 w-4 mr-2" />
                      导入原有方案
                    </Button>
                  </div>
                </CardTitle>
                <CardDescription>设计培训课程安排，可使用 AI 智能生成</CardDescription>
              </CardHeader>
              <CardContent>
                {generateLoading ? (
                  <div className="text-center py-12">
                    <Loader2 className="h-12 w-12 mx-auto text-primary animate-spin mb-4" />
                    <p className="text-muted-foreground">正在智能生成培训方案...</p>
                  </div>
                ) : courses.length === 0 ? (
                  <div className="text-center py-8">
                    <BookOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground mb-4">暂无课程安排</p>
                    <div className="flex justify-center gap-2">
                      <Button variant="outline" onClick={() => setActiveTab('requirement')}>
                        返回填写需求
                      </Button>
                      <Button 
                        onClick={handleGenerateScheme}
                        disabled={generateLoading || !formData.name}
                      >
                        <Sparkles className="h-4 w-4 mr-2" />
                        智能生成方案
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* 课程操作按钮栏 */}
                    <div className="flex justify-between items-center">
                      <div className="flex gap-2">
                        <Button 
                          variant="outline"
                          onClick={() => handleAddCourse('course')}
                          className="text-primary border-primary/30 hover:bg-primary/5"
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          新增课程
                        </Button>
                        <Button 
                          variant="outline"
                          onClick={() => handleAddCourse('visit')}
                          className="text-orange-600 border-orange-300 hover:bg-orange-50"
                        >
                          <MapPin className="h-4 w-4 mr-2" />
                          新增参访
                        </Button>
                      </div>
                      <Button 
                        onClick={handleGenerateScheme}
                        disabled={generateLoading}
                        variant="default"
                        size="sm"
                      >
                        <Sparkles className="h-4 w-4 mr-2" />
                        重新生成方案
                      </Button>
                    </div>
                    <div className="rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-20 text-center">排序</TableHead>
                            <TableHead className="w-16 text-center">序号</TableHead>
                            <TableHead className="w-20 text-center">天数</TableHead>
                            <TableHead>课程名称</TableHead>
                            <TableHead className="w-20 text-center">课时</TableHead>
                            <TableHead className="w-32">建议讲师</TableHead>
                            <TableHead className="w-40">课程地点</TableHead>
                            <TableHead className="w-20 text-center">操作</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {courses.map((course, index) => (
                            <TableRow 
                              key={course.id || index}
                              className="cursor-pointer hover:bg-muted/50"
                              onClick={() => handleEditCourse(course, index)}
                            >
                              <TableCell className="text-center">
                                <div className="flex items-center justify-center gap-1">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 w-7 p-0"
                                    disabled={index === 0}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleMoveUp(index);
                                    }}
                                  >
                                    ↑
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 w-7 p-0"
                                    disabled={index === courses.length - 1}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleMoveDown(index);
                                    }}
                                  >
                                    ↓
                                  </Button>
                                </div>
                              </TableCell>
                              <TableCell className="text-center font-medium">{index + 1}</TableCell>
                              <TableCell className="text-center">第{course.day}天</TableCell>
                              <TableCell className="font-medium">
                                <div className="flex items-center gap-2">
                                  {course.name}
                                  {course.description && (
                                    <TooltipProvider>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <Info className="h-4 w-4 text-muted-foreground cursor-help hover:text-blue-600 transition-colors" />
                                        </TooltipTrigger>
                                        <TooltipContent side="top" className="max-w-md">
                                          <div className="text-sm whitespace-pre-wrap">{course.description}</div>
                                        </TooltipContent>
                                      </Tooltip>
                                    </TooltipProvider>
                                  )}
                                  {course.type === 'visit' && (
                                    <Badge variant="outline" className="text-xs border-orange-300 text-orange-600">参访</Badge>
                                  )}
                                  {course.isFromTemplate && (
                                    <Badge variant="secondary" className="text-xs">模板</Badge>
                                  )}
                                  {course.isFromVisitLibrary && (
                                    <Badge variant="outline" className="text-xs border-blue-300 text-blue-600">基地库</Badge>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="text-center">{course.duration}</TableCell>
                              <TableCell>
                                {course.type === 'visit' ? (
                                  course.visitSiteName ? (
                                    <span className="text-orange-600 font-medium">{course.visitSiteName}</span>
                                  ) : (
                                    <span className="text-muted-foreground">待安排</span>
                                  )
                                ) : course.teacherName ? (
                                  <span className="text-green-600 font-medium">{course.teacherName}</span>
                                ) : course.teacherTitle ? (
                                  <span className="text-muted-foreground">{course.teacherTitle}</span>
                                ) : '-'}
                              </TableCell>
                              <TableCell className="text-sm">
                                {course.type === 'visit' && course.visitSiteAddress ? (
                                  <div className="flex items-center gap-1 text-muted-foreground">
                                    <MapPin className="h-3.5 w-3.5" />
                                    <span>{course.visitSiteAddress}</span>
                                  </div>
                                ) : course.location ? (
                                  <div className="flex items-center gap-1 text-muted-foreground">
                                    <MapPin className="h-3.5 w-3.5" />
                                    <span>{course.location}</span>
                                  </div>
                                ) : (
                                  <span className="text-muted-foreground">-</span>
                                )}
                              </TableCell>
                              <TableCell className="text-center">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteCourse(index);
                                  }}
                                  className="text-destructive hover:text-destructive"
                                >
                                  删除
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                    
                    {/* 修改意见输入框 */}
                    <div className="border-t pt-4">
                      <Label className="mb-2 block">修改意见</Label>
                      <div className="flex gap-2">
                        <Textarea
                          placeholder="请输入您对培训方案的修改意见，例如：增加实操课程、调整课程顺序、更换讲师类型等..."
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
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              生成中...
                            </>
                          ) : (
                            <>
                              <RefreshCw className="h-4 w-4 mr-2" />
                              根据意见重新生成
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
                
                {/* 下一步按钮 */}
                {courses.length > 0 && (
                  <div className="flex justify-end pt-4 border-t mt-4">
                    <Button 
                      onClick={() => {
                        // 先保存当前数据
                        if (formData.name?.trim()) {
                          performSave();
                        }
                        setActiveTab('venue');
                      }}
                      className="gap-2"
                    >
                      下一步：场地选择
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="venue" className="mt-6">
            {currentProjectBanner}
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
                          每课时租金：¥{venue.hourly_rate}
                        </p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="quotation" className="mt-6">
            {currentProjectBanner}
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
          onGoToSettings={() => router.push('/settings')}
          title="需要配置 API Key"
          description="智能分析功能需要配置 AI API Key。您可以前往设置页面配置，或手动填写信息。"
        />

        {/* 课程检查结果对话框 */}
        <Dialog open={showCheckResult} onOpenChange={setShowCheckResult}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {checkResult?.valid ? (
                  <>
                    <Check className="h-5 w-5 text-green-500" />
                    方案检查通过
                  </>
                ) : (
                  <>
                    <AlertCircle className="h-5 w-5 text-orange-500" />
                    发现问题
                  </>
                )}
              </DialogTitle>
              <DialogDescription>
                {checkResult?.valid 
                  ? '课程安排符合要求，可以继续下一步。'
                  : `发现 ${checkResult?.issues.length} 个问题需要处理：`}
              </DialogDescription>
            </DialogHeader>
            {checkResult && !checkResult.valid && (
              <div className="space-y-3">
                <ul className="space-y-2">
                  {checkResult.issues.map((issue, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-sm">
                      <span className="text-orange-500 mt-0.5">•</span>
                      <span>{issue}</span>
                    </li>
                  ))}
                </ul>
                <div className="flex justify-end gap-2 pt-4 border-t">
                  <Button variant="outline" onClick={() => setShowCheckResult(false)}>
                    手动调整
                  </Button>
                  {checkResult.canAutoFix && (
                    <Button onClick={handleAutoFix}>
                      自动修复
                    </Button>
                  )}
                </div>
              </div>
            )}
            {checkResult?.valid && (
              <div className="flex justify-end pt-4">
                <Button onClick={() => setShowCheckResult(false)}>
                  确定
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* 另存为新项目对话框 */}
        <Dialog open={showSaveAsNewDialog} onOpenChange={setShowSaveAsNewDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>项目名称已修改</DialogTitle>
              <DialogDescription>
                检测到您修改了项目名称，请选择操作方式：
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-4">
              <div className="p-3 border rounded-lg">
                <p className="text-sm text-muted-foreground">原项目名称：</p>
                <p className="font-medium">{originalProjectName}</p>
              </div>
              <div className="p-3 border rounded-lg bg-blue-50">
                <p className="text-sm text-muted-foreground">新项目名称：</p>
                <p className="font-medium">{formData.name}</p>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Button 
                onClick={handleSaveAsNewProject}
                className="w-full"
              >
                另存为新项目
              </Button>
              <Button 
                variant="outline"
                onClick={handleUpdateOriginalProject}
                className="w-full"
              >
                更新原项目
              </Button>
              <Button 
                variant="ghost"
                onClick={() => {
                  setShowSaveAsNewDialog(false);
                  setPendingAction(null);
                }}
                className="w-full"
              >
                取消
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* 课程编辑对话框 */}
        <Dialog open={showEditCourseDialog} onOpenChange={setShowEditCourseDialog} modal={false}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingCourseIndex !== null && editingCourseIndex >= courses.length 
                  ? (editingCourse?.type === 'visit' ? '新增参访活动' : '新增课程')
                  : '编辑课程'}
              </DialogTitle>
              <DialogDescription>
                {editingCourseIndex !== null && editingCourseIndex >= courses.length
                  ? '填写课程或参访信息'
                  : '修改课程信息'}
              </DialogDescription>
            </DialogHeader>
            {editingCourse && (
              <div className="space-y-4">
                {/* 快捷功能区：AI调整和课程库选择 */}
                <div className="p-3 bg-muted/50 rounded-lg space-y-3">
                  <div className="text-sm font-medium text-muted-foreground">快捷功能</div>
                  <div className="flex flex-col gap-2">
                    {/* AI调整课程 */}
                    <div className="flex gap-2">
                      <Input
                        value={aiAdjustText}
                        onChange={(e) => setAiAdjustText(e.target.value)}
                        placeholder={editingCourse.type === 'visit' 
                          ? "输入调整需求，如：调整参访内容、修改时长..." 
                          : "输入调整需求，如：增加实践环节、调整难度..."}
                        className="flex-1"
                      />
                      <Button
                        size="sm"
                        onClick={handleAiAdjustCourse}
                        disabled={aiAdjusting || !aiAdjustText.trim()}
                      >
                        {aiAdjusting ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Wand2 className="w-4 h-4" />
                        )}
                        <span className="ml-1 hidden sm:inline">AI调整</span>
                      </Button>
                    </div>
                    {/* 从课程库/参访基地库选择 */}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={loadCourseLibrary}
                      disabled={loadingCourseLibrary}
                      className="w-full"
                    >
                      {loadingCourseLibrary ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : editingCourse.type === 'visit' ? (
                        <MapPin className="w-4 h-4" />
                      ) : (
                        <BookOpen className="w-4 h-4" />
                      )}
                      <span className="ml-2">
                        {editingCourse.type === 'visit' ? '从参访基地库选择' : '从课程库选择'}
                      </span>
                    </Button>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label>{editingCourse.type === 'visit' ? '参访活动名称' : '课程名称'}</Label>
                  <Input
                    value={editingCourse.name}
                    onChange={(e) => setEditingCourse({ ...editingCourse, name: e.target.value })}
                    placeholder={editingCourse.type === 'visit' ? '如：某某企业参观考察' : '输入课程名称'}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>安排在第几天</Label>
                    <Input
                      type="number"
                      min={1}
                      value={editingCourse.day}
                      onChange={(e) => setEditingCourse({ ...editingCourse, day: parseInt(e.target.value) || 1 })}
                    />
                    <p className="text-xs text-muted-foreground">保存后将自动按天数排序</p>
                  </div>
                  <div className="space-y-2">
                    <Label>课时</Label>
                    <Select
                      value={editingCourse.duration === 1 || editingCourse.duration === 2 || editingCourse.duration === 4 ? String(editingCourse.duration) : 'other'}
                      onValueChange={(value) => {
                        if (value === 'other') {
                          // 保持当前的自定义课时，如果没有则默认为3
                          setEditingCourse({ 
                            ...editingCourse, 
                            duration: editingCourse.duration !== 1 && editingCourse.duration !== 2 && editingCourse.duration !== 4 ? editingCourse.duration : 3 
                          });
                        } else {
                          setEditingCourse({ ...editingCourse, duration: parseInt(value) });
                        }
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="选择课时" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">1课时（约1小时）</SelectItem>
                        <SelectItem value="2">2课时（约2小时）</SelectItem>
                        <SelectItem value="4">4课时（半天）</SelectItem>
                        <SelectItem value="other">其他（自定义）</SelectItem>
                      </SelectContent>
                    </Select>
                    {editingCourse.duration !== 1 && editingCourse.duration !== 2 && editingCourse.duration !== 4 && (
                      <Input
                        type="number"
                        min={1}
                        max={8}
                        value={editingCourse.duration}
                        onChange={(e) => setEditingCourse({ ...editingCourse, duration: parseInt(e.target.value) || 1 })}
                        placeholder="输入课时数（1-8）"
                        className="mt-2"
                      />
                    )}
                    <p className="text-xs text-muted-foreground">建议使用标准课时，特殊情况可选"其他"</p>
                  </div>
                </div>
                {/* 根据类型显示不同字段 */}
                {editingCourse.type === 'visit' ? (
                  <div className="space-y-2">
                    <Label>参访基地</Label>
                    {editingCourse.isFromVisitLibrary && editingCourse.visitSiteName ? (
                      <div className="flex items-center gap-2 p-2 bg-orange-50 border border-orange-200 rounded-md">
                        <MapPin className="w-4 h-4 text-orange-600" />
                        <span className="text-orange-700 font-medium">{editingCourse.visitSiteName}</span>
                        <span className="text-xs text-orange-600 ml-auto">来自参访基地库</span>
                      </div>
                    ) : (
                      <Input
                        value={editingCourse.visitSiteName || ''}
                        onChange={(e) => setEditingCourse({ ...editingCourse, visitSiteName: e.target.value })}
                        placeholder="输入参访基地名称"
                      />
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label>建议讲师</Label>
                    {editingCourse.isFromTemplate && editingCourse.teacherName ? (
                      <div className="flex items-center gap-2 p-2 bg-green-50 border border-green-200 rounded-md">
                        <User className="w-4 h-4 text-green-600" />
                        <span className="text-green-700 font-medium">{editingCourse.teacherName}</span>
                        <span className="text-xs text-green-600 ml-auto">来自课程模板</span>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <Input
                          value={editingCourse.teacherTitle || ''}
                          onChange={(e) => setEditingCourse({ ...editingCourse, teacherTitle: e.target.value })}
                          placeholder="输入建议讲师职称，如：教授、高级工程师"
                        />
                        <p className="text-xs text-muted-foreground">新课程需填写建议讲师职称</p>
                      </div>
                    )}
                  </div>
                )}
                <div className="space-y-2">
                  <Label>{editingCourse.type === 'visit' ? '参访内容' : '课程描述'}</Label>
                  <Textarea
                    value={editingCourse.description || ''}
                    onChange={(e) => setEditingCourse({ ...editingCourse, description: e.target.value })}
                    rows={3}
                    placeholder={editingCourse.type === 'visit' ? '参访内容概述...' : '课程内容概述...'}
                  />
                </div>
                {/* 课程地点 */}
                <div className="space-y-2">
                  <Label>课程地点</Label>
                  {editingCourse.type === 'visit' && editingCourse.isFromVisitLibrary && editingCourse.visitSiteAddress ? (
                    <div className="flex items-center gap-2 p-2 bg-orange-50 border border-orange-200 rounded-md">
                      <MapPin className="w-4 h-4 text-orange-600" />
                      <span className="text-orange-700">{editingCourse.visitSiteAddress}</span>
                    </div>
                  ) : (
                    <>
                      <select
                        value={editingCourse.location && venues && venues.find(v => v.name === editingCourse.location) ? editingCourse.location : 'custom'}
                        onChange={(e) => {
                          setEditingCourse({ ...editingCourse, location: e.target.value === 'custom' ? '' : e.target.value });
                        }}
                        className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <option value="">选择场地或自定义输入</option>
                        {venues && venues.length > 0 && venues.map((venue) => (
                          <option key={venue.id} value={venue.name}>
                            {venue.name} - {venue.location}
                          </option>
                        ))}
                        <option value="custom">
                          {venues && venues.length > 0 ? '自定义输入...' : '手动输入课程地点...'}
                        </option>
                      </select>
                      {/* 当选择自定义输入或地点不在场地列表中时，显示输入框 */}
                      {(!editingCourse.location || !venues || !venues.find(v => v.name === editingCourse.location)) && (
                        <Input
                          value={editingCourse.location || ''}
                          onChange={(e) => setEditingCourse({ ...editingCourse, location: e.target.value })}
                          placeholder={editingCourse.type === 'visit' ? '参访地址' : '输入课程地点，如：101教室'}
                          className="mt-2"
                        />
                      )}
                      {venues && venues.length > 0 && (
                        <p className="text-xs text-muted-foreground">
                          可从场地信息中选择，或选择"自定义输入"手动填写
                        </p>
                      )}
                    </>
                  )}
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setShowEditCourseDialog(false)}>
                    取消
                  </Button>
                  <Button onClick={handleSaveEditedCourse}>
                    保存
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* 导入原有方案对话框 */}
        <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <BookOpen className="h-5 w-5" />
                导入原有培训方案
              </DialogTitle>
              <DialogDescription>
                从已完成的项目中导入培训方案，可作为新项目的参考
              </DialogDescription>
            </DialogHeader>
            <div className="flex-1 overflow-auto">
              {importLoading ? (
                <div className="text-center py-12">
                  <Loader2 className="h-8 w-8 mx-auto animate-spin text-primary mb-4" />
                  <p className="text-muted-foreground">加载中...</p>
                </div>
              ) : completedProjects.length === 0 ? (
                <div className="text-center py-12">
                  <BookOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">暂无已完成的项目可导入</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {completedProjects.map((project) => (
                    <div
                      key={project.id}
                      className={`border rounded-lg p-4 cursor-pointer transition-all ${
                        selectedImportProject === project.id
                          ? 'border-primary bg-primary/5'
                          : 'hover:border-gray-300 hover:bg-gray-50'
                      }`}
                      onClick={() => setSelectedImportProject(project.id)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h4 className="font-medium">{project.name}</h4>
                          <div className="flex flex-wrap gap-2 mt-2 text-sm text-muted-foreground">
                            {project.trainingTarget && (
                              <span>培训目标：{project.trainingTarget}</span>
                            )}
                            {project.targetAudience && (
                              <span>• 目标人群：{project.targetAudience}</span>
                            )}
                            {project.trainingDays && (
                              <span>• 培训天数：{project.trainingDays}天</span>
                            )}
                            {project.trainingHours && (
                              <span>• 总课时：{project.trainingHours}课时</span>
                            )}
                          </div>
                          {project.courses && project.courses.length > 0 && (
                            <div className="mt-3">
                              <p className="text-sm text-muted-foreground mb-2">
                                课程方案（{project.courses.length}门课程）：
                              </p>
                              <div className="flex flex-wrap gap-1">
                                {project.courses.slice(0, 6).map((course, idx) => (
                                  <Badge key={idx} variant="secondary" className="text-xs">
                                    {course.name}
                                  </Badge>
                                ))}
                                {project.courses.length > 6 && (
                                  <Badge variant="outline" className="text-xs">
                                    +{project.courses.length - 6}门
                                  </Badge>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                        {selectedImportProject === project.id && (
                          <Check className="h-5 w-5 text-primary mt-1" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 pt-4 border-t mt-4">
              <Button variant="outline" onClick={() => {
                setShowImportDialog(false);
                setSelectedImportProject(null);
              }}>
                取消
              </Button>
              <Button 
                onClick={() => selectedImportProject && handleImportScheme(selectedImportProject)}
                disabled={!selectedImportProject}
              >
                导入方案
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* 课程库/参访基地选择对话框 */}
        <Dialog open={showCourseLibrary} onOpenChange={setShowCourseLibrary}>
          <DialogContent className="max-w-3xl max-h-[70vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {editingCourse?.type === 'visit' ? (
                  <>
                    <MapPin className="h-5 w-5" />
                    从参访基地库选择
                  </>
                ) : (
                  <>
                    <BookOpen className="h-5 w-5" />
                    从课程库选择
                  </>
                )}
              </DialogTitle>
              <DialogDescription>
                {editingCourse?.type === 'visit'
                  ? '选择合适的参访基地，快速填充参访信息'
                  : '选择合适的课程模板，快速填充课程信息'}
              </DialogDescription>
            </DialogHeader>
            <div className="flex-1 overflow-auto">
              {/* 参访基地列表 */}
              {editingCourse?.type === 'visit' ? (
                visitSiteLibraryList.length > 0 ? (
                  <div className="space-y-2">
                    {visitSiteLibraryList.map((site) => (
                      <div
                        key={site.id}
                        className="p-3 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                        onClick={() => handleSelectFromVisitLibrary(site)}
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="font-medium">{site.name}</div>
                            {site.description && (
                              <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                                {site.description}
                              </p>
                            )}
                            <div className="flex gap-2 mt-2 flex-wrap">
                              {site.type && (
                                <Badge variant="secondary" className="text-xs">
                                  {site.type === 'enterprise' ? '企业' : 
                                   site.type === 'government' ? '政府部门' : 
                                   site.type === 'institution' ? '事业单位' : '其他'}
                                </Badge>
                              )}
                              {site.industry && (
                                <Badge variant="outline" className="text-xs">
                                  {site.industry}
                                </Badge>
                              )}
                              {site.visitDuration && (
                                <Badge variant="outline" className="text-xs">
                                  建议{site.visitDuration}小时
                                </Badge>
                              )}
                              {site.visitFee !== undefined && site.visitFee > 0 && (
                                <Badge variant="outline" className="text-xs text-orange-600">
                                  ¥{site.visitFee}/人
                                </Badge>
                              )}
                            </div>
                          </div>
                          <Button size="sm" variant="ghost">
                            <Check className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                    <MapPin className="w-12 h-12 mb-2 opacity-50" />
                    <p>参访基地库暂无数据</p>
                    <p className="text-xs mt-1">请先在数据管理中添加参访基地</p>
                  </div>
                )
              ) : (
                /* 课程模板列表 */
                courseLibraryList.length > 0 ? (
                  <div className="space-y-2">
                    {courseLibraryList.map((template) => (
                      <div
                        key={template.id}
                        className="p-3 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                        onClick={() => handleSelectFromLibrary(template)}
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="font-medium">{template.name}</div>
                            {template.description && (
                              <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                                {template.description}
                              </p>
                            )}
                            <div className="flex gap-2 mt-2 flex-wrap">
                              {template.category && (
                                <Badge variant="secondary" className="text-xs">
                                  {template.category}
                                </Badge>
                              )}
                              {template.duration && (
                                <Badge variant="outline" className="text-xs">
                                  {template.duration}课时
                                </Badge>
                              )}
                              {template.teacherTitle && (
                                <Badge variant="outline" className="text-xs">
                                  {template.teacherTitle}
                                </Badge>
                              )}
                            </div>
                          </div>
                          <Button size="sm" variant="ghost">
                            <Check className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                    <BookOpen className="w-12 h-12 mb-2 opacity-50" />
                    <p>课程库暂无模板</p>
                    <p className="text-xs mt-1">请先在数据管理中添加课程模板</p>
                  </div>
                )
              )}
            </div>
            <div className="flex justify-end pt-4 border-t">
              <Button variant="outline" onClick={() => setShowCourseLibrary(false)}>
                取消
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}
