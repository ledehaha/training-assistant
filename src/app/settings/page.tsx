'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { 
  Key, 
  Save, 
  Eye, 
  EyeOff, 
  CheckCircle, 
  XCircle, 
  Info,
  ExternalLink 
} from 'lucide-react';
import { cn } from '@/lib/utils';

export default function SettingsPage() {
  const [apiKey, setApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [isConfigured, setIsConfigured] = useState(false);

  useEffect(() => {
    // 检查当前配置状态
    checkApiKeyStatus();
  }, []);

  const checkApiKeyStatus = async () => {
    try {
      const response = await fetch('/api/settings/api-key');
      const data = await response.json();
      setIsConfigured(data.configured || false);
    } catch (error) {
      console.error('检查API Key状态失败:', error);
    }
  };

  const handleSaveApiKey = async () => {
    if (!apiKey.trim()) {
      return;
    }

    setIsSaving(true);
    setSaveStatus('idle');

    try {
      const response = await fetch('/api/settings/api-key', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ apiKey: apiKey.trim() }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setSaveStatus('success');
        setIsConfigured(true);
        setApiKey(''); // 清空输入框，不再显示已保存的密钥
        // 重新检查状态
        setTimeout(() => {
          checkApiKeyStatus();
        }, 500);
      } else {
        setSaveStatus('error');
      }
    } catch (error) {
      console.error('保存API Key失败:', error);
      setSaveStatus('error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleClearApiKey = async () => {
    if (!confirm('确定要清除已配置的 API Key 吗？清除后将无法使用 AI 智能功能。')) {
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch('/api/settings/api-key', {
        method: 'DELETE',
      });

      if (response.ok) {
        setIsConfigured(false);
        setSaveStatus('idle');
      }
    } catch (error) {
      console.error('清除API Key失败:', error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">系统设置</h1>
        <p className="mt-1 text-sm text-gray-500">
          配置系统的各项参数和功能
        </p>
      </div>

      {/* API Key 配置 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Key className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <CardTitle className="text-lg">AI API Key 配置</CardTitle>
                <CardDescription>
                  配置 API Key 以启用 AI 智能推荐功能
                </CardDescription>
              </div>
            </div>
            {isConfigured ? (
              <Badge variant="default" className="bg-green-100 text-green-700 hover:bg-green-100">
                <CheckCircle className="w-3 h-3 mr-1" />
                已配置
              </Badge>
            ) : (
              <Badge variant="secondary" className="bg-gray-100 text-gray-600">
                <XCircle className="w-3 h-3 mr-1" />
                未配置
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription className="text-sm">
              <p className="font-medium mb-1">API Key 说明：</p>
              <ul className="list-disc list-inside space-y-1 text-gray-600">
                <li>API Key 用于启用 AI 智能推荐功能（课程、讲师、场地推荐）</li>
                <li>支持智能解析导入 PDF、Word、Excel、PPT 文件</li>
                <li>API Key 安全存储在服务器端，不会暴露给前端</li>
                <li>如未配置，文件导入将仅提取文本摘要</li>
              </ul>
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <Label htmlFor="apiKey">API Key</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  id="apiKey"
                  type={showApiKey ? 'text' : 'password'}
                  placeholder={isConfigured ? '已配置，输入新的 API Key 可更新' : '请输入您的 API Key'}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showApiKey ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
              <Button
                onClick={handleSaveApiKey}
                disabled={!apiKey.trim() || isSaving}
                className="min-w-[100px]"
              >
                {isSaving ? (
                  <span className="flex items-center gap-2">
                    <span className="animate-spin">⏳</span>
                    保存中
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <Save className="w-4 h-4" />
                    保存
                  </span>
                )}
              </Button>
            </div>
            {saveStatus === 'success' && (
              <p className="text-sm text-green-600 flex items-center gap-1">
                <CheckCircle className="w-4 h-4" />
                API Key 保存成功
              </p>
            )}
            {saveStatus === 'error' && (
              <p className="text-sm text-red-600 flex items-center gap-1">
                <XCircle className="w-4 h-4" />
                API Key 保存失败，请重试
              </p>
            )}
          </div>

          {isConfigured && (
            <div className="pt-4 border-t">
              <Button
                variant="outline"
                onClick={handleClearApiKey}
                disabled={isSaving}
                className="text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                清除已配置的 API Key
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 功能说明 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">功能说明</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="p-4 bg-blue-50 rounded-lg">
              <h4 className="font-medium text-blue-900 mb-2">AI 智能推荐</h4>
              <p className="text-sm text-blue-700">
                根据培训需求自动推荐合适的课程、讲师和场地
              </p>
            </div>
            <div className="p-4 bg-green-50 rounded-lg">
              <h4 className="font-medium text-green-900 mb-2">智能文件解析</h4>
              <p className="text-sm text-green-700">
                上传文件自动解析内容，智能提取关键信息导入
              </p>
            </div>
            <div className="p-4 bg-purple-50 rounded-lg">
              <h4 className="font-medium text-purple-900 mb-2">满意度分析</h4>
              <p className="text-sm text-purple-700">
                AI 分析培训反馈，生成满意度分析报告
              </p>
            </div>
            <div className="p-4 bg-orange-50 rounded-lg">
              <h4 className="font-medium text-orange-900 mb-2">智能报价</h4>
              <p className="text-sm text-orange-700">
                根据培训方案自动计算并优化报价
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 关于 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">关于系统</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex justify-between items-center py-2 border-b">
            <span className="text-gray-600">系统版本</span>
            <span className="font-medium">1.0.0</span>
          </div>
          <div className="flex justify-between items-center py-2 border-b">
            <span className="text-gray-600">技术栈</span>
            <span className="font-medium">Next.js 16 + React 19</span>
          </div>
          <div className="flex justify-between items-center py-2">
            <span className="text-gray-600">数据库</span>
            <span className="font-medium">SQLite (sql.js)</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
