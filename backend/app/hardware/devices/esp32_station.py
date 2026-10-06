"""
ESP32 康复训练站设备驱动

硬件配置:
  - ESP32 开发板 (ESP32-WROOM-32 或 ESP32-S3)
  - 3 个物理按钮 (确认/取消/下一题)
  - WS2812 RGB LED 灯条 (3 颗)
  - 有源蜂鸣器
  - 噪声传感器模块 (模拟输出)
  - INMP441 I2S 麦克风 (可选)
  - 0.96" OLED 显示屏 (可选)

通信方式: WebSocket (WiFi)
"""
from __future__ import annotations

import asyncio
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
    LEDColor,
    LEDCommand,
    LEDPattern,
    SensorReading,
    SensorType,
    TrainingEvent,
    TrainingEventType,
    WSMessage,
    WSMessageType,
)
from app.hardware.protocols.websocket_protocol import WebSocketDeviceConnection


class ESP32RehabStation(HardwareDevice):
    """
    ESP32 康复训练站

    通过 WebSocket 与后端通信，支持:
      - 3 个物理按钮输入（确认/取消/下一题）
      - 噪声传感器（环境 dB 监测）
      - RGB LED 指示（绿/红/蓝）
      - 蜂鸣器反馈
      - OLED 显示屏（可选）
      - I2S 麦克风音频流（可选）
    """

    def __init__(self, device_id: str = "esp32-rehab-001"):
        super().__init__(device_id, DeviceType.ESP32_STATION)
        self._ws_conn: Optional[WebSocketDeviceConnection] = None
        self._device_info: Optional[DeviceInfo] = None

    # ── 连接管理 ──────────────────────────────────────────────

    async def connect(self) -> bool:
        """
        连接由 WebSocket 服务端处理

        ESP32 主动连接到后端 WebSocket 端点，此处标记为已连接。
        实际连接在 manager 的 WebSocket handler 中建立。
        """
        self._update_status(DeviceStatus.CONNECTED)
        logger.info(f"[{self.device_id}] ESP32 设备已连接")
        return True

    async def disconnect(self) -> None:
        """断开连接"""
        if self._ws_conn:
            try:
                await self._ws_conn.ws.close()
            except Exception:
                pass
            self._ws_conn = None
        self._update_status(DeviceStatus.DISCONNECTED)
        logger.info(f"[{self.device_id}] ESP32 设备已断开")

    def is_connected(self) -> bool:
        return self._ws_conn is not None and self._ws_conn.is_alive

    def bind_ws_connection(self, conn: WebSocketDeviceConnection) -> None:
        """
        绑定 WebSocket 连接（由 manager 调用）

        Args:
            conn: WebSocket 设备连接实例
        """
        self._ws_conn = conn
        if conn.device_info:
            self._device_info = conn.device_info
        self._update_status(DeviceStatus.CONNECTED)

    # ── 传感器读取 ────────────────────────────────────────────

    async def read_sensor(self, sensor_type: str = "") -> Optional[SensorReading]:
        """
        读取传感器（被动模式）

        ESP32 使用推送模式上报数据，此方法返回缓存的最新读数。
        实时数据通过 WebSocket 消息回调 _on_ws_message 处理。
        """
        # 推送模式：数据通过 WebSocket 消息自动到达
        return None

    async def handle_ws_message(self, msg: WSMessage) -> None:
        """
        处理来自 ESP32 的 WebSocket 消息

        由 manager 在收到消息时调用，解析后分发到回调。

        Args:
            msg: WebSocket 消息
        """
        if msg.type == WSMessageType.SENSOR_DATA:
            reading = self._ws_conn.parse_sensor_reading(msg)
            if reading:
                self._emit_sensor(reading)

        elif msg.type == WSMessageType.BUTTON_EVENT:
            payload = msg.payload
            event = ButtonEvent(
                button_id=payload.get("button_id", ""),
                pressed=payload.get("pressed", False),
                duration_ms=payload.get("duration_ms", 0),
                device_id=self.device_id,
            )
            self._emit_button(event)

        elif msg.type == WSMessageType.AUDIO_CHUNK:
            import base64
            audio_data = base64.b64decode(msg.payload.get("data", ""))
            if audio_data:
                self._emit_audio(audio_data)

        elif msg.type == WSMessageType.HEARTBEAT:
            self._last_seen = time.time()

        elif msg.type == WSMessageType.REGISTER:
            info = self._ws_conn.parse_device_info(msg)
            if info:
                self._device_info = info
                logger.info(f"[{self.device_id}] 设备注册: {info.firmware_version}")

    # ── 执行器控制 ────────────────────────────────────────────

    async def send_command(self, command: ActuatorCommand) -> bool:
        """
        发送执行器命令到 ESP32

        Args:
            command: 执行器命令

        Returns:
            True=发送成功
        """
        if not self._ws_conn:
            logger.warning(f"[{self.device_id}] 设备未连接，无法发送命令")
            return False

        return await self._ws_conn.send_command(command)

    # ── 便捷控制方法 ──────────────────────────────────────────

    async def led_green(self, pattern: LEDPattern = LEDPattern.ON, duration_ms: int = 0) -> bool:
        """绿色 LED"""
        cmd = LEDCommand(
            color=LEDColor.GREEN,
            pattern=pattern,
            duration_ms=duration_ms,
        )
        return await self.send_command(cmd)

    async def led_red(self, pattern: LEDPattern = LEDPattern.ON, duration_ms: int = 0) -> bool:
        """红色 LED"""
        cmd = LEDCommand(
            color=LEDColor.RED,
            pattern=pattern,
            duration_ms=duration_ms,
        )
        return await self.send_command(cmd)

    async def led_off(self) -> bool:
        """关闭所有 LED"""
        cmd = LEDCommand(
            color=LEDColor.GREEN,
            pattern=LEDPattern.OFF,
        )
        return await self.send_command(cmd)

    async def buzzer_beep(self, frequency: int = 1000, duration_ms: int = 200) -> bool:
        """蜂鸣器响一声"""
        from app.hardware.schemas import BuzzerCommand
        cmd = BuzzerCommand(
            frequency_hz=frequency,
            duration_ms=duration_ms,
        )
        return await self.send_command(cmd)

    async def show_text(self, text: str, line: int = 0) -> bool:
        """OLED 显示文字"""
        from app.hardware.schemas import DisplayCommand
        cmd = DisplayCommand(text=text, line=line)
        return await self.send_command(cmd)

    # ── 训练事件处理 ──────────────────────────────────────────

    async def handle_training_event(self, event: TrainingEvent) -> bool:
        """
        处理训练事件，控制硬件反馈

        根据训练事件类型自动控制 LED、蜂鸣器、显示屏：
          - 回答正确 → 绿灯 + 短促蜂鸣
          - 回答错误 → 红灯 + 低频蜂鸣
          - 升级 → 绿灯快闪 + 高频蜂鸣
          - 降级 → 红灯慢闪
          - 会话开始 → 蓝灯
          - 会话结束 → 全灭

        Args:
            event: 训练事件

        Returns:
            True=处理成功
        """
        if not self.is_connected():
            return False

        handlers = {
            TrainingEventType.SESSION_START: self._on_session_start,
            TrainingEventType.QUESTION_PLAY: self._on_question_play,
            TrainingEventType.ANSWER_CORRECT: self._on_answer_correct,
            TrainingEventType.ANSWER_WRONG: self._on_answer_wrong,
            TrainingEventType.LEVEL_UP: self._on_level_up,
            TrainingEventType.LEVEL_DOWN: self._on_level_down,
            TrainingEventType.SESSION_COMPLETE: self._on_session_complete,
        }

        handler = handlers.get(event.event_type)
        if handler:
            try:
                await handler(event)
                return True
            except Exception as e:
                logger.error(f"[{self.device_id}] 处理训练事件异常: {e}")
                return False
        return True

    async def _on_session_start(self, event: TrainingEvent) -> None:
        """会话开始：蓝灯亮"""
        await self.led_green(LEDPattern.ON, 3000)
        await self.show_text("训练开始", 0)
        level = event.data.get("level", "")
        if level:
            level_names = {"syllable": "音节", "word": "词语", "sentence": "语句", "noise": "噪声"}
            await self.show_text(f"级别: {level_names.get(level, level)}", 1)

    async def _on_question_play(self, event: TrainingEvent) -> None:
        """播放题目：蓝灯闪烁"""
        await self.led_off()

    async def _on_answer_correct(self, event: TrainingEvent) -> None:
        """回答正确：绿灯 + 正向蜂鸣"""
        await self.led_green(LEDPattern.ON, 2000)
        await self.buzzer_beep(1500, 150)
        await self.show_text("✓ 正确!", 0)

    async def _on_answer_wrong(self, event: TrainingEvent) -> None:
        """回答错误：红灯 + 负向蜂鸣"""
        await self.led_red(LEDPattern.ON, 2000)
        await self.buzzer_beep(500, 300)
        answer = event.data.get("correct_answer", "")
        if answer:
            await self.show_text(f"答案: {answer}", 1)

    async def _on_level_up(self, event: TrainingEvent) -> None:
        """升级：绿灯快闪 + 连续蜂鸣"""
        await self.led_green(LEDPattern.BLINK_FAST, 3000)
        for _ in range(3):
            await self.buzzer_beep(2000, 100)
            await asyncio.sleep(0.15)
        await self.show_text("难度提升!", 0)

    async def _on_level_down(self, event: TrainingEvent) -> None:
        """降级：红灯慢闪"""
        await self.led_red(LEDPattern.BLINK_SLOW, 3000)
        await self.show_text("难度调整", 0)

    async def _on_session_complete(self, event: TrainingEvent) -> None:
        """会话结束：全灭 + 显示成绩"""
        accuracy = event.data.get("accuracy", 0)
        total = event.data.get("total_items", 0)
        correct = event.data.get("correct_items", 0)
        await self.led_off()
        await self.show_text(f"得分: {int(accuracy * 100)}%", 0)
        await self.show_text(f"{correct}/{total} 题", 1)

    # ── 设备信息 ──────────────────────────────────────────────

    def device_info(self) -> DeviceInfo:
        if self._device_info:
            return self._device_info
        return DeviceInfo(
            device_id=self.device_id,
            device_type=DeviceType.ESP32_STATION,
            firmware_version="unknown",
            sensors=[SensorType.BUTTON, SensorType.NOISE_LEVEL],
            actuators=[ActuatorType.LED, ActuatorType.BUZZER, ActuatorType.DISPLAY],
        )
