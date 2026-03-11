'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import MainLayout from '@/components/layout/main-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Database,
  Plus,
  Pencil,
  Trash2,
  Download,
  Search,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Sparkles,
  FileDown,
  Loader2,
  FileText,
  FileUp,
  X,
  ExternalLink,
} from 'lucide-react';
import ApiKeyCheckDialog, { checkApiKeyConfigured } from '@/components/api-key-check-dialog';

// 数据表配置
const TABLES_CONFIG = [
  { 
    name: 'teachers', 
    label: '讲师信息', 
    icon: '👤',
    columns: [
      { key: 'id', label: 'ID', type: 'uuid', editable: false },
      { key: 'name', label: '姓名', type: 'text', editable: true, required: true },
      { key: 'title', label: '职称', type: 'select', options: ['院士', '正高', '副高', '中级', '初级', '其他'], editable: true },
      { key: 'expertise', label: '专业领域', type: 'text', editable: true },
      { key: 'organization', label: '所属单位', type: 'text', editable: true },
      { key: 'bio', label: '简介', type: 'textarea', editable: true },
      { key: 'hourlyRate', label: '课时费(元)', type: 'number', editable: true },
      { key: 'rating', label: '评分', type: 'number', editable: true },
      { key: 'teachingCount', label: '授课次数', type: 'number', editable: true },
      { key: 'isActive', label: '状态', type: 'boolean', editable: true },
    ]
  },
  { 
    name: 'venues', 
    label: '场地信息', 
    icon: '🏢',
    columns: [
      { key: 'id', label: 'ID', type: 'uuid', editable: false },
      { key: 'name', label: '名称', type: 'text', editable: true, required: true },
      { key: 'location', label: '地址', type: 'text', editable: true },
      { key: 'capacity', label: '容纳人数', type: 'number', editable: true },
      { key: 'dailyRate', label: '日租金(元)', type: 'number', editable: true },
      { key: 'facilities', label: '设施', type: 'text', editable: true },
      { key: 'rating', label: '评分', type: 'number', editable: true },
      { key: 'usageCount', label: '使用次数', type: 'number', editable: true },
      { key: 'isActive', label: '状态', type: 'boolean', editable: true },
    ]
  },
  { 
    name: 'course_templates', 
    label: '课程模板', 
    icon: '📚',
    columns: [
      { key: 'id', label: 'ID', type: 'uuid', editable: false },
      { key: 'name', label: '课程名称', type: 'text', editable: true, required: true },
      { key: 'category', label: '类别', type: 'select', options: ['管理技能', '专业技能', '职业素养', '综合提升'], editable: true },
      { key: 'duration', label: '课时', type: 'number', editable: true },
      { key: 'targetAudience', label: '目标人群', type: 'text', editable: true },
      { key: 'difficulty', label: '难度', type: 'select', options: ['初级', '中级', '高级'], editable: true },
      { key: 'description', label: '描述', type: 'textarea', editable: true },
      { key: 'usageCount', label: '使用次数', type: 'number', editable: true },
      { key: 'avgRating', label: '平均评分', type: 'number', editable: true },
    ]
  },
  { 
    name: 'normative_documents', 
    label: '规范性文件', 
    icon: '📄',
    columns: [
      { key: 'id', label: 'ID', type: 'uuid', editable: false },
      { key: 'name', label: '文件名称', type: 'text', editable: true, required: true },
      { key: 'summary', label: '内容摘要', type: 'textarea', editable: true },
      { key: 'issuer', label: '颁发部门', type: 'text', editable: true },
      { key: 'issueDate', label: '颁发时间', type: 'date', editable: true },
      { key: 'fileUrl', label: '文件链接', type: 'text', editable: true },
      { key: 'isEffective', label: '是否有效', type: 'boolean', editable: true },
    ]
  },
  { 
    name: 'projects', 
    label: '培训项目', 
    icon: '📋',
    columns: [
      { key: 'id', label: 'ID', type: 'uuid', editable: false },
      { key: 'name', label: '项目名称', type: 'text', editable: true, required: true },
      { key: 'status', label: '状态', type: 'select', options: ['草稿', '设计阶段', '执行阶段', '已完成', '已归档'], editable: true },
      { key: 'trainingTarget', label: '培训目标', type: 'text', editable: true },
      { key: 'targetAudience', label: '目标人群', type: 'text', editable: true },
      { key: 'participantCount', label: '参训人数', type: 'number', editable: true },
      { key: 'trainingDays', label: '培训天数', type: 'number', editable: true },
      { key: 'totalBudget', label: '总预算', type: 'number', editable: true },
    ]
  },
  { 
    name: 'project_courses', 
    label: '项目课程', 
    icon: '📖',
    columns: [
      { key: 'id', label: 'ID', type: 'uuid', editable: false },
      { key: 'projectId', label: '项目ID', type: 'uuid', editable: true, required: true },
      { key: 'courseName', label: '课程名称', type: 'text', editable: true },
      { key: 'teacherId', label: '讲师ID', type: 'uuid', editable: true },
      { key: 'venueId', label: '场地ID', type: 'uuid', editable: true },
      { key: 'duration', label: '课时', type: 'number', editable: true },
      { key: 'sequence', label: '顺序', type: 'number', editable: true },
    ]
  },
  { 
    name: 'satisfaction_surveys', 
    label: '满意度调查', 
    icon: '⭐',
    columns: [
      { key: 'id', label: 'ID', type: 'uuid', editable: false },
      { key: 'projectId', label: '项目ID', type: 'uuid', editable: true },
      { key: 'overallScore', label: '总体评分', type: 'number', editable: true },
      { key: 'contentScore', label: '内容评分', type: 'number', editable: true },
      { key: 'teacherScore', label: '讲师评分', type: 'number', editable: true },
      { key: 'venueScore', label: '场地评分', type: 'number', editable: true },
      { key: 'suggestions', label: '建议', type: 'textarea', editable: true },
    ]
  },
];

interface TableConfig {
  name: string;
  label: string;
  icon: string;
  columns: ColumnConfig[];
}

interface ColumnConfig {
  key: string;
  label: string;
  type: string;
  editable: boolean;
  required?: boolean;
  options?: string[];
}

export default function DataManagementPage() {
  const router = useRouter();
  const [selectedTable, setSelectedTable] = useState<TableConfig>(TABLES_CONFIG[0]);
  const [data, setData] = useState<Record<string, unknown>[]>([]);
  const [tableCounts, setTableCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [aiImportDialogOpen, setAiImportDialogOpen] = useState(false);
  const [currentItem, setCurrentItem] = useState<Record<string, unknown> | null>(null);
  const [formData, setFormData] = useState<Record<string, unknown>>({});
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [aiImportText, setAiImportText] = useState<string>('');
  const [aiImportLoading, setAiImportLoading] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [fileImportLoading, setFileImportLoading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  // AI 导入预览状态（支持多条数据）
  const [aiImportPreview, setAiImportPreview] = useState<Record<string, unknown>[] | null>(null);
  const [aiImportConfirming, setAiImportConfirming] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0); // 当前编辑的数据索引
  // 重复数据检测状态
  const [duplicateCheckLoading, setDuplicateCheckLoading] = useState(false);
  const [duplicates, setDuplicates] = useState<Array<{
    index: number;
    record: Record<string, unknown>;
    existing: Record<string, unknown> | null;
    matchFields: string[];
  }>>([]);
  const [importDecisions, setImportDecisions] = useState<Record<number, 'skip' | 'update' | 'add'>>({});
  // 规范性文件专用状态
  const [normativeFile, setNormativeFile] = useState<File | null>(null);
  const [aiFillingLoading, setAiFillingLoading] = useState(false);
  const [isDraggingNormative, setIsDraggingNormative] = useState(false);
  // API Key 检查对话框状态
  const [apiKeyCheckOpen, setApiKeyCheckOpen] = useState(false);
  const [apiKeyConfigured, setApiKeyConfigured] = useState<boolean | null>(null);
  // 批量选择状态
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchDeleteDialogOpen, setBatchDeleteDialogOpen] = useState(false);
  const [batchDeleting, setBatchDeleting] = useState(false);

  // 初始化时检查 API Key 状态
  useEffect(() => {
    checkApiKeyConfigured().then(setApiKeyConfigured);
  }, []);

  // 根据表类型获取导入提示词
  const getImportPlaceholder = () => {
    const placeholders: Record<string, string> = {
      teachers: '请输入讲师信息...\n\n例如：张三，正高职称，专业领域是管理培训，来自某大学商学院\n\n提示：可省略课时费，AI将根据职称自动填充（院士1500元、正高1000元、其他500元）',
      venues: '请输入场地信息...\n\n例如：阳光培训中心，位于上海市浦东新区，可容纳100人，日租金5000元',
      course_templates: '请输入课程模板信息...\n\n例如：班组长管理技能提升，管理技能类，8课时，面向班组长',
      normative_documents: '请输入规范性文件信息...\n\n例如：培训费用管理办法，上海市人力资源和社会保障局，2024年1月颁布\n\n提示：上传文件后AI将自动提取摘要',
      projects: '请输入培训项目信息...\n\n例如：2024年班组长能力提升培训，目标人群班组长，参训人数50人，培训4天',
      project_courses: '请输入项目课程信息...\n\n例如：第一天上午，管理基础，张明教授授课，4课时',
      satisfaction_surveys: '请输入满意度调查数据...\n\n例如：总体评分4.8分，内容评分4.7分，讲师评分4.9分'
    };
    return placeholders[selectedTable.name] || '请输入要导入的数据描述...';
  };

  // 加载所有表的数据计数
  const loadTableCounts = useCallback(async () => {
    try {
      const counts: Record<string, number> = {};
      await Promise.all(
        TABLES_CONFIG.map(async (table) => {
          const res = await fetch(`/api/admin/data?table=${table.name}`);
          const result = await res.json();
          counts[table.name] = result.data?.length || 0;
        })
      );
      setTableCounts(counts);
    } catch (error) {
      console.error('Load table counts error:', error);
    }
  }, []);

  // 加载当前表数据
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/data?table=${selectedTable.name}`);
      const result = await res.json();
      if (result.data) {
        setData(result.data);
        // 更新当前表的计数
        setTableCounts(prev => ({ ...prev, [selectedTable.name]: result.data.length }));
      } else {
        setData([]);
        setTableCounts(prev => ({ ...prev, [selectedTable.name]: 0 }));
      }
    } catch (error) {
      console.error('Load data error:', error);
      setMessage({ type: 'error', text: '加载数据失败' });
    } finally {
      setLoading(false);
    }
  }, [selectedTable.name]);

  // 初始化加载所有表计数
  useEffect(() => {
    loadTableCounts();
  }, [loadTableCounts]);

  // 切换表时加载数据
  useEffect(() => {
    loadData();
  }, [loadData]);

  // 自动隐藏消息
  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  // 筛选数据
  const filteredData = data.filter(item => {
    if (!searchTerm) return true;
    return Object.values(item).some(val => 
      String(val).toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  // 打开新增对话框
  const handleAdd = () => {
    const initialData: Record<string, unknown> = {};
    selectedTable.columns.forEach(col => {
      if (col.editable) {
        if (col.type === 'boolean') {
          initialData[col.key] = true;
        } else if (col.type === 'number') {
          initialData[col.key] = 0;
        } else {
          initialData[col.key] = '';
        }
      }
    });
    setFormData(initialData);
    setCurrentItem(null);
    setNormativeFile(null); // 清空规范性文件
    setEditDialogOpen(true);
  };

  // 打开编辑对话框
  const handleEdit = (item: Record<string, unknown>) => {
    setFormData({ ...item });
    setCurrentItem(item);
    setNormativeFile(null); // 清空规范性文件
    setEditDialogOpen(true);
  };

  // 保存数据
  const handleSave = async () => {
    try {
      const url = '/api/admin/data';
      const method = currentItem ? 'PUT' : 'POST';
      const body = {
        table: selectedTable.name,
        data: formData,
        id: currentItem?.id,
      };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const result = await res.json();
      if (result.success) {
        setMessage({ type: 'success', text: currentItem ? '修改成功' : '添加成功' });
        setEditDialogOpen(false);
        setNormativeFile(null); // 清空文件
        loadData();
      } else {
        setMessage({ type: 'error', text: result.error || '操作失败' });
      }
    } catch (error) {
      console.error('Save error:', error);
      setMessage({ type: 'error', text: '保存失败' });
    }
  };

  // 删除数据
  const handleDelete = async () => {
    if (!currentItem?.id) return;

    try {
      const res = await fetch(`/api/admin/data?table=${selectedTable.name}&id=${currentItem.id}`, {
        method: 'DELETE',
      });

      const result = await res.json();
      if (result.success) {
        setMessage({ type: 'success', text: '删除成功' });
        setDeleteDialogOpen(false);
        loadData();
      } else {
        setMessage({ type: 'error', text: result.error || '删除失败' });
      }
    } catch (error) {
      console.error('Delete error:', error);
      setMessage({ type: 'error', text: '删除失败' });
    }
  };

  // 批量删除
  const handleBatchDelete = async () => {
    if (selectedIds.size === 0) return;

    setBatchDeleting(true);
    let successCount = 0;
    let failCount = 0;

    for (const id of selectedIds) {
      try {
        const res = await fetch(`/api/admin/data?table=${selectedTable.name}&id=${id}`, {
          method: 'DELETE',
        });
        const result = await res.json();
        if (result.success) {
          successCount++;
        } else {
          failCount++;
        }
      } catch {
        failCount++;
      }
    }

    setBatchDeleting(false);
    setBatchDeleteDialogOpen(false);
    setSelectedIds(new Set());
    loadData();

    if (failCount === 0) {
      setMessage({ type: 'success', text: `成功删除 ${successCount} 条记录` });
    } else {
      setMessage({ type: 'success', text: `成功删除 ${successCount} 条，失败 ${failCount} 条` });
    }
  };

  // 批量导出
  const handleBatchExport = async () => {
    if (selectedIds.size === 0) return;

    try {
      const ids = Array.from(selectedIds);
      const res = await fetch('/api/admin/data/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          table: selectedTable.name,
          ids: ids,
        }),
      });

      if (!res.ok) {
        throw new Error('导出失败');
      }
      
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${selectedTable.name}_selected_${new Date().toISOString().split('T')[0]}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      setMessage({ type: 'success', text: `成功导出 ${ids.length} 条记录` });
    } catch (error) {
      console.error('Batch export error:', error);
      setMessage({ type: 'error', text: '导出失败' });
    }
  };

  // 导出数据为 Excel
  const handleExport = async () => {
    try {
      const res = await fetch(`/api/admin/data/export?table=${selectedTable.name}`);
      if (!res.ok) {
        throw new Error('导出失败');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${selectedTable.name}_${new Date().toISOString().split('T')[0]}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      setMessage({ type: 'success', text: '导出成功' });
    } catch (error) {
      console.error('Export error:', error);
      setMessage({ type: 'error', text: '导出失败' });
    }
  };

  // 下载 Excel 模板
  const handleDownloadTemplate = async () => {
    try {
      const res = await fetch(`/api/admin/data/template?table=${selectedTable.name}`);
      if (!res.ok) {
        throw new Error('下载模板失败');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${selectedTable.name}_template.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      setMessage({ type: 'success', text: '模板下载成功' });
    } catch (error) {
      console.error('Download template error:', error);
      setMessage({ type: 'error', text: '下载模板失败' });
    }
  };

  // AI 智能导入
  const handleAiImport = async () => {
    if (!aiImportText.trim()) {
      setMessage({ type: 'error', text: '请输入要导入的内容' });
      return;
    }

    // 检查 API Key
    if (apiKeyConfigured === false) {
      setApiKeyCheckOpen(true);
      return;
    }

    await doAiImport();
  };

  // 检测重复数据
  const checkDuplicates = async (records: Record<string, unknown>[]) => {
    setDuplicateCheckLoading(true);
    try {
      const res = await fetch('/api/admin/data/check-duplicates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          table: selectedTable.name,
          records: records,
        }),
      });

      const result = await res.json();
      if (result.success) {
        setDuplicates(result.duplicates || []);
        // 默认所有重复记录选择"新增"
        const defaultDecisions: Record<number, 'skip' | 'update' | 'add'> = {};
        result.duplicates?.forEach((dup: { index: number }) => {
          defaultDecisions[dup.index] = 'add';
        });
        setImportDecisions(defaultDecisions);
      }
    } catch (error) {
      console.error('Check duplicates error:', error);
    } finally {
      setDuplicateCheckLoading(false);
    }
  };

  // 实际执行 AI 导入
  const doAiImport = async () => {
    setAiImportLoading(true);
    try {
      const res = await fetch('/api/admin/data/ai-analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          table: selectedTable.name,
          text: aiImportText,
        }),
      });

      const result = await res.json();
      if (result.success && result.data) {
        // 显示预览结果（支持单条或多条）
        const previewData = Array.isArray(result.data) ? result.data : [result.data];
        setAiImportPreview(previewData);
        setCurrentIndex(0);
        // 检测重复数据
        await checkDuplicates(previewData);
      } else {
        setMessage({ type: 'error', text: result.error || 'AI 解析失败' });
      }
    } catch (error) {
      console.error('AI import error:', error);
      setMessage({ type: 'error', text: 'AI 智能导入失败' });
    } finally {
      setAiImportLoading(false);
    }
  };

  // 文件导入
  const handleFileImport = async () => {
    if (!uploadFile) {
      setMessage({ type: 'error', text: '请选择要上传的文件' });
      return;
    }

    // 检查 API Key（规范性文件可以不需要 API Key）
    if (apiKeyConfigured === false && selectedTable.name !== 'normative_documents') {
      setApiKeyCheckOpen(true);
      return;
    }

    await doFileImport();
  };

  // 实际执行文件导入
  const doFileImport = async () => {
    setFileImportLoading(true);
    try {
      // 调用通用 AI 分析 API
      const formDataObj = new FormData();
      formDataObj.append('file', uploadFile!);
      formDataObj.append('table', selectedTable.name);

      const res = await fetch('/api/admin/data/ai-analyze', {
        method: 'POST',
        body: formDataObj,
      });

      const result = await res.json();
      if (result.success && result.data) {
        // 显示预览结果（支持单条或多条）
        const previewData = Array.isArray(result.data) ? result.data : [result.data];
        setAiImportPreview(previewData);
        setCurrentIndex(0);
        // 检测重复数据
        await checkDuplicates(previewData);
      } else {
        setMessage({ type: 'error', text: result.error || '文件解析失败' });
      }
    } catch (error) {
      console.error('File import error:', error);
      setMessage({ type: 'error', text: '文件导入失败' });
    } finally {
      setFileImportLoading(false);
    }
  };

  // 字段名映射：将下划线命名转换为驼峰命名（匹配 Schema 定义）
  const fieldNameMap: Record<string, Record<string, string>> = {
    teachers: {
      hourly_rate: 'hourlyRate',
      teaching_count: 'teachingCount',
      is_active: 'isActive',
    },
    venues: {
      daily_rate: 'dailyRate',
      usage_count: 'usageCount',
      is_active: 'isActive',
    },
    course_templates: {
      target_audience: 'targetAudience',
      usage_count: 'usageCount',
      avg_rating: 'avgRating',
    },
    normative_documents: {
      issue_date: 'issueDate',
      file_url: 'fileUrl',
      is_effective: 'isEffective',
    },
    projects: {
      training_target: 'trainingTarget',
      target_audience: 'targetAudience',
      participant_count: 'participantCount',
      training_days: 'trainingDays',
      training_hours: 'trainingHours',
      training_period: 'trainingPeriod',
      budget_min: 'budgetMin',
      budget_max: 'budgetMax',
      special_requirements: 'specialRequirements',
      start_date: 'startDate',
      end_date: 'endDate',
      venue_id: 'venueId',
      teacher_fee: 'teacherFee',
      venue_fee: 'venueFee',
      catering_fee: 'cateringFee',
      tea_break_fee: 'teaBreakFee',
      material_fee: 'materialFee',
      labor_fee: 'laborFee',
      other_fee: 'otherFee',
      management_fee: 'managementFee',
      total_budget: 'totalBudget',
      actual_cost: 'actualCost',
      avg_satisfaction: 'avgSatisfaction',
      survey_response_rate: 'surveyResponseRate',
    },
    project_courses: {
      project_id: 'projectId',
      course_name: 'courseName',
      teacher_id: 'teacherId',
      venue_id: 'venueId',
    },
    satisfaction_surveys: {
      project_id: 'projectId',
      overall_score: 'overallScore',
      content_score: 'contentScore',
      teacher_score: 'teacherScore',
      venue_score: 'venueScore',
    },
  };

  // 转换字段名（下划线 -> 驼峰）
  const convertFieldNames = (tableName: string, data: Record<string, unknown>): Record<string, unknown> => {
    const mapping = fieldNameMap[tableName] || {};
    const result: Record<string, unknown> = {};
    
    for (const [key, value] of Object.entries(data)) {
      const newKey = mapping[key] || key;
      result[newKey] = value;
    }
    
    return result;
  };

  // 确认导入数据
  const confirmImport = async () => {
    if (!aiImportPreview || aiImportPreview.length === 0) return;
    
    setAiImportConfirming(true);
    try {
      let successCount = 0;
      let failCount = 0;
      let skipCount = 0;
      let updateCount = 0;

      // 构建重复数据索引映射
      const duplicateMap = new Map<number, { existing: Record<string, unknown>; decision: 'skip' | 'update' | 'add' }>();
      duplicates.forEach(dup => {
        duplicateMap.set(dup.index, { 
          existing: dup.existing || {}, 
          decision: importDecisions[dup.index] || 'add' 
        });
      });

      // 批量导入数据
      for (let i = 0; i < aiImportPreview.length; i++) {
        const item = aiImportPreview[i];
        const dupInfo = duplicateMap.get(i);

        // 如果是重复数据且选择跳过
        if (dupInfo && dupInfo.decision === 'skip') {
          skipCount++;
          continue;
        }

        try {
          // 转换字段名
          const convertedData = convertFieldNames(selectedTable.name, item);
          
          // 如果是重复数据且选择更新
          if (dupInfo && dupInfo.decision === 'update' && dupInfo.existing.id) {
            const res = await fetch('/api/admin/data', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                table: selectedTable.name,
                id: dupInfo.existing.id,
                data: convertedData,
              }),
            });

            const result = await res.json();
            if (result.success) {
              successCount++;
              updateCount++;
            } else {
              failCount++;
            }
          } else {
            // 新增数据
            const res = await fetch('/api/admin/data', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                table: selectedTable.name,
                data: convertedData,
              }),
            });

            const result = await res.json();
            if (result.success) {
              successCount++;
            } else {
              failCount++;
            }
          }
        } catch {
          failCount++;
        }
      }

      if (successCount > 0 || skipCount > 0) {
        const messages: string[] = [];
        if (successCount > 0) messages.push(`导入 ${successCount} 条`);
        if (updateCount > 0) messages.push(`更新 ${updateCount} 条`);
        if (skipCount > 0) messages.push(`跳过 ${skipCount} 条`);
        if (failCount > 0) messages.push(`失败 ${failCount} 条`);
        
        setMessage({ 
          type: 'success', 
          text: messages.join('，')
        });
        setAiImportDialogOpen(false);
        setUploadFile(null);
        setAiImportPreview(null);
        setCurrentIndex(0);
        setDuplicates([]);
        setImportDecisions({});
        loadData();
      } else {
        setMessage({ type: 'error', text: '导入失败' });
      }
    } catch (error) {
      console.error('Confirm import error:', error);
      setMessage({ type: 'error', text: '导入失败' });
    } finally {
      setAiImportConfirming(false);
    }
  };

  // AI 填写规范性文件信息
  const handleAiFillNormative = async () => {
    if (!normativeFile) {
      setMessage({ type: 'error', text: '请先上传文件' });
      return;
    }

    // 检查 API Key
    if (apiKeyConfigured === false) {
      setApiKeyCheckOpen(true);
      return;
    }

    await doAiFillNormative();
  };

  // 实际执行 AI 填写
  const doAiFillNormative = async () => {
    setAiFillingLoading(true);
    try {
      const formDataObj = new FormData();
      formDataObj.append('file', normativeFile!);

      const res = await fetch('/api/admin/data/analyze-normative', {
        method: 'POST',
        body: formDataObj,
      });

      const result = await res.json();
      if (result.success && result.data) {
        // 自动填充表单
        setFormData(prev => ({
          ...prev,
          name: result.data.name || prev.name,
          summary: result.data.summary || prev.summary,
          issuer: result.data.issuer || prev.issuer,
          issue_date: result.data.issueDate || prev.issue_date,
        }));
        if (result.data.summary || result.data.issuer) {
          setMessage({ type: 'success', text: 'AI 分析完成，已自动填写表单' });
        } else {
          setMessage({ type: 'success', text: '已填充文件名，请手动填写其他信息' });
        }
      } else {
        setMessage({ type: 'error', text: result.error || 'AI 分析失败' });
      }
    } catch (error) {
      console.error('AI fill error:', error);
      setMessage({ type: 'error', text: 'AI 分析失败' });
    } finally {
      setAiFillingLoading(false);
    }
  };

  // API Key 检查对话框跳过回调
  const handleApiKeyCheckSkip = () => {
    // 用户选择跳过，不做任何事（让用户手动填写）
  };

  // 渲染表单字段
  const renderFormField = (col: ColumnConfig) => {
    if (!col.editable) return null;

    const value = formData[col.key] ?? '';

    switch (col.type) {
      case 'select':
        // 对于状态字段，处理英文到中文的映射
        const displayValue = col.key === 'status' ? (statusMap[String(value)] || String(value)) : String(value);
        return (
          <select
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={displayValue}
            onChange={(e) => setFormData({ ...formData, [col.key]: e.target.value })}
          >
            <option value="">请选择</option>
            {col.options?.map(opt => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        );
      case 'textarea':
        return (
          <textarea
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            rows={3}
            value={String(value)}
            onChange={(e) => setFormData({ ...formData, [col.key]: e.target.value })}
          />
        );
      case 'boolean':
        return (
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={Boolean(value)}
              onChange={(e) => setFormData({ ...formData, [col.key]: e.target.checked })}
              className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
            />
            <span className="text-sm">{col.label}</span>
          </label>
        );
      case 'number':
        return (
          <Input
            type="number"
            value={String(value)}
            onChange={(e) => setFormData({ ...formData, [col.key]: Number(e.target.value) })}
          />
        );
      case 'date':
        return (
          <Input
            type="date"
            value={value ? String(value).substring(0, 10) : ''}
            onChange={(e) => setFormData({ ...formData, [col.key]: e.target.value })}
          />
        );
      default:
        return (
          <Input
            type="text"
            value={String(value)}
            onChange={(e) => setFormData({ ...formData, [col.key]: e.target.value })}
          />
        );
    }
  };

  // 状态映射
  const statusMap: Record<string, string> = {
    'draft': '草稿',
    'designing': '设计阶段',
    'executing': '执行阶段',
    'completed': '已完成',
    'archived': '已归档',
  };

  // 渲染单元格值
  const renderCellValue = (col: ColumnConfig, value: unknown) => {
    if (value === null || value === undefined) return '-';

    // 特殊处理文件链接字段
    if (col.key === 'fileUrl' && value) {
      const url = String(value);
      return (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 text-xs"
          onClick={(e) => e.stopPropagation()}
        >
          <ExternalLink className="w-3 h-3" />
          下载文件
        </a>
      );
    }

    // 特殊处理状态字段
    if (col.key === 'status') {
      const statusValue = String(value);
      const displayValue = statusMap[statusValue] || statusValue;
      return (
        <Badge variant={
          statusValue === 'completed' ? 'default' :
          statusValue === 'executing' ? 'secondary' :
          statusValue === 'draft' ? 'outline' : 'secondary'
        }>
          {displayValue}
        </Badge>
      );
    }

    switch (col.type) {
      case 'boolean':
        return (
          <Badge variant={value ? 'default' : 'secondary'}>
            {value ? '是' : '否'}
          </Badge>
        );
      case 'uuid':
        return (
          <span className="text-xs text-gray-500 font-mono">
            {String(value).substring(0, 8)}...
          </span>
        );
      case 'date':
        return (
          <span className="text-sm text-gray-600">
            {String(value).substring(0, 10)}
          </span>
        );
      default:
        const str = String(value);
        return str.length > 50 ? str.substring(0, 50) + '...' : str;
    }
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* 页面标题 */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">数据管理</h1>
            <p className="text-gray-500 mt-1">管理所有数据表，支持增删改查和批量导入</p>
          </div>
        </div>

        {/* 消息提示 */}
        {message && (
          <div className={`flex items-center gap-2 p-4 rounded-lg ${
            message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
          }`}>
            {message.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
            {message.text}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* 左侧表列表 */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="text-base">数据表</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <nav className="space-y-1 px-2 pb-2">
                {TABLES_CONFIG.map(table => (
                  <button
                    key={table.name}
                    onClick={() => setSelectedTable(table)}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      selectedTable.name === table.name
                        ? 'bg-blue-50 text-blue-700'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    }`}
                  >
                    <span className="text-lg">{table.icon}</span>
                    <span>{table.label}</span>
                    <Badge variant="outline" className="ml-auto text-xs">
                      {tableCounts[table.name] || 0}
                    </Badge>
                  </button>
                ))}
              </nav>
            </CardContent>
          </Card>

          {/* 右侧数据表格 */}
          <Card className="lg:col-span-4">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <span className="text-xl">{selectedTable.icon}</span>
                    {selectedTable.label}
                  </CardTitle>
                  <CardDescription>共 {filteredData.length} 条记录</CardDescription>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Button variant="outline" size="sm" onClick={() => loadData()}>
                    <RefreshCw className="w-4 h-4 mr-1" />
                    刷新
                  </Button>
                  {selectedTable.name !== 'normative_documents' && (
                    <>
                      <Button variant="outline" size="sm" onClick={handleDownloadTemplate}>
                        <FileDown className="w-4 h-4 mr-1" />
                        下载模板
                      </Button>
                      <Button variant="outline" size="sm" onClick={handleExport}>
                        <Download className="w-4 h-4 mr-1" />
                        导出
                      </Button>
                    </>
                  )}
                  <Button variant="outline" size="sm" onClick={() => setAiImportDialogOpen(true)}>
                    <Sparkles className="w-4 h-4 mr-1" />
                    AI导入
                  </Button>
                  <Button size="sm" onClick={handleAdd}>
                    <Plus className="w-4 h-4 mr-1" />
                    新增
                  </Button>
                </div>
              </div>
              
              {/* 搜索框 */}
              <div className="mt-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    placeholder="搜索..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {/* 批量操作栏 */}
              {selectedIds.size > 0 && (
                <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-lg mb-3">
                  <span className="text-sm text-blue-700">
                    已选择 {selectedIds.size} 条记录
                  </span>
                  <div className="flex-1" />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleBatchExport}
                  >
                    <Download className="w-4 h-4 mr-1" />
                    批量导出
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => setBatchDeleteDialogOpen(true)}
                  >
                    <Trash2 className="w-4 h-4 mr-1" />
                    批量删除
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedIds(new Set())}
                  >
                    取消选择
                  </Button>
                </div>
              )}
              
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
                </div>
              ) : filteredData.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                  <Database className="w-12 h-12 mb-4 text-gray-300" />
                  <p>暂无数据</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <p className="text-xs text-gray-500 mb-3">💡 提示：双击行可快速编辑</p>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[40px]">
                          <input
                            type="checkbox"
                            checked={filteredData.length > 0 && selectedIds.size === filteredData.length}
                            ref={(el) => {
                              if (el) {
                                el.indeterminate = selectedIds.size > 0 && selectedIds.size < filteredData.length;
                              }
                            }}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedIds(new Set(filteredData.map(item => String(item.id))));
                              } else {
                                setSelectedIds(new Set());
                              }
                            }}
                            className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                          />
                        </TableHead>
                        {selectedTable.columns.map(col => (
                          <TableHead key={col.key}>{col.label}</TableHead>
                        ))}
                        <TableHead className="w-[100px]">操作</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredData.map((item, idx) => {
                        const itemId = String(item.id);
                        const isSelected = selectedIds.has(itemId);
                        return (
                          <TableRow 
                            key={itemId || idx}
                            className={`cursor-pointer hover:bg-blue-50 ${isSelected ? 'bg-blue-50' : ''}`}
                            onDoubleClick={() => handleEdit(item)}
                          >
                            <TableCell onClick={(e) => e.stopPropagation()}>
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={(e) => {
                                  const newSet = new Set(selectedIds);
                                  if (e.target.checked) {
                                    newSet.add(itemId);
                                  } else {
                                    newSet.delete(itemId);
                                  }
                                  setSelectedIds(newSet);
                                }}
                                className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                              />
                            </TableCell>
                            {selectedTable.columns.map(col => (
                              <TableCell key={col.key}>
                                {renderCellValue(col, item[col.key])}
                              </TableCell>
                            ))}
                            <TableCell>
                              <div className="flex items-center gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleEdit(item);
                                  }}
                                >
                                  <Pencil className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setCurrentItem(item);
                                    setDeleteDialogOpen(true);
                                  }}
                                >
                                  <Trash2 className="w-4 h-4 text-red-500" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* 编辑/新增对话框 */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{currentItem ? '编辑数据' : '新增数据'}</DialogTitle>
            <DialogDescription>
              {currentItem ? '修改数据记录' : '添加新的数据记录'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {selectedTable.name === 'normative_documents' ? (
              // 规范性文件特殊表单
              <>
                {/* 文件名称 */}
                <div className="space-y-2">
                  <Label>
                    文件名称<span className="text-red-500 ml-1">*</span>
                  </Label>
                  <Input
                    type="text"
                    value={String(formData.name || '')}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="请输入文件名称"
                  />
                </div>

                {/* 文件上传区域 */}
                <div className="space-y-2">
                  <Label>上传文件</Label>
                  <div
                    className={`border-2 border-dashed rounded-lg p-4 transition-colors ${
                      isDraggingNormative 
                        ? 'border-blue-500 bg-blue-50' 
                        : 'border-gray-300 hover:border-blue-400'
                    }`}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      e.dataTransfer.dropEffect = 'copy';
                      setIsDraggingNormative(true);
                    }}
                    onDragLeave={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setIsDraggingNormative(false);
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setIsDraggingNormative(false);
                      const file = e.dataTransfer.files?.[0];
                      if (file) {
                        const ext = file.name.split('.').pop()?.toLowerCase();
                        if (['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'].includes(ext || '')) {
                          setNormativeFile(file);
                          // 自动填充文件名
                          if (!formData.name) {
                            setFormData(prev => ({ ...prev, name: file.name.replace(/\.[^/.]+$/, '') }));
                          }
                        } else {
                          setMessage({ type: 'error', text: '不支持的文件格式，支持 PDF、Word、Excel、PPT' });
                        }
                      }
                    }}
                  >
                    <input
                      type="file"
                      className="hidden"
                      id="normative-file-upload"
                      accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setNormativeFile(file);
                          // 自动填充文件名
                          if (!formData.name) {
                            setFormData(prev => ({ ...prev, name: file.name.replace(/\.[^/.]+$/, '') }));
                          }
                        }
                      }}
                    />
                    <label htmlFor="normative-file-upload" className="cursor-pointer">
                      <div className="flex flex-col items-center gap-2">
                        <FileUp className={`w-8 h-8 ${isDraggingNormative ? 'text-blue-500' : 'text-gray-400'}`} />
                        {normativeFile ? (
                          <div className="flex items-center gap-2 p-2 bg-blue-100 rounded-lg">
                            <FileText className="w-4 h-4 text-blue-600" />
                            <span className="text-sm text-blue-700 font-medium">{normativeFile.name}</span>
                            <button
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setNormativeFile(null);
                              }}
                              className="text-gray-400 hover:text-red-500 ml-1"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <>
                            <p className="text-sm text-gray-600">
                              <span className="text-blue-600 font-medium">点击上传</span> 或拖拽文件到此处
                            </p>
                            <p className="text-xs text-gray-400">
                              支持 PDF、Word、Excel、PPT 文件
                            </p>
                          </>
                        )}
                      </div>
                    </label>
                  </div>
                  <div className="flex gap-2 mt-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleAiFillNormative}
                      disabled={!normativeFile || aiFillingLoading}
                      className="flex-1"
                    >
                      {aiFillingLoading ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          AI 分析中...
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4 mr-2" />
                          AI 填写
                        </>
                      )}
                    </Button>
                  </div>
                  {!normativeFile && (
                    <p className="text-xs text-gray-500 mt-1">
                      💡 可手动填写下方信息后直接保存，无需上传文件
                    </p>
                  )}
                </div>

                {/* 内容摘要 */}
                <div className="space-y-2">
                  <Label>内容摘要</Label>
                  <textarea
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    rows={3}
                    value={String(formData.summary || '')}
                    onChange={(e) => setFormData({ ...formData, summary: e.target.value })}
                    placeholder="请输入内容摘要，或上传文件后点击 AI 填写"
                  />
                </div>

                {/* 颁发部门 */}
                <div className="space-y-2">
                  <Label>颁发部门</Label>
                  <Input
                    type="text"
                    value={String(formData.issuer || '')}
                    onChange={(e) => setFormData({ ...formData, issuer: e.target.value })}
                    placeholder="请输入颁发部门"
                  />
                </div>

                {/* 颁发时间 */}
                <div className="space-y-2">
                  <Label>颁发时间</Label>
                  <Input
                    type="date"
                    value={String(formData.issue_date || '').substring(0, 10)}
                    onChange={(e) => setFormData({ ...formData, issue_date: e.target.value })}
                  />
                </div>

                {/* 是否有效 */}
                <div className="space-y-2">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={Boolean(formData.is_effective)}
                      onChange={(e) => setFormData({ ...formData, is_effective: e.target.checked })}
                      className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                    />
                    <span className="text-sm">是否有效</span>
                  </label>
                </div>

                {/* 已有文件链接提示 */}
                {currentItem?.file_url && (
                  <div className="p-3 bg-gray-50 rounded-lg text-sm text-gray-600">
                    <p className="font-medium mb-1">已上传文件：</p>
                    <a
                      href={String(currentItem.file_url)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800"
                    >
                      <ExternalLink className="w-3 h-3" />
                      下载查看
                    </a>
                  </div>
                )}
              </>
            ) : (
              // 其他表的通用表单
              selectedTable.columns
                .filter(col => col.editable)
                .map(col => (
                  <div key={col.key} className="space-y-2">
                    <Label>
                      {col.label}
                      {col.required && <span className="text-red-500 ml-1">*</span>}
                    </Label>
                    {renderFormField(col)}
                  </div>
                ))
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleSave}>
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 删除确认对话框 */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认删除</DialogTitle>
            <DialogDescription>
              确定要删除这条数据吗？此操作无法撤销。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              取消
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 批量删除确认对话框 */}
      <Dialog open={batchDeleteDialogOpen} onOpenChange={setBatchDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认批量删除</DialogTitle>
            <DialogDescription>
              确定要删除选中的 {selectedIds.size} 条数据吗？此操作无法撤销。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBatchDeleteDialogOpen(false)}>
              取消
            </Button>
            <Button variant="destructive" onClick={handleBatchDelete}>
              删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AI 智能导入对话框 */}
      <Dialog open={aiImportDialogOpen} onOpenChange={setAiImportDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader className="shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-purple-500" />
              AI 智能导入
            </DialogTitle>
            <DialogDescription>
              AI 将自动解析内容并导入到「{selectedTable.label}」表
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4 overflow-y-auto flex-1">
            {/* 文件上传区域（支持拖拽） */}
            <div
              className={`border-2 border-dashed rounded-lg p-6 transition-colors ${
                isDragging 
                  ? 'border-purple-500 bg-purple-50' 
                  : 'border-gray-300 hover:border-purple-400'
              }`}
              onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
                e.dataTransfer.dropEffect = 'copy';
                setIsDragging(true);
              }}
              onDragLeave={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsDragging(false);
              }}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsDragging(false);
                const file = e.dataTransfer.files?.[0];
                if (file) {
                  const ext = file.name.split('.').pop()?.toLowerCase();
                  if (['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'].includes(ext || '')) {
                    setUploadFile(file);
                    setAiImportText(''); // 清空文字输入
                  } else {
                    setMessage({ type: 'error', text: '不支持的文件格式' });
                  }
                }
              }}
            >
              <input
                type="file"
                className="hidden"
                id="file-upload"
                accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    setUploadFile(file);
                    setAiImportText(''); // 清空文字输入
                  }
                }}
              />
              <label htmlFor="file-upload" className="cursor-pointer">
                <div className="flex flex-col items-center gap-2">
                  <FileUp className={`w-10 h-10 ${isDragging ? 'text-purple-500' : 'text-gray-400'}`} />
                  {uploadFile ? (
                    <div className="flex items-center gap-2 p-2 bg-purple-100 rounded-lg">
                      <FileText className="w-4 h-4 text-purple-600" />
                      <span className="text-sm text-purple-700 font-medium">{uploadFile.name}</span>
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setUploadFile(null);
                        }}
                        className="text-gray-400 hover:text-red-500 ml-1"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <p className="text-sm text-gray-600">
                        <span className="text-purple-600 font-medium">点击上传</span> 或拖拽文件到此处
                      </p>
                      <p className="text-xs text-gray-400">
                        支持 PDF、Word、Excel、PPT 文件
                      </p>
                    </>
                  )}
                </div>
              </label>
            </div>

            {/* 分隔线 */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500">或直接输入文字描述</span>
              </div>
            </div>

            {/* 文字输入区域 */}
            <textarea
              className="w-full h-28 p-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
              placeholder={getImportPlaceholder()}
              value={aiImportText}
              onChange={(e) => {
                setAiImportText(e.target.value);
                if (e.target.value.trim()) {
                  setUploadFile(null); // 清空文件
                }
              }}
            />

            {/* AI 分析预览结果 */}
          {aiImportPreview && aiImportPreview.length > 0 && (
            <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
              {/* 重复数据提示 */}
              {duplicates.length > 0 && (
                <div className="mb-4 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertCircle className="w-5 h-5 text-yellow-600" />
                    <span className="font-medium text-yellow-700">
                      发现 {duplicates.length} 条可能重复的数据
                    </span>
                  </div>
                  <p className="text-sm text-yellow-600">
                    以下标记为重复的数据，请选择处理方式：跳过（不导入）、更新（覆盖已有数据）或新增（作为新记录）。
                  </p>
                </div>
              )}
              
              {/* 重复检测加载中 */}
              {duplicateCheckLoading && (
                <div className="flex items-center gap-2 mb-3 text-sm text-gray-500">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  正在检测重复数据...
                </div>
              )}
              
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-blue-600" />
                  <span className="font-medium text-blue-700">
                    AI 分析结果（可编辑）{aiImportPreview.length > 1 && ` - 共 ${aiImportPreview.length} 条`}
                  </span>
                </div>
                {aiImportPreview.length > 1 && (
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))}
                      disabled={currentIndex === 0}
                    >
                      上一条
                    </Button>
                    <span className="text-sm text-gray-600">
                      {currentIndex + 1} / {aiImportPreview.length}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentIndex(Math.min(aiImportPreview.length - 1, currentIndex + 1))}
                      disabled={currentIndex === aiImportPreview.length - 1}
                    >
                      下一条
                    </Button>
                  </div>
                )}
              </div>
              
              {/* 当前记录的重复数据处理选择 */}
              {(() => {
                const currentDup = duplicates.find(d => d.index === currentIndex);
                if (!currentDup) return null;
                return (
                  <div className="mb-3 p-3 bg-yellow-50 rounded-lg border border-yellow-300">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertCircle className="w-4 h-4 text-yellow-600" />
                      <span className="font-medium text-yellow-700">发现重复数据</span>
                    </div>
                    <div className="text-sm text-yellow-700 mb-2">
                      匹配字段：{currentDup.matchFields.join('、')}
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <Button
                        variant={importDecisions[currentIndex] === 'skip' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setImportDecisions({ ...importDecisions, [currentIndex]: 'skip' })}
                        className={importDecisions[currentIndex] === 'skip' ? 'bg-gray-600 hover:bg-gray-700' : ''}
                      >
                        跳过
                      </Button>
                      <Button
                        variant={importDecisions[currentIndex] === 'update' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setImportDecisions({ ...importDecisions, [currentIndex]: 'update' })}
                        className={importDecisions[currentIndex] === 'update' ? 'bg-blue-600 hover:bg-blue-700' : ''}
                      >
                        更新
                      </Button>
                      <Button
                        variant={importDecisions[currentIndex] === 'add' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setImportDecisions({ ...importDecisions, [currentIndex]: 'add' })}
                        className={importDecisions[currentIndex] === 'add' ? 'bg-green-600 hover:bg-green-700' : ''}
                      >
                        新增
                      </Button>
                    </div>
                    {currentDup.existing && (
                      <div className="mt-2 p-2 bg-white rounded border text-xs text-gray-600">
                        <div className="font-medium mb-1">已有记录：</div>
                        <div className="space-y-1">
                          {Object.entries(currentDup.existing)
                            .filter(([key]) => !['id', 'created_at', 'updated_at'].includes(key))
                            .slice(0, 5)
                            .map(([key, value]) => (
                              <div key={key}>
                                <span className="font-medium">{key}：</span>
                                {String(value).substring(0, 50)}
                              </div>
                            ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
              
              {/* 通用预览表单 - 根据表类型渲染不同字段 */}
              <div className="space-y-3 text-sm">
                {selectedTable.name === 'teachers' && aiImportPreview[currentIndex] && (
                  <>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-700 w-24 shrink-0">讲师姓名：</span>
                      <Input
                        type="text"
                        value={String(aiImportPreview[currentIndex].name || '')}
                        onChange={(e) => {
                          const newData = [...aiImportPreview];
                          newData[currentIndex] = { ...newData[currentIndex], name: e.target.value };
                          setAiImportPreview(newData);
                        }}
                        className="flex-1 bg-white"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-700 w-24 shrink-0">职称：</span>
                      <Input
                        type="text"
                        value={String(aiImportPreview[currentIndex].title || '')}
                        onChange={(e) => {
                          const newData = [...aiImportPreview];
                          newData[currentIndex] = { ...newData[currentIndex], title: e.target.value };
                          setAiImportPreview(newData);
                        }}
                        placeholder="未识别"
                        className="flex-1 bg-white"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-700 w-24 shrink-0">专业领域：</span>
                      <Input
                        type="text"
                        value={String(aiImportPreview[currentIndex].expertise || '')}
                        onChange={(e) => {
                          const newData = [...aiImportPreview];
                          newData[currentIndex] = { ...newData[currentIndex], expertise: e.target.value };
                          setAiImportPreview(newData);
                        }}
                        placeholder="未识别"
                        className="flex-1 bg-white"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-700 w-24 shrink-0">所属单位：</span>
                      <Input
                        type="text"
                        value={String(aiImportPreview[currentIndex].organization || '')}
                        onChange={(e) => {
                          const newData = [...aiImportPreview];
                          newData[currentIndex] = { ...newData[currentIndex], organization: e.target.value };
                          setAiImportPreview(newData);
                        }}
                        placeholder="未识别"
                        className="flex-1 bg-white"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-700 w-24 shrink-0">课时费(元)：</span>
                      <Input
                        type="number"
                        value={String(aiImportPreview[currentIndex].hourly_rate || aiImportPreview[currentIndex].hourlyRate || '')}
                        onChange={(e) => {
                          const newData = [...aiImportPreview];
                          newData[currentIndex] = { ...newData[currentIndex], hourly_rate: parseFloat(e.target.value) || 0, hourlyRate: parseFloat(e.target.value) || 0 };
                          setAiImportPreview(newData);
                        }}
                        placeholder="0"
                        className="flex-1 bg-white"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-700 w-24 shrink-0">是否在职：</span>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={Boolean(aiImportPreview[currentIndex].is_active)}
                          onChange={(e) => {
                            const newData = [...aiImportPreview];
                            newData[currentIndex] = { ...newData[currentIndex], is_active: e.target.checked };
                            setAiImportPreview(newData);
                          }}
                          className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                        />
                        <span className="text-gray-600">是</span>
                      </label>
                    </div>
                  </>
                )}
                
                {selectedTable.name === 'venues' && aiImportPreview[currentIndex] && (
                  <>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-700 w-24 shrink-0">场地名称：</span>
                      <Input
                        type="text"
                        value={String(aiImportPreview[currentIndex].name || '')}
                        onChange={(e) => {
                          const newData = [...aiImportPreview];
                          newData[currentIndex] = { ...newData[currentIndex], name: e.target.value };
                          setAiImportPreview(newData);
                        }}
                        className="flex-1 bg-white"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-700 w-24 shrink-0">地址：</span>
                      <Input
                        type="text"
                        value={String(aiImportPreview[currentIndex].location || '')}
                        onChange={(e) => {
                          const newData = [...aiImportPreview];
                          newData[currentIndex] = { ...newData[currentIndex], location: e.target.value };
                          setAiImportPreview(newData);
                        }}
                        placeholder="未识别"
                        className="flex-1 bg-white"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-700 w-24 shrink-0">容纳人数：</span>
                      <Input
                        type="number"
                        value={String(aiImportPreview[currentIndex].capacity || '')}
                        onChange={(e) => {
                          const newData = [...aiImportPreview];
                          newData[currentIndex] = { ...newData[currentIndex], capacity: parseInt(e.target.value) || 0 };
                          setAiImportPreview(newData);
                        }}
                        placeholder="0"
                        className="flex-1 bg-white"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-700 w-24 shrink-0">日租金(元)：</span>
                      <Input
                        type="number"
                        value={String(aiImportPreview[currentIndex].daily_rate || '')}
                        onChange={(e) => {
                          const newData = [...aiImportPreview];
                          newData[currentIndex] = { ...newData[currentIndex], daily_rate: parseFloat(e.target.value) || 0 };
                          setAiImportPreview(newData);
                        }}
                        placeholder="0"
                        className="flex-1 bg-white"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-700 w-24 shrink-0">设施：</span>
                      <Input
                        type="text"
                        value={String(aiImportPreview[currentIndex].facilities || '')}
                        onChange={(e) => {
                          const newData = [...aiImportPreview];
                          newData[currentIndex] = { ...newData[currentIndex], facilities: e.target.value };
                          setAiImportPreview(newData);
                        }}
                        placeholder="未识别"
                        className="flex-1 bg-white"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-700 w-24 shrink-0">是否可用：</span>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={Boolean(aiImportPreview[currentIndex].is_active)}
                          onChange={(e) => {
                            const newData = [...aiImportPreview];
                            newData[currentIndex] = { ...newData[currentIndex], is_active: e.target.checked };
                            setAiImportPreview(newData);
                          }}
                          className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                        />
                        <span className="text-gray-600">是</span>
                      </label>
                    </div>
                  </>
                )}
                
                {selectedTable.name === 'course_templates' && aiImportPreview[currentIndex] && (
                  <>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-700 w-24 shrink-0">课程名称：</span>
                      <Input
                        type="text"
                        value={String(aiImportPreview[currentIndex].name || '')}
                        onChange={(e) => {
                          const newData = [...aiImportPreview];
                          newData[currentIndex] = { ...newData[currentIndex], name: e.target.value };
                          setAiImportPreview(newData);
                        }}
                        className="flex-1 bg-white"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-700 w-24 shrink-0">类别：</span>
                      <select
                        value={String(aiImportPreview[currentIndex].category || '')}
                        onChange={(e) => {
                          const newData = [...aiImportPreview];
                          newData[currentIndex] = { ...newData[currentIndex], category: e.target.value };
                          setAiImportPreview(newData);
                        }}
                        className="flex-1 px-3 py-2 bg-white border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">请选择</option>
                        <option value="管理技能">管理技能</option>
                        <option value="专业技能">专业技能</option>
                        <option value="职业素养">职业素养</option>
                        <option value="综合提升">综合提升</option>
                      </select>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-700 w-24 shrink-0">课时：</span>
                      <Input
                        type="number"
                        value={String(aiImportPreview[currentIndex].duration || '')}
                        onChange={(e) => {
                          const newData = [...aiImportPreview];
                          newData[currentIndex] = { ...newData[currentIndex], duration: parseFloat(e.target.value) || 0 };
                          setAiImportPreview(newData);
                        }}
                        placeholder="0"
                        className="flex-1 bg-white"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-700 w-24 shrink-0">目标人群：</span>
                      <Input
                        type="text"
                        value={String(aiImportPreview[currentIndex].target_audience || '')}
                        onChange={(e) => {
                          const newData = [...aiImportPreview];
                          newData[currentIndex] = { ...newData[currentIndex], target_audience: e.target.value };
                          setAiImportPreview(newData);
                        }}
                        placeholder="未识别"
                        className="flex-1 bg-white"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-700 w-24 shrink-0">难度：</span>
                      <select
                        value={String(aiImportPreview[currentIndex].difficulty || '')}
                        onChange={(e) => {
                          const newData = [...aiImportPreview];
                          newData[currentIndex] = { ...newData[currentIndex], difficulty: e.target.value };
                          setAiImportPreview(newData);
                        }}
                        className="flex-1 px-3 py-2 bg-white border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">请选择</option>
                        <option value="初级">初级</option>
                        <option value="中级">中级</option>
                        <option value="高级">高级</option>
                      </select>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">课程描述：</span>
                      <textarea
                        className="mt-1 w-full p-2 bg-white border border-gray-300 rounded-md text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        rows={2}
                        value={String(aiImportPreview[currentIndex].description || '')}
                        onChange={(e) => {
                          const newData = [...aiImportPreview];
                          newData[currentIndex] = { ...newData[currentIndex], description: e.target.value };
                          setAiImportPreview(newData);
                        }}
                        placeholder="未识别"
                      />
                    </div>
                  </>
                )}
                
                {selectedTable.name === 'normative_documents' && aiImportPreview[currentIndex] && (
                  <>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-700 w-24 shrink-0">文件名称：</span>
                      <Input
                        type="text"
                        value={String(aiImportPreview[currentIndex].name || '')}
                        onChange={(e) => {
                          const newData = [...aiImportPreview];
                          newData[currentIndex] = { ...newData[currentIndex], name: e.target.value };
                          setAiImportPreview(newData);
                        }}
                        className="flex-1 bg-white"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-700 w-24 shrink-0">颁发部门：</span>
                      <Input
                        type="text"
                        value={String(aiImportPreview[currentIndex].issuer || '')}
                        onChange={(e) => {
                          const newData = [...aiImportPreview];
                          newData[currentIndex] = { ...newData[currentIndex], issuer: e.target.value };
                          setAiImportPreview(newData);
                        }}
                        placeholder="未识别"
                        className="flex-1 bg-white"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-700 w-24 shrink-0">颁发时间：</span>
                      <Input
                        type="date"
                        value={String(aiImportPreview[currentIndex].issue_date || '').substring(0, 10)}
                        onChange={(e) => {
                          const newData = [...aiImportPreview];
                          newData[currentIndex] = { ...newData[currentIndex], issue_date: e.target.value };
                          setAiImportPreview(newData);
                        }}
                        className="flex-1 bg-white"
                      />
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">内容摘要：</span>
                      <textarea
                        className="mt-1 w-full p-2 bg-white border border-gray-300 rounded-md text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        rows={2}
                        value={String(aiImportPreview[currentIndex].summary || '')}
                        onChange={(e) => {
                          const newData = [...aiImportPreview];
                          newData[currentIndex] = { ...newData[currentIndex], summary: e.target.value };
                          setAiImportPreview(newData);
                        }}
                        placeholder="未识别"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-700 w-24 shrink-0">是否有效：</span>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={Boolean(aiImportPreview[currentIndex].is_effective)}
                          onChange={(e) => {
                            const newData = [...aiImportPreview];
                            newData[currentIndex] = { ...newData[currentIndex], is_effective: e.target.checked };
                            setAiImportPreview(newData);
                          }}
                          className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                        />
                        <span className="text-gray-600">是</span>
                      </label>
                    </div>
                  </>
                )}
                
                {selectedTable.name === 'projects' && aiImportPreview[currentIndex] && (
                  <>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-700 w-24 shrink-0">项目名称：</span>
                      <Input
                        type="text"
                        value={String(aiImportPreview[currentIndex].name || '')}
                        onChange={(e) => {
                          const newData = [...aiImportPreview];
                          newData[currentIndex] = { ...newData[currentIndex], name: e.target.value };
                          setAiImportPreview(newData);
                        }}
                        className="flex-1 bg-white"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-700 w-24 shrink-0">培训目标：</span>
                      <Input
                        type="text"
                        value={String(aiImportPreview[currentIndex].training_target || '')}
                        onChange={(e) => {
                          const newData = [...aiImportPreview];
                          newData[currentIndex] = { ...newData[currentIndex], training_target: e.target.value };
                          setAiImportPreview(newData);
                        }}
                        placeholder="未识别"
                        className="flex-1 bg-white"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-700 w-24 shrink-0">目标人群：</span>
                      <Input
                        type="text"
                        value={String(aiImportPreview[currentIndex].target_audience || '')}
                        onChange={(e) => {
                          const newData = [...aiImportPreview];
                          newData[currentIndex] = { ...newData[currentIndex], target_audience: e.target.value };
                          setAiImportPreview(newData);
                        }}
                        placeholder="未识别"
                        className="flex-1 bg-white"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-700 w-24 shrink-0">参训人数：</span>
                      <Input
                        type="number"
                        value={String(aiImportPreview[currentIndex].participant_count || '')}
                        onChange={(e) => {
                          const newData = [...aiImportPreview];
                          newData[currentIndex] = { ...newData[currentIndex], participant_count: parseInt(e.target.value) || 0 };
                          setAiImportPreview(newData);
                        }}
                        placeholder="0"
                        className="flex-1 bg-white"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-700 w-24 shrink-0">培训天数：</span>
                      <Input
                        type="number"
                        value={String(aiImportPreview[currentIndex].training_days || '')}
                        onChange={(e) => {
                          const newData = [...aiImportPreview];
                          newData[currentIndex] = { ...newData[currentIndex], training_days: parseFloat(e.target.value) || 0 };
                          setAiImportPreview(newData);
                        }}
                        placeholder="0"
                        className="flex-1 bg-white"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-700 w-24 shrink-0">总预算(元)：</span>
                      <Input
                        type="number"
                        value={String(aiImportPreview[currentIndex].total_budget || '')}
                        onChange={(e) => {
                          const newData = [...aiImportPreview];
                          newData[currentIndex] = { ...newData[currentIndex], total_budget: parseFloat(e.target.value) || 0 };
                          setAiImportPreview(newData);
                        }}
                        placeholder="0"
                        className="flex-1 bg-white"
                      />
                    </div>
                  </>
                )}
                
                {selectedTable.name === 'satisfaction_surveys' && aiImportPreview[currentIndex] && (
                  <>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-700 w-24 shrink-0">总体评分：</span>
                      <Input
                        type="number"
                        step="0.1"
                        min="1"
                        max="5"
                        value={String(aiImportPreview[currentIndex].overall_score || '')}
                        onChange={(e) => {
                          const newData = [...aiImportPreview];
                          newData[currentIndex] = { ...newData[currentIndex], overall_score: parseFloat(e.target.value) || 0 };
                          setAiImportPreview(newData);
                        }}
                        placeholder="1-5"
                        className="flex-1 bg-white"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-700 w-24 shrink-0">内容评分：</span>
                      <Input
                        type="number"
                        step="0.1"
                        min="1"
                        max="5"
                        value={String(aiImportPreview[currentIndex].content_score || '')}
                        onChange={(e) => {
                          const newData = [...aiImportPreview];
                          newData[currentIndex] = { ...newData[currentIndex], content_score: parseFloat(e.target.value) || 0 };
                          setAiImportPreview(newData);
                        }}
                        placeholder="1-5"
                        className="flex-1 bg-white"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-700 w-24 shrink-0">讲师评分：</span>
                      <Input
                        type="number"
                        step="0.1"
                        min="1"
                        max="5"
                        value={String(aiImportPreview[currentIndex].teacher_score || '')}
                        onChange={(e) => {
                          const newData = [...aiImportPreview];
                          newData[currentIndex] = { ...newData[currentIndex], teacher_score: parseFloat(e.target.value) || 0 };
                          setAiImportPreview(newData);
                        }}
                        placeholder="1-5"
                        className="flex-1 bg-white"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-700 w-24 shrink-0">场地评分：</span>
                      <Input
                        type="number"
                        step="0.1"
                        min="1"
                        max="5"
                        value={String(aiImportPreview[currentIndex].venue_score || '')}
                        onChange={(e) => {
                          const newData = [...aiImportPreview];
                          newData[currentIndex] = { ...newData[currentIndex], venue_score: parseFloat(e.target.value) || 0 };
                          setAiImportPreview(newData);
                        }}
                        placeholder="1-5"
                        className="flex-1 bg-white"
                      />
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">建议：</span>
                      <textarea
                        className="mt-1 w-full p-2 bg-white border border-gray-300 rounded-md text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        rows={2}
                        value={String(aiImportPreview[currentIndex].suggestions || '')}
                        onChange={(e) => {
                          const newData = [...aiImportPreview];
                          newData[currentIndex] = { ...newData[currentIndex], suggestions: e.target.value };
                          setAiImportPreview(newData);
                        }}
                        placeholder="未识别"
                      />
                    </div>
                  </>
                )}
              </div>
              
              <div className="flex gap-2 mt-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setAiImportPreview(null);
                    setCurrentIndex(0);
                  }}
                >
                  取消
                </Button>
                <Button
                  size="sm"
                  onClick={confirmImport}
                  disabled={aiImportConfirming}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {aiImportConfirming ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      导入中...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4 mr-2" />
                      确认导入{aiImportPreview.length > 1 ? `（${aiImportPreview.length}条）` : ''}
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
          </div>
          
          <DialogFooter className="shrink-0 border-t pt-4 mt-2">
            <Button variant="outline" onClick={() => {
              setAiImportDialogOpen(false);
              setUploadFile(null);
              setAiImportText('');
              setAiImportPreview(null);
              setDuplicates([]);
              setImportDecisions({});
            }}>
              取消
            </Button>
            {!aiImportPreview && (
              <Button 
                onClick={uploadFile ? handleFileImport : handleAiImport} 
                disabled={(!uploadFile && !aiImportText.trim()) || aiImportLoading || fileImportLoading || duplicateCheckLoading}
                className="bg-purple-600 hover:bg-purple-700"
              >
                {(aiImportLoading || fileImportLoading || duplicateCheckLoading) ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    AI 解析中...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" />
                    AI 分析导入
                  </>
                )}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* API Key 检查对话框 */}
      <ApiKeyCheckDialog
        open={apiKeyCheckOpen}
        onOpenChange={setApiKeyCheckOpen}
        onConfirm={handleApiKeyCheckSkip}
        onGoToSettings={() => router.push('/settings')}
      />
    </MainLayout>
  );
}
