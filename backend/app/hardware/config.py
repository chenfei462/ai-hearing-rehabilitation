"""
硬件配置集中管理

所有硬件相关配置项统一在此定义，支持环境变量覆盖。
修改配置无需改动代码，重启服务即生效。
"""
from __future__ import annotations

from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache


class HardwareConfig(BaseSettings):
    """硬件集成配置"""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # ── 全局开关 ──────────────────────────────────────────────
    HARDWARE_ENABLED: bool = True
    """硬件集成总开关。设为 False 时完全禁用硬件模块"""

    HARDWARE_AUTO_CONNECT: bool = True
    """启动时自动连接已知设备"""

    HARDWARE_MOCK_MODE: bool = False
    """模拟模式：使用 MockDevice 替代真实硬件（开发/测试用）"""

    # ── WebSocket 服务端 ──────────────────────────────────────
    HW_WS_HOST: str = "0.0.0.0"
    """WebSocket 监听地址。0.0.0.0 表示接受所有来源"""

    HW_WS_PORT: int = 8001
    """WebSocket 监听端口。与 FastAPI HTTP 端口（8000）分离"""

    HW_WS_PATH: str = "/ws/device"
    """WebSocket 路径"""

    # ── 串口配置 ──────────────────────────────────────────────
    HW_SERIAL_PORT: str = "COM3"
    """串口号。Windows: COM3/COM4, Linux: /dev/ttyUSB0"""

    HW_SERIAL_BAUD: int = 115200
    """串口波特率。ESP32 默认 115200"""

    HW_SERIAL_TIMEOUT: float = 1.0
    """串口读取超时（秒）"""

    # ── 设备参数 ──────────────────────────────────────────────
    HW_READ_INTERVAL_MS: int = 100
    """传感器读取间隔（毫秒）。100ms = 10Hz 采样率"""

    HW_HEARTBEAT_INTERVAL_S: float = 5.0
    """心跳检测间隔（秒）"""

    HW_HEARTBEAT_TIMEOUT_S: float = 30.0
    """心跳超时阈值（秒）。超过此时间无通信视为离线"""

    HW_RECONNECT_MAX_ATTEMPTS: int = 10
    """最大重连次数。达到后停止重连，需手动触发"""

    HW_RECONNECT_BASE_DELAY_S: float = 1.0
    """重连基础延迟（秒），采用指数退避"""

    HW_RECONNECT_MAX_DELAY_S: float = 30.0
    """重连最大延迟（秒）"""

    # ── 音频配置 ──────────────────────────────────────────────
    HW_AUDIO_SAMPLE_RATE: int = 16000
    """音频采样率（Hz）。16kHz 与 ASR 模型匹配"""

    HW_AUDIO_CHANNELS: int = 1
    """音频通道数。1=单声道"""

    HW_AUDIO_SAMPLE_WIDTH: int = 16
    """音频位深（bit）。16bit PCM"""

    HW_AUDIO_CHUNK_SIZE: int = 4096
    """音频数据块大小（bytes）。4096 ≈ 128ms @16kHz/16bit"""

    # ── 传感器阈值 ────────────────────────────────────────────
    HW_NOISE_LOW_DB: float = 40.0
    """安静环境阈值（dB）。低于此值视为安静"""

    HW_NOISE_HIGH_DB: float = 70.0
    """嘈杂环境阈值（dB）。高于此值视为嘈杂"""

    HW_BUTTON_DEBOUNCE_MS: int = 50
    """按钮去抖时间（毫秒）"""

    HW_BUTTON_LONG_PRESS_MS: int = 1000
    """长按判定时间（毫秒）"""

    # ── 已知设备列表（静态注册）───────────────────────────────
    KNOWN_DEVICES: list[str] = []
    """已知设备 ID 列表。启动时自动尝试连接。
    示例: ["esp32-rehab-001", "arduino-btn-001"]"""


@lru_cache
def get_hardware_config() -> HardwareConfig:
    return HardwareConfig()


# 向后兼容
hw_config = get_hardware_config()
