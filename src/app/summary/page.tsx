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
  // 成本测算表（PDF和Word）
  costFilePdf: string | null;
  costFileNamePdf: string | null;
  costFileWord: string | null;
  costFileNameWord: string | null;
  // 项目申报书（PDF和Word）
  declarationFilePdf: string | null;
  declarationFileNamePdf: string | null;
  declarationFileWord: string | null;
  declarationFileNameWord: string | null;
  // 学员名单
  studentListFile: string | null;
  studentListFileName: string | null;
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
  const checkArchiveRequirements = (project: Project) => {
    const requirements = [
      {
        name: '合同文件',
        uploaded: !!(project.contractFilePdf || project.contractFileWord),
        required: true,
      },
      {
        name: '成本测算表',
        uploaded: !!(project.costFilePdf || project.costFileWord),
        required: true,
      },
      {
        name: '项目申报书',
        uploaded: !!(project.declarationFilePdf || project.declarationFileWord),
        required: true,
      },
      {
        name: '学员名单',
        uploaded: !!project.studentListFile,
        required: true,
      },
      {
        name: '满意度调查结果',
        uploaded: !!project.satisfactionSurveyFile,
        required: true,
      },
    ];
    
    const missingFiles = requirements.filter(r => r.required && !r.uploaded);
    const isComplete = missingFiles.length === 0;
    
    return { isComplete, missingFiles, requirements };
  };

  // 分类项目
  const categorizedProjects = useMemo(() => {
    const filtered = filterByTime(allProjects, timeFilter);
    
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
  }, [allProjects, timeFilter]);

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
        setSelectedProject(prev => prev ? { ...prev, ...getUpdatedProjectData(fileType, data) } : null);
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
      case 'costWord':
        updates.costFileWord = data.fileKey;
        updates.costFileNameWord = data.fileName;
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
    }
    return updates;
  };

  // 文件删除
  const handleFileDelete = async (fileType: string, fileIndex?: number) => {
    if (!selectedProject) return;

    try {
      const res = await fetch('/api/upload', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: selectedProject.id,
          fileType,
          fileIndex,
        }),
      });

      const data = await res.json();
      if (data.success) {
        toast.success('删除成功', { description: '文件已删除' });
        // 更新本地状态
        if (fileType === 'other' && fileIndex !== undefined) {
          const materials = selectedProject.otherMaterials ? JSON.parse(selectedProject.otherMaterials) : [];
          materials.splice(fileIndex, 1);
          setSelectedProject(prev => prev ? { ...prev, otherMaterials: materials.length > 0 ? JSON.stringify(materials) : null } : null);
        } else {
          const updates: Record<string, null> = {};
          updates[`${fileType}Pdf`] = null;
          updates[`${fileType}FileNamePdf`] = null;
          // 实际需要根据fileType映射
          setSelectedProject(prev => prev ? { ...prev, ...getDeleteUpdate(fileType) } : null);
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
      costWord: ['costFileWord', 'costFileNameWord'],
      declarationPdf: ['declarationFilePdf', 'declarationFileNamePdf'],
      declarationWord: ['declarationFileWord', 'declarationFileNameWord'],
      studentList: ['studentListFile', 'studentListFileName'],
      satisfaction: ['satisfactionSurveyFile', 'satisfactionSurveyFileName'],
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
      handleFileUpload(fileType, file);
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
    wordFileType: string,
    wordFileName: string | null,
    wordFileKey: string | null,
    description: string
  ) => (
    <div className="p-4 border rounded-lg">
      <div className="flex items-center gap-2 mb-2">
        <FileText className="w-4 h-4 text-gray-500" />
        <span className="font-medium text-gray-900">{title}</span>
      </div>
      <p className="text-xs text-gray-500 mb-4">{description}</p>
      
      <div className="grid grid-cols-2 gap-3">
        {/* PDF版本 */}
        <div
          className={`border-2 border-dashed rounded-lg p-3 text-center transition-colors cursor-pointer ${
            dragActive === pdfFileType ? 'bg-blue-50 border-blue-400' :
            uploading === pdfFileType ? 'bg-blue-50 border-blue-300' : 
            pdfFileName ? 'bg-green-50 border-green-300' : 'hover:bg-gray-50 border-gray-200'
          }`}
          onDragOver={(e) => handleDragOver(e, pdfFileType)}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, pdfFileType)}
          onClick={() => {
            if (!pdfFileName && uploading !== pdfFileType) {
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
              if (file) handleFileUpload(pdfFileType, file);
            }}
          />
          {pdfFileName ? (
            <div className="space-y-1">
              <CheckCircle className="w-5 h-5 mx-auto text-green-500" />
              <p className="text-xs text-green-600 font-medium">PDF已上传</p>
              <p className="text-xs text-gray-500 truncate">{pdfFileName}</p>
              <div className="flex justify-center gap-1">
                <Button variant="ghost" size="sm" className="h-6 px-2" onClick={(e) => { e.stopPropagation(); pdfFileKey && getFileUrl(pdfFileKey); }}>
                  <Download className="w-3 h-3" />
                </Button>
                <Button variant="ghost" size="sm" className="h-6 px-2" onClick={(e) => { e.stopPropagation(); handleFileDelete(pdfFileType); }}>
                  <Trash2 className="w-3 h-3 text-red-500" />
                </Button>
              </div>
            </div>
          ) : uploading === pdfFileType ? (
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

        {/* Word版本 */}
        <div
          className={`border-2 border-dashed rounded-lg p-3 text-center transition-colors cursor-pointer ${
            dragActive === wordFileType ? 'bg-blue-50 border-blue-400' :
            uploading === wordFileType ? 'bg-blue-50 border-blue-300' :
            wordFileName ? 'bg-green-50 border-green-300' : 'hover:bg-gray-50 border-gray-200'
          }`}
          onDragOver={(e) => handleDragOver(e, wordFileType)}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, wordFileType)}
          onClick={() => {
            if (!wordFileName && uploading !== wordFileType) {
              const input = document.getElementById(`file-${wordFileType}`) as HTMLInputElement;
              input?.click();
            }
          }}
        >
          <input
            type="file"
            accept=".doc,.docx"
            className="hidden"
            id={`file-${wordFileType}`}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFileUpload(wordFileType, file);
            }}
          />
          {wordFileName ? (
            <div className="space-y-1">
              <CheckCircle className="w-5 h-5 mx-auto text-green-500" />
              <p className="text-xs text-green-600 font-medium">Word已上传</p>
              <p className="text-xs text-gray-500 truncate">{wordFileName}</p>
              <div className="flex justify-center gap-1">
                <Button variant="ghost" size="sm" className="h-6 px-2" onClick={(e) => { e.stopPropagation(); wordFileKey && getFileUrl(wordFileKey); }}>
                  <Download className="w-3 h-3" />
                </Button>
                <Button variant="ghost" size="sm" className="h-6 px-2" onClick={(e) => { e.stopPropagation(); handleFileDelete(wordFileType); }}>
                  <Trash2 className="w-3 h-3 text-red-500" />
                </Button>
              </div>
            </div>
          ) : uploading === wordFileType ? (
            <div className="py-2">
              <Loader2 className="w-5 h-5 mx-auto animate-spin text-blue-500" />
              <p className="text-xs text-blue-500 mt-1">上传中...</p>
            </div>
          ) : (
            <div className="py-2">
              <Upload className="w-5 h-5 mx-auto text-gray-400" />
              <p className="text-xs text-gray-500 mt-1">Word版本</p>
              <p className="text-[10px] text-gray-400">点击或拖放</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );

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
        <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
          <span className="text-sm text-gray-700 truncate flex-1">{fileName}</span>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={() => fileKey && getFileUrl(fileKey)}>
              <Download className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => handleFileDelete(fileType)}>
              <Trash2 className="w-4 h-4 text-red-500" />
            </Button>
          </div>
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
              if (file) handleFileUpload(fileType, file);
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
                    {categorizedProjects.executingProjects.map((project) => (
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
                    {categorizedProjects.completedProjects.map((project) => {
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
              {categorizedProjects.archivedProjects.map((project) => (
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
            合同文件、成本测算表、项目申报书需同时上传PDF和Word两个版本。支持拖放上传。
            上传的材料将自动保存。
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
            '合同文件',
            'contractPdf',
            selectedProject.contractFileNamePdf,
            selectedProject.contractFilePdf,
            'contractWord',
            selectedProject.contractFileNameWord,
            selectedProject.contractFileWord,
            '上传合同扫描件或电子版（需PDF和Word两个版本）'
          )}
          {renderDualFileUpload(
            '成本测算表',
            'costPdf',
            selectedProject.costFileNamePdf,
            selectedProject.costFilePdf,
            'costWord',
            selectedProject.costFileNameWord,
            selectedProject.costFileWord,
            '上传成本明细表（需PDF和Word两个版本）'
          )}
          {renderDualFileUpload(
            '项目申报书',
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
            '学员名单',
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
            '上传满意度调查原始数据'
          )}
        </div>

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
    </MainLayout>
  );
}
