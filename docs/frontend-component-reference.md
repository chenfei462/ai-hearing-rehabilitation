# 前端组件参考

本文档记录可复用前端组件的用途、Props 和输入约束。组件源码位于
`frontend/src/components/`；类型定义以源码和 `frontend/src/types/index.ts` 为准。

## 通用组件

### `BigButton`

老年友好操作按钮，默认启用语音提示，并在加载时显示进度指示器。

| Prop | 类型 | 默认值 | 说明 |
|---|---|---:|---|
| `children` | `React.ReactNode` | — | 按钮内容；当为字符串且 `withSpeech` 开启时会朗读。 |
| `onClick` | `(event: React.MouseEvent<HTMLButtonElement>) => void` | — | 点击回调。加载中或禁用时不会触发。 |
| `loading` | `boolean` | `false` | 显示加载状态并禁用按钮。 |
| `withSpeech` | `boolean` | `true` | 是否在点击时使用语音引导。 |
| 其他 | `ButtonProps` | — | 透传 Material UI `Button` 属性；`onClick` 使用上表类型。 |

### `ElderlyButton`

提供更大字号和触控区域的 Material UI 按钮，适合听觉康复训练流程中的主要操作。

| Prop | 类型 | 默认值 | 说明 |
|---|---|---:|---|
| `children` | `React.ReactNode` | — | 按钮内容；字符串内容可被 `speak` 朗读。 |
| `speak` | `(text: string) => void` | — | 可选的语音提示回调。 |
| 其他 | `ButtonProps` | — | 透传 Material UI `Button` 属性。 |

### `LevelBadge`

展示训练级别及其难度标签。

| Prop | 类型 | 默认值 | 说明 |
|---|---|---:|---|
| `level` | `TrainingLevel` | — | 必填；可选值为 `syllable`、`word`、`sentence`、`noise`。 |
| `showDifficulty` | `boolean` | `true` | 是否同时显示难度，例如“词语 · 初级”。 |
| 其他 | `Omit<ChipProps, 'label' \| 'color'>` | — | 透传 Material UI `Chip` 属性；标签和颜色由级别决定。 |

### `ScoreRing`

以环形进度图展示发音评分。传入的分数会被限制到 `0-100`。

| Prop | 类型 | 默认值 | 说明 |
|---|---|---:|---|
| `score` | `number` | — | 必填；评分值，超出范围会被钳制。 |
| `size` | `number` | `120` | 环形图直径，单位为像素。 |
| `strokeWidth` | `number` | `8` | 环宽，单位为像素。 |
| `label` | `string` | — | 环内自定义文字标签。 |
| `color` | `string` | — | 自定义环和分数颜色；未传入时按分数自动选择。 |
| `showValue` | `boolean` | `true` | 是否显示数值。 |
| `sx` | `SxProps<Theme>` | — | Material UI 样式扩展。 |

### `Subtitle`

显示训练或对话字幕，并跟随无障碍设置自动处理显示开关和高对比度。

| Prop | 类型 | 默认值 | 说明 |
|---|---|---:|---|
| `text` | `string` | — | 必填；为空时不渲染。 |
| `active` | `boolean` | `false` | 是否以高亮颜色显示当前字幕。 |
| `withBackground` | `boolean` | `true` | 是否显示字幕背景。 |

## 图表组件

图表基于 `echarts-for-react` 渲染，容器宽度自适应。数据数组应由服务层转换为下列结构，组件不负责请求数据。

### `TrendChart`

展示按日期聚合的正确率和训练次数趋势。

| Prop | 类型 | 默认值 | 说明 |
|---|---|---:|---|
| `data` | `AccuracyPoint[]` | — | 必填；每项至少包含 `date`、`accuracy`（`0-1`）和 `session_count`。 |
| `title` | `string` | `正确率趋势` | 图表标题。 |

### `AdherenceChart`

展示训练依从率仪表盘和连续训练天数。

| Prop | 类型 | 默认值 | 说明 |
|---|---|---:|---|
| `rate` | `number` | — | 必填；依从率，按 `0-1` 传入，组件转换为百分比。 |
| `streakDays` | `number` | — | 必填；连续训练天数。 |
| `title` | `string` | `训练依从率` | 图表标题。 |

### `LevelProgressChart`

以雷达图展示音节、词语、语句和噪声环境四个训练级别的能力值及正确率。

| Prop | 类型 | 默认值 | 说明 |
|---|---|---:|---|
| `data` | `LevelProgress[]` | — | 必填；按 `level`、`theta` 和 `avg_accuracy` 提供进度数据。 |
| `title` | `string` | `训练级别进度` | 图表标题。 |

`data` 中缺少某个级别时，该级别会以 `0` 展示。`theta` 映射到雷达图时会加 `1`，正确率会映射到 `0-3` 范围。

## 硬件组件

### `HardwareStatus`

显示硬件在线数量，并提供设备展开、刷新、连接和断开操作。设备列表由 `useHardware` 轮询获取。

| Prop | 类型 | 默认值 | 说明 |
|---|---|---:|---|
| `defaultExpanded` | `boolean` | `false` | 是否默认展开设备详情面板。 |
| `showControls` | `boolean` | `true` | 是否显示连接、断开和设备面板控制按钮。 |

### `HardwareControlPanel`

向已连接设备发送 LED、蜂鸣器和显示屏控制命令。

| Prop | 类型 | 默认值 | 说明 |
|---|---|---:|---|
| `deviceId` | `string` | — | 必填；目标设备标识。 |
| `isConnected` | `boolean` | — | 必填；为 `false` 时只显示设备未连接提示，不发送命令。 |

## 无障碍组件

### `AccessibilityPanel`

内嵌无障碍设置面板。组件无外部 Props，配置通过 `useA11yStore` 管理，包括字体大小、音量和语音引导开关。

## 使用示例

```tsx
<LevelBadge level="word" />
<ScoreRing score={82} label="本次评分" />
<TrendChart data={accuracyPoints} />
<HardwareStatus showControls={false} />
```

## 维护约定

- 新增或修改组件 Props 时，同步更新本文档和对应的 TypeScript interface。
- 服务层负责校验和转换 API 数据；图表组件只负责展示。
- 需要无障碍行为时优先复用 `BigButton`、`ElderlyButton` 和 `AccessibilityPanel`，避免在页面中重复实现。
