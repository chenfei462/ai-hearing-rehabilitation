# 40 — 前端规则（React 18 + TypeScript + Vite）

## 结构与规范

- 目录：`src/{pages,components,hooks,stores,services,api,theme,types,utils}`；页面级组件放 `pages/`，可复用组件放 `components/{common,charts,layout}`。
- TypeScript strict；共享类型统一放 `src/types/index.ts`，禁止在 service 文件内重复定义类型（历史 A14 教训）。
- Lint：`npm run lint`（eslint，--max-warnings 0）；格式：prettier。构建 = `tsc && vite build`，typecheck 失败即构建失败。

## 状态管理

- Zustand：`authStore`（用户/会话唯一来源）、`a11yStore`（无障碍偏好）、`sessionStore`（训练会话运行时状态）。
- 服务端数据用 TanStack Query，禁止手写 loading/竞态逻辑。
- 已废弃的 `stores/useAppStore.ts`（deprecated 兼容层）与 `appStore` 重复状态：清理走 ARCH-006 任务，禁止新代码 import deprecated 文件。

## API 调用

- 统一走 `services/api.ts` axios 实例：httpOnly Cookie 凭据、`{code,data,message}` 解包、40101 处理。
- 401 处理禁止硬 `window.location.href` 跳转丢状态；用 React Router navigate + 用户提示（历史 A10 教训）。
- 新页面必须配 service 层封装，禁止组件内裸 axios。

## 音频与录音

- 录音统一 `hooks/useRecorder.ts`（MediaRecorder + recorder-core 兜底，微信 WebView 兼容）；对外接口以 hook 实际返回值为准（历史 B1 教训：禁止使用不存在的属性，如 `isRecording`/`clearRecording`）。
- `URL.createObjectURL` 必须配对 revoke（useRef 或依赖数组追踪，历史 A5 教训）。
- 上传统一 wav 16kHz 单声道 multipart/form-data。
- 播放用 `hooks/useAudioPlayer.ts`；TTS 不可用时 Web Speech API 兜底。

## 老年适配（强制验收项）

- 字号 ≥18px、触控目标 ≥48px、对比度 ≥4.5:1；token 集中在 `theme/index.ts` 与 `tailwind.config.js`，禁止页面内硬编码覆盖。
- 关键操作有语音引导（`hooks/useSpeechGuide.ts`）与字幕（`components/common/Subtitle.tsx`）。
- 新页面必须通过无障碍核查（AccessibilityPanel / a11yStore 的大字模式生效）。

## 测试

- 单测：vitest + Testing Library（现有 `*.test.tsx` 5 个：LoginPage、HomePage、DialoguePage、TrainingPage、authStore、utils/errors）；新页面必须带渲染与关键交互测试。
- E2E：playwright（`npm run test:e2e`）；CI 跑 chromium 冒烟。
- 禁止为过门禁删测/skip；mock 外部 AI 接口，禁止测试打真实 dashscope。
