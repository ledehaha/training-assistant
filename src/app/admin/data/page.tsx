'use client';

import { useState, useEffect, useCallback } from 'react';
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
      { key: 'hourly_rate', label: '课时费(元)', type: 'number', editable: true },
      { key: 'rating', label: '评分', type: 'number', editable: true },
      { key: 'teaching_count', label: '授课次数', type: 'number', editable: true },
      { key: 'is_active', label: '状态', type: 'boolean', editable: true },
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
      { key: 'daily_rate', label: '日租金(元)', type: 'number', editable: true },
      { key: 'facilities', label: '设施', type: 'text', editable: true },
      { key: 'rating', label: '评分', type: 'number', editable: true },
      { key: 'usage_count', label: '使用次数', type: 'number', editable: true },
      { key: 'is_active', label: '状态', type: 'boolean', editable: true },
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
      { key: 'target_audience', label: '目标人群', type: 'text', editable: true },
      { key: 'difficulty', label: '难度', type: 'select', options: ['初级', '中级', '高级'], editable: true },
      { key: 'description', label: '描述', type: 'textarea', editable: true },
      { key: 'usage_count', label: '使用次数', type: 'number', editable: true },
      { key: 'avg_rating', label: '平均评分', type: 'number', editable: true },
    ]
  },
  { 
    name: 'normative_documents', 
    label: '规范性文件', 
    icon: '📄',
    columns: [
      { key: 'id', label: 'ID', type: 'uuid', editable: false },
      { key: 'name', label: '文件名称', type: 'text', editable: true, required: true },
      { key: 'type', label: '类型', type: 'select', options: ['费用标准', '合规条款', '政策文件', '职称对照表', '其他'], editable: true },
      { key: 'content', label: '内容摘要', type: 'textarea', editable: true },
      { key: 'file_url', label: '文件链接', type: 'text', editable: true },
      { key: 'is_effective', label: '是否有效', type: 'boolean', editable: true },
    ]
  },
  { 
    name: 'projects', 
    label: '培训项目', 
    icon: '📋',
    columns: [
      { key: 'id', label: 'ID', type: 'uuid', editable: false },
      { key: 'name', label: '项目名称', type: 'text', editable: true, required: true },
      { key: 'status', label: '状态', type: 'select', options: ['draft', 'designing', 'executing', 'completed', 'archived'], editable: true },
      { key: 'training_target', label: '培训目标', type: 'text', editable: true },
      { key: 'target_audience', label: '目标人群', type: 'text', editable: true },
      { key: 'participant_count', label: '参训人数', type: 'number', editable: true },
      { key: 'training_days', label: '培训天数', type: 'number', editable: true },
      { key: 'total_budget', label: '总预算', type: 'number', editable: true },
    ]
  },
  { 
    name: 'project_courses', 
    label: '项目课程', 
    icon: '📖',
    columns: [
      { key: 'id', label: 'ID', type: 'uuid', editable: false },
      { key: 'project_id', label: '项目ID', type: 'uuid', editable: true, required: true },
      { key: 'course_name', label: '课程名称', type: 'text', editable: true },
      { key: 'teacher_id', label: '讲师ID', type: 'uuid', editable: true },
      { key: 'venue_id', label: '场地ID', type: 'uuid', editable: true },
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
      { key: 'project_id', label: '项目ID', type: 'uuid', editable: true },
      { key: 'overall_score', label: '总体评分', type: 'number', editable: true },
      { key: 'content_score', label: '内容评分', type: 'number', editable: true },
      { key: 'teacher_score', label: '讲师评分', type: 'number', editable: true },
      { key: 'venue_score', label: '场地评分', type: 'number', editable: true },
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

  // 根据表类型获取导入提示词
  const getImportPlaceholder = () => {
    const placeholders: Record<string, string> = {
      teachers: '请输入讲师信息...\n\n例如：张三，正高职称，专业领域是管理培训，来自某大学商学院\n\n提示：可省略课时费，AI将根据职称自动填充（院士1500元、正高1000元、其他500元）',
      venues: '请输入场地信息...\n\n例如：阳光培训中心，位于上海市浦东新区，可容纳100人，日租金5000元',
      course_templates: '请输入课程模板信息...\n\n例如：班组长管理技能提升，管理技能类，8课时，面向班组长',
      normative_documents: '请输入规范性文件内容...\n\n例如：讲师费标准：院士1500元/课时，正高1000元/课时，其他500元/课时',
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
    setEditDialogOpen(true);
  };

  // 打开编辑对话框
  const handleEdit = (item: Record<string, unknown>) => {
    setFormData({ ...item });
    setCurrentItem(item);
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

    setAiImportLoading(true);
    try {
      const res = await fetch('/api/admin/data/ai-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          table: selectedTable.name,
          text: aiImportText,
        }),
      });

      const result = await res.json();
      if (result.success) {
        setMessage({ type: 'success', text: result.summary || `成功导入 ${result.count} 条数据` });
        setAiImportDialogOpen(false);
        setAiImportText('');
        loadData();
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

    setFileImportLoading(true);
    try {
      const formDataObj = new FormData();
      formDataObj.append('file', uploadFile);
      formDataObj.append('table', selectedTable.name);

      const res = await fetch('/api/admin/data/ai-import-file', {
        method: 'POST',
        body: formDataObj,
      });

      const result = await res.json();
      if (result.success) {
        setMessage({ type: 'success', text: result.summary || `成功导入 ${result.count} 条数据` });
        setAiImportDialogOpen(false);
        setUploadFile(null);
        loadData();
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

  // 渲染表单字段
  const renderFormField = (col: ColumnConfig) => {
    if (!col.editable) return null;

    const value = formData[col.key] ?? '';

    switch (col.type) {
      case 'select':
        return (
          <select
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={String(value)}
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

  // 渲染单元格值
  const renderCellValue = (col: ColumnConfig, value: unknown) => {
    if (value === null || value === undefined) return '-';

    // 特殊处理文件链接字段
    if (col.key === 'file_url' && value) {
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
                  <Button variant="outline" size="sm" onClick={handleDownloadTemplate}>
                    <FileDown className="w-4 h-4 mr-1" />
                    下载模板
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleExport}>
                    <Download className="w-4 h-4 mr-1" />
                    导出
                  </Button>
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
                        {selectedTable.columns.map(col => (
                          <TableHead key={col.key}>{col.label}</TableHead>
                        ))}
                        <TableHead className="w-[100px]">操作</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredData.map((item, idx) => (
                        <TableRow 
                          key={item.id as string || idx}
                          className="cursor-pointer hover:bg-blue-50"
                          onDoubleClick={() => handleEdit(item)}
                        >
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
                      ))}
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
            {selectedTable.columns
              .filter(col => col.editable)
              .map(col => (
                <div key={col.key} className="space-y-2">
                  <Label>
                    {col.label}
                    {col.required && <span className="text-red-500 ml-1">*</span>}
                  </Label>
                  {renderFormField(col)}
                </div>
              ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleSave}>保存</Button>
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

      {/* AI 智能导入对话框 */}
      <Dialog open={aiImportDialogOpen} onOpenChange={setAiImportDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-purple-500" />
              AI 智能导入
            </DialogTitle>
            <DialogDescription>
              AI 将自动解析内容并导入到「{selectedTable.label}」表
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* 文件上传区域（支持拖拽） */}
            <div
              className={`border-2 border-dashed rounded-lg p-6 transition-colors ${
                isDragging 
                  ? 'border-purple-500 bg-purple-50' 
                  : 'border-gray-300 hover:border-purple-400'
              }`}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={(e) => {
                e.preventDefault();
                setIsDragging(false);
              }}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                const file = e.dataTransfer.files?.[0];
                if (file) {
                  const ext = file.name.split('.').pop()?.toLowerCase();
                  if (['pdf', 'doc', 'docx', 'xls', 'xlsx'].includes(ext || '')) {
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
                accept=".pdf,.doc,.docx,.xls,.xlsx"
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
                        支持 PDF、Word (.doc/.docx)、Excel (.xls/.xlsx)
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

            {/* 规范性文件提示 */}
            <div className="bg-gradient-to-r from-purple-50 to-blue-50 p-3 rounded-lg text-sm">
              <div className="flex items-start gap-2">
                <FileText className="w-4 h-4 text-purple-500 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium text-purple-700">智能参考规范性文件</p>
                  <p className="text-xs text-gray-600 mt-1">
                    AI 将根据费用标准、合规条款等自动补全数据
                  </p>
                </div>
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
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setAiImportDialogOpen(false);
              setUploadFile(null);
              setAiImportText('');
            }}>
              取消
            </Button>
            <Button 
              onClick={uploadFile ? handleFileImport : handleAiImport} 
              disabled={(!uploadFile && !aiImportText.trim()) || aiImportLoading || fileImportLoading}
              className="bg-purple-600 hover:bg-purple-700"
            >
              {(aiImportLoading || fileImportLoading) ? (
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
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
