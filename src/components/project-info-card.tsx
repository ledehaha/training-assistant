'use client';

import { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  FileText,
  Download,
  ExternalLink,
  Calendar,
  Users,
  Clock,
  MapPin,
  BookOpen,
  User,
  Building2,
  Loader2,
  FolderOpen,
  File,
  Eye,
} from 'lucide-react';
import { toast } from 'sonner';

interface ProjectInfoCardProps {
  projectId: string | null;
  onClose?: () => void;
}

interface ProjectDetail {
  id: string;
  name: string;
  status: string;
  trainingTarget?: string;
  targetAudience?: string;
  participantCount?: number;
  trainingDays?: number;
  trainingHours?: number;
  startDate?: string;
  endDate?: string;
  totalBudget?: number;
  avgSatisfaction?: number;
  // 文件字段
  contractFilePdf?: string;
  contractFileNamePdf?: string;
  contractFileWord?: string;
  contractFileNameWord?: string;
  costFilePdf?: string;
  costFileNamePdf?: string;
  costFileExcel?: string;
  costFileNameExcel?: string;
  declarationFilePdf?: string;
  declarationFileNamePdf?: string;
  declarationFileWord?: string;
  declarationFileNameWord?: string;
  studentListFile?: string;
  studentListFileName?: string;
  courseScheduleFile?: string;
  courseScheduleFileName?: string;
  countersignFile?: string;
  countersignFileName?: string;
  satisfactionSurveyFile?: string;
  satisfactionSurveyFileName?: string;
  summaryReport?: string;
  createdAt: string;
}

interface Course {
  id: string;
  name: string;
  type: string;
  day?: number;
  startTime?: string;
  endTime?: string;
  duration?: number;
  teacherName?: string;
  teacherTitle?: string;
  venueName?: string;
  visitSiteName?: string;
  description?: string;
}

// 状态映射
const statusMap: Record<string, { label: string; color: string }> = {
  draft: { label: '草稿', color: 'bg-gray-100 text-gray-700' },
  designing: { label: '设计中', color: 'bg-blue-100 text-blue-700' },
  executing: { label: '执行中', color: 'bg-indigo-100 text-indigo-700' },
  completed: { label: '已完成', color: 'bg-emerald-100 text-emerald-700' },
  archived: { label: '已归档', color: 'bg-gray-100 text-gray-500' },
};

// 课程类型映射
const courseTypeMap: Record<string, { label: string; color: string }> = {
  course: { label: '课程', color: 'bg-blue-100 text-blue-700' },
  visit: { label: '参访', color: 'bg-green-100 text-green-700' },
  break: { label: '休息', color: 'bg-gray-100 text-gray-600' },
  other: { label: '其他', color: 'bg-orange-100 text-orange-700' },
};

// 检查文件是否是有效的上传文件
const isValidFile = (fileKey: string | undefined): boolean => {
  if (!fileKey || typeof fileKey !== 'string') return false;
  return fileKey.startsWith('projects/');
};

export default function ProjectInfoCard({ projectId, onClose }: ProjectInfoCardProps) {
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('files');

  useEffect(() => {
    if (projectId) {
      loadProjectDetail();
    }
  }, [projectId]);

  const loadProjectDetail = async () => {
    if (!projectId) return;
    
    setLoading(true);
    try {
      const sessionToken = localStorage.getItem('session_token');
      const headers: Record<string, string> = {};
      if (sessionToken) {
        headers['Authorization'] = `Bearer ${sessionToken}`;
      }

      // 加载项目详情
      const projectRes = await fetch(`/api/projects/${projectId}`, { headers });
      const projectData = await projectRes.json();
      if (projectData.data) {
        setProject(projectData.data);
      }

      // 加载课程安排
      const coursesRes = await fetch(`/api/projects/${projectId}/courses`, { headers });
      const coursesData = await coursesRes.json();
      if (coursesData.data) {
        setCourses(coursesData.data);
      }
    } catch (error) {
      console.error('Load project detail error:', error);
      toast.error('加载项目详情失败');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadFile = async (fileKey: string, fileName: string) => {
    try {
      const res = await fetch(`/api/upload?fileKey=${encodeURIComponent(fileKey)}`);
      const data = await res.json();
      if (data.url) {
        window.open(data.url, '_blank');
      }
    } catch (error) {
      toast.error('获取文件链接失败');
    }
  };

  // 文件列表
  const getFiles = (): { name: string; key: string; type: string }[] => {
    if (!project) return [];
    
    const files: { name: string; key: string; type: string }[] = [];
    
    // 合同文件
    if (isValidFile(project.contractFilePdf)) {
      files.push({ name: project.contractFileNamePdf || '合同文件.pdf', key: project.contractFilePdf!, type: '合同' });
    }
    if (isValidFile(project.contractFileWord)) {
      files.push({ name: project.contractFileNameWord || '合同文件.docx', key: project.contractFileWord!, type: '合同' });
    }
    
    // 成本测算表
    if (isValidFile(project.costFilePdf)) {
      files.push({ name: project.costFileNamePdf || '成本测算表.pdf', key: project.costFilePdf!, type: '成本测算' });
    }
    if (isValidFile(project.costFileExcel)) {
      files.push({ name: project.costFileNameExcel || '成本测算表.xlsx', key: project.costFileExcel!, type: '成本测算' });
    }
    
    // 项目申报书
    if (isValidFile(project.declarationFilePdf)) {
      files.push({ name: project.declarationFileNamePdf || '项目申报书.pdf', key: project.declarationFilePdf!, type: '申报书' });
    }
    if (isValidFile(project.declarationFileWord)) {
      files.push({ name: project.declarationFileNameWord || '项目申报书.docx', key: project.declarationFileWord!, type: '申报书' });
    }
    
    // 学员名单
    if (isValidFile(project.studentListFile)) {
      files.push({ name: project.studentListFileName || '学员名单', key: project.studentListFile!, type: '学员名单' });
    }
    
    // 课程安排表
    if (isValidFile(project.courseScheduleFile)) {
      files.push({ name: project.courseScheduleFileName || '课程安排表', key: project.courseScheduleFile!, type: '课程安排' });
    }
    
    // 会签单
    if (isValidFile(project.countersignFile)) {
      files.push({ name: project.countersignFileName || '会签单.pdf', key: project.countersignFile!, type: '会签单' });
    }
    
    // 满意度调查
    if (isValidFile(project.satisfactionSurveyFile)) {
      files.push({ name: project.satisfactionSurveyFileName || '满意度调查', key: project.satisfactionSurveyFile!, type: '满意度' });
    }
    
    return files;
  };

  if (!projectId) {
    return (
      <Card className="h-full">
        <CardContent className="flex items-center justify-center h-64 text-gray-400">
          <div className="text-center">
            <FolderOpen className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>选择一个项目查看详细信息</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card className="h-full">
        <CardContent className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </CardContent>
      </Card>
    );
  }

  if (!project) {
    return (
      <Card className="h-full">
        <CardContent className="flex items-center justify-center h-64 text-gray-400">
          <div className="text-center">
            <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>项目信息加载失败</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const files = getFiles();

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-lg">{project.name}</CardTitle>
            <CardDescription className="mt-1">
              <Badge className={statusMap[project.status]?.color || 'bg-gray-100'}>
                {statusMap[project.status]?.label || project.status}
              </Badge>
            </CardDescription>
          </div>
          {onClose && (
            <Button variant="ghost" size="sm" onClick={onClose}>
              关闭
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {/* 基本信息 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4 text-sm">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-gray-400" />
            <span>{project.participantCount || 0} 人</span>
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-gray-400" />
            <span>{project.trainingDays || 0} 天</span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-gray-400" />
            <span>{project.trainingHours || 0} 课时</span>
          </div>
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-gray-400" />
            <span>{files.length} 个文件</span>
          </div>
        </div>

        {/* 标签页 */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="files">项目文件 ({files.length})</TabsTrigger>
            <TabsTrigger value="courses">课程安排 ({courses.length})</TabsTrigger>
          </TabsList>

          {/* 文件列表 */}
          <TabsContent value="files" className="mt-4">
            {files.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <File className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>暂无文件</p>
              </div>
            ) : (
              <div className="space-y-2">
                {files.map((file, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <FileText className="w-5 h-5 text-blue-600 flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{file.name}</p>
                        <p className="text-xs text-gray-400">{file.type}</p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDownloadFile(file.key, file.name)}
                    >
                      <Eye className="w-4 h-4 mr-1" />
                      查看
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* 课程安排 */}
          <TabsContent value="courses" className="mt-4">
            {courses.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <BookOpen className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>暂无课程安排</p>
              </div>
            ) : (
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16">天数</TableHead>
                      <TableHead>课程名称</TableHead>
                      <TableHead className="w-20">类型</TableHead>
                      <TableHead className="w-24">讲师</TableHead>
                      <TableHead className="w-16">课时</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {courses.map((course) => (
                      <TableRow key={course.id}>
                        <TableCell className="text-center">
                          第{course.day || '-'}天
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{course.name}</p>
                            {course.description && (
                              <p className="text-xs text-gray-400 truncate">{course.description}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={courseTypeMap[course.type]?.color || 'bg-gray-100'}>
                            {courseTypeMap[course.type]?.label || course.type}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">
                          {course.type === 'visit' ? (
                            <div className="flex items-center gap-1">
                              <Building2 className="w-3 h-3" />
                              <span className="truncate">{course.visitSiteName || '-'}</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1">
                              <User className="w-3 h-3" />
                              <span className="truncate">{course.teacherName || '-'}</span>
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          {course.duration || '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
