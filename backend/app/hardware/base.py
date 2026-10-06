"""
硬件设备抽象基类

所有硬件设备驱动均继承 HardwareDevice，实现统一的生命周期和通信接口。
上层业务通过 DeviceManager 与设备交互，不直接依赖具体硬件实现。

设计原则：
  - 接口隔离：上层只依赖 HardwareDevice 抽象类
  - 依赖倒置：业务逻辑通过事件回调接收传感器数据
  - 开闭原则：新设备只需继承 HardwareDevice 即可接入
"""
from __future__ import annotations

import asyncio
import time
from abc import ABC, abstractmethod
from typing import Any, Callable, Optional

from loguru import logger

from app.hardware.schemas import (
    ActuatorCommand,
    ButtonEvent,
    DeviceInfo,
    DeviceState,
    DeviceStatus,
    DeviceType,
    SensorReading,
    TrainingEvent,
)


# 事件回调类型
SensorCallback = Callable[[SensorReading], Any]
ButtonCallback = Callable[[ButtonEvent], Any]
StatusCallback = Callable[[DeviceState], Any]
AudioCallback = Callable[[bytes, str], Any]  # (audio_bytes, device_id)


class HardwareDevice(ABC):
    """
    硬件设备抽象基类

    生命周期：
      1. __init__(): 创建设备实例（不连接）
      2. connect(): 建立物理连接（串口/WebSocket/BLE）
      3. 循环: read_sensor() / send_command() / 事件回调
      4. disconnect(): 断开连接，释放资源

    子类必须实现:
      - connect() / disconnect() / is_connected()
      - read_sensor() / send_command()
      - device_info()

    可选覆盖:
      - handle_training_event(): 处理训练事件
      - handle_audio_chunk(): 处理音频数据
    """

    def __init__(self, device_id: str, device_type: DeviceType):
        self.device_id = device_id
        self.device_type = device_type
        self._status = DeviceStatus.DISCONNECTED
        self._last_seen: float = 0.0
        self._reconnect_count: int = 0
        self._error_message: str = ""

        # 事件回调
        self._sensor_callbacks: list[SensorCallback] = []
        self._button_callbacks: list[ButtonCallback] = []
        self._status_callbacks: list[StatusCallback] = []
        self._audio_callbacks: list[AudioCallback] = []

        # 非阻塞读取任务
        self._read_task: Optional[asyncio.Task] = None
        self._heartbeat_task: Optional[asyncio.Task] = None
        self._running = False

    # ── 属性 ──────────────────────────────────────────────────

    @property
    def status(self) -> DeviceStatus:
        return self._status

    @property
    def is_online(self) -> bool:
        return self._status == DeviceStatus.CONNECTED

    @property
    def last_seen(self) -> float:
        return self._last_seen

    def get_state(self) -> DeviceState:
        """获取设备当前状态快照"""
        return DeviceState(
            device_id=self.device_id,
            status=self._status,
            last_seen=self._last_seen,
            reconnect_count=self._reconnect_count,
            error_message=self._error_message,
            info=self.device_info() if self.is_online else None,
        )

    # ── 事件注册 ──────────────────────────────────────────────

    def on_sensor(self, callback: SensorCallback) -> None:
        """注册传感器数据回调"""
        self._sensor_callbacks.append(callback)

    def on_button(self, callback: ButtonCallback) -> None:
        """注册按钮事件回调"""
        self._button_callbacks.append(callback)

    def on_status_change(self, callback: StatusCallback) -> None:
        """注册状态变更回调"""
        self._status_callbacks.append(callback)

    def on_audio(self, callback: AudioCallback) -> None:
        """注册音频数据回调"""
        self._audio_callbacks.append(callback)

    def _emit_sensor(self, reading: SensorReading) -> None:
        """分发传感器数据到所有回调"""
        reading.device_id = self.device_id
        self._last_seen = time.time()
        for cb in self._sensor_callbacks:
            try:
                result = cb(reading)
                if asyncio.iscoroutine(result):
                    asyncio.create_task(result)
            except Exception as e:
                logger.error(f"[{self.device_id}] 传感器回调异常: {e}")

    def _emit_button(self, event: ButtonEvent) -> None:
        """分发按钮事件到所有回调"""
        event.device_id = self.device_id
        self._last_seen = time.time()
        for cb in self._button_callbacks:
            try:
                result = cb(event)
                if asyncio.iscoroutine(result):
                    asyncio.create_task(result)
            except Exception as e:
                logger.error(f"[{self.device_id}] 按钮回调异常: {e}")

    def _emit_audio(self, audio_bytes: bytes) -> None:
        """分发音频数据到所有回调"""
        self._last_seen = time.time()
        for cb in self._audio_callbacks:
            try:
                result = cb(audio_bytes, self.device_id)
                if asyncio.iscoroutine(result):
                    asyncio.create_task(result)
            except Exception as e:
                logger.error(f"[{self.device_id}] 音频回调异常: {e}")

    def _update_status(self, status: DeviceStatus, error: str = "") -> None:
        """更新设备状态并通知回调"""
        old_status = self._status
        self._status = status
        self._error_message = error
        if old_status != status:
            logger.info(f"[{self.device_id}] 状态变更: {old_status.value} → {status.value}")
            for cb in self._status_callbacks:
                try:
                    result = cb(self.get_state())
                    if asyncio.iscoroutine(result):
                        asyncio.create_task(result)
                except Exception as e:
                    logger.error(f"[{self.device_id}] 状态回调异常: {e}")

    # ── 抽象方法（子类必须实现）────────────────────────────────

    @abstractmethod
    async def connect(self) -> bool:
        """
        建立物理连接

        Returns:
            True=连接成功, False=连接失败
        """
        ...

    @abstractmethod
    async def disconnect(self) -> None:
        """断开连接，释放资源"""
        ...

    @abstractmethod
    def is_connected(self) -> bool:
        """检查物理连接是否存活"""
        ...

    @abstractmethod
    async def read_sensor(self, sensor_type: str = "") -> Optional[SensorReading]:
        """
        读取传感器数据（同步轮询模式）

        Args:
            sensor_type: 指定传感器类型，空字符串=读取所有

        Returns:
            传感器读数，无数据返回 None
        """
        ...

    @abstractmethod
    async def send_command(self, command: ActuatorCommand) -> bool:
        """
        发送执行器控制命令

        Args:
            command: 执行器命令

        Returns:
            True=发送成功, False=发送失败
        """
        ...

    @abstractmethod
    def device_info(self) -> DeviceInfo:
        """返回设备静态信息"""
        ...

    # ── 可选覆盖 ──────────────────────────────────────────────

    async def handle_training_event(self, event: TrainingEvent) -> bool:
        """
        处理训练事件（业务层 → 硬件层）

        默认实现将事件转发为 WSMessage，子类可覆盖实现具体控制逻辑。
        """
        return True

    async def handle_audio_chunk(self, audio_bytes: bytes) -> None:
        """处理来自设备的音频数据块"""
        self._emit_audio(audio_bytes)

    # ── 非阻塞读取循环 ────────────────────────────────────────

    async def start_read_loop(self, interval_ms: int = 100) -> None:
        """
        启动非阻塞传感器读取循环

        以 interval_ms 毫秒为间隔持续读取传感器数据，通过回调分发。
        不阻塞主线程，异常时自动重试。

        Args:
            interval_ms: 读取间隔（毫秒），默认 100ms
        """
        if self._running:
            return
        self._running = True
        self._read_task = asyncio.create_task(self._read_loop(interval_ms))
        self._heartbeat_task = asyncio.create_task(self._heartbeat_loop())
        logger.info(f"[{self.device_id}] 读取循环已启动 (间隔 {interval_ms}ms)")

    async def stop_read_loop(self) -> None:
        """停止读取循环"""
        self._running = False
        if self._read_task and not self._read_task.done():
            self._read_task.cancel()
            try:
                await self._read_task
            except asyncio.CancelledError:
                pass
        if self._heartbeat_task and not self._heartbeat_task.done():
            self._heartbeat_task.cancel()
            try:
                await self._heartbeat_task
            except asyncio.CancelledError:
                pass
        logger.info(f"[{self.device_id}] 读取循环已停止")

    async def _read_loop(self, interval_ms: int) -> None:
        """内部读取循环实现"""
        interval = interval_ms / 1000.0
        while self._running:
            try:
                if self.is_connected():
                    reading = await self.read_sensor()
                    if reading:
                        self._emit_sensor(reading)
                else:
                    # 设备断开，等待重连
                    await asyncio.sleep(1)
                    continue
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.warning(f"[{self.device_id}] 读取异常: {e}")
                self._update_status(DeviceStatus.ERROR, str(e))
            await asyncio.sleep(interval)

    async def _heartbeat_loop(self, interval: float = 5.0) -> None:
        """心跳检测循环，每 5 秒检查连接状态"""
        while self._running:
            try:
                if not self.is_connected():
                    await asyncio.sleep(interval)
                    continue
                # 检查最后通信时间，超过 30 秒认为离线
                if time.time() - self._last_seen > 30:
                    logger.warning(f"[{self.device_id}] 心跳超时，设备可能离线")
                    self._update_status(DeviceStatus.ERROR, "心跳超时")
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"[{self.device_id}] 心跳检测异常: {e}")
            await asyncio.sleep(interval)
