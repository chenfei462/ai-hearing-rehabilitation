"""
硬件数据模型

定义设备事件、传感器读数、控制命令等数据结构。
所有硬件通信均使用这些统一模型，上层业务不直接依赖硬件细节。
"""
from __future__ import annotations

import time
from enum import Enum
from typing import Any, Optional
from pydantic import BaseModel, Field


# ── 设备状态 ──────────────────────────────────────────────────

class DeviceStatus(str, Enum):
    """设备连接状态"""
    DISCONNECTED = "disconnected"
    CONNECTING = "connecting"
    CONNECTED = "connected"
    ERROR = "error"
    RECONNECTING = "reconnecting"


class DeviceType(str, Enum):
    """设备类型"""
    ESP32_STATION = "esp32_station"       # ESP32 康复训练站
    ARDUINO_BASIC = "arduino_basic"       # Arduino 基础设备
    MOCK_DEVICE = "mock_device"           # 模拟设备（开发/测试用）


# ── 传感器数据 ─────────────────────────────────────────────────

class SensorType(str, Enum):
    """传感器类型"""
    BUTTON = "button"                     # 物理按钮
    NOISE_LEVEL = "noise_level"           # 噪声传感器 (dB)
    POTENTIOMETER = "potentiometer"       # 电位器/旋钮
    MICROPHONE = "microphone"             # I2S 麦克风
    ENCODER = "encoder"                   # 旋转编码器


class SensorReading(BaseModel):
    """传感器读数"""
    sensor_type: SensorType
    value: Any                            # 按钮: bool, 噪声: float(dB), 旋钮: int(0-100)
    unit: str = ""                        # 单位: "dB", "%", "bool"
    timestamp: float = Field(default_factory=time.time)
    device_id: str = ""
    metadata: dict[str, Any] = Field(default_factory=dict)


class ButtonEvent(BaseModel):
    """按钮事件"""
    button_id: str                        # 按钮标识: "btn_confirm", "btn_cancel", "btn_next"
    pressed: bool                         # True=按下, False=释放
    duration_ms: int = 0                  # 按住时长（释放时计算）
    timestamp: float = Field(default_factory=time.time)
    device_id: str = ""


# ── 执行器控制 ─────────────────────────────────────────────────

class ActuatorType(str, Enum):
    """执行器类型"""
    LED = "led"                           # LED 指示灯
    BUZZER = "buzzer"                     # 蜂鸣器
    DISPLAY = "display"                   # OLED 显示屏
    VIBRATION = "vibration"               # 振动马达


class LEDPattern(str, Enum):
    """LED 显示模式"""
    OFF = "off"
    ON = "on"
    BLINK_SLOW = "blink_slow"             # 慢闪 (1Hz)
    BLINK_FAST = "blink_fast"             # 快闪 (5Hz)
    PULSE = "pulse"                       # 呼吸灯效果


class LEDColor(str, Enum):
    """LED 颜色"""
    GREEN = "green"
    RED = "red"
    BLUE = "blue"
    YELLOW = "yellow"
    WHITE = "white"


class ActuatorCommand(BaseModel):
    """执行器控制命令"""
    actuator_type: ActuatorType
    action: str                           # "on", "off", "blink", "buzz", "show_text"
    params: dict[str, Any] = Field(default_factory=dict)
    duration_ms: int = 0                  # 持续时间，0=持续
    timestamp: float = Field(default_factory=time.time)


class LEDCommand(ActuatorCommand):
    """LED 控制命令"""
    actuator_type: ActuatorType = ActuatorType.LED
    color: LEDColor = LEDColor.GREEN
    pattern: LEDPattern = LEDPattern.ON


class BuzzerCommand(ActuatorCommand):
    """蜂鸣器控制命令"""
    actuator_type: ActuatorType = ActuatorType.BUZZER
    frequency_hz: int = 1000              # 频率
    duration_ms: int = 200                # 时长


class DisplayCommand(ActuatorCommand):
    """显示屏控制命令"""
    actuator_type: ActuatorType = ActuatorType.DISPLAY
    text: str = ""
    line: int = 0                         # 显示行号


# ── 设备信息 ───────────────────────────────────────────────────

class DeviceInfo(BaseModel):
    """设备信息（注册/心跳时上报）"""
    device_id: str
    device_type: DeviceType
    firmware_version: str = "1.0.0"
    ip_address: str = ""
    mac_address: str = ""
    sensors: list[SensorType] = Field(default_factory=list)
    actuators: list[ActuatorType] = Field(default_factory=list)
    battery_level: Optional[int] = None   # 电池电量百分比
    uptime_seconds: int = 0


class DeviceState(BaseModel):
    """设备运行时状态"""
    device_id: str
    status: DeviceStatus = DeviceStatus.DISCONNECTED
    last_seen: float = 0.0                # 最后通信时间戳
    reconnect_count: int = 0              # 重连次数
    error_message: str = ""
    sensor_readings: dict[str, SensorReading] = Field(default_factory=dict)
    info: Optional[DeviceInfo] = None


# ── WebSocket 消息协议 ─────────────────────────────────────────

class WSMessageType(str, Enum):
    """WebSocket 消息类型"""
    # 设备 → 服务端
    REGISTER = "register"                 # 设备注册
    HEARTBEAT = "heartbeat"               # 心跳
    SENSOR_DATA = "sensor_data"           # 传感器数据上报
    BUTTON_EVENT = "button_event"         # 按钮事件
    AUDIO_CHUNK = "audio_chunk"           # 音频数据块

    # 服务端 → 设备
    COMMAND = "command"                    # 执行器控制命令
    TRAINING_EVENT = "training_event"     # 训练事件通知
    CONFIG_UPDATE = "config_update"       # 配置更新

    # 双向
    ACK = "ack"                           # 确认
    ERROR = "error"                       # 错误


class WSMessage(BaseModel):
    """WebSocket 消息封装"""
    type: WSMessageType
    payload: dict[str, Any] = Field(default_factory=dict)
    message_id: str = ""
    timestamp: float = Field(default_factory=time.time)
    device_id: str = ""


# ── 训练事件（业务层 → 硬件层）─────────────────────────────────

class TrainingEventType(str, Enum):
    """训练事件类型"""
    SESSION_START = "session_start"
    QUESTION_PLAY = "question_play"
    ANSWER_CORRECT = "answer_correct"
    ANSWER_WRONG = "answer_wrong"
    LEVEL_UP = "level_up"
    LEVEL_DOWN = "level_down"
    SESSION_COMPLETE = "session_complete"
    AUDIO_PLAYING = "audio_playing"


class TrainingEvent(BaseModel):
    """训练事件（发送给硬件设备）"""
    event_type: TrainingEventType
    data: dict[str, Any] = Field(default_factory=dict)
    timestamp: float = Field(default_factory=time.time)
