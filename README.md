# 非学历培训全周期助手

> 从需求分析到项目总结的完整闭环管理系统

---

这是一个基于 [Next.js 16](https://nextjs.org) + [shadcn/ui](https://ui.shadcn.com) 的全栈应用项目，由扣子编程 CLI 创建。

## 快速开始

```bash
# 安装依赖
pnpm install

# 启动开发服务器
coze dev
```

访问 [http://localhost:5000](http://localhost:5000) 查看应用。

## 功能特性

- **项目设计**：需求分析、方案设计、费用预算
- **项目申报**：申报材料生成、审批流程
- **项目总结**：满意度调查、总结报告
- **项目查询**：项目检索、统计分析
- **数据管理**：讲师、场地、课程模板、规范性文件的增删改查
- **AI 智能**：智能推荐课程/讲师/场地、智能导入数据

## 部署方式

### 开发环境

```bash
# 安装依赖
pnpm install

# 启动开发服务器
coze dev
```

启动后，在浏览器中打开 [http://localhost:5000](http://localhost:5000) 查看应用。

### 生产环境 - Docker 部署

> 详细部署指南请查看 [deploy/DOCKER_DEPLOY_GUIDE.md](./deploy/DOCKER_DEPLOY_GUIDE.md)

**快速部署步骤：**

1. **安装 Container Manager**
   
   群晖套件中心搜索「Container Manager」并安装（等同于 Docker）

2. **上传代码**
   
   - 下载项目 ZIP 包
   - 通过 SCP 或 File Station 上传到 `/volume1/docker/training-assistant/`

3. **配置环境变量**
   ```bash
   cd /volume1/docker/training-assistant
   cp .env.example .env
   nano .env  # 填入 API 密钥
   ```

4. **启动服务**
   ```bash
   docker compose up -d --build
   ```

5. **访问应用**
   
   打开 `http://你的NAS_IP:5000`

**更新应用：**
```bash
# 上传新代码后执行
cd /volume1/docker/training-assistant
docker compose up -d --build
```

**部署文件说明：**

| 文件 | 说明 |
|------|------|
| `Dockerfile` | Docker 镜像构建文件 |
| `docker-compose.yml` | Docker Compose 配置 |
| `.env.example` | 环境变量示例 |
| `deploy/docker-deploy.sh` | 一键部署脚本 |
| `deploy/update.sh` | 更新脚本 |
| `deploy/backup-docker.sh` | 备份脚本 |

## 项目结构

```
src/
├── app/                      # Next.js App Router 目录
│   ├── layout.tsx           # 根布局组件
│   ├── page.tsx             # 首页
│   ├── globals.css          # 全局样式（包含 shadcn 主题变量）
│   └── [route]/             # 其他路由页面
├── components/              # React 组件目录
│   └── ui/                  # shadcn/ui 基础组件（优先使用）
│       ├── button.tsx
│       ├── card.tsx
│       └── ...
├── lib/                     # 工具函数库
│   └── utils.ts            # cn() 等工具函数
└── hooks/                   # 自定义 React Hooks（可选）
```

## 核心开发规范

### 1. 组件开发

**优先使用 shadcn/ui 基础组件**

本项目已预装完整的 shadcn/ui 组件库，位于 `src/components/ui/` 目录。开发时应优先使用这些组件作为基础：

```tsx
// ✅ 推荐：使用 shadcn 基础组件
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

export default function MyComponent() {
  return (
    <Card>
      <CardHeader>标题</CardHeader>
      <CardContent>
        <Input placeholder="输入内容" />
        <Button>提交</Button>
      </CardContent>
    </Card>
  );
}
```

**可用的 shadcn 组件清单**

- 表单：`button`, `input`, `textarea`, `select`, `checkbox`, `radio-group`, `switch`, `slider`
- 布局：`card`, `separator`, `tabs`, `accordion`, `collapsible`, `scroll-area`
- 反馈：`alert`, `alert-dialog`, `dialog`, `toast`, `sonner`, `progress`
- 导航：`dropdown-menu`, `menubar`, `navigation-menu`, `context-menu`
- 数据展示：`table`, `avatar`, `badge`, `hover-card`, `tooltip`, `popover`
- 其他：`calendar`, `command`, `carousel`, `resizable`, `sidebar`

详见 `src/components/ui/` 目录下的具体组件实现。

### 2. 路由开发

Next.js 使用文件系统路由，在 `src/app/` 目录下创建文件夹即可添加路由：

```bash
# 创建新路由 /about
src/app/about/page.tsx

# 创建动态路由 /posts/[id]
src/app/posts/[id]/page.tsx

# 创建路由组（不影响 URL）
src/app/(marketing)/about/page.tsx

# 创建 API 路由
src/app/api/users/route.ts
```

**页面组件示例**

```tsx
// src/app/about/page.tsx
import { Button } from '@/components/ui/button';

export const metadata = {
  title: '关于我们',
  description: '关于页面描述',
};

export default function AboutPage() {
  return (
    <div>
      <h1>关于我们</h1>
      <Button>了解更多</Button>
    </div>
  );
}
```

**动态路由示例**

```tsx
// src/app/posts/[id]/page.tsx
export default async function PostPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return <div>文章 ID: {id}</div>;
}
```

**API 路由示例**

```tsx
// src/app/api/users/route.ts
import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({ users: [] });
}

export async function POST(request: Request) {
  const body = await request.json();
  return NextResponse.json({ success: true });
}
```

### 3. 依赖管理

**必须使用 pnpm 管理依赖**

```bash
# ✅ 安装依赖
pnpm install

# ✅ 添加新依赖
pnpm add package-name

# ✅ 添加开发依赖
pnpm add -D package-name

# ❌ 禁止使用 npm 或 yarn
# npm install  # 错误！
# yarn add     # 错误！
```

项目已配置 `preinstall` 脚本，使用其他包管理器会报错。

### 4. 样式开发

**使用 Tailwind CSS v4**

本项目使用 Tailwind CSS v4 进行样式开发，并已配置 shadcn 主题变量。

```tsx
// 使用 Tailwind 类名
<div className="flex items-center gap-4 p-4 rounded-lg bg-background">
  <Button className="bg-primary text-primary-foreground">
    主要按钮
  </Button>
</div>

// 使用 cn() 工具函数合并类名
import { cn } from '@/lib/utils';

<div className={cn(
  "base-class",
  condition && "conditional-class",
  className
)}>
  内容
</div>
```

**主题变量**

主题变量定义在 `src/app/globals.css` 中，支持亮色/暗色模式：

- `--background`, `--foreground`
- `--primary`, `--primary-foreground`
- `--secondary`, `--secondary-foreground`
- `--muted`, `--muted-foreground`
- `--accent`, `--accent-foreground`
- `--destructive`, `--destructive-foreground`
- `--border`, `--input`, `--ring`

### 5. 表单开发

推荐使用 `react-hook-form` + `zod` 进行表单开发：

```tsx
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const formSchema = z.object({
  username: z.string().min(2, '用户名至少 2 个字符'),
  email: z.string().email('请输入有效的邮箱'),
});

export default function MyForm() {
  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: { username: '', email: '' },
  });

  const onSubmit = (data: z.infer<typeof formSchema>) => {
    console.log(data);
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)}>
      <Input {...form.register('username')} />
      <Input {...form.register('email')} />
      <Button type="submit">提交</Button>
    </form>
  );
}
```

### 6. 数据获取

**服务端组件（推荐）**

```tsx
// src/app/posts/page.tsx
async function getPosts() {
  const res = await fetch('https://api.example.com/posts', {
    cache: 'no-store', // 或 'force-cache'
  });
  return res.json();
}

export default async function PostsPage() {
  const posts = await getPosts();

  return (
    <div>
      {posts.map(post => (
        <div key={post.id}>{post.title}</div>
      ))}
    </div>
  );
}
```

**客户端组件**

```tsx
'use client';

import { useEffect, useState } from 'react';

export default function ClientComponent() {
  const [data, setData] = useState(null);

  useEffect(() => {
    fetch('/api/data')
      .then(res => res.json())
      .then(setData);
  }, []);

  return <div>{JSON.stringify(data)}</div>;
}
```

## 常见开发场景

### 添加新页面

1. 在 `src/app/` 下创建文件夹和 `page.tsx`
2. 使用 shadcn 组件构建 UI
3. 根据需要添加 `layout.tsx` 和 `loading.tsx`

### 创建业务组件

1. 在 `src/components/` 下创建组件文件（非 UI 组件）
2. 优先组合使用 `src/components/ui/` 中的基础组件
3. 使用 TypeScript 定义 Props 类型

### 添加全局状态

推荐使用 React Context 或 Zustand：

```tsx
// src/lib/store.ts
import { create } from 'zustand';

interface Store {
  count: number;
  increment: () => void;
}

export const useStore = create<Store>((set) => ({
  count: 0,
  increment: () => set((state) => ({ count: state.count + 1 })),
}));
```

### 集成数据库

推荐使用 Prisma 或 Drizzle ORM，在 `src/lib/db.ts` 中配置。

## 技术栈

- **框架**: Next.js 16.1.1 (App Router)
- **UI 组件**: shadcn/ui (基于 Radix UI)
- **样式**: Tailwind CSS v4
- **表单**: React Hook Form + Zod
- **图标**: Lucide React
- **字体**: Geist Sans & Geist Mono
- **包管理器**: pnpm 9+
- **TypeScript**: 5.x

## 参考文档

- [Next.js 官方文档](https://nextjs.org/docs)
- [shadcn/ui 组件文档](https://ui.shadcn.com)
- [Tailwind CSS 文档](https://tailwindcss.com/docs)
- [React Hook Form](https://react-hook-form.com)

## 重要提示

1. **必须使用 pnpm** 作为包管理器
2. **优先使用 shadcn/ui 组件** 而不是从零开发基础组件
3. **遵循 Next.js App Router 规范**，正确区分服务端/客户端组件
4. **使用 TypeScript** 进行类型安全开发
5. **使用 `@/` 路径别名** 导入模块（已配置）

---

## 故障排查

### 服务启动失败

#### 问题：`node_modules/.bin/next: No such file or directory`

**原因**：依赖未完全安装或损坏

**解决方案**：

```bash
# 方案1：使用恢复脚本（推荐）
bash scripts/recover.sh

# 方案2：手动重新安装
rm -rf node_modules pnpm-lock.yaml
pnpm install
```

#### 问题：端口 5000 被占用

**原因**：之前的服务未正确关闭

**解决方案**：

```bash
# 方案1：使用恢复脚本自动处理
bash scripts/recover.sh

# 方案2：手动查找并关闭占用端口的进程
ss -lntp | grep :5000
kill -9 <PID>
```

#### 问题：`.next` 缓存损坏

**症状**：启动时报错或页面显示异常

**解决方案**：

```bash
# 清理缓存
rm -rf .next

# 重新启动
coze dev
```

### 常用诊断工具

#### 快速诊断

```bash
# 运行诊断脚本，检查环境状态
bash scripts/diagnose.sh
```

诊断脚本会检查：
- 文件系统完整性
- 依赖安装状态
- 构建配置
- 运行时状态
- 磁盘空间

#### 完整恢复

```bash
# 运行恢复脚本，自动修复所有常见问题
bash scripts/recover.sh
```

恢复脚本会：
- 释放被占用的端口
- 清理损坏的缓存
- 重新安装依赖

### 查看日志

```bash
# 查看开发服务器日志
tail -f /app/work/logs/bypass/dev.log

# 查看应用日志
tail -f /app/work/logs/bypass/app.log

# 查看控制台日志
tail -f /app/work/logs/bypass/console.log

# 搜索错误
grep -iE "error|exception" /app/work/logs/bypass/dev.log | tail -20
```

### 常见错误码

| 错误信息 | 原因 | 解决方案 |
|---------|------|---------|
| `Cannot find module 'next/dist/...'` | Next.js 依赖缺失 | 运行 `bash scripts/recover.sh` |
| `duplicate column name` | 数据库迁移问题 | 运行 `rm -f training.db && coze dev` |
| `cannot unmarshal array` | API 请求格式错误 | 检查 API 调用是否发送了数组类型的数据 |
| `Port 5000 is already in use` | 端口被占用 | 运行 `bash scripts/recover.sh` |
| `EMFILE: too many open files` | 文件描述符限制 | 检查磁盘空间和进程数量 |

### 手动修复步骤

如果自动恢复脚本无法解决问题，请按以下步骤手动修复：

```bash
# 1. 停止所有服务
pkill -f "next dev"
pkill -f "node"

# 2. 清理所有缓存和依赖
rm -rf node_modules .next .pnpm-store

# 3. 重新安装依赖
pnpm install

# 4. 验证 Next.js 是否正确安装
test -f node_modules/.bin/next && echo "Next.js 安装成功" || echo "Next.js 安装失败"

# 5. 启动服务
coze dev
```

### 获取帮助

如果以上方法都无法解决问题，请提供以下信息：

1. 错误信息截图或日志
2. 诊断脚本输出：`bash scripts/diagnose.sh > diagnose-report.txt`
3. 环境信息：
   - Node.js 版本：`node --version`
   - pnpm 版本：`pnpm --version`
   - 操作系统：`uname -a`
