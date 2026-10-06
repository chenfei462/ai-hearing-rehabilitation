"""
WebSocket 通信协议

用于 ESP32 等通过 WiFi 连接的设备。
协议格式: JSON WebSocket 消息

设备连接后先发送注册消息:
    {"type": "register", "device_id": "esp32-001", "device_type": "esp32_station",
     "sensors": ["button", "noise_level"], "actuators": ["led", "buzzer"]}

设备持续上报传感器数据:
    {"type": "sensor_data", "sensor_type": "button", "value": true, "timestamp": 1234567890.123}
    {"type": "sensor_data", "sensor_type": "noise_level", "value": 55.3, "unit": "dB"}

设备发送心跳:
    {"type": "heartbeat", "timestamp": 1234567890.123}

服务端下发控制命令:
    {"type": "command", "actuator_type": "led", "action": "on",
     "params": {"color": "green", "pattern": "blink_fast"}}
"""
from __future__ import annotations

import asyncio
import json
import time
from typing import Any, Optional

from loguru import logger

from app.hardware.schemas import (
    ActuatorCommand,
    DeviceInfo,
    DeviceType,
    SensorReading,
    SensorType,
    WSMessage,
    WSMessageType,
)


class WebSocketDeviceConnection:
    """
    单个设备的 WebSocket 连接封装

    管理一个 WebSocket 连接的读写、消息解析、心跳。
    """

    def __init__(self, ws: Any, device_id: str = ""):
        self.ws = ws
        self.device_id = device_id
        self.device_info: Optional[DeviceInfo] = None
        self.connected_at: float = time.time()
        self.last_heartbeat: float = time.time()
        self._send_lock = asyncio.Lock()

    @property
    def is_alive(self) -> bool:
        """检查连接是否存活"""
        try:
            return self.ws.client_state.name == "CONNECTED"
        except Exception:
            return False

    async def send_message(self, message: WSMessage) -> bool:
        """
        发送 WebSocket 消息

        Args:
            message: WSMessage 实例

        Returns:
            True=发送成功
        """
        async with self._send_lock:
            try:
                data = message.model_dump_json()
                await self.ws.send_text(data)
                return True
            except Exception as e:
                logger.error(f"[WS:{self.device_id}] 发送失败: {e}")
                return False

    async def send_command(self, command: ActuatorCommand) -> bool:
        """
        发送执行器控制命令

        Args:
            command: ActuatorCommand 实例

        Returns:
            True=发送成功
        """
        msg = WSMessage(
            type=WSMessageType.COMMAND,
            payload=command.model_dump(),
            device_id=self.device_id,
        )
        return await self.send_message(msg)

    async def send_training_event(self, event_type: str, data: dict) -> bool:
        """发送训练事件通知"""
        msg = WSMessage(
            type=WSMessageType.TRAINING_EVENT,
            payload={"event_type": event_type, **data},
            device_id=self.device_id,
        )
        return await self.send_message(msg)

    async def send_ack(self, message_id: str, success: bool = True) -> bool:
        """发送确认消息"""
        msg = WSMessage(
            type=WSMessageType.ACK,
            payload={"message_id": message_id, "success": success},
            device_id=self.device_id,
        )
        return await self.send_message(msg)

    async def receive_message(self) -> Optional[WSMessage]:
        """
        接收并解析 WebSocket 消息

        Returns:
            解析后的 WSMessage，连接关闭返回 None
        """
        try:
            data = await asyncio.wait_for(self.ws.receive_text(), timeout=30.0)
            parsed = json.loads(data)
            msg = WSMessage(**parsed)

            # 更新心跳时间
            if msg.type == WSMessageType.HEARTBEAT:
                self.last_heartbeat = time.time()

            return msg
        except asyncio.TimeoutError:
            return None
        except json.JSONDecodeError as e:
            logger.warning(f"[WS:{self.device_id}] JSON 解析失败: {e}")
            return None
        except Exception as e:
            if "1000" in str(e) or "1001" in str(e):
                # 正常关闭
                return None
            logger.error(f"[WS:{self.device_id}] 接收异常: {e}")
            return None

    def parse_sensor_reading(self, msg: WSMessage) -> Optional[SensorReading]:
        """
        将 WSMessage 解析为 SensorReading

        Args:
            msg: 接收到的 WebSocket 消息

        Returns:
            解析成功返回 SensorReading
        """
        if msg.type != WSMessageType.SENSOR_DATA:
            return None

        payload = msg.payload
        sensor_type_str = payload.get("sensor_type", "")

        try:
            sensor_type = SensorType(sensor_type_str)
        except ValueError:
            logger.warning(f"[WS:{self.device_id}] 未知传感器类型: {sensor_type_str}")
            return None

        return SensorReading(
            sensor_type=sensor_type,
            value=payload.get("value"),
            unit=payload.get("unit", ""),
            timestamp=payload.get("timestamp", time.time()),
            device_id=self.device_id,
            metadata={"message_id": msg.message_id},
        )

    def parse_device_info(self, msg: WSMessage) -> Optional[DeviceInfo]:
        """
        从注册消息解析设备信息

        Args:
            msg: 注册消息

        Returns:
            解析成功返回 DeviceInfo
        """
        if msg.type != WSMessageType.REGISTER:
            return None

        payload = msg.payload
        try:
            info = DeviceInfo(
                device_id=payload.get("device_id", self.device_id),
                device_type=DeviceType(payload.get("device_type", "esp32_station")),
                firmware_version=payload.get("firmware_version", "1.0.0"),
                ip_address=payload.get("ip_address", ""),
                mac_address=payload.get("mac_address", ""),
                sensors=[SensorType(s) for s in payload.get("sensors", [])],
                actuators=[],
                battery_level=payload.get("battery_level"),
                uptime_seconds=payload.get("uptime_seconds", 0),
            )
            self.device_info = info
            self.device_id = info.device_id
            return info
        except Exception as e:
            logger.error(f"[WS] 解析设备信息失败: {e}")
            return None


class WebSocketServer:
    """
    WebSocket 服务端

    监听设备连接，管理多个设备的 WebSocket 连接。
    提供消息广播和单设备通信能力。
    """

    def __init__(self, host: str = "0.0.0.0", port: int = 8001, path: str = "/ws/device"):
        self.host = host
        self.port = port
        self.path = path
        self._connections: dict[str, WebSocketDeviceConnection] = {}
        self._server = None

    @property
    def connections(self) -> dict[str, WebSocketDeviceConnection]:
        return self._connections.copy()

    def get_connection(self, device_id: str) -> Optional[WebSocketDeviceConnection]:
        """获取指定设备的连接"""
        return self._connections.get(device_id)

    def register_connection(self, conn: WebSocketDeviceConnection) -> None:
        """注册设备连接"""
        self._connections[conn.device_id] = conn
        logger.info(f"[WS] 设备已注册: {conn.device_id} (共 {len(self._connections)} 个)")

    def unregister_connection(self, device_id: str) -> None:
        """注销设备连接"""
        self._connections.pop(device_id, None)
        logger.info(f"[WS] 设备注销: {device_id} (剩余 {len(self._connections)} 个)")

    async def send_to_device(self, device_id: str, message: WSMessage) -> bool:
        """向指定设备发送消息"""
        conn = self._connections.get(device_id)
        if not conn:
            logger.warning(f"[WS] 设备 {device_id} 未连接")
            return False
        return await conn.send_message(message)

    async def send_command_to_device(self, device_id: str, command: ActuatorCommand) -> bool:
        """向指定设备发送控制命令"""
        conn = self._connections.get(device_id)
        if not conn:
            return False
        return await conn.send_command(command)

    async def broadcast(self, message: WSMessage) -> int:
        """
        广播消息到所有已连接设备

        Returns:
            成功发送的设备数量
        """
        success_count = 0
        for device_id, conn in self._connections.items():
            if conn.is_alive:
                if await conn.send_message(message):
                    success_count += 1
        return success_count

    async def broadcast_training_event(self, event_type: str, data: dict) -> int:
        """广播训练事件到所有设备"""
        msg = WSMessage(
            type=WSMessageType.TRAINING_EVENT,
            payload={"event_type": event_type, **data},
        )
        return await self.broadcast(msg)
