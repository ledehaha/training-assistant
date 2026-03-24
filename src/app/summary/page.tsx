'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import MainLayout from '@/components/layout/main-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ClipboardCheck,
  Upload,
  FileText,
  BarChart3,
  Archive,
  Loader2,
  Plus,
  Download,
  Trash2,
  CheckCircle,
  AlertCircle,
  Brain,
  Database,
  ArrowRight,
  ArrowLeft,
  Save,
  FileDown,
  Check,
  Clock,
  FolderOpen,
  Calendar,
  Filter,
  PlayCircle,
  FileCheck,
  Inbox,
  Eye,
  RefreshCw,
  Sparkles,
  UserPlus,
  User,
  MapPin,
  BookOpen,
  Building2,
  CalendarDays,
  ChevronDown,
  ChevronUp,
  X,
  Send,
} from 'lucide-react';
import { toast } from 'sonner';

interface Project {
  id: string;
  name: string;
  status: string;
  participantCount: number;
  trainingTarget?: string;
  targetAudience?: string;
  trainingDays?: number;
  trainingHours?: number;
  startDate?: string;
  endDate?: string;
  avgSatisfaction: string | null;
  surveyResponseRate: string | null;
  // 合同文件（PDF和Word）
  contractFilePdf: string | null;
  contractFileNamePdf: string | null;
  contractFileWord: string | null;
  contractFileNameWord: string | null;
  // 成本测算表（PDF和Excel）
  costFilePdf: string | null;
  costFileNamePdf: string | null;
  costFileExcel: string | null;
  costFileNameExcel: string | null;
  // 项目申报书（PDF和Word）
  declarationFilePdf: string | null;
  declarationFileNamePdf: string | null;
  declarationFileWord: string | null;
  declarationFileNameWord: string | null;
  // 学员名单
  studentListFile: string | null;
  studentListFileName: string | null;
  // 课程安排表（实际执行的）
  courseScheduleFile: string | null;
  courseScheduleFileName: string | null;
  // 会签单（PDF）
  countersignFile: string | null;
  countersignFileName: string | null;
  // 其他材料
  otherMaterials: string | null;
  // 满意度调查
  satisfactionSurveyFile: string | null;
  satisfactionSurveyFileName: string | null;
  // 总结报告
  summaryReport: string | null;
  // 课程是否已保存
  hasSavedCourses: boolean | null;
  archivedAt?: string;
  createdAt: string;
  updatedAt: string;
}

interface FileInfo {
  key: string;
  name: string;
  uploadedAt: string;
}

// 状态映射
const statusMap: Record<string, { label: string; color: string }> = {
  executing: { label: '执行中', color: 'bg-indigo-100 text-indigo-700' },
  completed: { label: '已完成', color: 'bg-emerald-100 text-emerald-700' },
  archived: { label: '已归档', color: 'bg-gray-100 text-gray-500' },
};

// 时间筛选选项
const TIME_FILTERS = [
  { value: 'all', label: '全部' },
  { value: 'month', label: '当月' },
  { value: 'quarter', label: '近三个月' },
  { value: 'year', label: '近一年' },
];

// 步骤定义
const STEPS = [
  { id: 1, name: '选择项目', description: '选择待总结或已归档项目' },
  { id: 2, name: '上传材料', description: '上传项目相关材料文件' },
  { id: 3, name: 'AI分析', description: '生成项目总结报告' },
  { id: 4, name: '确认下载', description: '确认并下载报告' },
];

export default function SummaryPage() {
  const router = useRouter();
  
  // 步骤状态
  const [currentStep, setCurrentStep] = useState(1);
  
  // 项目列表
  const [allProjects, setAllProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  
  // 时间筛选
  const [timeFilter, setTimeFilter] = useState<string>('all');
  
  // 搜索关键词
  const [searchKeyword, setSearchKeyword] = useState<string>('');
  
  // 文件上传状态
  const [uploading, setUploading] = useState<string | null>(null);
  
  // AI分析状态
  const [analyzing, setAnalyzing] = useState(false);
  const [summaryReport, setSummaryReport] = useState<string | null>(null);
  const [extractedData, setExtractedData] = useState<Record<string, unknown>>({});
  
  // 保存状态
  const [saving, setSaving] = useState(false);
  const [lastSaveTime, setLastSaveTime] = useState<Date | null>(null);
  
  // 确认对话框
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  
  // 新建待总结项目对话框
  const [showNewProjectDialog, setShowNewProjectDialog] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [creatingProject, setCreatingProject] = useState(false);
  
  // 拖放状态
  const [dragActive, setDragActive] = useState<string | null>(null);
  
  // 文件预览状态
  const [previewDialog, setPreviewDialog] = useState<{
    open: boolean;
    url: string | null;
    fileName: string | null;
    fileType: string | null;
  }>({ open: false, url: null, fileName: null, fileType: null });
  
  // 覆盖确认状态（支持多文件）
  const [overwriteDialog, setOverwriteDialog] = useState<{
    open: boolean;
    fileType: string | null;
    files: File[];  // 待确认的文件列表
    currentIndex: number;  // 当前处理的文件索引
  }>({ open: false, fileType: null, files: [], currentIndex: 0 });
  
  // 待上传文件队列（用于覆盖确认后继续上传）
  const pendingFilesRef = useRef<{ fileType: string; files: File[]; currentIndex: number } | null>(null);

  // AI检查状态（总检查，已废弃）
  const [aiChecking, setAiChecking] = useState(false);
  const [aiCheckProgress, setAiCheckProgress] = useState<{
    current: number;
    total: number;
    stepName: string;
  } | null>(null);
  const [aiCheckResult, setAiCheckResult] = useState<{
    hasChanges: boolean;
    totalChanges: number;
    checkResult: {
      projectInfo: ProjectInfoItem[];
      teachers: AiCheckItem[];
      venues: AiCheckItem[];
      courseTemplates: AiCheckItem[];
      visitSites: AiCheckItem[];
    };
  } | null>(null);
  const [showAiCheckDialog, setShowAiCheckDialog] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    projectInfo: true,
    teachers: true,
    venues: true,
    courseTemplates: true,
    visitSites: true,
  });
  
  // 权限错误对话框状态
  const [permissionErrorDialog, setPermissionErrorDialog] = useState<{
    isOpen: boolean;
    error: string;
    creator: {
      id?: string;
      name: string;
      departmentId?: string;
      departmentName: string;
    } | null;
    pendingItem: { type: string; item: AiCheckItem } | null;
  }>({
    isOpen: false,
    error: '',
    creator: null,
    pendingItem: null,
  });

  // 课程安排表提取状态
  interface ExtractedCourse {
    id: string;
    name: string;
    day: number;
    duration: number;
    type: 'course' | 'visit';  // 只保留课程和参访两种类型
    description?: string;
    teacherName?: string;
    teacherTitle?: string;
    visitSiteName?: string;
    visitAddress?: string;
    startTime?: string;
    endTime?: string;
  }
  
  const [extractedCourses, setExtractedCourses] = useState<ExtractedCourse[]>([]);
  const [extractingCourses, setExtractingCourses] = useState(false);
  const [editingCourseIndex, setEditingCourseIndex] = useState<number | null>(null);
  const [editingCourse, setEditingCourse] = useState<ExtractedCourse | null>(null);
  const [savingCourses, setSavingCourses] = useState(false);

  // 课程安排上传对话框
  const [showCourseUploadDialog, setShowCourseUploadDialog] = useState(false);
  const [tempCourseFile, setTempCourseFile] = useState<File | null>(null);
  const [tempCourseFileUploading, setTempCourseFileUploading] = useState(false);

  // 单文件AI检查状态
  const [fileAiChecking, setFileAiChecking] = useState<string | null>(null); // 当前正在检查的文件key
  const fileAiCheckCancelledRef = useRef(false); // 取消标志
  const [fileAiCheckResult, setFileAiCheckResult] = useState<{
    fileType: string;
    fileName: string;
    hasChanges: boolean;
    totalChanges: number;
    checkResult: {
      projectInfo: ProjectInfoItem[];
      teachers: AiCheckItem[];
      venues: AiCheckItem[];
      courseTemplates: AiCheckItem[];
      visitSites: AiCheckItem[];
    };
  } | null>(null);

  // AI检查结果项类型
  interface AiCheckItem {
    action: 'add' | 'update';
    data: Record<string, unknown>;
    existingId?: string;
    reason: string;
    source?: string; // 数据来源文件
    confidence?: 'high' | 'medium' | 'low'; // 数据置信度
  }

  // 项目基本信息检查结果类型
  interface ProjectInfoItem {
    field: string;
    fieldName: string;
    currentValue: string | number | null;
    extractedValue: string | number;
    source: string;
    reason: string;
  }

  // 加载项目列表
  const loadProjects = async () => {
    try {
      setLoading(true);
      // 获取session token
      const sessionToken = typeof window !== 'undefined' ? localStorage.getItem('session_token') : null;
      const headers: Record<string, string> = {};
      if (sessionToken) {
        headers['Authorization'] = `Bearer ${sessionToken}`;
      }
      
      const res = await fetch('/api/projects', { headers });
      if (res.ok) {
        const data = await res.json();
        setAllProjects(data.data || []);
      }
    } catch (error) {
      console.error('加载项目失败:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProjects();
  }, []);

  // 监听导航重置事件（点击当前页面的导航链接时触发）
  useEffect(() => {
    const handleNavigationReset = () => {
      // 重置页面状态，回到初始页
      setCurrentStep(1);
      setSelectedProject(null);
      setSummaryReport(null);
      setExtractedData({});
      setExtractedCourses([]);
      setFileAiChecking(null);
      setFileAiCheckResult(null);
      setEditingCourseIndex(null);
      setEditingCourse(null);
      toast.success('已返回项目列表');
    };

    window.addEventListener('navigation-reset', handleNavigationReset);
    return () => {
      window.removeEventListener('navigation-reset', handleNavigationReset);
    };
  }, []);

  // 时间过滤函数
  const filterByTime = (projects: Project[], filter: string): Project[] => {
    if (filter === 'all') return projects;
    
    const now = new Date();
    let startDate: Date;
    
    switch (filter) {
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'quarter':
        startDate = new Date(now.getFullYear(), now.getMonth() - 2, 1);
        break;
      case 'year':
        startDate = new Date(now.getFullYear() - 1, now.getMonth(), 1);
        break;
      default:
        return projects;
    }
    
    return projects.filter(p => {
      const projectDate = new Date(p.createdAt);
      return projectDate >= startDate;
    });
  };

  // 检查归档必要文件是否已上传
  // 辅助函数：检查文件是否是有效的上传文件（以 "projects/" 开头）
  const isValidFile = (fileKey: string | null): boolean => {
    if (!fileKey) return false;
    // 有效的文件路径应该以 "projects/" 开头
    return fileKey.startsWith('projects/');
  };

  const checkArchiveRequirements = (project: Project) => {
    const requirements = [
      {
        name: '合同文件',
        uploaded: isValidFile(project.contractFilePdf) && isValidFile(project.contractFileWord),
        required: true,
      },
      {
        name: '成本测算表',
        uploaded: isValidFile(project.costFilePdf) && isValidFile(project.costFileExcel),
        required: true,
      },
      {
        name: '项目申报书',
        uploaded: isValidFile(project.declarationFilePdf) && isValidFile(project.declarationFileWord),
        required: true,
      },
      {
        name: '学员名单',
        uploaded: isValidFile(project.studentListFile),
        required: true,
      },
      {
        name: '课程安排',
        uploaded: project.hasSavedCourses === true,
        required: true,
      },
      {
        name: '满意度调查结果',
        uploaded: isValidFile(project.satisfactionSurveyFile),
        required: false, // 非必选
      },
      {
        name: '会签单',
        uploaded: isValidFile(project.countersignFile),
        required: true,
      },
    ];
    
    const missingFiles = requirements.filter(r => r.required && !r.uploaded);
    const isComplete = missingFiles.length === 0;
    
    return { isComplete, missingFiles, requirements };
  };

  // 分类项目
  const categorizedProjects = useMemo(() => {
    let filtered = filterByTime(allProjects, timeFilter);
    
    // 搜索过滤
    if (searchKeyword.trim()) {
      const keyword = searchKeyword.trim().toLowerCase();
      filtered = filtered.filter(p => p.name.toLowerCase().includes(keyword));
    }
    
    // 执行中待总结
    const executingProjects = filtered.filter(p => p.status === 'executing');
    
    // 已完成待归档（包括 status=completed 和 status=archived 但缺少文件的）
    const completedProjects = filtered.filter(p => {
      if (p.status === 'completed') return true;
      if (p.status === 'archived') {
        const { isComplete } = checkArchiveRequirements(p);
        return !isComplete; // 缺少文件的归入待归档
      }
      return false;
    });
    
    // 已归档（满足条件，真正归档完成）
    const archivedProjects = filtered.filter(p => {
      if (p.status !== 'archived') return false;
      const { isComplete } = checkArchiveRequirements(p);
      return isComplete;
    });
    
    // 计算项目完成进度（与 getUploadProgress 一致的计算方式）
    const calculateProgress = (project: Project): number => {
      const { requirements } = checkArchiveRequirements(project);
      const uploaded = requirements.filter(r => r.uploaded).length;
      return uploaded / requirements.length;
    };
    
    // 待总结项目按完成进度降序排序（完成度高的排在前面）
    const pendingProjects = [...executingProjects, ...completedProjects].sort((a, b) => {
      const progressA = calculateProgress(a);
      const progressB = calculateProgress(b);
      return progressB - progressA; // 降序：完成度高的在前
    });
    
    return {
      executingProjects,
      completedProjects,
      archivedProjects,
      pendingProjects,
    };
  }, [allProjects, timeFilter, searchKeyword]);

  // 列表显示限制（每页8个）
  const PAGE_SIZE = 8;
  
  // 分页状态
  const [pendingPage, setPendingPage] = useState(1);
  const [archivedPage, setArchivedPage] = useState(1);
  
  // 重置分页（当筛选条件变化时）
  useEffect(() => {
    setPendingPage(1);
    setArchivedPage(1);
  }, [timeFilter, searchKeyword]);
  
  // 统计数据
  const stats = useMemo(() => ({
    executing: categorizedProjects.executingProjects.length,
    completed: categorizedProjects.completedProjects.length,
    archived: categorizedProjects.archivedProjects.length,
  }), [categorizedProjects]);

  // 分页组件
  const renderPagination = (
    currentPage: number, 
    totalItems: number, 
    onPageChange: (page: number) => void
  ) => {
    const totalPages = Math.ceil(totalItems / PAGE_SIZE);
    if (totalPages <= 1) return null;
    
    const pages: (number | string)[] = [];
    
    // 始终显示第一页
    pages.push(1);
    
    // 计算中间页码
    let startPage = Math.max(2, currentPage - 1);
    let endPage = Math.min(totalPages - 1, currentPage + 1);
    
    if (startPage > 2) {
      pages.push('...');
    }
    
    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }
    
    if (endPage < totalPages - 1) {
      pages.push('...');
    }
    
    // 始终显示最后一页
    if (totalPages > 1) {
      pages.push(totalPages);
    }
    
    return (
      <div className="flex items-center justify-center gap-1 mt-3">
        {/* 上一页 */}
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="px-2 py-1 text-xs rounded border disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
        >
          ‹
        </button>
        
        {/* 页码 */}
        {pages.map((page, index) => (
          <button
            key={index}
            onClick={() => typeof page === 'number' && onPageChange(page)}
            disabled={page === '...'}
            className={`px-2.5 py-1 text-xs rounded border ${
              page === currentPage 
                ? 'bg-blue-500 text-white border-blue-500' 
                : page === '...' 
                  ? 'border-transparent cursor-default' 
                  : 'hover:bg-gray-100'
            }`}
          >
            {page}
          </button>
        ))}
        
        {/* 下一页 */}
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="px-2 py-1 text-xs rounded border disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
        >
          ›
        </button>
      </div>
    );
  };

  // 选择项目并进入下一步
  const handleSelectProject = async (project: Project) => {
    setSelectedProject(project);
    // 如果已有报告，加载报告
    if (project.summaryReport) {
      try {
        const reportData = JSON.parse(project.summaryReport);
        setSummaryReport(reportData.report || null);
        setExtractedData(reportData.extractedData || {});
      } catch {
        setSummaryReport(null);
        setExtractedData({});
      }
    } else {
      setSummaryReport(null);
      setExtractedData({});
    }
    
    // 加载已有的课程数据
    try {
      const sessionToken = localStorage.getItem('session_token');
      const headers: Record<string, string> = {};
      if (sessionToken) {
        headers['Authorization'] = `Bearer ${sessionToken}`;
      }
      const res = await fetch(`/api/projects/${project.id}/courses`, { headers });
      const data = await res.json();
      if (data.data && data.data.length > 0) {
        setExtractedCourses(data.data);
      } else {
        setExtractedCourses([]);
      }
    } catch (error) {
      console.error('加载课程失败:', error);
      setExtractedCourses([]);
    }
    
    setCurrentStep(2);
  };

  // 计算上传进度
  const getUploadProgress = (project: Project) => {
    const { requirements } = checkArchiveRequirements(project);
    const uploaded = requirements.filter(r => r.uploaded).length;
    return Math.round((uploaded / requirements.length) * 100);
  };
  
  // 检查文件是否已存在（支持检查其它附件中的重复文件名）
  const checkFileExists = (fileType: string, fileName?: string): boolean => {
    if (!selectedProject) return false;
    
    // 课程安排表是临时文件，用于AI分析，不需要检查是否已存在
    if (fileType === 'courseSchedule') {
      return false;
    }
    
    // 其它附件：检查是否有同名文件
    if (fileType === 'other' && fileName) {
      const otherMaterials = selectedProject.otherMaterials 
        ? JSON.parse(selectedProject.otherMaterials) 
        : [];
      return otherMaterials.some((m: { name: string }) => m.name === fileName);
    }
    
    // 其他类型：检查字段是否已有值
    const mapping: Record<string, string | null> = {
      contractPdf: selectedProject.contractFilePdf,
      contractWord: selectedProject.contractFileWord,
      costPdf: selectedProject.costFilePdf,
      costExcel: selectedProject.costFileExcel,
      declarationPdf: selectedProject.declarationFilePdf,
      declarationWord: selectedProject.declarationFileWord,
      studentList: selectedProject.studentListFile,
      satisfaction: selectedProject.satisfactionSurveyFile,
      countersign: selectedProject.countersignFile,
    };
    return !!mapping[fileType];
  };
  
  // 处理文件选择（带覆盖确认）
  const handleFileSelect = (fileType: string, file: File) => {
    const exists = fileType === 'other' 
      ? checkFileExists(fileType, file.name) 
      : checkFileExists(fileType);
    
    if (exists) {
      // 显示覆盖确认对话框
      pendingFilesRef.current = { fileType, files: [file], currentIndex: 0 };
      setOverwriteDialog({ open: true, fileType, files: [file], currentIndex: 0 });
    } else {
      // 直接上传
      handleFileUpload(fileType, file);
    }
  };
  
  // 处理多文件选择（带覆盖确认）
  const handleMultipleFileSelect = (fileType: string, files: File[]) => {
    if (files.length === 0) return;
    
    // 对于其它附件类型，检查重复文件
    if (fileType === 'other') {
      const existingFiles: File[] = [];
      const newFiles: File[] = [];
      
      files.forEach(file => {
        if (checkFileExists(fileType, file.name)) {
          existingFiles.push(file);
        } else {
          newFiles.push(file);
        }
      });
      
      // 先上传新文件
      newFiles.forEach(file => handleFileUpload(fileType, file));
      
      // 如果有重复文件，显示确认对话框
      if (existingFiles.length > 0) {
        pendingFilesRef.current = { fileType, files: existingFiles, currentIndex: 0 };
        setOverwriteDialog({ open: true, fileType, files: existingFiles, currentIndex: 0 });
      }
    } else {
      // 非其它附件类型，只取第一个文件
      const file = files[0];
      if (checkFileExists(fileType)) {
        pendingFilesRef.current = { fileType, files: [file], currentIndex: 0 };
        setOverwriteDialog({ open: true, fileType, files: [file], currentIndex: 0 });
      } else {
        handleFileUpload(fileType, file);
      }
    }
  };
  
  // 确认覆盖后上传
  const handleConfirmOverwrite = async () => {
    if (pendingFilesRef.current) {
      const { fileType, files, currentIndex } = pendingFilesRef.current;
      
      if (currentIndex < files.length) {
        // 上传当前文件
        await handleFileUpload(fileType, files[currentIndex]);
        
        // 移到下一个文件
        const nextIndex = currentIndex + 1;
        if (nextIndex < files.length) {
          pendingFilesRef.current = { fileType, files, currentIndex: nextIndex };
          setOverwriteDialog({ open: true, fileType, files, currentIndex: nextIndex });
        } else {
          // 所有文件处理完毕
          pendingFilesRef.current = null;
          setOverwriteDialog({ open: false, fileType: null, files: [], currentIndex: 0 });
        }
      }
    }
  };
  
  // 跳过当前文件，处理下一个
  const handleSkipFile = () => {
    if (pendingFilesRef.current) {
      const { fileType, files, currentIndex } = pendingFilesRef.current;
      const nextIndex = currentIndex + 1;
      
      if (nextIndex < files.length) {
        pendingFilesRef.current = { fileType, files, currentIndex: nextIndex };
        setOverwriteDialog({ open: true, fileType, files, currentIndex: nextIndex });
      } else {
        // 所有文件处理完毕
        pendingFilesRef.current = null;
        setOverwriteDialog({ open: false, fileType: null, files: [], currentIndex: 0 });
      }
    }
  };
  
  // 取消覆盖
  const handleCancelOverwrite = () => {
    pendingFilesRef.current = null;
    setOverwriteDialog({ open: false, fileType: null, files: [], currentIndex: 0 });
  };
  
  // 文件预览
  const handlePreview = async (fileKey: string, fileName: string) => {
    try {
      const res = await fetch(`/api/upload?fileKey=${encodeURIComponent(fileKey)}`);
      const data = await res.json();
      if (data.url) {
        // 判断文件类型
        const ext = fileName.toLowerCase().split('.').pop();
        const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'];
        const pdfExt = 'pdf';
        
        setPreviewDialog({
          open: true,
          url: data.url,
          fileName,
          fileType: imageExts.includes(ext || '') ? 'image' : ext === pdfExt ? 'pdf' : 'other'
        });
      }
    } catch (error) {
      console.error('Preview error:', error);
      toast.error('预览失败', { description: '无法获取文件预览地址' });
    }
  };

  // 文件上传
  const handleFileUpload = async (fileType: string, file: File) => {
    if (!selectedProject) return;

    setUploading(fileType);
    try {
      // 对于其它附件，如果存在同名文件，先删除旧文件
      if (fileType === 'other') {
        const materials = selectedProject.otherMaterials ? JSON.parse(selectedProject.otherMaterials) : [];
        const existingIndex = materials.findIndex((m: { name: string }) => m.name === file.name);
        if (existingIndex >= 0) {
          // 删除旧文件
          const oldFile = materials[existingIndex];
          try {
            await fetch(`/api/upload?fileKey=${encodeURIComponent(oldFile.key)}`, { method: 'DELETE' });
            // 从数组中移除旧文件
            materials.splice(existingIndex, 1);
          } catch (error) {
            console.error('删除旧文件失败:', error);
          }
        }
      }
      
      const formData = new FormData();
      formData.append('file', file);
      formData.append('projectId', selectedProject.id);
      formData.append('fileType', fileType);

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (data.success) {
        toast.success('上传成功', { description: `${file.name} 已成功上传` });
        
        // 更新本地状态
        if (fileType === 'other') {
          // 其它附件：添加到数组中
          const materials = selectedProject.otherMaterials ? JSON.parse(selectedProject.otherMaterials) : [];
          // 再次检查是否已存在同名文件（可能在前面的步骤已经删除了）
          const existingIndex = materials.findIndex((m: { name: string }) => m.name === data.fileName);
          if (existingIndex >= 0) {
            materials[existingIndex] = { key: data.fileKey, name: data.fileName, uploadedAt: new Date().toISOString() };
          } else {
            materials.push({ key: data.fileKey, name: data.fileName, uploadedAt: new Date().toISOString() });
          }
          setSelectedProject(prev => prev ? { ...prev, otherMaterials: JSON.stringify(materials) } : null);
        } else {
          // 其他类型：直接更新字段
          const updates = getUpdatedProjectData(fileType, data);
          setSelectedProject(prev => prev ? { ...prev, ...updates } : null);
          
          // 课程安排表上传成功后自动触发AI提取
          if (fileType === 'courseSchedule') {
            // 延迟一下让状态更新完成
            setTimeout(() => {
              autoExtractCourses(data.fileKey, data.fileName);
            }, 500);
          }
        }
        setLastSaveTime(new Date());
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('上传失败', { description: error instanceof Error ? error.message : '文件上传失败' });
    } finally {
      setUploading(null);
    }
  };

  // 自动提取课程（上传后自动触发）
  const autoExtractCourses = async (fileKey: string, fileName: string) => {
    if (!selectedProject) return;

    const projectId = selectedProject.id; // 保存项目ID，防止状态变化导致问题
    setExtractingCourses(true);
    try {
      const sessionToken = localStorage.getItem('session_token');
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (sessionToken) {
        headers['Authorization'] = `Bearer ${sessionToken}`;
      }

      const res = await fetch(`/api/projects/${projectId}/courses/extract`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          fileKey,
          fileName,
        }),
      });

      // 检查响应是否有效
      const responseText = await res.text();
      let data;
      try {
        data = JSON.parse(responseText);
      } catch {
        console.error('JSON解析失败，响应内容:', responseText.substring(0, 200));
        throw new Error('服务器响应格式错误');
      }
      
      if (res.ok && data && data.courses && data.courses.length > 0) {
        // 为每个课程生成ID
        const coursesWithIds = data.courses.map((course: ExtractedCourse, index: number) => ({
          ...course,
          id: `course-${Date.now()}-${index}`,
        }));
        console.log('设置课程列表，数量:', coursesWithIds.length);
        setExtractedCourses(coursesWithIds);
        toast.success(`成功提取 ${coursesWithIds.length} 门课程`);
      } else {
        // AI提取失败或没有课程，显示空表格
        console.log('课程提取结果为空，data:', JSON.stringify(data).substring(0, 500));
        setExtractedCourses([]);
        if (data?.message) {
          toast.warning(data.message);
        } else {
          toast.info('未识别到课程信息，请手动添加');
        }
      }
    } catch (error) {
      console.error('提取课程失败:', error);
      // 提取失败，显示空表格让用户手动编辑
      setExtractedCourses([]);
      toast.error(error instanceof Error ? error.message : 'AI提取失败，请手动添加课程');
    } finally {
      setExtractingCourses(false);
    }
  };

  const getUpdatedProjectData = (fileType: string, data: { fileKey: string; fileName: string }) => {
    const updates: Record<string, string | null> = {};
    switch (fileType) {
      case 'contractPdf':
        updates.contractFilePdf = data.fileKey;
        updates.contractFileNamePdf = data.fileName;
        break;
      case 'contractWord':
        updates.contractFileWord = data.fileKey;
        updates.contractFileNameWord = data.fileName;
        break;
      case 'costPdf':
        updates.costFilePdf = data.fileKey;
        updates.costFileNamePdf = data.fileName;
        break;
      case 'costExcel':
        updates.costFileExcel = data.fileKey;
        updates.costFileNameExcel = data.fileName;
        break;
      case 'declarationPdf':
        updates.declarationFilePdf = data.fileKey;
        updates.declarationFileNamePdf = data.fileName;
        break;
      case 'declarationWord':
        updates.declarationFileWord = data.fileKey;
        updates.declarationFileNameWord = data.fileName;
        break;
      case 'studentList':
        updates.studentListFile = data.fileKey;
        updates.studentListFileName = data.fileName;
        break;
      case 'courseSchedule':
        updates.courseScheduleFile = data.fileKey;
        updates.courseScheduleFileName = data.fileName;
        break;
      case 'satisfaction':
        updates.satisfactionSurveyFile = data.fileKey;
        updates.satisfactionSurveyFileName = data.fileName;
        break;
      case 'countersign':
        updates.countersignFile = data.fileKey;
        updates.countersignFileName = data.fileName;
        break;
      case 'other':
        // 其它附件需要特殊处理，在后面单独更新
        break;
    }
    return updates;
  };

  // 文件删除
  const handleFileDelete = async (fileType: string, fileIndex?: number) => {
    if (!selectedProject) return;

    try {
      // 使用 URL 参数而不是请求体，避免浏览器兼容性问题
      const params = new URLSearchParams({
        projectId: selectedProject.id,
        fileType,
      });
      if (fileIndex !== undefined) {
        params.set('fileIndex', String(fileIndex));
      }
      
      console.log('Delete request params:', params.toString());
      
      const res = await fetch(`/api/upload?${params.toString()}`, {
        method: 'DELETE',
      });

      const data = await res.json();
      console.log('Delete response:', data);
      
      if (data.success) {
        toast.success('删除成功', { description: '文件已删除' });
        // 更新本地状态
        if (fileType === 'other' && fileIndex !== undefined) {
          setSelectedProject(prev => {
            if (!prev) return null;
            const materials = prev.otherMaterials ? JSON.parse(prev.otherMaterials) : [];
            materials.splice(fileIndex, 1);
            const newMaterials = materials.length > 0 ? JSON.stringify(materials) : null;
            console.log('Updating other materials:', { old: prev.otherMaterials, new: newMaterials });
            return { ...prev, otherMaterials: newMaterials };
          });
        } else {
          const updates = getDeleteUpdate(fileType);
          console.log('Delete updates for', fileType, ':', updates);
          setSelectedProject(prev => {
            if (!prev) return null;
            const newState = { ...prev, ...updates };
            console.log('New state:', JSON.stringify(updates, null, 2));
            return newState;
          });
        }
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      console.error('Delete error:', error);
      toast.error('删除失败', { description: error instanceof Error ? error.message : '文件删除失败' });
    }
  };

  const getDeleteUpdate = (fileType: string): Record<string, null> => {
    const mapping: Record<string, string[]> = {
      contractPdf: ['contractFilePdf', 'contractFileNamePdf'],
      contractWord: ['contractFileWord', 'contractFileNameWord'],
      costPdf: ['costFilePdf', 'costFileNamePdf'],
      costExcel: ['costFileExcel', 'costFileNameExcel'],
      declarationPdf: ['declarationFilePdf', 'declarationFileNamePdf'],
      declarationWord: ['declarationFileWord', 'declarationFileNameWord'],
      studentList: ['studentListFile', 'studentListFileName'],
      courseSchedule: ['courseScheduleFile', 'courseScheduleFileName'],
      satisfaction: ['satisfactionSurveyFile', 'satisfactionSurveyFileName'],
      countersign: ['countersignFile', 'countersignFileName'],
    };
    const fields = mapping[fileType] || [];
    const updates: Record<string, null> = {};
    fields.forEach(f => updates[f] = null);
    return updates;
  };

  // 获取文件URL
  const getFileUrl = async (fileKey: string) => {
    try {
      const res = await fetch(`/api/upload?fileKey=${encodeURIComponent(fileKey)}`);
      const data = await res.json();
      if (data.url) {
        window.open(data.url, '_blank');
      }
    } catch (error) {
      console.error('Get file URL error:', error);
    }
  };

  // 拖放处理
  const handleDragOver = (e: React.DragEvent, fileType: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(fileType);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(null);
  };

  const handleDrop = (e: React.DragEvent, fileType: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(null);
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length === 0) return;
    
    // 根据文件类型校验
    const validFiles: File[] = [];
    for (const file of files) {
      if (fileType.endsWith('Pdf') && !file.name.toLowerCase().endsWith('.pdf')) {
        toast.error('文件格式错误', { description: `${file.name} 不是PDF格式，已跳过` });
        continue;
      }
      if (fileType.endsWith('Word') && !/\.(doc|docx)$/i.test(file.name)) {
        toast.error('文件格式错误', { description: `${file.name} 不是Word格式，已跳过` });
        continue;
      }
      validFiles.push(file);
    }
    
    if (validFiles.length > 0) {
      // 使用多文件处理函数
      handleMultipleFileSelect(fileType, validFiles);
    }
  };

  // AI分析生成报告
  const handleGenerateSummary = async () => {
    if (!selectedProject) return;

    setAnalyzing(true);
    try {
      // 获取 session token
      const sessionToken = typeof window !== 'undefined' ? localStorage.getItem('session_token') : null;
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (sessionToken) {
        headers['Authorization'] = `Bearer ${sessionToken}`;
      }
      
      const res = await fetch('/api/ai/summary', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          projectId: selectedProject.id,
        }),
      });

      const data = await res.json();
      if (data.data) {
        setSummaryReport(data.data.report);
        setExtractedData(data.data.extractedData || {});
        toast.success('报告生成成功', { description: 'AI已生成项目总结报告' });
        // 进入下一步
        setCurrentStep(4);
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      console.error('Generate summary error:', error);
      toast.error('生成失败', { description: error instanceof Error ? error.message : '报告生成失败' });
    } finally {
      setAnalyzing(false);
    }
  };

  // 确认并下载
  const handleConfirmAndDownload = async () => {
    if (!selectedProject || !summaryReport) return;

    // 检查归档条件
    const { isComplete, missingFiles } = checkArchiveRequirements(selectedProject);
    
    if (!isComplete) {
      const missingNames = missingFiles.map(f => f.name).join('、');
      toast.error('无法归档', { 
        description: `以下必要文件未上传：${missingNames}。请先上传这些文件后再进行归档。`
      });
      return;
    }

    setSaving(true);
    try {
      // 获取session token
      const sessionToken = typeof window !== 'undefined' ? localStorage.getItem('session_token') : null;
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (sessionToken) {
        headers['Authorization'] = `Bearer ${sessionToken}`;
      }
      
      // 更新项目状态为已归档
      const res = await fetch(`/api/projects/${selectedProject.id}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ 
          status: 'archived',
          summaryReport: JSON.stringify({ report: summaryReport, extractedData }),
        }),
      });

      if (res.ok) {
        toast.success('归档成功', { description: '项目已归档，报告已保存' });
        // 下载报告
        downloadReport();
        // 返回第一步
        loadProjects();
        resetState();
      } else {
        throw new Error('保存失败');
      }
    } catch (error) {
      console.error('Confirm error:', error);
      toast.error('保存失败', { description: error instanceof Error ? error.message : '保存失败' });
    } finally {
      setSaving(false);
    }
  };

  // 下载报告
  const downloadReport = () => {
    if (!summaryReport || !selectedProject) return;
    
    const blob = new Blob([summaryReport], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedProject.name}-项目总结报告.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // 重置状态
  const resetState = () => {
    setSelectedProject(null);
    setSummaryReport(null);
    setExtractedData({});
    setCurrentStep(1);
    setLastSaveTime(null);
  };

  // 监听导航事件，点击左侧菜单时重置状态
  useEffect(() => {
    const handleNavigate = (event: CustomEvent) => {
      if (event.detail?.page === '/summary') {
        resetState();
        loadProjects();
      }
    };
    
    window.addEventListener('navigate-to-page', handleNavigate as EventListener);
    return () => {
      window.removeEventListener('navigate-to-page', handleNavigate as EventListener);
    };
  }, []);

  // 创建新的待总结项目（补录）
  const handleCreateNewProject = async () => {
    if (!newProjectName.trim()) {
      toast.error('请输入项目名称');
      return;
    }

    setCreatingProject(true);
    try {
      // 获取session token
      const sessionToken = typeof window !== 'undefined' ? localStorage.getItem('session_token') : null;
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (sessionToken) {
        headers['Authorization'] = `Bearer ${sessionToken}`;
      }
      
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          name: newProjectName.trim(),
          status: 'completed', // 直接设为已完成状态，因为这是补录的项目
        }),
      });

      const data = await res.json();
      if (data.data) {
        toast.success('项目创建成功', { description: '请上传项目材料' });
        setShowNewProjectDialog(false);
        setNewProjectName('');
        // 自动选中新建的项目
        handleSelectProject(data.data);
        // 刷新项目列表
        loadProjects();
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      console.error('Create project error:', error);
      toast.error('创建失败', { description: error instanceof Error ? error.message : '创建项目失败' });
    } finally {
      setCreatingProject(false);
    }
  };

  // 返回上一步
  const handlePrevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  // 下一步
  const handleNextStep = () => {
    if (currentStep === 2) {
      // 检查是否至少上传了一个文件
      const progress = getUploadProgress(selectedProject!);
      if (progress === 0) {
        toast.error('请先上传材料', { description: '至少需要上传一份材料才能进行AI分析' });
        return;
      }
      setCurrentStep(3);
    } else if (currentStep === 3) {
      if (!summaryReport) {
        toast.error('请先生成报告', { description: '请点击生成按钮生成项目总结报告' });
        return;
      }
      setCurrentStep(4);
    }
  };

  // 渲染步骤指示器
  const renderStepIndicator = () => (
    <div className="mb-8">
      <div className="flex items-center justify-center">
        {STEPS.map((step, index) => (
          <div key={step.id} className="flex items-center">
            <div className="flex flex-col items-center">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center font-medium text-sm transition-colors ${
                  currentStep > step.id
                    ? 'bg-green-500 text-white'
                    : currentStep === step.id
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-200 text-gray-500'
                }`}
              >
                {currentStep > step.id ? (
                  <Check className="w-5 h-5" />
                ) : (
                  step.id
                )}
              </div>
              <span className={`mt-2 text-sm font-medium ${
                currentStep >= step.id ? 'text-gray-900' : 'text-gray-400'
              }`}>
                {step.name}
              </span>
              <span className="text-xs text-gray-400">{step.description}</span>
            </div>
            {index < STEPS.length - 1 && (
              <div className={`w-20 h-0.5 mx-2 ${
                currentStep > step.id ? 'bg-green-500' : 'bg-gray-200'
              }`} />
            )}
          </div>
        ))}
      </div>
    </div>
  );

  // 渲染文件上传组件（双版本）
  const renderDualFileUpload = (
    title: string,
    pdfFileType: string,
    pdfFileName: string | null,
    pdfFileKey: string | null,
    secondFileType: string,  // 第二个文件类型标识
    secondFileName: string | null,
    secondFileKey: string | null,
    description: string,
    secondFileFormat: 'word' | 'excel' = 'word',  // 默认Word，可选Excel
    enableAiCheck: boolean = false  // 是否启用AI检查
  ) => {
    // 根据文件格式确定参数
    const secondAccept = secondFileFormat === 'excel' ? '.xls,.xlsx' : '.doc,.docx';
    const secondLabel = secondFileFormat === 'excel' ? 'Excel版本' : 'Word版本';
    const secondUploadedLabel = secondFileFormat === 'excel' ? 'Excel已上传' : 'Word已上传';
    
    // 确定用于AI检查的文件（优先使用Word/Excel版本）
    const aiCheckFileKey = secondFileKey || pdfFileKey;
    const aiCheckFileName = secondFileName || pdfFileName;
    const aiCheckFileType = pdfFileType.replace('Pdf', '').toLowerCase(); // 从pdfFileType提取类型
    
    return (
    <div className="p-4 border rounded-lg">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-gray-500" />
          <span className="font-medium text-gray-900">{title}</span>
        </div>
        {enableAiCheck && aiCheckFileKey && (
          <Button
            variant="outline"
            size="sm"
            className={`h-7 text-xs ${
              fileAiChecking === aiCheckFileKey 
                ? 'border-red-200 text-red-600 hover:bg-red-50' 
                : 'border-purple-200 text-purple-600 hover:bg-purple-50'
            }`}
            onClick={() => {
              if (fileAiChecking === aiCheckFileKey) {
                handleCancelFileAiCheck();
              } else {
                handleFileAiCheck(aiCheckFileType, aiCheckFileKey, aiCheckFileName || '');
              }
            }}
          >
            {fileAiChecking === aiCheckFileKey ? (
              <>
                <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                取消检查
              </>
            ) : (
              <>
                <Brain className="w-3 h-3 mr-1" />
                AI检查
              </>
            )}
          </Button>
        )}
      </div>
      <p className="text-xs text-gray-500 mb-4">{description}</p>
      
      <div className="grid grid-cols-2 gap-3">
        {/* 第二个版本（Word或Excel） */}
        <div className="space-y-2">
          {secondFileName ? (
            <div 
              className={`p-3 bg-green-50 border border-green-200 rounded-lg transition-colors ${
                dragActive === secondFileType ? 'bg-blue-50 border-blue-400 border-dashed' : ''
              }`}
              onDragOver={(e) => handleDragOver(e, secondFileType)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, secondFileType)}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-green-600 font-medium">{secondUploadedLabel}</span>
                <CheckCircle className="w-4 h-4 text-green-500" />
              </div>
              <p className="text-xs text-gray-600 truncate mb-2">{secondFileName}</p>
              <div className="flex gap-1">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="h-7 flex-1 text-xs"
                  onClick={() => secondFileKey && handlePreview(secondFileKey, secondFileName)}
                >
                  <Eye className="w-3 h-3 mr-1" />
                  预览
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="h-7 flex-1 text-xs"
                  onClick={() => secondFileKey && getFileUrl(secondFileKey)}
                >
                  <Download className="w-3 h-3 mr-1" />
                  下载
                </Button>
              </div>
              <div className="flex gap-1 mt-1">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="h-7 flex-1 text-xs border-blue-200 text-blue-600 hover:bg-blue-50"
                  onClick={() => {
                    const input = document.getElementById(`file-${secondFileType}`) as HTMLInputElement;
                    if (input) {
                      input.value = '';
                      input.click();
                    }
                  }}
                >
                  <Upload className="w-3 h-3 mr-1" />
                  重新上传
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="h-7 flex-1 text-xs border-red-200 text-red-600 hover:bg-red-50"
                  onClick={() => handleFileDelete(secondFileType)}
                >
                  <Trash2 className="w-3 h-3 mr-1" />
                  删除
                </Button>
              </div>
              <input
                type="file"
                accept={secondAccept}
                className="hidden"
                id={`file-${secondFileType}`}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFileSelect(secondFileType, file);
                }}
              />
            </div>
          ) : (
            <div
              className={`border-2 border-dashed rounded-lg p-3 text-center transition-colors cursor-pointer ${
                dragActive === secondFileType ? 'bg-blue-50 border-blue-400' :
                uploading === secondFileType ? 'bg-blue-50 border-blue-300' : 'hover:bg-gray-50 border-gray-200'
              }`}
              onDragOver={(e) => handleDragOver(e, secondFileType)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, secondFileType)}
              onClick={() => {
                if (uploading !== secondFileType) {
                  const input = document.getElementById(`file-${secondFileType}`) as HTMLInputElement;
                  input?.click();
                }
              }}
            >
              <input
                type="file"
                accept={secondAccept}
                className="hidden"
                id={`file-${secondFileType}`}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFileSelect(secondFileType, file);
                }}
              />
              {uploading === secondFileType ? (
                <div className="py-2">
                  <Loader2 className="w-5 h-5 mx-auto animate-spin text-blue-500" />
                  <p className="text-xs text-blue-500 mt-1">上传中...</p>
                </div>
              ) : (
                <div className="py-2">
                  <Upload className="w-5 h-5 mx-auto text-gray-400" />
                  <p className="text-xs text-gray-500 mt-1">{secondLabel}</p>
                  <p className="text-[10px] text-gray-400">点击或拖放</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* PDF版本 */}
        <div className="space-y-2">
          {pdfFileName ? (
            <div 
              className={`p-3 bg-green-50 border border-green-200 rounded-lg transition-colors ${
                dragActive === pdfFileType ? 'bg-blue-50 border-blue-400 border-dashed' : ''
              }`}
              onDragOver={(e) => handleDragOver(e, pdfFileType)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, pdfFileType)}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-green-600 font-medium">PDF已上传</span>
                <CheckCircle className="w-4 h-4 text-green-500" />
              </div>
              <p className="text-xs text-gray-600 truncate mb-2">{pdfFileName}</p>
              <div className="flex gap-1">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="h-7 flex-1 text-xs"
                  onClick={() => pdfFileKey && handlePreview(pdfFileKey, pdfFileName)}
                >
                  <Eye className="w-3 h-3 mr-1" />
                  预览
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="h-7 flex-1 text-xs"
                  onClick={() => pdfFileKey && getFileUrl(pdfFileKey)}
                >
                  <Download className="w-3 h-3 mr-1" />
                  下载
                </Button>
              </div>
              <div className="flex gap-1 mt-1">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="h-7 flex-1 text-xs border-blue-200 text-blue-600 hover:bg-blue-50"
                  onClick={() => {
                    const input = document.getElementById(`file-${pdfFileType}`) as HTMLInputElement;
                    if (input) {
                      input.value = '';
                      input.click();
                    }
                  }}
                >
                  <Upload className="w-3 h-3 mr-1" />
                  重新上传
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="h-7 flex-1 text-xs border-red-200 text-red-600 hover:bg-red-50"
                  onClick={() => handleFileDelete(pdfFileType)}
                >
                  <Trash2 className="w-3 h-3 mr-1" />
                  删除
                </Button>
              </div>
              <input
                type="file"
                accept=".pdf"
                className="hidden"
                id={`file-${pdfFileType}`}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFileSelect(pdfFileType, file);
                }}
              />
            </div>
          ) : (
            <div
              className={`border-2 border-dashed rounded-lg p-3 text-center transition-colors cursor-pointer ${
                dragActive === pdfFileType ? 'bg-blue-50 border-blue-400' :
                uploading === pdfFileType ? 'bg-blue-50 border-blue-300' : 'hover:bg-gray-50 border-gray-200'
              }`}
              onDragOver={(e) => handleDragOver(e, pdfFileType)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, pdfFileType)}
              onClick={() => {
                if (uploading !== pdfFileType) {
                  const input = document.getElementById(`file-${pdfFileType}`) as HTMLInputElement;
                  input?.click();
                }
              }}
            >
              <input
                type="file"
                accept=".pdf"
                className="hidden"
                id={`file-${pdfFileType}`}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFileSelect(pdfFileType, file);
                }}
              />
              {uploading === pdfFileType ? (
                <div className="py-2">
                  <Loader2 className="w-5 h-5 mx-auto animate-spin text-blue-500" />
                  <p className="text-xs text-blue-500 mt-1">上传中...</p>
                </div>
              ) : (
                <div className="py-2">
                  <Upload className="w-5 h-5 mx-auto text-gray-400" />
                  <p className="text-xs text-gray-500 mt-1">PDF版本</p>
                  <p className="text-[10px] text-gray-400">点击或拖放</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
    );
  };

  // 渲染单文件上传组件
  const renderSingleFileUpload = (
    title: string,
    fileType: string,
    fileName: string | null,
    fileKey: string | null,
    description: string,
    accept: string = '.pdf,.doc,.docx,.xls,.xlsx',
    enableAiCheck: boolean = false  // 是否启用AI检查
  ) => {
    // 从fileType提取AI检查类型
    const aiCheckFileType = fileType.toLowerCase();
    // 判断文件是否真正上传（fileKey必须以 "projects/" 开头）
    const hasValidFile = isValidFile(fileKey);
    
    return (
    <div className="p-4 border rounded-lg">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-gray-500" />
          <span className="font-medium text-gray-900">{title}</span>
        </div>
        <div className="flex items-center gap-2">
          {hasValidFile && (
            <Badge variant="default" className="bg-green-100 text-green-700">
              <CheckCircle className="w-3 h-3 mr-1" />
              已上传
            </Badge>
          )}
          {enableAiCheck && hasValidFile && (
            <Button
              variant="outline"
              size="sm"
              className={`h-7 text-xs ${
                fileAiChecking === fileKey 
                  ? 'border-red-200 text-red-600 hover:bg-red-50' 
                  : 'border-purple-200 text-purple-600 hover:bg-purple-50'
              }`}
              onClick={() => {
                if (fileAiChecking === fileKey) {
                  handleCancelFileAiCheck();
                } else {
                  handleFileAiCheck(aiCheckFileType, fileKey!, fileName || '未知文件');
                }
              }}
            >
              {fileAiChecking === fileKey ? (
                <>
                  <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                  取消检查
                </>
              ) : (
                <>
                  <Brain className="w-3 h-3 mr-1" />
                  AI检查
                </>
              )}
            </Button>
          )}
        </div>
      </div>
      <p className="text-xs text-gray-500 mb-3">{description}</p>
      
      {hasValidFile ? (
        <div 
          className={`p-3 bg-green-50 border border-green-200 rounded-lg transition-colors ${
            dragActive === fileType ? 'bg-blue-50 border-blue-400 border-dashed' : ''
          }`}
          onDragOver={(e) => handleDragOver(e, fileType)}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, fileType)}
        >
          <p className="text-sm text-gray-700 truncate mb-2">{fileName}</p>
          <div className="flex gap-1">
            <Button 
              variant="outline" 
              size="sm" 
              className="h-7 flex-1 text-xs"
              onClick={() => fileKey && handlePreview(fileKey, fileName || '未知文件')}
            >
              <Eye className="w-3 h-3 mr-1" />
              预览
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              className="h-7 flex-1 text-xs"
              onClick={() => fileKey && getFileUrl(fileKey)}
            >
              <Download className="w-3 h-3 mr-1" />
              下载
            </Button>
          </div>
          <div className="flex gap-1 mt-1">
            <Button 
              variant="outline" 
              size="sm" 
              className="h-7 flex-1 text-xs border-blue-200 text-blue-600 hover:bg-blue-50"
              onClick={() => {
                const input = document.getElementById(`file-${fileType}`) as HTMLInputElement;
                if (input) {
                  input.value = '';
                  input.click();
                }
              }}
            >
              <Upload className="w-3 h-3 mr-1" />
              重新上传
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              className="h-7 flex-1 text-xs border-red-200 text-red-600 hover:bg-red-50"
              onClick={() => handleFileDelete(fileType)}
            >
              <Trash2 className="w-3 h-3 mr-1" />
              删除
            </Button>
          </div>
          <input
            type="file"
            accept={accept}
            className="hidden"
            id={`file-${fileType}`}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFileSelect(fileType, file);
            }}
          />
        </div>
      ) : (
        <div
          className={`border-2 border-dashed rounded-lg p-4 text-center transition-colors cursor-pointer ${
            dragActive === fileType ? 'bg-blue-50 border-blue-400' :
            uploading === fileType ? 'bg-blue-50 border-blue-300' : 'hover:bg-gray-50 border-gray-200'
          }`}
          onDragOver={(e) => handleDragOver(e, fileType)}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, fileType)}
          onClick={() => {
            if (uploading !== fileType) {
              const input = document.getElementById(`file-${fileType}`) as HTMLInputElement;
              input?.click();
            }
          }}
        >
          <input
            type="file"
            accept={accept}
            className="hidden"
            id={`file-${fileType}`}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFileSelect(fileType, file);
            }}
          />
          {uploading === fileType ? (
            <div>
              <Loader2 className="w-6 h-6 mx-auto animate-spin text-blue-500" />
              <p className="text-sm text-blue-500 mt-2">上传中...</p>
            </div>
          ) : (
            <div>
              <Upload className="w-6 h-6 mx-auto text-gray-400" />
              <p className="text-sm text-gray-500 mt-2">点击或拖放文件上传</p>
            </div>
          )}
        </div>
      )}
    </div>
    );
  };

  // 渲染第一步：选择项目
  const renderStep1 = () => (
    <div className="space-y-6">
      {/* 时间筛选和统计概览 */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        <div className="flex items-center gap-3">
          <Filter className="w-4 h-4 text-gray-500" />
          <Select value={timeFilter} onValueChange={setTimeFilter}>
            <SelectTrigger className="w-[140px]">
              <Calendar className="w-4 h-4 mr-2" />
              <SelectValue placeholder="选择时间范围" />
            </SelectTrigger>
            <SelectContent>
              {TIME_FILTERS.map(filter => (
                <SelectItem key={filter.value} value={filter.value}>
                  {filter.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {/* 搜索框 */}
          <div className="relative">
            <input
              type="text"
              placeholder="搜索项目名称..."
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              className="w-[200px] pl-8 pr-3 py-1.5 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <svg
              className="absolute left-2.5 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            {searchKeyword && (
              <button
                onClick={() => setSearchKeyword('')}
                className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>
        
        {/* 统计概览 */}
        <div className="flex flex-wrap gap-3">
          <Badge variant="outline" className="px-3 py-1.5 text-sm">
            <PlayCircle className="w-3.5 h-3.5 mr-1.5 text-indigo-600" />
            执行中：{stats.executing}
          </Badge>
          <Badge variant="outline" className="px-3 py-1.5 text-sm">
            <FileCheck className="w-3.5 h-3.5 mr-1.5 text-emerald-600" />
            已完成待归档：{stats.completed}
          </Badge>
          <Badge variant="outline" className="px-3 py-1.5 text-sm">
            <Archive className="w-3.5 h-3.5 mr-1.5 text-gray-600" />
            已归档：{stats.archived}
          </Badge>
        </div>
      </div>

      {/* 待总结项目（执行中 + 已完成待归档） */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <ClipboardCheck className="w-5 h-5" />
                待总结项目
              </CardTitle>
              <CardDescription>
                执行中 ({stats.executing}) + 已完成待归档 ({stats.completed})
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowNewProjectDialog(true)}
            >
              <Plus className="w-4 h-4 mr-1" />
              新建
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-gray-500">
              <Loader2 className="w-6 h-6 mx-auto animate-spin" />
              <p className="mt-2">加载中...</p>
            </div>
          ) : categorizedProjects.pendingProjects.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Inbox className="w-12 h-12 mx-auto mb-2 text-gray-300" />
              <p>暂无待总结项目</p>
              <Button
                variant="link"
                className="mt-2"
                onClick={() => setShowNewProjectDialog(true)}
              >
                <Plus className="w-4 h-4 mr-1" />
                新建一个待总结项目
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* 待总结项目列表 - 按完成进度排序 */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {categorizedProjects.pendingProjects
                  .slice((pendingPage - 1) * PAGE_SIZE, pendingPage * PAGE_SIZE)
                  .map((project) => {
                  const { isComplete } = checkArchiveRequirements(project);
                  const isExecuting = project.status === 'executing';
                  return (
                    <Card
                      key={project.id}
                      className={`cursor-pointer hover:shadow-md transition-all ${
                        isExecuting ? 'hover:border-indigo-500' : 
                        isComplete ? 'hover:border-emerald-500' : 'border-orange-300 bg-orange-50'
                      }`}
                      onClick={() => handleSelectProject(project)}
                    >
                      <CardContent className="p-3">
                        <div className="flex items-start justify-between mb-1.5">
                          <h5 className="font-medium text-gray-900 text-sm line-clamp-1">{project.name}</h5>
                          <Badge className={
                            isExecuting ? 'bg-indigo-100 text-indigo-700 text-xs' : 
                            isComplete ? 'bg-emerald-100 text-emerald-700 text-xs' : 'bg-orange-100 text-orange-600 text-xs'
                          }>
                            {isExecuting ? '执行中' : isComplete ? '可归档' : '待上传'}
                          </Badge>
                        </div>
                        <div className="text-xs text-gray-500 space-y-0.5">
                          <p>参训：{project.participantCount || '-'}人</p>
                          {project.trainingDays && <p>天数：{project.trainingDays}天</p>}
                        </div>
                        <div className="mt-2">
                          <div className="flex items-center justify-between text-xs text-gray-400 mb-0.5">
                            <span>材料</span>
                            <span>{getUploadProgress(project)}%</span>
                          </div>
                          <Progress value={getUploadProgress(project)} className="h-1" />
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
              {renderPagination(pendingPage, categorizedProjects.pendingProjects.length, setPendingPage)}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 已归档项目（只有满足条件的才显示） */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Archive className="w-5 h-5" />
                已归档项目
              </CardTitle>
              <CardDescription>
                已完成归档 ({stats.archived})
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-4 text-gray-500">加载中...</div>
          ) : categorizedProjects.archivedProjects.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Archive className="w-12 h-12 mx-auto mb-2 text-gray-300" />
              <p>暂无已归档项目</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {categorizedProjects.archivedProjects
                  .slice((archivedPage - 1) * PAGE_SIZE, archivedPage * PAGE_SIZE)
                  .map((project) => (
                  <Card
                    key={project.id}
                    className="cursor-pointer hover:shadow-md transition-all opacity-80 hover:opacity-100"
                    onClick={() => handleSelectProject(project)}
                  >
                    <CardContent className="p-3">
                      <div className="flex items-start justify-between mb-1.5">
                        <h5 className="font-medium text-gray-900 text-sm line-clamp-1">{project.name}</h5>
                        <Badge className="bg-gray-100 text-gray-500 text-xs">已归档</Badge>
                      </div>
                      <div className="text-xs text-gray-500">
                        <p>参训：{project.participantCount || '-'}人</p>
                      </div>
                      <div className="mt-2 flex items-center gap-1 text-xs text-gray-400">
                        <CheckCircle className="w-3 h-3" />
                        <span>已完成总结</span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
              {renderPagination(archivedPage, categorizedProjects.archivedProjects.length, setArchivedPage)}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );

  // 取消归档（将项目状态改回 completed）
  const handleUnarchive = async (project: Project) => {
    try {
      // 获取session token
      const sessionToken = typeof window !== 'undefined' ? localStorage.getItem('session_token') : null;
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (sessionToken) {
        headers['Authorization'] = `Bearer ${sessionToken}`;
      }
      
      const res = await fetch(`/api/projects/${project.id}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ status: 'completed' }),
      });

      if (res.ok) {
        toast.success('已取消归档', { description: '项目已转为待总结状态' });
        loadProjects();
      } else {
        const data = await res.json();
        throw new Error(data.error);
      }
    } catch (error) {
      console.error('Unarchive error:', error);
      toast.error('操作失败', { description: error instanceof Error ? error.message : '取消归档失败' });
    }
  };

  // 渲染第二步：上传材料
  const renderStep2 = () => {
    if (!selectedProject) return null;
    
    const progress = getUploadProgress(selectedProject);
    
    return (
      <div className="space-y-6">
        {/* 项目信息 */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium text-lg">{selectedProject.name}</h3>
                <p className="text-sm text-gray-500">
                  参训人数：{selectedProject.participantCount || '-'}人 | 
                  培训天数：{selectedProject.trainingDays || '-'}天
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-500">材料上传进度</p>
                <p className="text-2xl font-bold text-blue-600">{progress}%</p>
              </div>
            </div>
            <Progress value={progress} className="h-2 mt-3" />
          </CardContent>
        </Card>

        {/* 上传说明 */}
        <div className="p-4 bg-blue-50 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className="w-5 h-5 text-blue-600" />
            <span className="font-medium text-blue-700">上传说明</span>
          </div>
          <p className="text-sm text-gray-600">
            合同文件、项目申报书需同时上传PDF和Word两个版本；成本测算表需上传PDF和Excel两个版本；会签单仅需PDF版本。
            所有带 * 的文件为归档必要材料。支持拖放上传，材料将自动保存。
          </p>
          {lastSaveTime && (
            <p className="text-xs text-gray-500 mt-2 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              上次保存：{lastSaveTime.toLocaleString()}
            </p>
          )}
        </div>

        {/* 第一行：合同文件、成本测算表 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {renderDualFileUpload(
            '合同文件 *',
            'contractPdf',
            selectedProject.contractFileNamePdf,
            selectedProject.contractFilePdf,
            'contractWord',
            selectedProject.contractFileNameWord,
            selectedProject.contractFileWord,
            '上传合同扫描件或电子版（需PDF和Word两个版本）',
            'word',
            true  // 启用AI检查
          )}
          {renderDualFileUpload(
            '成本测算表 *',
            'costPdf',
            selectedProject.costFileNamePdf,
            selectedProject.costFilePdf,
            'costExcel',
            selectedProject.costFileNameExcel,
            selectedProject.costFileExcel,
            '上传成本明细表（需PDF和Excel两个版本）',
            'excel',
            true  // 启用AI检查
          )}
        </div>

        {/* 第二行：项目申报书、学员名单 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {renderDualFileUpload(
            '项目申报书 *',
            'declarationPdf',
            selectedProject.declarationFileNamePdf,
            selectedProject.declarationFilePdf,
            'declarationWord',
            selectedProject.declarationFileNameWord,
            selectedProject.declarationFileWord,
            '上传项目申报材料（需PDF和Word两个版本）',
            'word',
            true  // 启用AI检查
          )}
          {renderSingleFileUpload(
            '学员名单 *',
            'studentList',
            selectedProject.studentListFileName,
            selectedProject.studentListFile,
            '上传学员名单（支持 PDF、Word、Excel 格式）',
            '.pdf,.doc,.docx,.xls,.xlsx',
            true  // 启用AI检查
          )}
        </div>

        {/* 第三行：会签单、满意度调查结果 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {renderSingleFileUpload(
            '会签单 *',
            'countersign',
            selectedProject.countersignFileName,
            selectedProject.countersignFile,
            '上传会签单PDF文件（必传）',
            '.pdf'
          )}
          {renderSingleFileUpload(
            '满意度调查结果',
            'satisfaction',
            selectedProject.satisfactionSurveyFileName,
            selectedProject.satisfactionSurveyFile,
            '上传满意度调查原始数据（非必传）',
            '.pdf,.doc,.docx,.xls,.xlsx',
            true  // 启用AI检查
          )}
        </div>

        {/* 第四行：课程安排 */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-blue-600" />
                  课程安排 *
                  {extractingCourses && (
                    <Badge variant="outline" className="text-purple-600 border-purple-200">
                      <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                      AI提取中...
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription>
                  上传课程安排表AI自动提取，或手动添加课程
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="border-purple-200 text-purple-600 hover:bg-purple-50"
                  onClick={() => setShowCourseUploadDialog(true)}
                  disabled={extractingCourses}
                >
                  <Upload className="w-4 h-4 mr-2" />
                  上传文件智能分析
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-blue-200 text-blue-600 hover:bg-blue-50"
                  onClick={() => handleAddCourse('course')}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  新增课程
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-orange-200 text-orange-600 hover:bg-orange-50"
                  onClick={() => handleAddCourse('visit')}
                >
                  <MapPin className="w-4 h-4 mr-2" />
                  新增参访
                </Button>
                {extractedCourses.length > 0 && (
                  <Button
                    size="sm"
                    onClick={handleSaveCourses}
                    disabled={savingCourses}
                  >
                    {savingCourses ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        保存中...
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4 mr-2" />
                        保存课程
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {extractedCourses.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {extractingCourses ? (
                  <>
                    <Loader2 className="w-12 h-12 mx-auto mb-2 animate-spin text-purple-600" />
                    <p>正在AI提取课程信息...</p>
                  </>
                ) : (
                  <>
                    <BookOpen className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>暂无课程安排</p>
                    <p className="text-xs mt-1">点击"上传文件智能分析"按钮上传课程表，或点击"新增课程"手动添加</p>
                  </>
                )}
              </div>
            ) : (
              <>
                {/* 统计信息 */}
                <div className="grid grid-cols-4 gap-4 mb-4 p-3 bg-muted/50 rounded-lg">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">{extractedCourses.length}</div>
                    <div className="text-xs text-muted-foreground">课程总数</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">
                      {extractedCourses.reduce((sum, c) => sum + c.duration, 0)}
                    </div>
                    <div className="text-xs text-muted-foreground">总课时</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-orange-600">
                      {extractedCourses.filter(c => c.type === 'visit').length}
                    </div>
                    <div className="text-xs text-muted-foreground">参访活动</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-purple-600">
                      {Math.max(...extractedCourses.map(c => c.day), 0)}
                    </div>
                    <div className="text-xs text-muted-foreground">培训天数</div>
                  </div>
                </div>

                {/* 课程表格 */}
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="w-16 px-2 py-2 text-center">排序</th>
                        <th className="w-16 px-2 py-2 text-center">序号</th>
                        <th className="w-20 px-2 py-2 text-center">天数</th>
                        <th className="px-2 py-2 text-left">课程名称</th>
                        <th className="w-20 px-2 py-2 text-center">课时</th>
                        <th className="w-28 px-2 py-2 text-left">讲师/地点</th>
                        <th className="w-20 px-2 py-2 text-center">类型</th>
                        <th className="w-20 px-2 py-2 text-center">操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {extractedCourses.map((course, index) => (
                        <tr 
                          key={course.id || index}
                          className="border-t cursor-pointer hover:bg-muted/30"
                          onClick={() => handleEditCourse(index)}
                        >
                          <td className="px-2 py-2 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                className="p-0.5 hover:bg-muted rounded disabled:opacity-30"
                                disabled={index === 0}
                                onClick={(e) => { e.stopPropagation(); handleMoveCourseUp(index); }}
                              >
                                ↑
                              </button>
                              <button
                                className="p-0.5 hover:bg-muted rounded disabled:opacity-30"
                                disabled={index === extractedCourses.length - 1}
                                onClick={(e) => { e.stopPropagation(); handleMoveCourseDown(index); }}
                              >
                                ↓
                              </button>
                            </div>
                          </td>
                          <td className="px-2 py-2 text-center font-medium">{index + 1}</td>
                          <td className="px-2 py-2 text-center">第{course.day}天</td>
                          <td className="px-2 py-2">
                            <span className="font-medium">{course.name || '未填写'}</span>
                            {course.description && (
                              <p className="text-xs text-muted-foreground truncate">{course.description}</p>
                            )}
                          </td>
                          <td className="px-2 py-2 text-center">{course.duration}</td>
                          <td className="px-2 py-2 text-sm">
                            {course.type === 'visit' ? (
                              <span className="text-orange-600">{course.visitSiteName || '待定'}</span>
                            ) : (
                              <span className="text-green-600">{course.teacherName || course.teacherTitle || '-'}</span>
                            )}
                          </td>
                          <td className="px-2 py-2 text-center">
                            <Badge 
                              variant="outline" 
                              className={
                                course.type === 'visit' 
                                  ? 'border-orange-300 text-orange-600' 
                                  : 'border-blue-300 text-blue-600'
                              }
                            >
                              {course.type === 'visit' ? '参访' : '课程'}
                            </Badge>
                          </td>
                          <td className="px-2 py-2 text-center">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive hover:text-destructive h-7 px-2"
                              onClick={(e) => { e.stopPropagation(); handleDeleteCourse(index); }}
                            >
                              删除
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* 第五行：其它附件 */}

        {/* 其它附件（非必须，支持多种格式） */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">其它附件</CardTitle>
                <CardDescription>可上传Word、PPT、Excel、PDF、图片等文件（非必传）</CardDescription>
              </div>
              {selectedProject.otherMaterials && JSON.parse(selectedProject.otherMaterials).length > 0 && (
                <Badge variant="default" className="bg-green-100 text-green-700">
                  <CheckCircle className="w-3 h-3 mr-1" />
                  已上传 {JSON.parse(selectedProject.otherMaterials).length} 个文件
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {selectedProject.otherMaterials && JSON.parse(selectedProject.otherMaterials).length > 0 ? (
              <div className="space-y-2 mb-4">
                {JSON.parse(selectedProject.otherMaterials).map((file: { key: string; name: string }, index: number) => (
                  <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                    <span className="text-sm text-gray-700 truncate flex-1">{file.name}</span>
                    <div className="flex items-center gap-1">
                      <Button 
                        variant="outline"
                        size="sm" 
                        className={`h-6 px-2 text-xs ${
                          fileAiChecking === file.key 
                            ? 'border-red-200 text-red-600 hover:bg-red-50' 
                            : 'border-purple-200 text-purple-600 hover:bg-purple-50'
                        }`}
                        onClick={() => {
                          if (fileAiChecking === file.key) {
                            handleCancelFileAiCheck();
                          } else {
                            handleFileAiCheck('other', file.key, file.name);
                          }
                        }}
                      >
                        {fileAiChecking === file.key ? (
                          <>
                            <Loader2 className="w-3 h-3 animate-spin" />
                            <span className="ml-1">取消</span>
                          </>
                        ) : (
                          <Brain className="w-3 h-3" />
                        )}
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-6 px-2" 
                        onClick={() => handlePreview(file.key, file.name)}
                      >
                        <Eye className="w-3 h-3" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-6 px-2" 
                        onClick={() => getFileUrl(file.key)}
                      >
                        <Download className="w-3 h-3" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-6 px-2" 
                        onClick={() => handleFileDelete('other', index)}
                      >
                        <Trash2 className="w-3 h-3 text-red-500" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
            <div
              className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer ${
                dragActive === 'other' ? 'bg-blue-50 border-blue-400' : 'hover:bg-gray-50 border-gray-200'
              }`}
              onDragOver={(e) => handleDragOver(e, 'other')}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, 'other')}
              onClick={() => {
                if (uploading !== 'other') {
                  const input = document.getElementById('file-other') as HTMLInputElement;
                  input?.click();
                }
              }}
            >
              <input
                type="file"
                accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.png,.jpg,.jpeg,.gif,.bmp"
                className="hidden"
                id="file-other"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFileUpload('other', file);
                }}
              />
              {uploading === 'other' ? (
                <div className="py-2">
                  <Loader2 className="w-6 h-6 mx-auto animate-spin text-blue-500" />
                  <p className="text-sm text-blue-500 mt-2">上传中...</p>
                </div>
              ) : (
                <div>
                  <Upload className="w-8 h-8 mx-auto text-gray-400" />
                  <p className="text-sm text-gray-500 mt-2">点击或拖放文件上传</p>
                  <p className="text-xs text-gray-400 mt-1">支持 Word、PPT、Excel、PDF、图片等格式</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* 操作按钮 */}
        <div className="flex justify-between">
          <Button variant="outline" onClick={handlePrevStep}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            返回选择项目
          </Button>
          <Button onClick={handleNextStep} disabled={progress === 0}>
            下一步：AI分析
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </div>
    );
  };

  // 渲染第三步：AI分析
  const renderStep3 = () => {
    if (!selectedProject) return null;
    
    return (
      <div className="space-y-6">
        {/* 项目信息 */}
        <Card>
          <CardContent className="p-4">
            <h3 className="font-medium text-lg">{selectedProject.name}</h3>
            <p className="text-sm text-gray-500 mt-1">
              材料上传进度：{getUploadProgress(selectedProject)}%
            </p>
          </CardContent>
        </Card>

        {summaryReport ? (
          <div className="space-y-4">
            <div className="p-4 bg-green-50 rounded-lg flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <span className="font-medium text-green-700">报告已生成</span>
              </div>
              <Button variant="outline" size="sm" onClick={() => setCurrentStep(4)}>
                查看报告
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
            
            <Card>
              <CardHeader>
                <CardTitle>报告预览</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="max-h-96 overflow-y-auto text-sm text-gray-700 whitespace-pre-wrap bg-gray-50 p-4 rounded">
                  {summaryReport.substring(0, 1000)}...
                </div>
              </CardContent>
            </Card>
          </div>
        ) : (
          <Card>
            <CardContent className="p-8 text-center">
              <Brain className="w-16 h-16 mx-auto mb-4 text-gray-300" />
              <h3 className="text-lg font-medium mb-2">AI智能分析</h3>
              <p className="text-gray-500 mb-6 max-w-md mx-auto">
                系统将根据上传的材料，自动分析并生成项目总结报告。
                报告将包含项目概况、费用分析、满意度分析等内容。
              </p>
              <Button
                size="lg"
                onClick={handleGenerateSummary}
                disabled={analyzing}
              >
                {analyzing ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    AI分析中...
                  </>
                ) : (
                  <>
                    <Brain className="w-5 h-5 mr-2" />
                    生成总结报告
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* 操作按钮 */}
        <div className="flex justify-between">
          <Button variant="outline" onClick={handlePrevStep}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            返回上传材料
          </Button>
          {summaryReport && (
            <Button onClick={() => setCurrentStep(4)}>
              下一步：确认下载
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          )}
        </div>
      </div>
    );
  };

  // 从课程安排表提取课程
  const handleExtractCourses = async () => {
    if (!selectedProject?.courseScheduleFile) {
      toast.error('请先上传课程安排表');
      return;
    }

    setExtractingCourses(true);
    try {
      const sessionToken = localStorage.getItem('session_token');
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (sessionToken) {
        headers['Authorization'] = `Bearer ${sessionToken}`;
      }

      const res = await fetch('/api/ai/extract-courses', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          projectId: selectedProject.id,
          fileKey: selectedProject.courseScheduleFile,
          fileName: selectedProject.courseScheduleFileName,
        }),
      });

      const data = await res.json();
      if (data.success && data.courses && data.courses.length > 0) {
        // 为每个课程生成ID
        const coursesWithIds = data.courses.map((course: ExtractedCourse, index: number) => ({
          ...course,
          id: `course-${Date.now()}-${index}`,
        }));
        setExtractedCourses(coursesWithIds);
        toast.success(`成功提取 ${coursesWithIds.length} 门课程`);
      } else {
        // AI提取失败或没有课程，显示空表格
        setExtractedCourses([]);
        if (data.message) {
          toast.warning(data.message);
        } else {
          toast.info('未识别到课程信息，请手动添加');
        }
      }
      // 结果会自动显示在页面上的课程表格中
    } catch (error) {
      console.error('提取课程失败:', error);
      // 提取失败，显示空表格让用户手动编辑
      setExtractedCourses([]);
      toast.error('AI提取失败，请手动添加课程');
    } finally {
      setExtractingCourses(false);
    }
  };

  // 编辑课程
  const handleEditCourse = (index: number) => {
    setEditingCourseIndex(index);
    setEditingCourse({ ...extractedCourses[index] });
  };

  // 保存编辑的课程
  const handleSaveEditedCourse = () => {
    if (editingCourseIndex !== null && editingCourse) {
      const updatedCourses = [...extractedCourses];
      updatedCourses[editingCourseIndex] = editingCourse;
      setExtractedCourses(updatedCourses);
      setEditingCourseIndex(null);
      setEditingCourse(null);
      toast.success('课程已更新');
    }
  };

  // 删除课程
  const handleDeleteCourse = (index: number) => {
    const updatedCourses = extractedCourses.filter((_, i) => i !== index);
    setExtractedCourses(updatedCourses);
    toast.success('课程已删除');
  };

  // 新增课程
  const handleAddCourse = (type: 'course' | 'visit' = 'course') => {
    const newCourse: ExtractedCourse = {
      id: `course-${Date.now()}`,
      name: '',
      day: extractedCourses.length > 0 ? Math.max(...extractedCourses.map(c => c.day)) : 1,
      duration: 2,
      type,
      description: '',
    };
    setExtractedCourses([...extractedCourses, newCourse]);
    setEditingCourseIndex(extractedCourses.length);
    setEditingCourse(newCourse);
  };

  // 保存课程到数据库
  const handleSaveCourses = async () => {
    if (!selectedProject) return;

    console.log('保存课程: 当前课程数量', extractedCourses.length);
    console.log('课程列表:', extractedCourses.map(c => c.name).join(', '));
    
    setSavingCourses(true);
    try {
      const sessionToken = localStorage.getItem('session_token');
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (sessionToken) {
        headers['Authorization'] = `Bearer ${sessionToken}`;
      }

      // 先删除现有课程
      const deleteRes = await fetch(`/api/projects/${selectedProject.id}/courses`, {
        method: 'DELETE',
        headers,
      });
      console.log('删除课程结果:', deleteRes.status);

      // 如果有课程，逐个添加
      if (extractedCourses.length > 0) {
        let successCount = 0;
        
        for (let index = 0; index < extractedCourses.length; index++) {
          const course = extractedCourses[index];
          try {
            const res = await fetch(`/api/projects/${selectedProject.id}/courses`, {
              method: 'POST',
              headers,
              body: JSON.stringify({
                ...course,
                order: index,
              }),
            });

            if (res.ok) {
              successCount++;
            } else {
              const text = await res.text();
              console.error('课程保存失败:', course.name, text);
            }
          } catch (err) {
            console.error('课程保存异常:', course.name, err);
          }
        }

        if (successCount === extractedCourses.length) {
          toast.success('课程安排已保存');
          // 更新当前项目的 hasSavedCourses 状态
          setSelectedProject(prev => prev ? { ...prev, hasSavedCourses: true } : null);
          // 同步更新 allProjects 中的对应项目状态（避免重新加载整个列表）
          setAllProjects(prev => prev.map(p => 
            p.id === selectedProject.id ? { ...p, hasSavedCourses: true } : p
          ));
        } else {
          toast.warning(`已保存 ${successCount}/${extractedCourses.length} 门课程`);
        }
      } else {
        // 没有课程，更新状态为未保存
        setSelectedProject(prev => prev ? { ...prev, hasSavedCourses: false } : null);
        toast.success('课程安排已清空');
      }
    } catch (error) {
      console.error('保存课程失败:', error);
      toast.error('保存失败，请稍后重试');
    } finally {
      setSavingCourses(false);
    }
  };

  // 移动课程顺序
  const handleMoveCourseUp = (index: number) => {
    if (index === 0) return;
    const updatedCourses = [...extractedCourses];
    [updatedCourses[index - 1], updatedCourses[index]] = [updatedCourses[index], updatedCourses[index - 1]];
    setExtractedCourses(updatedCourses);
  };

  const handleMoveCourseDown = (index: number) => {
    if (index === extractedCourses.length - 1) return;
    const updatedCourses = [...extractedCourses];
    [updatedCourses[index], updatedCourses[index + 1]] = [updatedCourses[index + 1], updatedCourses[index]];
    setExtractedCourses(updatedCourses);
  };

  // 取消AI检查
  const handleCancelFileAiCheck = () => {
    // 设置取消标志
    fileAiCheckCancelledRef.current = true;
    // 清理UI状态
    setFileAiChecking(null);
    toast.info('已取消AI检查');
  };

  // 单文件AI检查函数
  const handleFileAiCheck = async (fileType: string, fileKey: string, fileName: string) => {
    if (!selectedProject || !fileKey) return;
    
    // 重置取消标志
    fileAiCheckCancelledRef.current = false;
    
    setFileAiChecking(fileKey); // 使用fileKey作为唯一标识
    
    // 创建 AbortController 用于超时控制
    const controller = new AbortController();
    
    const timeoutId = setTimeout(() => {
      controller.abort();
      setFileAiChecking(null);
      toast.error('AI检查超时', { description: '请求超过3分钟未响应，请重试' });
    }, 180000); // 3分钟超时
    
    try {
      // 获取 session token
      const sessionToken = typeof window !== 'undefined' ? localStorage.getItem('session_token') : null;
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (sessionToken) {
        headers['Authorization'] = `Bearer ${sessionToken}`;
      }
      
      const res = await fetch('/api/ai/check-file', {
        method: 'POST',
        headers,
        body: JSON.stringify({ 
          projectId: selectedProject.id, 
          fileType,
          fileKey,
          fileName,
        }),
        signal: controller.signal,
      });
      
      if (!res.ok) {
        throw new Error('请求失败');
      }
      
      const reader = res.body?.getReader();
      if (!reader) {
        throw new Error('无法读取响应流');
      }
      
      const decoder = new TextDecoder();
      let buffer = '';
      
      while (true) {
        // 检查是否已取消
        if (fileAiCheckCancelledRef.current) {
          reader.cancel();
          break;
        }
        
        const { done, value } = await reader.read();
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const event = JSON.parse(line.slice(6));
              
              // 再次检查是否已取消
              if (fileAiCheckCancelledRef.current) {
                reader.cancel();
                break;
              }
              
              if (event.type === 'result') {
                clearTimeout(timeoutId);
                const data = event.data;
                setFileAiCheckResult(data);
                setShowAiCheckDialog(true);
                
                if (!data.hasChanges) {
                  toast.success('AI检查完成', { description: '未发现需要更新的数据' });
                } else {
                  toast.info('AI检查完成', { description: `发现 ${data.totalChanges} 条数据需要更新或新增` });
                }
              } else if (event.type === 'error') {
                clearTimeout(timeoutId);
                throw new Error(event.data?.error || 'AI检查失败');
              }
            } catch (parseError) {
              console.error('解析事件失败:', parseError);
            }
          }
        }
      }
    } catch (error) {
      clearTimeout(timeoutId);
      console.error('File AI check error:', error);
      if (error instanceof Error && error.name === 'AbortError') {
        // 用户取消或超时，不显示额外错误提示
      } else {
        toast.error('AI检查失败', { description: error instanceof Error ? error.message : '请稍后重试' });
      }
    } finally {
      clearTimeout(timeoutId);
      setFileAiChecking(null);
    }
  };

  // AI检查函数（流式响应）- 已废弃，保留兼容
  const handleAiCheck = async () => {
    if (!selectedProject) return;
    
    setAiChecking(true);
    setAiCheckProgress(null);
    setAiCheckResult(null);
    
    try {
      // 获取 session token
      const sessionToken = typeof window !== 'undefined' ? localStorage.getItem('session_token') : null;
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (sessionToken) {
        headers['Authorization'] = `Bearer ${sessionToken}`;
      }
      
      const res = await fetch('/api/ai/check-archive', {
        method: 'POST',
        headers,
        body: JSON.stringify({ projectId: selectedProject.id }),
      });
      
      if (!res.ok) {
        throw new Error('请求失败');
      }
      
      const reader = res.body?.getReader();
      if (!reader) {
        throw new Error('无法读取响应流');
      }
      
      const decoder = new TextDecoder();
      let buffer = '';
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const event = JSON.parse(line.slice(6));
              
              if (event.type === 'progress') {
                setAiCheckProgress({
                  current: event.progress,
                  total: event.total,
                  stepName: event.stepName,
                });
              } else if (event.type === 'result') {
                const data = event.data;
                setAiCheckResult(data);
                setShowAiCheckDialog(true);
                
                if (!data.hasChanges) {
                  toast.success('AI检查完成', { description: '未发现需要更新的数据' });
                } else {
                  toast.info('AI检查完成', { description: `发现 ${data.totalChanges} 条数据需要更新或新增` });
                }
              } else if (event.type === 'error') {
                throw new Error(event.data?.error || 'AI检查失败');
              }
            } catch (parseError) {
              console.error('解析事件失败:', parseError);
            }
          }
        }
      }
    } catch (error) {
      console.error('AI check error:', error);
      toast.error('AI检查失败', { description: error instanceof Error ? error.message : '请稍后重试' });
    } finally {
      setAiChecking(false);
      setAiCheckProgress(null);
    }
  };

  // 确认添加/更新数据
  const handleConfirmDataChange = async (type: string, item: AiCheckItem) => {
    try {
      const endpoint = type === 'teachers' ? '/api/teachers' :
                       type === 'venues' ? '/api/venues' :
                       type === 'courseTemplates' ? '/api/course-templates' :
                       type === 'visitSites' ? '/api/visit-sites' : '';
      
      if (!endpoint) {
        toast.error('不支持的数据类型');
        return;
      }
      
      const method = item.action === 'add' ? 'POST' : 'PUT';
      const body = item.action === 'update' 
        ? { ...item.data, id: item.existingId }
        : item.data;
      
      // 获取 session token
      const sessionToken = typeof window !== 'undefined' ? localStorage.getItem('session_token') : null;
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (sessionToken) {
        headers['Authorization'] = `Bearer ${sessionToken}`;
      }
      
      const res = await fetch(endpoint, {
        method,
        headers,
        body: JSON.stringify(body),
      });
      
      if (res.ok) {
        toast.success(item.action === 'add' ? '数据已添加' : '数据已更新');
        
        // 从结果列表中移除已处理的项
        if (aiCheckResult) {
          const newResult = { ...aiCheckResult };
          const targetArray = newResult.checkResult[type as keyof typeof newResult.checkResult];
          if (Array.isArray(targetArray)) {
            (newResult.checkResult[type as keyof typeof newResult.checkResult] as unknown[]) = 
              targetArray.filter((i: unknown) => i !== item);
          }
          const { projectInfo, teachers, venues, courseTemplates, visitSites } = newResult.checkResult;
          newResult.totalChanges = 
            (projectInfo?.length || 0) +
            teachers.length + 
            venues.length + 
            courseTemplates.length + 
            visitSites.length;
          newResult.hasChanges = newResult.totalChanges > 0;
          setAiCheckResult(newResult);
        }
        if (fileAiCheckResult) {
          const newResult = { ...fileAiCheckResult };
          const targetArray = newResult.checkResult[type as keyof typeof newResult.checkResult];
          if (Array.isArray(targetArray)) {
            (newResult.checkResult[type as keyof typeof newResult.checkResult] as unknown[]) = 
              targetArray.filter((i: unknown) => i !== item);
          }
          const { projectInfo, teachers, venues, courseTemplates, visitSites } = newResult.checkResult;
          newResult.totalChanges = 
            (projectInfo?.length || 0) +
            teachers.length + 
            venues.length + 
            courseTemplates.length + 
            visitSites.length;
          newResult.hasChanges = newResult.totalChanges > 0;
          setFileAiCheckResult(newResult);
        }
      } else {
        const errorData = await res.json();
        
        // 处理权限错误
        if (res.status === 403 && errorData.code === 'FORBIDDEN' && errorData.creator) {
          setPermissionErrorDialog({
            isOpen: true,
            error: errorData.error,
            creator: errorData.creator,
            pendingItem: { type, item },
          });
          return;
        }
        
        throw new Error(errorData.error || '操作失败');
      }
    } catch (error) {
      console.error('Confirm data change error:', error);
      toast.error('操作失败', { description: error instanceof Error ? error.message : '请稍后重试' });
    }
  };

  // 发送修改申请
  const handleSendModifyRequest = async () => {
    const { pendingItem, creator } = permissionErrorDialog;
    if (!pendingItem || !creator) return;
    
    try {
      // TODO: 实现发送修改申请的逻辑
      // 这里可以调用API发送通知给创建者
      toast.success('修改申请已发送', { 
        description: `已向 ${creator.name}（${creator.departmentName}）发送修改申请` 
      });
      
      // 从结果列表中移除该项
      handleIgnoreDataChange(pendingItem.type, pendingItem.item);
    } catch (error) {
      console.error('Send modify request error:', error);
      toast.error('发送申请失败', { description: '请稍后重试' });
    } finally {
      setPermissionErrorDialog({
        isOpen: false,
        error: '',
        creator: null,
        pendingItem: null,
      });
    }
  };

  // 忽略权限错误，跳过该项
  const handleIgnorePermissionError = () => {
    const { pendingItem } = permissionErrorDialog;
    if (pendingItem) {
      handleIgnoreDataChange(pendingItem.type, pendingItem.item);
    }
    setPermissionErrorDialog({
      isOpen: false,
      error: '',
      creator: null,
      pendingItem: null,
    });
  };

  // 忽略变更
  const handleIgnoreDataChange = (type: string, item: AiCheckItem) => {
    if (aiCheckResult) {
      const newResult = { ...aiCheckResult };
      const targetArray = newResult.checkResult[type as keyof typeof newResult.checkResult];
      if (Array.isArray(targetArray)) {
        (newResult.checkResult[type as keyof typeof newResult.checkResult] as unknown[]) = 
          targetArray.filter((i: unknown) => i !== item);
      }
      const { projectInfo, teachers, venues, courseTemplates, visitSites } = newResult.checkResult;
      newResult.totalChanges = 
        (projectInfo?.length || 0) +
        teachers.length + 
        venues.length + 
        courseTemplates.length + 
        visitSites.length;
      newResult.hasChanges = newResult.totalChanges > 0;
      setAiCheckResult(newResult);
    }
    if (fileAiCheckResult) {
      const newResult = { ...fileAiCheckResult };
      const targetArray = newResult.checkResult[type as keyof typeof newResult.checkResult];
      if (Array.isArray(targetArray)) {
        (newResult.checkResult[type as keyof typeof newResult.checkResult] as unknown[]) = 
          targetArray.filter((i: unknown) => i !== item);
      }
      const { projectInfo, teachers, venues, courseTemplates, visitSites } = newResult.checkResult;
      newResult.totalChanges = 
        (projectInfo?.length || 0) +
        teachers.length + 
        venues.length + 
        courseTemplates.length + 
        visitSites.length;
      newResult.hasChanges = newResult.totalChanges > 0;
      setFileAiCheckResult(newResult);
    }
    toast.success('已忽略该变更');
  };

  // 切换展开/折叠
  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  // 渲染项目基本信息检查结果
  const renderProjectInfoItems = (items: ProjectInfoItem[]) => {
    if (!items || items.length === 0) return null;
    
    return (
      <div className="border rounded-lg overflow-hidden border-amber-300 bg-amber-50">
        <button
          className="w-full flex items-center justify-between p-3 bg-amber-100 hover:bg-amber-200 transition-colors"
          onClick={() => toggleSection('projectInfo')}
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600" />
            <span className="font-medium text-amber-900">项目基本信息</span>
            <Badge variant="secondary" className="text-xs bg-amber-200 text-amber-800">{items.length}</Badge>
          </div>
          {expandedSections.projectInfo ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
        {expandedSections.projectInfo && (
          <div className="divide-y divide-amber-200">
            {items.map((item, index) => (
              <div key={index} className="p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className="text-xs border-amber-400 text-amber-700">
                        {item.fieldName}
                      </Badge>
                      <span className="text-xs text-amber-600">来源: {item.source}</span>
                    </div>
                    <div className="flex items-center gap-4 text-sm mb-2">
                      <div>
                        <span className="text-gray-500">当前值：</span>
                        <span className={item.currentValue === null || item.currentValue === '未填写' ? 'text-red-500 italic' : 'text-gray-700'}>
                          {item.currentValue ?? '未填写'}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-500">文件值：</span>
                        <span className="font-medium text-green-700">{item.extractedValue}</span>
                      </div>
                    </div>
                    <p className="text-xs text-amber-700">{item.reason}</p>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs text-green-600 border-green-200 hover:bg-green-50"
                      onClick={() => handleConfirmProjectInfo(item)}
                    >
                      <Check className="w-3 h-3 mr-1" />
                      更新
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => handleIgnoreProjectInfo(item)}
                    >
                      <X className="w-3 h-3 mr-1" />
                      忽略
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  // 确认更新项目基本信息
  const handleConfirmProjectInfo = async (item: ProjectInfoItem) => {
    if (!selectedProject) return;
    
    try {
      const updateData: Record<string, unknown> = {};
      updateData[item.field] = typeof item.extractedValue === 'string' && !isNaN(Number(item.extractedValue)) 
        ? Number(item.extractedValue) 
        : item.extractedValue;
      
      // 获取session token
      const sessionToken = typeof window !== 'undefined' ? localStorage.getItem('session_token') : null;
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (sessionToken) {
        headers['Authorization'] = `Bearer ${sessionToken}`;
      }
      
      const res = await fetch(`/api/projects/${selectedProject.id}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(updateData),
      });
      
      if (res.ok) {
        toast.success('项目信息已更新');
        // 更新本地状态
        setSelectedProject(prev => prev ? { ...prev, [item.field]: updateData[item.field] } : null);
        
        // 从结果列表中移除已处理的项
        if (aiCheckResult) {
          const newResult = { ...aiCheckResult };
          newResult.checkResult.projectInfo = newResult.checkResult.projectInfo.filter(i => i !== item);
          const { projectInfo, teachers, venues, courseTemplates, visitSites } = newResult.checkResult;
          newResult.totalChanges = 
            (projectInfo?.length || 0) +
            teachers.length + 
            venues.length + 
            courseTemplates.length + 
            visitSites.length;
          newResult.hasChanges = newResult.totalChanges > 0;
          setAiCheckResult(newResult);
        }
        if (fileAiCheckResult) {
          const newResult = { ...fileAiCheckResult };
          newResult.checkResult.projectInfo = newResult.checkResult.projectInfo.filter(i => i !== item);
          const { projectInfo, teachers, venues, courseTemplates, visitSites } = newResult.checkResult;
          newResult.totalChanges = 
            (projectInfo?.length || 0) +
            teachers.length + 
            venues.length + 
            courseTemplates.length + 
            visitSites.length;
          newResult.hasChanges = newResult.totalChanges > 0;
          setFileAiCheckResult(newResult);
        }
      } else {
        const errorData = await res.json();
        throw new Error(errorData.error || '更新失败');
      }
    } catch (error) {
      console.error('Update project info error:', error);
      toast.error('更新失败', { description: error instanceof Error ? error.message : '请稍后重试' });
    }
  };

  // 忽略项目基本信息变更
  const handleIgnoreProjectInfo = (item: ProjectInfoItem) => {
    if (aiCheckResult) {
      const newResult = { ...aiCheckResult };
      newResult.checkResult.projectInfo = newResult.checkResult.projectInfo.filter(i => i !== item);
      const { projectInfo, teachers, venues, courseTemplates, visitSites } = newResult.checkResult;
      newResult.totalChanges = 
        (projectInfo?.length || 0) +
        teachers.length + 
        venues.length + 
        courseTemplates.length + 
        visitSites.length;
      newResult.hasChanges = newResult.totalChanges > 0;
      setAiCheckResult(newResult);
    }
    if (fileAiCheckResult) {
      const newResult = { ...fileAiCheckResult };
      newResult.checkResult.projectInfo = newResult.checkResult.projectInfo.filter(i => i !== item);
      const { projectInfo, teachers, venues, courseTemplates, visitSites } = newResult.checkResult;
      newResult.totalChanges = 
        (projectInfo?.length || 0) +
        teachers.length + 
        venues.length + 
        courseTemplates.length + 
        visitSites.length;
      newResult.hasChanges = newResult.totalChanges > 0;
      setFileAiCheckResult(newResult);
    }
    toast.success('已忽略该变更');
  };

  // 渲染AI检查结果项
  const renderCheckItems = (type: string, items: AiCheckItem[], icon: React.ReactNode, title: string) => {
    if (!items || items.length === 0) return null;
    
    // 置信度颜色映射
    const getConfidenceBadge = (confidence?: 'high' | 'medium' | 'low') => {
      if (!confidence) return null;
      const config = {
        high: { color: 'bg-green-100 text-green-700 border-green-200', label: '高置信度' },
        medium: { color: 'bg-yellow-100 text-yellow-700 border-yellow-200', label: '中置信度' },
        low: { color: 'bg-gray-100 text-gray-600 border-gray-200', label: '低置信度' },
      };
      return (
        <span className={`text-xs px-1.5 py-0.5 rounded border ${config[confidence].color}`}>
          {config[confidence].label}
        </span>
      );
    };
    
    return (
      <div className="border rounded-lg overflow-hidden">
        <button
          className="w-full flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 transition-colors"
          onClick={() => toggleSection(type)}
        >
          <div className="flex items-center gap-2">
            {icon}
            <span className="font-medium text-gray-900">{title}</span>
            <Badge variant="secondary" className="text-xs">{items.length}</Badge>
          </div>
          {expandedSections[type] ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
        {expandedSections[type] && (
          <div className="divide-y">
            {items.map((item, index) => (
              <div key={index} className="p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <Badge variant={item.action === 'add' ? 'default' : 'outline'} className="text-xs">
                        {item.action === 'add' ? '新增' : '更新'}
                      </Badge>
                      <span className="font-medium text-gray-900">
                        {String(item.data.name || '未命名')}
                      </span>
                      {getConfidenceBadge(item.confidence)}
                    </div>
                    <p className="text-xs text-gray-500 mb-2">{item.reason}</p>
                    {/* 数据来源显示 */}
                    {item.source && (
                      <div className="flex items-center gap-1 text-xs text-blue-600 mb-2">
                        <FileText className="w-3 h-3" />
                        <span>来源：{item.source}</span>
                      </div>
                    )}
                    <div className="text-xs text-gray-600 bg-gray-50 p-2 rounded max-h-20 overflow-y-auto">
                      {Object.entries(item.data).map(([key, value]) => (
                        value && key !== 'name' ? (
                          <span key={key} className="inline-block mr-3">
                            <span className="text-gray-400">{key}:</span> {String(value)}
                          </span>
                        ) : null
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-1 flex-shrink-0 flex-wrap">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs text-green-600 border-green-200 hover:bg-green-50"
                      onClick={() => handleConfirmDataChange(type, item)}
                    >
                      <Check className="w-3 h-3 mr-1" />
                      确认
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => handleIgnoreDataChange(type, item)}
                    >
                      <X className="w-3 h-3 mr-1" />
                      忽略
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  // 渲染第四步：确认下载
  const renderStep4 = () => {
    if (!selectedProject || !summaryReport) return null;
    
    return (
      <div className="space-y-6">
        {/* AI检查状态提示 */}
        {aiCheckResult && (
          <Card className={aiCheckResult.hasChanges ? "border-amber-200 bg-amber-50" : "border-green-200 bg-green-50"}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                {aiCheckResult.hasChanges ? (
                  <>
                    <AlertCircle className="w-5 h-5 text-amber-600" />
                    <div>
                      <span className="text-sm text-amber-700">
                        已完成AI检查，发现 <strong>{aiCheckResult.totalChanges}</strong> 条数据变更建议待处理
                      </span>
                      <Button
                        variant="link"
                        className="h-auto p-0 ml-2 text-amber-700 underline"
                        onClick={() => setShowAiCheckDialog(true)}
                      >
                        查看详情
                      </Button>
                    </div>
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-5 h-5 text-green-600" />
                    <span className="text-sm text-green-700">AI检查已完成，未发现需要更新的数据</span>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>项目总结报告</CardTitle>
            <CardDescription>请确认报告内容，确认后将保存并归档项目</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="max-h-[500px] overflow-y-auto text-sm text-gray-700 whitespace-pre-wrap bg-gray-50 p-4 rounded border">
              {summaryReport}
            </div>
          </CardContent>
        </Card>

        {/* 提取的数据 */}
        {Object.keys(extractedData).length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="w-5 h-5" />
                AI提取的数据
              </CardTitle>
              <CardDescription>以下数据已从材料中提取，将保存到系统</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {Object.entries(extractedData).map(([key, value]) => (
                  value !== null && (
                    <div key={key} className="p-3 bg-gray-50 rounded">
                      <p className="text-xs text-gray-500">{key}</p>
                      <p className="font-medium text-gray-900">{String(value)}</p>
                    </div>
                  )
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* 操作按钮 */}
        <div className="flex justify-between">
          <Button variant="outline" onClick={handlePrevStep}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            返回修改
          </Button>
          <div className="flex gap-3">
            <Button variant="outline" onClick={downloadReport}>
              <FileDown className="w-4 h-4 mr-2" />
              下载报告
            </Button>
            <Button onClick={handleConfirmAndDownload} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  保存中...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  确认并归档
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    );
  };

  // 根据当前步骤渲染内容
  const renderContent = () => {
    switch (currentStep) {
      case 1:
        return renderStep1();
      case 2:
        return renderStep2();
      case 3:
        return renderStep3();
      case 4:
        return renderStep4();
      default:
        return renderStep1();
    }
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* 页面标题 */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">项目总结</h1>
            <p className="text-gray-500 mt-1">材料上传、AI分析、报告生成与项目归档</p>
          </div>
          {currentStep > 1 && (
            <Button variant="outline" onClick={resetState}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              返回列表
            </Button>
          )}
        </div>

        {/* 步骤指示器 */}
        {currentStep > 1 && renderStepIndicator()}

        {/* 内容区域 */}
        {renderContent()}
      </div>
      
      {/* 新建待总结项目对话框 */}
      <Dialog open={showNewProjectDialog} onOpenChange={setShowNewProjectDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5" />
              新建待总结项目
            </DialogTitle>
            <DialogDescription>
              创建一个新的项目用于补录历史项目数据。项目创建后将自动进入材料上传步骤。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">
                项目名称 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="请输入项目名称"
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !creatingProject) {
                    handleCreateNewProject();
                  }
                }}
              />
              <p className="text-xs text-gray-500">
                例如：2024年XX公司班组长能力提升培训
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowNewProjectDialog(false);
                setNewProjectName('');
              }}
            >
              取消
            </Button>
            <Button
              onClick={handleCreateNewProject}
              disabled={creatingProject || !newProjectName.trim()}
            >
              {creatingProject ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  创建中...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-2" />
                  创建项目
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* 文件预览对话框 */}
      <Dialog open={previewDialog.open} onOpenChange={(open) => setPreviewDialog(prev => ({ ...prev, open }))}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="w-5 h-5" />
              文件预览
            </DialogTitle>
            <DialogDescription>
              {previewDialog.fileName}
            </DialogDescription>
          </DialogHeader>
          <div className="overflow-auto" style={{ height: 'calc(90vh - 200px)' }}>
            {previewDialog.url && previewDialog.fileType === 'image' && (
              <img 
                src={previewDialog.url} 
                alt={previewDialog.fileName || ''} 
                className="max-w-full h-auto mx-auto"
              />
            )}
            {previewDialog.url && previewDialog.fileType === 'pdf' && (
              <iframe 
                src={previewDialog.url} 
                className="w-full h-full border-0"
                style={{ minHeight: '500px' }}
              />
            )}
            {previewDialog.url && previewDialog.fileType === 'other' && (
              <div className="flex flex-col items-center justify-center h-64 text-gray-500">
                <FileText className="w-16 h-16 mb-4 text-gray-300" />
                <p className="text-center mb-4">此文件类型不支持在线预览</p>
                <Button onClick={() => previewDialog.url && window.open(previewDialog.url, '_blank')}>
                  <Download className="w-4 h-4 mr-2" />
                  下载文件
                </Button>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewDialog(prev => ({ ...prev, open: false }))}>
              关闭
            </Button>
            {previewDialog.url && (
              <Button onClick={() => {
                if (previewDialog.url) window.open(previewDialog.url, '_blank');
              }}>
                <Download className="w-4 h-4 mr-2" />
                下载文件
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* 覆盖确认对话框 */}
      <Dialog open={overwriteDialog.open} onOpenChange={(open) => {
        if (!open) handleCancelOverwrite();
        else setOverwriteDialog(prev => ({ ...prev, open }));
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-600">
              <AlertCircle className="w-5 h-5" />
              确认覆盖文件
            </DialogTitle>
            <DialogDescription>
              {overwriteDialog.files.length > 1 
                ? `共 ${overwriteDialog.files.length} 个重复文件，当前第 ${overwriteDialog.currentIndex + 1} 个`
                : '该位置已有同名文件，上传新文件将覆盖原有文件。是否继续？'}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-3">
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600">
                即将覆盖：<span className="font-medium text-gray-900">{overwriteDialog.files[overwriteDialog.currentIndex]?.name}</span>
              </p>
            </div>
            {overwriteDialog.files.length > 1 && (
              <div className="text-sm text-gray-500">
                剩余待处理：{overwriteDialog.files.length - overwriteDialog.currentIndex - 1} 个文件
              </div>
            )}
          </div>
          <DialogFooter className="flex gap-2 sm:gap-0">
            <Button variant="outline" onClick={handleCancelOverwrite}>
              全部取消
            </Button>
            {overwriteDialog.files.length > 1 && (
              <Button variant="outline" onClick={handleSkipFile}>
                跳过此文件
              </Button>
            )}
            <Button onClick={handleConfirmOverwrite}>
              确认覆盖
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AI检查结果对话框 */}
      <Dialog open={showAiCheckDialog} onOpenChange={setShowAiCheckDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-blue-600" />
              AI数据检查结果
              {fileAiCheckResult && (
                <Badge variant="outline" className="ml-2 text-xs">
                  {fileAiCheckResult.fileName}
                </Badge>
              )}
            </DialogTitle>
            <DialogDescription>
              {(aiCheckResult || fileAiCheckResult)?.hasChanges 
                ? `发现 ${(aiCheckResult || fileAiCheckResult)?.totalChanges} 条数据变更建议，请确认是否添加或更新`
                : '未发现需要更新的数据'}
            </DialogDescription>
          </DialogHeader>
          <div className="overflow-y-auto" style={{ maxHeight: 'calc(90vh - 200px)' }}>
            {(aiCheckResult || fileAiCheckResult)?.hasChanges ? (
              <div className="space-y-4">
                {renderProjectInfoItems((aiCheckResult || fileAiCheckResult)?.checkResult?.projectInfo || [])}
                {renderCheckItems('teachers', (aiCheckResult || fileAiCheckResult)?.checkResult?.teachers || [], <UserPlus className="w-4 h-4 text-blue-600" />, '讲师信息')}
                {renderCheckItems('venues', (aiCheckResult || fileAiCheckResult)?.checkResult?.venues || [], <MapPin className="w-4 h-4 text-green-600" />, '场地信息')}
                {renderCheckItems('courseTemplates', (aiCheckResult || fileAiCheckResult)?.checkResult?.courseTemplates || [], <BookOpen className="w-4 h-4 text-purple-600" />, '课程模板')}
                {renderCheckItems('visitSites', (aiCheckResult || fileAiCheckResult)?.checkResult?.visitSites || [], <Building2 className="w-4 h-4 text-orange-600" />, '参访基地')}
              </div>
            ) : (
              <div className="text-center py-12">
                <CheckCircle className="w-16 h-16 mx-auto text-green-500 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">数据检查完成</h3>
                <p className="text-gray-500">未发现需要新增或更新的数据，可以直接归档项目</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAiCheckDialog(false)}>
              关闭
            </Button>
            {(aiCheckResult || fileAiCheckResult)?.hasChanges && (
              <Button onClick={() => {
                // 一键确认所有变更
                const currentResult = aiCheckResult || fileAiCheckResult;
                if (!currentResult) return;
                
                const allPromises: Promise<void>[] = [];
                
                // 处理项目基本信息
                currentResult.checkResult.projectInfo.forEach(item => {
                  allPromises.push(
                    new Promise<void>((resolve) => {
                      handleConfirmProjectInfo(item);
                      resolve();
                    })
                  );
                });
                
                // 处理其他数据类型
                const otherTypes = ['teachers', 'venues', 'courseTemplates', 'visitSites'] as const;
                otherTypes.forEach(type => {
                  currentResult.checkResult[type].forEach(item => {
                    allPromises.push(
                      new Promise<void>((resolve) => {
                        handleConfirmDataChange(type, item);
                        resolve();
                      })
                    );
                  });
                });
                Promise.all(allPromises).then(() => {
                  toast.success('所有变更已确认');
                  setShowAiCheckDialog(false);
                });
              }}>
                <Check className="w-4 h-4 mr-2" />
                一键确认所有变更
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 课程安排上传对话框 */}
      <Dialog open={showCourseUploadDialog} onOpenChange={(open) => {
        if (!open) {
          setShowCourseUploadDialog(false);
          setTempCourseFile(null);
        }
      }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5 text-purple-600" />
              上传课程安排表
            </DialogTitle>
            <DialogDescription>
              上传课程安排表文件，系统将智能提取课程信息
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* 拖拽上传区域 */}
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer ${
                tempCourseFile ? 'bg-green-50 border-green-400' : 'hover:bg-gray-50 border-gray-200'
              }`}
              onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                const file = e.dataTransfer.files[0];
                if (file) {
                  const validTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];
                  if (validTypes.includes(file.type) || /\.(pdf|doc|docx|xls|xlsx)$/i.test(file.name)) {
                    setTempCourseFile(file);
                  } else {
                    toast.error('请上传 PDF、Word 或 Excel 格式的文件');
                  }
                }
              }}
              onClick={() => {
                const input = document.getElementById('temp-course-file-input') as HTMLInputElement;
                input?.click();
              }}
            >
              <input
                type="file"
                accept=".pdf,.doc,.docx,.xls,.xlsx"
                className="hidden"
                id="temp-course-file-input"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    setTempCourseFile(file);
                  }
                }}
              />
              {tempCourseFile ? (
                <div className="flex items-center justify-center gap-2">
                  <CheckCircle className="w-8 h-8 text-green-600" />
                  <div className="text-left">
                    <p className="font-medium text-green-700">{tempCourseFile.name}</p>
                    <p className="text-xs text-green-600">{(tempCourseFile.size / 1024).toFixed(1)} KB</p>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center">
                  <FileText className="w-12 h-12 text-gray-400 mb-2" />
                  <p className="text-sm text-gray-600">拖拽文件到此处</p>
                  <p className="text-xs text-gray-400 mt-1">支持 PDF、Word、Excel 格式</p>
                </div>
              )}
            </div>

            {/* 操作按钮 */}
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  const input = document.getElementById('temp-course-file-input') as HTMLInputElement;
                  input?.click();
                }}
                disabled={tempCourseFileUploading || extractingCourses}
              >
                <Upload className="w-4 h-4 mr-2" />
                点击上传文件
              </Button>
              <Button
                className="flex-1"
                disabled={!tempCourseFile || tempCourseFileUploading || extractingCourses}
                onClick={async () => {
                  if (!tempCourseFile || !selectedProject) return;
                  
                  const projectId = selectedProject.id; // 保存项目ID
                  setTempCourseFileUploading(true);
                  try {
                    // 1. 上传文件
                    const formData = new FormData();
                    formData.append('file', tempCourseFile);
                    formData.append('projectId', projectId);
                    formData.append('fileType', 'courseSchedule');

                    const uploadRes = await fetch('/api/upload', {
                      method: 'POST',
                      body: formData,
                    });

                    const uploadData = await uploadRes.json();
                    if (!uploadRes.ok) {
                      throw new Error(uploadData.error || '上传失败');
                    }

                    // 更新项目状态
                    setSelectedProject(prev => prev ? {
                      ...prev,
                      courseScheduleFile: uploadData.fileKey,
                      courseScheduleFileName: uploadData.fileName
                    } : null);

                    // 关闭对话框
                    setShowCourseUploadDialog(false);
                    setTempCourseFile(null);

                    // 2. 开始AI提取
                    setExtractingCourses(true);
                    
                    const sessionToken = localStorage.getItem('session_token');
                    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
                    if (sessionToken) {
                      headers['Authorization'] = `Bearer ${sessionToken}`;
                    }

                    const extractRes = await fetch(`/api/projects/${projectId}/courses/extract`, {
                      method: 'POST',
                      headers,
                      body: JSON.stringify({
                        fileKey: uploadData.fileKey,
                        fileName: uploadData.fileName,
                      }),
                    });

                    // 检查响应是否有效
                    const responseText = await extractRes.text();
                    let extractData;
                    try {
                      extractData = JSON.parse(responseText);
                    } catch {
                      console.error('JSON解析失败:', responseText.substring(0, 200));
                      throw new Error('服务器响应格式错误');
                    }
                    
                    if (extractRes.ok && extractData && extractData.courses && extractData.courses.length > 0) {
                      const coursesWithIds = extractData.courses.map((c: ExtractedCourse, i: number) => ({
                        ...c,
                        id: c.id || `course-${Date.now()}-${i}`,
                      }));
                      setExtractedCourses(coursesWithIds);
                      toast.success(`成功提取 ${coursesWithIds.length} 门课程`);
                    } else {
                      setExtractedCourses([]);
                      if (extractData?.message) {
                        toast.warning(extractData.message);
                      } else {
                        toast.info('未识别到课程信息，请手动添加');
                      }
                    }
                  } catch (error) {
                    console.error('上传或提取失败:', error);
                    toast.error(error instanceof Error ? error.message : '操作失败，请重试');
                    // 出错时关闭对话框
                    setShowCourseUploadDialog(false);
                    setTempCourseFile(null);
                  } finally {
                    setTempCourseFileUploading(false);
                    setExtractingCourses(false);
                  }
                }}
              >
                {tempCourseFileUploading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    上传中...
                  </>
                ) : extractingCourses ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    分析中...
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
        </DialogContent>
      </Dialog>

      {/* 课程编辑对话框 */}
      <Dialog open={editingCourseIndex !== null} onOpenChange={(open) => {
        if (!open) {
          setEditingCourseIndex(null);
          setEditingCourse(null);
        }
      }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingCourse?.type === 'visit' ? '编辑参访活动' : '编辑课程'}
            </DialogTitle>
          </DialogHeader>
          
          {editingCourse && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">第几天</label>
                  <input
                    type="number"
                    min="1"
                    value={editingCourse.day}
                    onChange={(e) => setEditingCourse({ ...editingCourse, day: parseInt(e.target.value) || 1 })}
                    className="w-full px-3 py-2 border rounded-md"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">课时数</label>
                  <input
                    type="number"
                    min="1"
                    max="8"
                    step="0.5"
                    value={editingCourse.duration}
                    onChange={(e) => setEditingCourse({ ...editingCourse, duration: parseFloat(e.target.value) || 2 })}
                    className="w-full px-3 py-2 border rounded-md"
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  {editingCourse.type === 'visit' ? '参访地点' : '课程名称'}
                </label>
                <input
                  type="text"
                  value={editingCourse.name}
                  onChange={(e) => setEditingCourse({ ...editingCourse, name: e.target.value })}
                  placeholder={editingCourse.type === 'visit' ? '请输入参访地点' : '请输入课程名称'}
                  className="w-full px-3 py-2 border rounded-md"
                />
              </div>
              
              {editingCourse.type === 'visit' ? (
                <div className="space-y-2">
                  <label className="text-sm font-medium">参访地址</label>
                  <input
                    type="text"
                    value={editingCourse.visitAddress || ''}
                    onChange={(e) => setEditingCourse({ ...editingCourse, visitAddress: e.target.value })}
                    placeholder="请输入参访地址"
                    className="w-full px-3 py-2 border rounded-md"
                  />
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">讲师姓名</label>
                    <input
                      type="text"
                      value={editingCourse.teacherName || ''}
                      onChange={(e) => setEditingCourse({ ...editingCourse, teacherName: e.target.value })}
                      placeholder="讲师姓名"
                      className="w-full px-3 py-2 border rounded-md"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">讲师职称</label>
                    <input
                      type="text"
                      value={editingCourse.teacherTitle || ''}
                      onChange={(e) => setEditingCourse({ ...editingCourse, teacherTitle: e.target.value })}
                      placeholder="如：教授、副教授"
                      className="w-full px-3 py-2 border rounded-md"
                    />
                  </div>
                </div>
              )}
              
              <div className="space-y-2">
                <label className="text-sm font-medium">课程描述</label>
                <textarea
                  value={editingCourse.description || ''}
                  onChange={(e) => setEditingCourse({ ...editingCourse, description: e.target.value })}
                  placeholder="请输入课程描述或内容概要"
                  rows={3}
                  className="w-full px-3 py-2 border rounded-md"
                />
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setEditingCourseIndex(null);
              setEditingCourse(null);
            }}>
              取消
            </Button>
            <Button onClick={handleSaveEditedCourse}>
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 权限错误对话框 */}
      <Dialog open={permissionErrorDialog.isOpen} onOpenChange={(open) => {
        if (!open) {
          setPermissionErrorDialog(prev => ({ ...prev, isOpen: false }));
        }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-600">
              <AlertCircle className="w-5 h-5" />
              无权限修改
            </DialogTitle>
            <DialogDescription>
              该记录由其他用户创建，您没有权限直接修改
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <p className="text-sm text-amber-800 mb-2">{permissionErrorDialog.error}</p>
              
              {permissionErrorDialog.creator && (
                <div className="mt-3 space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-muted-foreground" />
                    <span className="text-muted-foreground">创建者：</span>
                    <span className="font-medium">{permissionErrorDialog.creator.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-muted-foreground" />
                    <span className="text-muted-foreground">所属部门：</span>
                    <span className="font-medium">{permissionErrorDialog.creator.departmentName}</span>
                  </div>
                </div>
              )}
            </div>
            
            <p className="text-sm text-muted-foreground">
              您可以选择发送修改申请给创建者，或者忽略此项修改。
            </p>
          </div>
          
          <DialogFooter className="flex gap-2 sm:gap-0">
            <Button variant="outline" onClick={handleIgnorePermissionError}>
              <X className="w-4 h-4 mr-2" />
              忽略，跳过此项
            </Button>
            <Button onClick={handleSendModifyRequest}>
              <Send className="w-4 h-4 mr-2" />
              发送修改申请
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
