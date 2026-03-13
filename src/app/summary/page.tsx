'use client';

import { useState, useEffect, useRef } from 'react';
import MainLayout from '@/components/layout/main-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
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
  ClipboardCheck,
  Upload,
  FileText,
  BarChart3,
  Star,
  Archive,
  TrendingUp,
  Users,
  Loader2,
  Plus,
  X,
  Download,
  Trash2,
  CheckCircle,
  AlertCircle,
  Brain,
  Database,
} from 'lucide-react';
import { toast } from 'sonner';

interface Project {
  id: string;
  name: string;
  status: string;
  participantCount: number;
  avgSatisfaction: string | null;
  surveyResponseRate: string | null;
  contractFile: string | null;
  contractFileName: string | null;
  costFile: string | null;
  costFileName: string | null;
  declarationFile: string | null;
  declarationFileName: string | null;
  studentListFile: string | null;
  studentListFileName: string | null;
  otherMaterials: string | null;
  satisfactionSurveyFile: string | null;
  satisfactionSurveyFileName: string | null;
  summaryReport: string | null;
  createdAt: string;
  updatedAt: string;
}

interface FileInfo {
  key: string;
  name: string;
  uploadedAt: string;
  url?: string;
}

const statusMap: Record<string, { label: string; color: string }> = {
  executing: { label: '执行中', color: 'bg-indigo-100 text-indigo-700' },
  completed: { label: '已完成', color: 'bg-emerald-100 text-emerald-700' },
  archived: { label: '已归档', color: 'bg-gray-100 text-gray-500' },
};

export default function SummaryPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [archivedProjects, setArchivedProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<Record<string, unknown> | null>(null);
  const [summaryReport, setSummaryReport] = useState<string | null>(null);
  const [showDataDialog, setShowDataDialog] = useState(false);
  const [dataToImport, setDataToImport] = useState<Record<string, unknown>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    try {
      // 加载待总结项目（执行中、已完成）
      const res = await fetch('/api/projects?status=executing,completed');
      const data = await res.json();
      if (data.data) {
        setProjects(data.data);
      }
      
      // 加载已归档项目
      const archivedRes = await fetch('/api/projects?status=archived');
      const archivedData = await archivedRes.json();
      if (archivedData.data) {
        setArchivedProjects(archivedData.data);
      }
    } catch (error) {
      console.error('Load projects error:', error);
    } finally {
      setLoading(false);
    }
  };

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
        // 更新项目信息
        await loadProjects();
        const updated = projects.find((p) => p.id === selectedProject.id);
        if (updated) {
          setSelectedProject({ ...updated, ...getUpdatedProjectData(fileType, data) });
        }
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
      case 'contract':
        updates.contractFile = data.fileKey;
        updates.contractFileName = data.fileName;
        break;
      case 'cost':
        updates.costFile = data.fileKey;
        updates.costFileName = data.fileName;
        break;
      case 'declaration':
        updates.declarationFile = data.fileKey;
        updates.declarationFileName = data.fileName;
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
        await loadProjects();
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      console.error('Delete error:', error);
      toast.error('删除失败', { description: error instanceof Error ? error.message : '文件删除失败' });
    }
  };

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
        setDataToImport(data.data.extractedData || {});
        toast.success('报告生成成功', { description: 'AI已生成项目总结报告' });
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

  const handleImportData = async () => {
    if (!selectedProject || Object.keys(dataToImport).length === 0) return;

    try {
      const res = await fetch(`/api/projects/${selectedProject.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dataToImport),
      });

      const data = await res.json();
      if (data.data) {
        toast.success('数据补入成功', { description: '已更新项目数据' });
        setShowDataDialog(false);
        await loadProjects();
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      console.error('Import data error:', error);
      toast.error('数据补入失败', { description: error instanceof Error ? error.message : '数据补入失败' });
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
      toast.success('归档成功', { description: '项目已归档' });
      loadProjects();
      setSelectedProject(null);
    } catch (error) {
      console.error('Archive project error:', error);
      toast.error('归档失败', { description: error instanceof Error ? error.message : '项目归档失败' });
    }
  };

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

  const getUploadProgress = (project: Project) => {
    const files = [
      project.contractFile,
      project.costFile,
      project.declarationFile,
      project.studentListFile,
      project.satisfactionSurveyFile,
    ];
    const uploaded = files.filter((f) => f).length;
    return Math.round((uploaded / files.length) * 100);
  };

  const renderFileUploadCard = (
    title: string,
    fileType: string,
    fileName: string | null,
    fileKey: string | null,
    description: string
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
      <p className="text-sm text-gray-500 mb-3">{description}</p>
      {fileName ? (
        <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
          <span className="text-sm text-gray-700 truncate flex-1">{fileName}</span>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => fileKey && getFileUrl(fileKey)}
            >
              <Download className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleFileDelete(fileType)}
            >
              <Trash2 className="w-4 h-4 text-red-500" />
            </Button>
          </div>
        </div>
      ) : (
        <div>
          <input
            type="file"
            accept=".pdf,.doc,.docx,.xls,.xlsx"
            className="hidden"
            id={`file-${fileType}`}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                handleFileUpload(fileType, file);
              }
            }}
          />
          <Button
            variant="outline"
            className="w-full"
            onClick={() => {
              const input = document.getElementById(`file-${fileType}`) as HTMLInputElement;
              input?.click();
            }}
            disabled={uploading === fileType}
          >
            {uploading === fileType ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                上传中...
              </>
            ) : (
              <>
                <Upload className="w-4 h-4 mr-2" />
                上传文件
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* 页面标题 */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">项目总结</h1>
          <p className="text-gray-500 mt-1">材料上传、AI分析、数据补入与项目归档</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 左侧项目列表区域 */}
          <div className="lg:col-span-1 space-y-6">
            {/* 待总结项目列表 */}
            <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>待总结项目</CardTitle>
                  <CardDescription>选择需要总结的项目</CardDescription>
                </div>
                <Button size="sm" onClick={() => window.location.href = '/design'}>
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
                  <p>暂无待总结项目</p>
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
                      onClick={() => {
                        setSelectedProject(project);
                        setAnalysisResult(null);
                        setSummaryReport(project.summaryReport ? JSON.parse(project.summaryReport).report : null);
                      }}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-medium text-gray-900">{project.name}</p>
                          <p className="text-sm text-gray-500 mt-1">
                            {project.participantCount}人参训
                          </p>
                        </div>
                        <Badge className={statusMap[project.status]?.color}>
                          {statusMap[project.status]?.label}
                        </Badge>
                      </div>
                      <div className="mt-2">
                        <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                          <span>材料上传进度</span>
                          <span>{getUploadProgress(project)}%</span>
                        </div>
                        <Progress value={getUploadProgress(project)} className="h-1.5" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* 已归档项目列表 */}
          <Card>
            <CardHeader>
              <CardTitle>已归档项目</CardTitle>
              <CardDescription>点击可查看或补充材料</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-4 text-gray-500">加载中...</div>
              ) : archivedProjects.length === 0 ? (
                <div className="text-center py-6 text-gray-500">
                  <Archive className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                  <p className="text-sm">暂无已归档项目</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {archivedProjects.map((project) => (
                    <div
                      key={project.id}
                      className={`p-3 rounded-lg cursor-pointer transition-colors ${
                        selectedProject?.id === project.id
                          ? 'bg-blue-50 border-2 border-blue-500'
                          : 'bg-gray-50 hover:bg-gray-100'
                      }`}
                      onClick={() => {
                        setSelectedProject(project);
                        setAnalysisResult(null);
                        setSummaryReport(project.summaryReport ? JSON.parse(project.summaryReport).report : null);
                      }}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-900 truncate">{project.name}</p>
                          <p className="text-xs text-gray-500 mt-1">
                            {project.participantCount}人参训
                          </p>
                        </div>
                        <Badge className="bg-gray-100 text-gray-500">
                          已归档
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
          </div>

          {/* 总结内容 */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>项目总结</CardTitle>
              <CardDescription>上传材料、AI分析、数据补入</CardDescription>
            </CardHeader>
            <CardContent>
              {selectedProject ? (
                <Tabs defaultValue="materials">
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="materials">材料上传</TabsTrigger>
                    <TabsTrigger value="analysis">AI分析</TabsTrigger>
                    <TabsTrigger value="archive">归档管理</TabsTrigger>
                  </TabsList>

                  {/* 材料上传 */}
                  <TabsContent value="materials" className="space-y-4">
                    <div className="p-4 bg-blue-50 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <AlertCircle className="w-5 h-5 text-blue-600" />
                        <span className="font-medium text-blue-700">上传说明</span>
                      </div>
                      <p className="text-sm text-gray-600">
                        请上传项目相关材料，支持PDF、Word、Excel格式。AI将分析材料并生成总结报告。
                      </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {renderFileUploadCard(
                        '合同文件',
                        'contract',
                        selectedProject.contractFileName,
                        selectedProject.contractFile,
                        '上传合同扫描件或电子版'
                      )}
                      {renderFileUploadCard(
                        '成本测算表',
                        'cost',
                        selectedProject.costFileName,
                        selectedProject.costFile,
                        '上传成本明细表'
                      )}
                      {renderFileUploadCard(
                        '项目申报书',
                        'declaration',
                        selectedProject.declarationFileName,
                        selectedProject.declarationFile,
                        '上传项目申报材料'
                      )}
                      {renderFileUploadCard(
                        '学员名单',
                        'studentList',
                        selectedProject.studentListFileName,
                        selectedProject.studentListFile,
                        '上传学员名单Excel'
                      )}
                    </div>

                    <Separator />

                    <div>
                      <h4 className="font-medium text-gray-900 mb-3">满意度调查</h4>
                      {renderFileUploadCard(
                        '满意度调查结果',
                        'satisfaction',
                        selectedProject.satisfactionSurveyFileName,
                        selectedProject.satisfactionSurveyFile,
                        '上传满意度调查原始数据'
                      )}
                    </div>

                    <Separator />

                    <div>
                      <h4 className="font-medium text-gray-900 mb-3">其他材料</h4>
                      <div className="space-y-2">
                        {selectedProject.otherMaterials && (
                          <>
                            {(JSON.parse(selectedProject.otherMaterials) as FileInfo[]).map(
                              (file, index) => (
                                <div
                                  key={file.key}
                                  className="flex items-center justify-between p-2 bg-gray-50 rounded"
                                >
                                  <span className="text-sm text-gray-700 truncate flex-1">
                                    {file.name}
                                  </span>
                                  <div className="flex items-center gap-2">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => getFileUrl(file.key)}
                                    >
                                      <Download className="w-4 h-4" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleFileDelete('other', index)}
                                    >
                                      <Trash2 className="w-4 h-4 text-red-500" />
                                    </Button>
                                  </div>
                                </div>
                              )
                            )}
                          </>
                        )}
                        <div>
                          <input
                            type="file"
                            accept=".pdf,.doc,.docx,.xls,.xlsx"
                            className="hidden"
                            id="file-other"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                handleFileUpload('other', file);
                              }
                            }}
                          />
                          <Button
                            variant="outline"
                            className="w-full"
                            onClick={() => {
                              const input = document.getElementById('file-other') as HTMLInputElement;
                              input?.click();
                            }}
                            disabled={uploading === 'other'}
                          >
                            {uploading === 'other' ? (
                              <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                上传中...
                              </>
                            ) : (
                              <>
                                <Plus className="w-4 h-4 mr-2" />
                                添加其他材料
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                    </div>
                  </TabsContent>

                  {/* AI分析 */}
                  <TabsContent value="analysis" className="space-y-4">
                    {summaryReport ? (
                      <div className="space-y-4">
                        <div className="p-4 bg-green-50 rounded-lg">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <CheckCircle className="w-5 h-5 text-green-600" />
                              <span className="font-medium text-green-700">报告已生成</span>
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                navigator.clipboard.writeText(summaryReport);
                                toast.success('已复制到剪贴板');
                              }}
                            >
                              复制报告
                            </Button>
                          </div>
                        </div>

                        <div className="p-4 border rounded-lg">
                          <h5 className="font-medium text-gray-900 mb-3">项目总结报告</h5>
                          <div className="text-sm text-gray-700 whitespace-pre-wrap">
                            {summaryReport}
                          </div>
                        </div>

                        {Object.keys(dataToImport).length > 0 && (
                          <div className="p-4 bg-blue-50 rounded-lg">
                            <div className="flex items-center gap-2 mb-3">
                              <Database className="w-5 h-5 text-blue-600" />
                              <span className="font-medium text-blue-700">
                                AI提取的数据（可补入系统）
                              </span>
                            </div>
                            <div className="space-y-2 text-sm">
                              {Object.entries(dataToImport).map(([key, value]) => (
                                <div key={key} className="flex items-center justify-between p-2 bg-white rounded">
                                  <span className="text-gray-600">{key}</span>
                                  <span className="font-medium text-gray-900">
                                    {value !== null ? String(value) : '-'}
                                  </span>
                                </div>
                              ))}
                            </div>
                            <Button
                              className="w-full mt-3"
                              onClick={() => setShowDataDialog(true)}
                            >
                              <Database className="w-4 h-4 mr-2" />
                              确认补入数据
                            </Button>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-center py-12">
                        <Brain className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                        <p className="text-gray-500 mb-2">点击下方按钮生成项目总结报告</p>
                        <p className="text-sm text-gray-400 mb-4">
                          AI将分析上传的材料，提取关键数据并生成报告
                        </p>
                        <Button
                          onClick={handleGenerateSummary}
                          disabled={analyzing || getUploadProgress(selectedProject) === 0}
                        >
                          {analyzing ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              AI分析中...
                            </>
                          ) : (
                            <>
                              <Brain className="w-4 h-4 mr-2" />
                              生成总结报告
                            </>
                          )}
                        </Button>
                        {getUploadProgress(selectedProject) === 0 && (
                          <p className="text-xs text-red-500 mt-2">
                            请先上传至少一份材料
                          </p>
                        )}
                      </div>
                    )}
                  </TabsContent>

                  {/* 归档管理 */}
                  <TabsContent value="archive" className="space-y-4">
                    <div className="p-6 bg-gray-50 rounded-lg">
                      <h4 className="font-medium text-gray-900 mb-4">归档清单</h4>
                      <div className="space-y-2">
                        {[
                          { name: '项目申报表', status: selectedProject.declarationFile ? '已上传' : '待上传' },
                          { name: '培训方案', status: '已生成' },
                          { name: '成本测算表', status: selectedProject.costFile ? '已上传' : '待上传' },
                          { name: '合同文件', status: selectedProject.contractFile ? '已上传' : '待上传' },
                          { name: '学员名单', status: selectedProject.studentListFile ? '已上传' : '待上传' },
                          { name: '满意度调查结果', status: selectedProject.satisfactionSurveyFile ? '已上传' : '待上传' },
                          { name: '项目总结报告', status: summaryReport ? '已生成' : '待生成' },
                        ].map((doc) => (
                          <div
                            key={doc.name}
                            className="flex items-center justify-between p-3 bg-white rounded"
                          >
                            <span className="text-sm text-gray-700">{doc.name}</span>
                            <Badge
                              variant={doc.status.includes('已') ? 'default' : 'outline'}
                            >
                              {doc.status}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="flex justify-end gap-3">
                      <Button variant="outline">导出归档包</Button>
                      <Button
                        onClick={handleArchiveProject}
                        disabled={!summaryReport}
                      >
                        <Archive className="w-4 h-4 mr-2" />
                        归档项目
                      </Button>
                    </div>
                    {!summaryReport && (
                      <p className="text-xs text-red-500 text-right">
                        请先生成项目总结报告
                      </p>
                    )}
                  </TabsContent>
                </Tabs>
              ) : (
                <div className="text-center py-12 text-gray-500">
                  <ClipboardCheck className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                  <p>请从左侧选择一个项目开始总结</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* 数据补入确认对话框 */}
      <Dialog open={showDataDialog} onOpenChange={setShowDataDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认数据补入</DialogTitle>
            <DialogDescription>
              以下数据将被更新到项目中，请确认是否继续
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 max-h-64 overflow-y-auto">
            {Object.entries(dataToImport).map(([key, value]) => (
              <div key={key} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                <span className="text-gray-600">{key}</span>
                <span className="font-medium text-gray-900">
                  {value !== null ? String(value) : '-'}
                </span>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDataDialog(false)}>
              取消
            </Button>
            <Button onClick={handleImportData}>
              <Database className="w-4 h-4 mr-2" />
              确认补入
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
