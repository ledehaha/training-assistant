'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Key, Settings, ArrowRight } from 'lucide-react';

interface ApiKeyCheckDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void; // 用户选择跳过时执行
  onGoToSettings: () => void; // 用户选择去配置时执行
  title?: string;
  description?: string;
}

// 检查 API Key 是否已配置
export async function checkApiKeyConfigured(): Promise<boolean> {
  try {
    const res = await fetch('/api/settings/api-key');
    const data = await res.json();
    return data.configured === true;
  } catch {
    return false;
  }
}

export default function ApiKeyCheckDialog({
  open,
  onOpenChange,
  onConfirm,
  onGoToSettings,
  title = '需要配置 API Key',
  description = '此功能需要配置 AI API Key 才能使用。您可以选择前往设置页面配置，或者手动填写信息。',
}: ApiKeyCheckDialogProps) {
  const handleSkip = () => {
    onOpenChange(false);
    onConfirm();
  };

  const handleGoToSettings = () => {
    onOpenChange(false);
    onGoToSettings();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Key className="w-5 h-5 text-orange-500" />
            {title}
          </DialogTitle>
          <DialogDescription className="pt-2">
            {description}
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <div className="flex items-center gap-3 p-3 bg-orange-50 rounded-lg text-sm text-orange-700">
            <Settings className="w-5 h-5 flex-shrink-0" />
            <span>配置 API Key 后可使用 AI 智能分析、智能推荐等功能</span>
          </div>
        </div>
        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={handleSkip}
            className="w-full sm:w-auto"
          >
            跳过，手动填写
          </Button>
          <Button
            onClick={handleGoToSettings}
            className="w-full sm:w-auto"
          >
            去配置
            <ArrowRight className="w-4 h-4 ml-1" />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Hook: 检查 API Key 并显示对话框
export function useApiKeyCheck() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isConfigured, setIsConfigured] = useState<boolean | null>(null);
  const [pendingCallback, setPendingCallback] = useState<(() => void) | null>(null);

  // 执行需要 API Key 的操作
  const executeWithApiKeyCheck = (callback: () => void) => {
    if (isConfigured === false) {
      // 未配置，显示对话框
      setPendingCallback(() => callback);
      setDialogOpen(true);
    } else {
      // 已配置，直接执行
      callback();
    }
  };

  // 用户选择跳过
  const handleSkip = () => {
    if (pendingCallback) {
      pendingCallback();
      setPendingCallback(null);
    }
  };

  return {
    isConfigured,
    setIsConfigured,
    dialogOpen,
    setDialogOpen,
    executeWithApiKeyCheck,
    handleSkip,
  };
}
