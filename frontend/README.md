# AI 听觉康复助手 - 前端

人工耳蜗术后听觉康复训练的 Web 前端应用。

## 技术栈

| 类别 | 选型 |
|------|------|
| 框架 | React 18 + TypeScript |
| 构建 | Vite 5 |
| UI 组件 | MUI 5 + Tailwind CSS 3 |
| 状态管理 | Zustand 4 |
| 数据请求 | Axios + TanStack Query 5 |
| 图表 | ECharts 5 |
| 音频 | WaveSurfer.js 7 |
| 路由 | React Router 6 |

## 快速开始

```bash
# 安装依赖
npm install

# 启动开发服务器（默认 http://localhost:3000）
npm run dev

# 构建生产版本
npm run build

# 预览构建结果
npm run preview
```

## 项目结构

```
src/
├── api/            # API 请求封装（Axios 实例、请求/响应拦截器）
├── assets/         # 静态资源（图片、音频）
├── components/     # 通用 UI 组件
│   ├── AccessibilityToolbar.tsx   # 无障碍工具栏（字体/语速调节）
│   ├── AudioPlayer.tsx           # 音频播放器组件
│   ├── FeedbackCard.tsx          # 反馈卡片
│   ├── Layout.tsx                # 页面布局骨架
│   ├── Navbar.tsx                # 导航栏
│   └── WaveformVisualizer.tsx    # 波形可视化
├── hooks/          # 自定义 React Hooks
├── pages/          # 页面组件
│   ├── DialoguePage.tsx      # 对话陪练页
│   ├── HomePage.tsx          # 首页/训练选择
│   ├── LoginPage.tsx         # 登录页
│   ├── ProfilePage.tsx       # 个人中心
│   ├── PronunciationPage.tsx # 发音反馈页
│   ├── ReportPage.tsx        # 训练报告页
│   ├── SettingsPage.tsx      # 设置页
│   ├── TrainingPage.tsx      # 听觉训练页
│   └── TrainingResult.tsx    # 训练结果页
├── services/       # 业务 API 服务层
├── stores/         # Zustand 状态仓库
├── theme/          # MUI 主题配置（含无障碍适配）
├── types/          # TypeScript 类型定义
├── utils/          # 工具函数
├── App.tsx         # 根组件（路由配置）
└── main.tsx        # 应用入口
```

## 开发命令

| 命令 | 说明 |
|------|------|
| `npm run dev` | 启动开发服务器（HMR 热更新） |
| `npm run build` | TypeScript 类型检查 + Vite 生产构建 |
| `npm run lint` | ESLint 代码检查 |
| `npm run lint:fix` | ESLint 自动修复 |
| `npm run format` | Prettier 格式化 |
| `npm run format:check` | Prettier 格式检查 |

## 环境变量

开发服务器默认连接 `http://localhost:8000` 的后端 API。如需修改，创建 `.env.local` 文件：

```env
VITE_API_BASE_URL=http://your-backend-host:8000
```

## 无障碍支持

本项目面向听觉障碍用户，内置以下无障碍特性：

- **字体调节**：支持 3 级字体大小切换
- **语速调节**：TTS 播放语速可调（0.5x ~ 2.0x）
- **高对比度**：支持高对比度主题切换
- **键盘导航**：所有交互元素支持键盘操作
