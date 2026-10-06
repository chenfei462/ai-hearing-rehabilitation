# 硬件集成指南

## 1. 架构概览

```
┌──────────────────────────────────────────────────────────────────┐
│                        用户浏览器 (前端)                          │
│  React + TypeScript + MUI                                        │
│  ┌─────────────┐  ┌──────────────────┐  ┌───────────────────┐   │
│  │ 训练页面     │  │ 硬件状态组件      │  │ 硬件控制面板      │   │
│  │ TrainingPage │  │ HardwareStatus   │  │ ControlPanel      │   │
│  └──────┬──────┘  └────────┬─────────┘  └────────┬──────────┘   │
└─────────┼──────────────────┼──────────────────────┼──────────────┘
          │                  │                      │
          │ HTTP API         │ HTTP API              │ HTTP API
          ▼                  ▼                      ▼
┌──────────────────────────────────────────────────────────────────┐
│                     FastAPI 后端                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                    硬件管理器 (DeviceManager)              │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐ │   │
│  │  │ 设备注册  │  │ 事件分发  │  │ 自动重连  │  │ 状态查询  │ │   │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘ │   │
│  └───────────────────────┬──────────────────────────────────┘   │
│                          │                                       │
│  ┌───────────────────────┼──────────────────────────────────┐   │
│  │                 通信协议层                                  │   │
│  │  ┌─────────────────┐  │  ┌─────────────────┐             │   │
│  │  │ WebSocket 协议   │  │  │ 串口协议         │             │   │
│  │  │ (ESP32 WiFi)    │  │  │ (Arduino USB)   │             │   │
│  │  └────────┬────────┘  │  └────────┬────────┘             │   │
│  └───────────┼───────────┼───────────┼──────────────────────┘   │
└──────────────┼───────────┼───────────┼──────────────────────────┘
               │           │           │
               │ WiFi      │ WiFi      │ USB 串口
               ▼           ▼           ▼
┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│  ESP32 训练站     │  │  ESP32 训练站     │  │  Arduino 设备    │
│  ┌────┐ ┌────┐   │  │  ┌────┐ ┌────┐   │  │  ┌────┐ ┌────┐  │
│  │按钮│ │LED │   │  │  │按钮│ │LED │   │  │  │按钮│ │LED │  │
│  └────┘ └────┘   │  │  └────┘ └────┘   │  │  └────┘ └────┘  │
│  ┌────┐ ┌────┐   │  │  ┌────┐ ┌────┐   │  │  ┌────┐ ┌────┐  │
│  │噪声│ │蜂鸣│   │  │  │噪声│ │蜂鸣│   │  │  │噪声│ │蜂鸣│  │
│  └────┘ └────┘   │  │  └────┘ └────┘   │  │  └────┘ └────┘  │
└──────────────────┘  └──────────────────┘  └──────────────────┘
```

## 2. 硬件接口说明

### 2.1 支持的设备类型

| 设备类型 | 通信方式 | 适用场景 |
|----------|----------|----------|
| ESP32 训练站 | WebSocket (WiFi) | 推荐，实时双向通信，延迟 <100ms |
| Arduino 基础设备 | USB 串口 | 简单场景，需要 USB 线连接 |
| Mock 设备 | 内存模拟 | 开发测试，无需真实硬件 |

### 2.2 传感器类型

| 传感器 | 数据类型 | 单位 | 说明 |
|--------|----------|------|------|
| button | bool | - | 物理按钮（按下=true，释放=false） |
| noise_level | float | dB | 环境噪声分贝值 |
| potentiometer | int | % | 电位器/旋钮位置 (0-100) |
| encoder | int | - | 旋转编码器位置 |
| microphone | bytes | PCM | I2S 麦克风音频流 |

### 2.3 执行器类型

| 执行器 | 控制参数 | 说明 |
|--------|----------|------|
| led | color, pattern, duration_ms | RGB LED 指示灯 |
| buzzer | frequency_hz, duration_ms | 有源蜂鸣器 |
| display | text, line | OLED 显示屏 |
| vibration | intensity, duration_ms | 振动马达 |

## 3. 数据流与控制流程

### 3.1 传感器数据流（设备 → 服务端 → 前端）

```
[ESP32 按钮按下]
    │
    ▼
{type: "button_event", payload: {button_id: "btn_confirm", pressed: true}}
    │
    ▼ (WebSocket)
[WebSocketServer 接收]
    │
    ▼
[DeviceManager._dispatch_button()]
    │
    ▼
[ButtonCallback → 业务逻辑层]
    │
    ▼ (HTTP API / WebSocket)
[前端更新 UI]
```

### 3.2 控制命令流（前端 → 服务端 → 设备）

```
[用户点击"提交答案"]
    │
    ▼
[TrainingService.submit_answer()]
    │
    ▼
[TrainingEvent: ANSWER_CORRECT]
    │
    ▼
[DeviceManager.send_training_event()]
    │
    ▼
[ESP32RehabStation.handle_training_event()]
    │
    ├──→ led_green(ON, 2000)  ──→  WebSocket 命令 ──→ [ESP32 绿灯亮]
    └──→ buzzer_beep(1500, 150) ──→ WebSocket 命令 ──→ [ESP32 蜂鸣]
```

### 3.3 音频数据流（设备 → ASR 服务）

```
[ESP32 I2S 麦克风采集]
    │
    ▼
{type: "audio_chunk", payload: {data: "<base64_pcm>"}}
    │
    ▼ (WebSocket)
[DeviceManager._dispatch_audio()]
    │
    ▼
[AudioCallback → ASR Gateway]
    │
    ▼
[阿里云百炼 Fun-ASR 识别]
    │
    ▼
[返回识别结果]
```

## 4. 关键集成点实现

### 4.1 训练模块集成

在 `TrainingService.submit_answer()` 中添加硬件反馈：

```python
# backend/app/services/training_service.py

from app.hardware.manager import device_manager
from app.hardware.schemas import TrainingEvent, TrainingEventType

class TrainingService:
    async def submit_answer(self, session_id, item_id, user_answer, response_ms=0):
        # ... 现有逻辑 ...

        # 发送硬件反馈
        event_type = TrainingEventType.ANSWER_CORRECT if is_correct else TrainingEventType.ANSWER_WRONG
        event = TrainingEvent(
            event_type=event_type,
            data={
                "item_id": item_id,
                "correct_answer": item.text,
                "is_correct": is_correct,
            }
        )
        await device_manager.send_training_event(event)

        return result
```

### 4.2 前端集成

在训练页面顶部添加硬件状态指示器：

```tsx
// frontend/src/pages/TrainingPage.tsx

import { HardwareStatus } from '../components/hardware';

export default function TrainingPage() {
  return (
    <Box sx={{ maxWidth: 800, mx: 'auto', p: 3 }}>
      {/* 硬件状态指示器 - 右上角 */}
      <Box sx={{ position: 'fixed', top: 16, right: 16, zIndex: 1000 }}>
        <HardwareStatus />
      </Box>

      {/* ... 现有训练界面 ... */}
    </Box>
  );
}
```

### 4.3 WebSocket 服务端

WebSocket 服务端独立运行在 8001 端口，接受设备连接：

```
ws://<server_ip>:8001/ws/device
```

设备连接后发送注册消息：

```json
{
  "type": "register",
  "device_id": "esp32-rehab-001",
  "device_type": "esp32_station",
  "firmware_version": "1.0.0",
  "sensors": ["button", "noise_level"]
}
```

## 5. 配置项说明

### 5.1 环境变量

在 `.env` 文件中添加以下配置：

```bash
# 硬件集成开关
HARDWARE_ENABLED=true
HARDWARE_MOCK_MODE=false
HARDWARE_AUTO_CONNECT=true

# WebSocket 服务端
HW_WS_HOST=0.0.0.0
HW_WS_PORT=8001
HW_WS_PATH=/ws/device

# 串口配置（Arduino）
HW_SERIAL_PORT=COM3
HW_SERIAL_BAUD=115200

# 读取参数
HW_READ_INTERVAL_MS=100
HW_HEARTBEAT_INTERVAL_S=5
HW_HEARTBEAT_TIMEOUT_S=30

# 重连策略
HW_RECONNECT_MAX_ATTEMPTS=10
HW_RECONNECT_BASE_DELAY_S=1
HW_RECONNECT_MAX_DELAY_S=30
```

### 5.2 配置说明

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| HARDWARE_ENABLED | true | 硬件集成总开关 |
| HARDWARE_MOCK_MODE | false | 模拟模式（开发测试用） |
| HW_WS_PORT | 8001 | WebSocket 端口 |
| HW_READ_INTERVAL_MS | 100 | 传感器读取间隔 |
| HW_RECONNECT_MAX_ATTEMPTS | 10 | 最大重连次数 |

## 6. 本地部署步骤

### 6.1 后端部署

```bash
# 1. 安装依赖（如果还没有）
cd backend
pip install websockets uvicorn[standard] pyserial-asyncio

# 2. 配置环境变量
echo "HARDWARE_ENABLED=true" >> .env
echo "HARDWARE_MOCK_MODE=true" >> .env  # 开发时使用模拟设备

# 3. 启动后端
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### 6.2 ESP32 固件烧录

```bash
# 1. 安装 Arduino IDE 或 PlatformIO
# 2. 安装依赖库: ArduinoJson, FastLED, WebSockets
# 3. 修改配置:
#    - WIFI_SSID / WIFI_PASSWORD
#    - WS_HOST (后端服务器 IP)
# 4. 选择开发板: ESP32 Dev Module
# 5. 上传固件
```

### 6.3 前端集成

```bash
# 前端无需额外配置，硬件状态组件自动从后端获取设备信息
cd frontend
npm run dev
```

### 6.4 验证流程

1. 启动后端，查看日志确认硬件模块已初始化
2. 访问 `http://localhost:8000/docs`，查看 `/api/hardware/devices` 端点
3. 烧录 ESP32 固件，打开串口监视器查看连接日志
4. 前端页面右上角应显示硬件状态指示器
5. 点击按钮，观察后端日志和前端状态更新

## 7. 常见问题排查

### 7.1 设备无法连接

**症状**: ESP32 串口显示 "WebSocket 连接失败"

**排查步骤**:
1. 确认后端服务已启动，端口 8001 已监听
   ```bash
   netstat -an | findstr 8001
   ```
2. 确认 ESP32 和服务器在同一局域网
3. 检查防火墙是否放行 8001 端口
4. 确认 `WS_HOST` 配置正确（服务器 IP，不是 localhost）

### 7.2 按钮无响应

**症状**: 按下按钮后端无日志输出

**排查步骤**:
1. 检查接线是否松动
2. 确认按钮使用 `INPUT_PULLUP` 模式
3. 打开 ESP32 串口监视器，查看按钮事件日志
4. 检查去抖时间是否过长（默认 50ms）

### 7.3 LED 不亮

**症状**: 发送 LED 命令后灯不亮

**排查步骤**:
1. 检查 WS2812 供电（3.3V 或 5V）
2. 确认 DIN 接 GPIO 5
3. 检查 FastLED 库版本（推荐 3.5+）
4. 尝试降低亮度: `FastLED.setBrightness(30)`

### 7.4 噪声传感器读数异常

**症状**: 噪声值始终为 0 或固定值

**排查步骤**:
1. 检查传感器模块供电
2. 确认 AO 引脚接 GPIO 34
3. 用万用表测量传感器输出电压
4. 调整传感器灵敏度旋钮

### 7.5 WebSocket 频繁断开

**症状**: 日志显示频繁重连

**排查步骤**:
1. 检查 WiFi 信号强度
2. 确认路由器未限制设备连接数
3. 增加心跳间隔: `HW_HEARTBEAT_INTERVAL_S=10`
4. 检查是否有其他设备占用大量带宽

## 8. API 参考

### 8.1 设备管理 API

| 方法 | 端点 | 说明 |
|------|------|------|
| GET | `/api/hardware/devices` | 列出所有设备 |
| GET | `/api/hardware/devices/{id}` | 查询单个设备状态 |
| POST | `/api/hardware/devices/{id}/connect` | 连接设备 |
| POST | `/api/hardware/devices/{id}/disconnect` | 断开设备 |
| POST | `/api/hardware/devices/{id}/command` | 发送控制命令 |
| POST | `/api/hardware/devices/{id}/led` | LED 快捷控制 |
| POST | `/api/hardware/devices/{id}/buzzer` | 蜂鸣器快捷控制 |
| POST | `/api/hardware/training-event` | 推送训练事件 |
| GET | `/api/hardware/ws-info` | 获取 WebSocket 连接信息 |

### 8.2 WebSocket 协议

**设备 → 服务端**:
- `register`: 设备注册
- `heartbeat`: 心跳
- `sensor_data`: 传感器数据
- `button_event`: 按钮事件
- `audio_chunk`: 音频数据块

**服务端 → 设备**:
- `command`: 执行器控制命令
- `training_event`: 训练事件通知
- `ack`: 确认消息
