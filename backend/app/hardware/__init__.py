"""
硬件集成模块

提供统一的硬件设备管理接口，支持：
  - ESP32 WiFi 设备（WebSocket 通信）
  - Arduino USB 串口设备
  - Mock 设备（开发/测试）

使用方式：
    from app.hardware import device_manager, HardwareDevice
"""
from app.hardware.base import HardwareDevice
from app.hardware.schemas import (
    ActuatorCommand,
    ButtonEvent,
    DeviceInfo,
    DeviceState,
    DeviceStatus,
    DeviceType,
    SensorReading,
    TrainingEvent,
    TrainingEventType,
    LEDCommand,
    BuzzerCommand,
    DisplayCommand,
)

__all__ = [
    "HardwareDevice",
    "ActuatorCommand",
    "ButtonEvent",
    "DeviceInfo",
    "DeviceState",
    "DeviceStatus",
    "DeviceType",
    "SensorReading",
    "TrainingEvent",
    "TrainingEventType",
    "LEDCommand",
    "BuzzerCommand",
    "DisplayCommand",
]
