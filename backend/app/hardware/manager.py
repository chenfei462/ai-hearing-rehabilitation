"""
设备管理器

硬件集成的核心组件，职责：
  1. 设备生命周期管理（注册/连接/断开/重连）
  2. WebSocket 服务端（接受设备连接）
  3. 事件分发（传感器数据 → 业务层，训练事件 → 硬件层）
  4. 自动重连（指数退避）
  5. 设备状态查询

上层业务通过 device_manager 单例与硬件交互，无需了解底层通信细节。
"""
from __future__ import annotations

import asyncio
from typing import Optional

from loguru import logger

from app.hardware.base import AudioCallback, ButtonCallback, HardwareDevice, SensorCallback, StatusCallback
from app.hardware.config import get_hardware_config
from app.hardware.devices.esp32_station import ESP32RehabStation
from app.hardware.schemas import (
    ActuatorCommand,
    ButtonEvent,
    DeviceState,
    DeviceStatus,
    SensorReading,
    TrainingEvent,
    WSMessageType,
)
from app.hardware.protocols.websocket_protocol import WebSocketDeviceConnection, WebSocketServer


class DeviceManager:
    """
    设备管理器（单例）

    统一管理所有硬件设备的生命周期，提供：
      - 设备注册与发现
      - 自动连接与重连
      - 事件分发（传感器 → 业务，命令 → 设备）
      - WebSocket 服务端
      - 设备状态查询

    使用方式：
        manager = DeviceManager()
        await manager.start()
        manager.on_sensor(my_sensor_handler)
        ...
        await manager.stop()
    """

    def __init__(self):
        self._devices: dict[str, HardwareDevice] = {}
        self._ws_server: Optional[WebSocketServer] = None
        self._running = False
        self._reconnect_tasks: dict[str, asyncio.Task] = {}

        # 全局事件回调
        self._sensor_callbacks: list[SensorCallback] = []
        self._button_callbacks: list[ButtonCallback] = []
        self._status_callbacks: list[StatusCallback] = []
        self._audio_callbacks: list[AudioCallback] = []

    # ── 属性 ──────────────────────────────────────────────────

    @property
    def is_running(self) -> bool:
        return self._running

    @property
    def devices(self) -> dict[str, HardwareDevice]:
        return self._devices.copy()

    def get_device(self, device_id: str) -> Optional[HardwareDevice]:
        """获取指定设备"""
        return self._devices.get(device_id)

    def get_all_states(self) -> list[DeviceState]:
        """获取所有设备状态"""
        return [d.get_state() for d in self._devices.values()]

    def get_connected_devices(self) -> list[HardwareDevice]:
        """获取所有已连接设备"""
        return [d for d in self._devices.values() if d.is_online]

    # ── 全局事件注册 ──────────────────────────────────────────

    def on_sensor(self, callback: SensorCallback) -> None:
        """注册全局传感器数据回调"""
        self._sensor_callbacks.append(callback)

    def on_button(self, callback: ButtonCallback) -> None:
        """注册全局按钮事件回调"""
        self._button_callbacks.append(callback)

    def on_status_change(self, callback: StatusCallback) -> None:
        """注册全局状态变更回调"""
        self._status_callbacks.append(callback)

    def on_audio(self, callback: AudioCallback) -> None:
        """注册全局音频数据回调"""
        self._audio_callbacks.append(callback)

    # ── 设备注册 ──────────────────────────────────────────────

    def register_device(self, device: HardwareDevice) -> None:
        """
        注册设备到管理器

        注册后自动绑定事件回调，设备处于未连接状态，
        需要调用 connect_device() 或 start() 后自动连接。

        Args:
            device: 硬件设备实例
        """
        self._devices[device.device_id] = device

        # 绑定全局回调到设备
        for cb in self._sensor_callbacks:
            device.on_sensor(cb)
        for cb in self._button_callbacks:
            device.on_button(cb)
        for cb in self._status_callbacks:
            device.on_status_change(cb)
        for cb in self._audio_callbacks:
            device.on_audio(cb)

        # 注册设备自身的状态回调（用于自动重连）
        device.on_status_change(self._on_device_status_change)

        logger.info(f"[Manager] 设备已注册: {device.device_id} ({device.device_type.value})")

    def unregister_device(self, device_id: str) -> None:
        """注销设备"""
        device = self._devices.pop(device_id, None)
        if device:
            # 取消重连任务
            task = self._reconnect_tasks.pop(device_id, None)
            if task and not task.done():
                task.cancel()
            logger.info(f"[Manager] 设备注销: {device_id}")

    # ── 生命周期 ──────────────────────────────────────────────

    async def start(self) -> None:
        """
        启动设备管理器

        1. 启动 WebSocket 服务端（监听设备连接）
        2. 自动连接已注册的设备
        """
        if self._running:
            return

        self._running = True
        config = get_hardware_config()

        if not config.HARDWARE_ENABLED:
            logger.info("[Manager] 硬件集成已禁用 (HARDWARE_ENABLED=false)")
            return

        # 启动 WebSocket 服务端
        self._ws_server = WebSocketServer(
            host=config.HW_WS_HOST,
            port=config.HW_WS_PORT,
            path=config.HW_WS_PATH,
        )
        asyncio.create_task(self._run_ws_server())
        logger.info(f"[Manager] WebSocket 服务端启动: ws://{config.HW_WS_HOST}:{config.HW_WS_PORT}{config.HW_WS_PATH}")

        # 自动连接已注册设备
        if config.HARDWARE_AUTO_CONNECT:
            for device_id, device in self._devices.items():
                if not device.is_online:
                    asyncio.create_task(self._connect_with_retry(device))

        logger.info(f"[Manager] 设备管理器已启动 (设备数: {len(self._devices)})")

    async def stop(self) -> None:
        """停止设备管理器，断开所有设备"""
        if not self._running:
            return

        self._running = False

        # 取消所有重连任务
        for task in self._reconnect_tasks.values():
            if not task.done():
                task.cancel()
        self._reconnect_tasks.clear()

        # 断开所有设备
        for device in self._devices.values():
            try:
                await device.stop_read_loop()
                await device.disconnect()
            except Exception as e:
                logger.error(f"[Manager] 断开设备异常: {e}")

        logger.info("[Manager] 设备管理器已停止")

    # ── 设备连接 ──────────────────────────────────────────────

    async def connect_device(self, device_id: str) -> bool:
        """
        连接指定设备

        Args:
            device_id: 设备 ID

        Returns:
            True=连接成功
        """
        device = self._devices.get(device_id)
        if not device:
            logger.warning(f"[Manager] 设备 {device_id} 未注册")
            return False

        return await self._connect_with_retry(device, max_attempts=1)

    async def _connect_with_retry(
        self,
        device: HardwareDevice,
        max_attempts: int = 0,
    ) -> bool:
        """
        带重试的设备连接

        使用指数退避策略，最多重试 max_attempts 次（0=无限重试）。

        Args:
            device: 硬件设备
            max_attempts: 最大重试次数，0=使用配置值

        Returns:
            True=最终连接成功
        """
        config = get_hardware_config()
        attempts = max_attempts or config.HW_RECONNECT_MAX_ATTEMPTS
        delay = config.HW_RECONNECT_BASE_DELAY_S

        for attempt in range(1, attempts + 1):
            if not self._running:
                return False

            try:
                success = await device.connect()
                if success:
                    # 启动非阻塞读取循环
                    await device.start_read_loop(config.HW_READ_INTERVAL_MS)
                    return True
            except Exception as e:
                logger.error(f"[Manager] 连接 {device.device_id} 失败 (第 {attempt} 次): {e}")

            if attempt < attempts:
                logger.info(f"[Manager] {delay:.1f} 秒后重试...")
                await asyncio.sleep(delay)
                delay = min(delay * 2, config.HW_RECONNECT_MAX_DELAY_S)

        logger.error(f"[Manager] 设备 {device.device_id} 连接失败，已用尽重试次数")
        return False

    async def _on_device_status_change(self, state: DeviceState) -> None:
        """设备状态变更回调（用于自动重连）"""
        if state.status == DeviceStatus.ERROR and self._running:
            device = self._devices.get(state.device_id)
            if device and state.device_id not in self._reconnect_tasks:
                logger.info(f"[Manager] 触发自动重连: {state.device_id}")
                self._reconnect_tasks[state.device_id] = asyncio.create_task(
                    self._auto_reconnect(device)
                )

    async def _auto_reconnect(self, device: HardwareDevice) -> None:
        """自动重连任务"""
        try:
            await device.stop_read_loop()
            await device.disconnect()
            success = await self._connect_with_retry(device)
            if not success:
                logger.error(f"[Manager] 自动重连失败: {device.device_id}")
        finally:
            self._reconnect_tasks.pop(device.device_id, None)

    # ── WebSocket 服务端 ──────────────────────────────────────

    async def _run_ws_server(self) -> None:
        """运行 WebSocket 服务端"""
        try:
            from fastapi import FastAPI, WebSocket

            config = get_hardware_config()

            # 使用 uvicorn 运行独立的 WebSocket 服务
            import uvicorn

            ws_app = FastAPI(title="Hardware WebSocket Server")

            @ws_app.websocket(config.HW_WS_PATH)
            async def websocket_endpoint(websocket: WebSocket):
                await websocket.accept()
                conn = WebSocketDeviceConnection(websocket)

                try:
                    # 等待设备注册消息
                    msg = await conn.receive_message()
                    if msg and msg.type == WSMessageType.REGISTER:
                        device_info = conn.parse_device_info(msg)
                        if device_info:
                            conn.device_id = device_info.device_id

                            # 查找或创建设备
                            device = self._devices.get(device_info.device_id)
                            if not device:
                                device = ESP32RehabStation(device_info.device_id)
                                self.register_device(device)

                            # 绑定 WebSocket 连接
                            if isinstance(device, ESP32RehabStation):
                                device.bind_ws_connection(conn)

                            self._ws_server.register_connection(conn)
                            await conn.send_ack(msg.message_id, True)
                        else:
                            await conn.send_ack(msg.message_id, False)
                            return
                    else:
                        logger.warning("[WS] 未收到注册消息")
                        return

                    # 持续接收消息
                    while self._running and conn.is_alive:
                        msg = await conn.receive_message()
                        if msg is None:
                            break

                        if msg.type == WSMessageType.SENSOR_DATA:
                            reading = conn.parse_sensor_reading(msg)
                            if reading:
                                self._dispatch_sensor(reading)
                                await conn.send_ack(msg.message_id, True)

                        elif msg.type == WSMessageType.BUTTON_EVENT:
                            event = ButtonEvent(
                                button_id=msg.payload.get("button_id", ""),
                                pressed=msg.payload.get("pressed", False),
                                duration_ms=msg.payload.get("duration_ms", 0),
                                device_id=conn.device_id,
                            )
                            self._dispatch_button(event)
                            await conn.send_ack(msg.message_id, True)

                        elif msg.type == WSMessageType.AUDIO_CHUNK:
                            import base64
                            audio_data = base64.b64decode(msg.payload.get("data", ""))
                            if audio_data:
                                self._dispatch_audio(audio_data, conn.device_id)

                        elif msg.type == WSMessageType.HEARTBEAT:
                            await conn.send_ack(msg.message_id, True)

                except Exception as e:
                    logger.error(f"[WS] 连接异常: {e}")
                finally:
                    self._ws_server.unregister_connection(conn.device_id)
                    device = self._devices.get(conn.device_id)
                    if device:
                        device._update_status(DeviceStatus.DISCONNECTED)

            # 启动 WebSocket 服务
            uv_config = uvicorn.Config(
                ws_app,
                host=config.HW_WS_HOST,
                port=config.HW_WS_PORT,
                log_level="warning",
            )
            server = uvicorn.Server(uv_config)
            await server.serve()

        except Exception as e:
            logger.error(f"[Manager] WebSocket 服务端异常: {e}")

    # ── 事件分发 ──────────────────────────────────────────────

    def _dispatch_sensor(self, reading: SensorReading) -> None:
        """分发传感器数据到全局回调"""
        for cb in self._sensor_callbacks:
            try:
                result = cb(reading)
                if asyncio.iscoroutine(result):
                    asyncio.create_task(result)
            except Exception as e:
                logger.error(f"[Manager] 传感器回调异常: {e}")

    def _dispatch_button(self, event: ButtonEvent) -> None:
        """分发按钮事件到全局回调"""
        for cb in self._button_callbacks:
            try:
                result = cb(event)
                if asyncio.iscoroutine(result):
                    asyncio.create_task(result)
            except Exception as e:
                logger.error(f"[Manager] 按钮回调异常: {e}")

    def _dispatch_audio(self, audio_bytes: bytes, device_id: str) -> None:
        """分发音频数据到全局回调"""
        for cb in self._audio_callbacks:
            try:
                result = cb(audio_bytes, device_id)
                if asyncio.iscoroutine(result):
                    asyncio.create_task(result)
            except Exception as e:
                logger.error(f"[Manager] 音频回调异常: {e}")

    # ── 命令发送 ──────────────────────────────────────────────

    async def send_command(self, device_id: str, command: ActuatorCommand) -> bool:
        """
        向指定设备发送控制命令

        Args:
            device_id: 设备 ID
            command: 执行器命令

        Returns:
            True=发送成功
        """
        device = self._devices.get(device_id)
        if not device:
            logger.warning(f"[Manager] 设备 {device_id} 未注册")
            return False

        if not device.is_online:
            logger.warning(f"[Manager] 设备 {device_id} 未连接")
            return False

        return await device.send_command(command)

    async def broadcast_command(self, command: ActuatorCommand) -> int:
        """
        广播控制命令到所有已连接设备

        Returns:
            成功发送的设备数
        """
        count = 0
        for device in self._devices.values():
            if device.is_online:
                if await device.send_command(command):
                    count += 1
        return count

    async def send_training_event(
        self,
        event: TrainingEvent,
        device_id: str = "",
    ) -> bool:
        """
        发送训练事件到设备

        Args:
            event: 训练事件
            device_id: 指定设备 ID，空字符串=发送到所有设备

        Returns:
            True=至少一个设备成功接收
        """
        if device_id:
            device = self._devices.get(device_id)
            if device and device.is_online:
                return await device.handle_training_event(event)
            return False

        success = False
        for device in self._devices.values():
            if device.is_online:
                if await device.handle_training_event(event):
                    success = True
        return success


# ── 全局单例 ──────────────────────────────────────────────────

device_manager = DeviceManager()
