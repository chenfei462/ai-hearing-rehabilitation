# ESP32 康复训练站固件

## 硬件清单

| 组件 | 型号 | 数量 | 参考价格 |
|------|------|------|----------|
| 主控板 | ESP32-WROOM-32 开发板 | 1 | ¥25 |
| 按钮 | 6x6mm 轻触开关 | 3 | ¥1 |
| LED 灯条 | WS2812B (3灯珠) | 1 | ¥5 |
| 蜂鸣器 | 有源蜂鸣器 3.3V | 1 | ¥2 |
| 噪声传感器 | LM393 声音传感器模块 | 1 | ¥8 |
| 麦克风 | INMP441 I2S MEMS | 1 | ¥12 |
| 面包板 | 830 孔 | 1 | ¥8 |
| 杜邦线 | 公对公/公对母 | 若干 | ¥5 |
| **总计** | | | **约 ¥66** |

## 接线图

```
ESP32 引脚分配:
┌─────────────────────────────────────┐
│  ESP32-WROOM-32                     │
│                                     │
│  GPIO 12 ←── [BTN_CONFIRM] ──→ GND │
│  GPIO 13 ←── [BTN_CANCEL]  ──→ GND │
│  GPIO 14 ←── [BTN_NEXT]    ──→ GND │
│                                     │
│  GPIO 5  ──→ [WS2812 DIN]          │
│                                     │
│  GPIO 18 ──→ [BUZZER +]            │
│            [BUZZER -] ──→ GND       │
│                                     │
│  GPIO 34 ←── [NOISE A0]            │
│                                     │
│  (可选) I2S 麦克风:                 │
│  GPIO 33 ←── [INMP441 SCK]         │
│  GPIO 25 ←── [INMP441 WS]          │
│  GPIO 26 ←── [INMP441 SD]          │
└─────────────────────────────────────┘
```

## 开发环境搭建

### 1. 安装 Arduino IDE
- 下载: https://www.arduino.cc/en/software
- 或使用 PlatformIO (VS Code 插件)

### 2. 添加 ESP32 开发板
1. 打开 Arduino IDE → 文件 → 首选项
2. 附加开发板管理器网址:
   ```
   https://dl.espressif.com/dl/package_esp32_index.json
   ```
3. 工具 → 开发板 → 开发板管理器 → 搜索 "esp32" → 安装

### 3. 安装依赖库
工具 → 管理库，搜索并安装:
- `ArduinoJson` by Benoit Blanchon
- `FastLED` by Daniel Garcia
- `WebSockets` by Markus Sattler

### 4. 配置并烧录
1. 修改 `esp32-rehab-station.ino` 中的配置:
   ```cpp
   const char* WIFI_SSID = "你的WiFi名称";
   const char* WIFI_PASSWORD = "你的WiFi密码";
   const char* WS_HOST = "192.168.1.100";  // 后端服务器IP
   ```
2. 工具 → 开发板 → ESP32 Dev Module
3. 工具 → 端口 → 选择 COM 口
4. 点击上传

## 按键功能

| 按钮 | 功能 |
|------|------|
| 确认 (GPIO 12) | 提交答案 / 确认操作 |
| 取消 (GPIO 13) | 取消当前操作 |
| 下一题 (GPIO 14) | 跳到下一题 |

## LED 状态指示

| 颜色 | 模式 | 含义 |
|------|------|------|
| 蓝色 | 常亮 | 设备已连接，等待中 |
| 绿色 | 常亮 | 回答正确 |
| 红色 | 常亮 | 回答错误 |
| 绿色 | 快闪 | 难度升级 |
| 红色 | 慢闪 | 难度降级 |
| 灭 | - | 设备断开 / 空闲 |

## 故障排查

### WiFi 连不上
- 检查 SSID 和密码是否正确
- 确认 WiFi 是 2.4GHz（ESP32 不支持 5GHz）
- 检查信号强度

### WebSocket 连不上
- 确认后端服务已启动
- 确认 WS_HOST 和 WS_PORT 正确
- 检查防火墙是否放行 8001 端口
- 确认 ESP32 和服务器在同一局域网

### 按钮无响应
- 检查接线是否松动
- 确认使用了内部上拉电阻（INPUT_PULLUP）
- 用串口监视器查看按钮事件日志

### LED 不亮
- 检查 WS2812 供电（3.3V）
- 确认 DIN 接 GPIO 5
- 检查 FastLED 库版本
