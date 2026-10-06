"""
Mock 设备驱动

用于开发和测试，模拟硬件设备行为。
启用方式: 设置环境变量 HARDWARE_MOCK_MODE=true

模拟功能:
  - 按钮：每 10 秒自动触发一次确认按钮
  - 噪声传感器：每秒生成随机 dB 值
  - LED/蜂鸣器：日志输出
"""
from __future__ import annotations

import random
import time
from typing import Optional

from loguru import logger

from app.hardware.base import HardwareDevice
from app.hardware.schemas import (
    ActuatorCommand,
    ActuatorType,
    ButtonEvent,
    DeviceInfo,
    DeviceStatus,
    DeviceType,
    SensorReading,
    SensorType,
    TrainingEvent,
)


class MockDevice(HardwareDevice):
    """
    模拟设备

    模拟 ESP32 康复训练站的行为，用于开发和测试。
    """

    def __init__(self, device_id: str = "mock-device-001"):
        super().__init__(device_id, DeviceType.MOCK_DEVICE)
        self._last_button_time: float = 0
        self._button_interval: float = 10.0  # 每 10 秒模拟一次按钮

    async def connect(self) -> bool:
        """模拟连接"""
        logger.info(f"[{self.device_id}] Mock 设备连接")
        self._update_status(DeviceStatus.CONNECTED)
        self._last_seen = time.time()
        return True

    async def disconnect(self) -> None:
        """模拟断开"""
        logger.info(f"[{self.device_id}] Mock 设备断开")
        self._update_status(DeviceStatus.DISCONNECTED)

    def is_connected(self) -> bool:
        return self._status == DeviceStatus.CONNECTED

    async def read_sensor(self, sensor_type: str = "") -> Optional[SensorReading]:
        """
        模拟传感器读取

        返回随机噪声值，偶尔模拟按钮按下。
        """
        now = time.time()

        # 模拟按钮（每 10 秒一次）
        if now - self._last_button_time >= self._button_interval:
            self._last_button_time = now
            self._emit_button(ButtonEvent(
                button_id="btn_confirm",
                pressed=True,
                duration_ms=random.randint(50, 300),
                device_id=self.device_id,
            ))

        # 始终返回噪声传感器读数
        return SensorReading(
            sensor_type=SensorType.NOISE_LEVEL,
            value=round(random.uniform(30, 80), 1),
            unit="dB",
            device_id=self.device_id,
        )

    async def send_command(self, command: ActuatorCommand) -> bool:
        """模拟执行器命令（仅日志输出）"""
        logger.info(
            f"[{self.device_id}] 执行器命令: "
            f"type={command.actuator_type.value}, "
            f"action={command.action}, "
            f"params={command.params}"
        )
        return True

    async def handle_training_event(self, event: TrainingEvent) -> bool:
        """模拟训练事件处理"""
        logger.info(f"[{self.device_id}] 训练事件: {event.event_type.value}")
        return True

    def device_info(self) -> DeviceInfo:
        return DeviceInfo(
            device_id=self.device_id,
            device_type=DeviceType.MOCK_DEVICE,
            firmware_version="mock-1.0.0",
            sensors=[SensorType.BUTTON, SensorType.NOISE_LEVEL],
            actuators=[ActuatorType.LED, ActuatorType.BUZZER],
        )
