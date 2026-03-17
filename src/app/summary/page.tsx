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
  
  // 覆盖确认状态
  const [overwriteDialog, setOverwriteDialog] = useState<{
    open: boolean;
    fileType: string | null;
    file: File | null;
  }>({ open: false, fileType: null, file: null });
  
  // 待上传文件（用于覆盖确认后继续上传）
  const pendingFileRef = useRef<{ fileType: string; file: File } | null>(null);

  // 加载项目列表
  const loadProjects = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/projects');
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
    
    return {
      executingProjects,
      completedProjects,
      archivedProjects,
      // 待总结 = 执行中 + 已完成待归档
      pendingProjects: [...executingProjects, ...completedProjects],
    };
  }, [allProjects, timeFilter, searchKeyword]);

  // 列表显示限制（最多8个）
  const MAX_DISPLAY_COUNT = 8;
  
  // 统计数据
  const stats = useMemo(() => ({
    executing: categorizedProjects.executingProjects.length,
    completed: categorizedProjects.completedProjects.length,
    archived: categorizedProjects.archivedProjects.length,
  }), [categorizedProjects]);

  // 选择项目并进入下一步
  const handleSelectProject = (project: Project) => {
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
    setCurrentStep(2);
  };

  // 计算上传进度
  const getUploadProgress = (project: Project) => {
    const { requirements } = checkArchiveRequirements(project);
    const uploaded = requirements.filter(r => r.uploaded).length;
    return Math.round((uploaded / requirements.length) * 100);
  };
  
  // 检查文件是否已存在
  const checkFileExists = (fileType: string): boolean => {
    if (!selectedProject) return false;
    if (fileType === 'other') return false; // 其它附件不检查，允许多个
    
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
    if (checkFileExists(fileType)) {
      // 显示覆盖确认对话框
      pendingFileRef.current = { fileType, file };
      setOverwriteDialog({ open: true, fileType, file });
    } else {
      // 直接上传
      handleFileUpload(fileType, file);
    }
  };
  
  // 确认覆盖后上传
  const handleConfirmOverwrite = () => {
    if (pendingFileRef.current) {
      handleFileUpload(pendingFileRef.current.fileType, pendingFileRef.current.file);
      pendingFileRef.current = null;
    }
    setOverwriteDialog({ open: false, fileType: null, file: null });
  };
  
  // 取消覆盖
  const handleCancelOverwrite = () => {
    pendingFileRef.current = null;
    setOverwriteDialog({ open: false, fileType: null, file: null });
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
          materials.push({ key: data.fileKey, name: data.fileName, uploadedAt: new Date().toISOString() });
          setSelectedProject(prev => prev ? { ...prev, otherMaterials: JSON.stringify(materials) } : null);
        } else {
          // 其他类型：直接更新字段
          const updates = getUpdatedProjectData(fileType, data);
          setSelectedProject(prev => prev ? { ...prev, ...updates } : null);
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
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      // 根据文件类型校验
      if (fileType.endsWith('Pdf') && !file.name.toLowerCase().endsWith('.pdf')) {
        toast.error('文件格式错误', { description: '请上传PDF格式文件' });
        return;
      }
      if (fileType.endsWith('Word') && !/\.(doc|docx)$/i.test(file.name)) {
        toast.error('文件格式错误', { description: '请上传Word格式文件' });
        return;
      }
      handleFileSelect(fileType, file);
    }
  };

  // AI分析生成报告
  const handleGenerateSummary = async () => {
    if (!selectedProject) return;

    setAnalyzing(true);
    try {
      const res = await fetch('/api/ai/summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
      // 更新项目状态为已归档
      const res = await fetch(`/api/projects/${selectedProject.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
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
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
    secondFileFormat: 'word' | 'excel' = 'word'  // 默认Word，可选Excel
  ) => {
    // 根据文件格式确定参数
    const secondAccept = secondFileFormat === 'excel' ? '.xls,.xlsx' : '.doc,.docx';
    const secondLabel = secondFileFormat === 'excel' ? 'Excel版本' : 'Word版本';
    const secondUploadedLabel = secondFileFormat === 'excel' ? 'Excel已上传' : 'Word已上传';
    
    return (
    <div className="p-4 border rounded-lg">
      <div className="flex items-center gap-2 mb-2">
        <FileText className="w-4 h-4 text-gray-500" />
        <span className="font-medium text-gray-900">{title}</span>
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
    accept: string = '.pdf,.doc,.docx,.xls,.xlsx'
  ) => (
    <div className="p-4 border rounded-lg">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-gray-500" />
          <span className="font-medium text-gray-900">{title}</span>
        </div>
        {fileName && (
          <Badge variant="default" className="bg-green-100 text-green-700">
            <CheckCircle className="w-3 h-3 mr-1" />
            已上传
          </Badge>
        )}
      </div>
      <p className="text-xs text-gray-500 mb-3">{description}</p>
      
      {fileName ? (
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
              onClick={() => fileKey && handlePreview(fileKey, fileName)}
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
              {/* 执行中项目 */}
              {categorizedProjects.executingProjects.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                    <PlayCircle className="w-4 h-4 text-indigo-600" />
                    执行中待总结
                    <Badge variant="secondary" className="text-xs">{categorizedProjects.executingProjects.length}</Badge>
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                    {/* 新建项目卡片 - 放在执行中项目列表第一位 */}
                    <Card
                      className="cursor-pointer border-2 border-dashed hover:border-indigo-400 hover:bg-indigo-50/50 transition-all"
                      onClick={() => setShowNewProjectDialog(true)}
                    >
                      <CardContent className="p-3 flex flex-col items-center justify-center min-h-[100px]">
                        <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center mb-2">
                          <Plus className="w-5 h-5 text-indigo-600" />
                        </div>
                        <p className="font-medium text-gray-700 text-sm">新建项目</p>
                        <p className="text-xs text-gray-400">补录历史项目</p>
                      </CardContent>
                    </Card>
                    {categorizedProjects.executingProjects.slice(0, MAX_DISPLAY_COUNT).map((project) => (
                      <Card
                        key={project.id}
                        className="cursor-pointer hover:border-indigo-500 hover:shadow-md transition-all"
                        onClick={() => handleSelectProject(project)}
                      >
                        <CardContent className="p-3">
                          <div className="flex items-start justify-between mb-1.5">
                            <h5 className="font-medium text-gray-900 text-sm line-clamp-1">{project.name}</h5>
                            <Badge className="bg-indigo-100 text-indigo-700 text-xs">执行中</Badge>
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
                    ))}
                  </div>
                  {categorizedProjects.executingProjects.length > MAX_DISPLAY_COUNT && (
                    <p className="text-xs text-gray-500 text-center mt-2">
                      还有 {categorizedProjects.executingProjects.length - MAX_DISPLAY_COUNT} 个执行中项目未显示
                    </p>
                  )}
                </div>
              )}
              
              {/* 已完成项目 */}
              {categorizedProjects.completedProjects.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                    <FileCheck className="w-4 h-4 text-emerald-600" />
                    已完成待归档
                    <Badge variant="secondary" className="text-xs">{categorizedProjects.completedProjects.length}</Badge>
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                    {categorizedProjects.completedProjects.slice(0, MAX_DISPLAY_COUNT).map((project) => {
                      const { isComplete } = checkArchiveRequirements(project);
                      return (
                        <Card
                          key={project.id}
                          className={`cursor-pointer hover:shadow-md transition-all ${isComplete ? 'hover:border-emerald-500' : 'border-orange-300 bg-orange-50'}`}
                          onClick={() => handleSelectProject(project)}
                        >
                          <CardContent className="p-3">
                            <div className="flex items-start justify-between mb-1.5">
                              <h5 className="font-medium text-gray-900 text-sm line-clamp-1">{project.name}</h5>
                              <Badge className={isComplete ? 'bg-emerald-100 text-emerald-700 text-xs' : 'bg-orange-100 text-orange-600 text-xs'}>
                                {isComplete ? '可归档' : '待上传'}
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
                  {categorizedProjects.completedProjects.length > MAX_DISPLAY_COUNT && (
                    <p className="text-xs text-gray-500 text-center mt-2">
                      还有 {categorizedProjects.completedProjects.length - MAX_DISPLAY_COUNT} 个已完成项目未显示
                    </p>
                  )}
                </div>
              )}
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {categorizedProjects.archivedProjects.slice(0, MAX_DISPLAY_COUNT).map((project) => (
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
          )}
          {categorizedProjects.archivedProjects.length > MAX_DISPLAY_COUNT && (
            <p className="text-xs text-gray-500 text-center mt-2">
              还有 {categorizedProjects.archivedProjects.length - MAX_DISPLAY_COUNT} 个已归档项目未显示
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );

  // 取消归档（将项目状态改回 completed）
  const handleUnarchive = async (project: Project) => {
    try {
      const res = await fetch(`/api/projects/${project.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
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

        {/* 必须上传的材料 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {renderDualFileUpload(
            '合同文件 *',
            'contractPdf',
            selectedProject.contractFileNamePdf,
            selectedProject.contractFilePdf,
            'contractWord',
            selectedProject.contractFileNameWord,
            selectedProject.contractFileWord,
            '上传合同扫描件或电子版（需PDF和Word两个版本）'
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
            'excel'  // 指定第二个文件类型为Excel
          )}
          {renderDualFileUpload(
            '项目申报书 *',
            'declarationPdf',
            selectedProject.declarationFileNamePdf,
            selectedProject.declarationFilePdf,
            'declarationWord',
            selectedProject.declarationFileNameWord,
            selectedProject.declarationFileWord,
            '上传项目申报材料（需PDF和Word两个版本）'
          )}
        </div>

        {/* 其他材料 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {renderSingleFileUpload(
            '学员名单 *',
            'studentList',
            selectedProject.studentListFileName,
            selectedProject.studentListFile,
            '上传学员名单Excel文件',
            '.xls,.xlsx'
          )}
          {renderSingleFileUpload(
            '满意度调查结果',
            'satisfaction',
            selectedProject.satisfactionSurveyFileName,
            selectedProject.satisfactionSurveyFile,
            '上传满意度调查原始数据（非必传）'
          )}
        </div>

        {/* 会签单（必须，只支持PDF） */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {renderSingleFileUpload(
            '会签单 *',
            'countersign',
            selectedProject.countersignFileName,
            selectedProject.countersignFile,
            '上传会签单PDF文件（必传）',
            '.pdf'
          )}
        </div>

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

  // 渲染第四步：确认下载
  const renderStep4 = () => {
    if (!selectedProject || !summaryReport) return null;
    
    return (
      <div className="space-y-6">
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
      <Dialog open={overwriteDialog.open} onOpenChange={(open) => setOverwriteDialog(prev => ({ ...prev, open }))}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-600">
              <AlertCircle className="w-5 h-5" />
              确认覆盖文件
            </DialogTitle>
            <DialogDescription>
              该位置已有文件，上传新文件将覆盖原有文件。是否继续？
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-gray-600">
              即将上传：<span className="font-medium">{overwriteDialog.file?.name}</span>
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleCancelOverwrite}>
              取消
            </Button>
            <Button onClick={handleConfirmOverwrite}>
              确认覆盖
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
