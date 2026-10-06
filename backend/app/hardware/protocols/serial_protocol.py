"""
串口通信协议

用于 Arduino 等通过 USB 串口连接的设备。
协议格式: JSON Lines（每行一个 JSON 对象）

发送格式（服务端 → 设备）:
    {"cmd": "led", "color": "green", "pattern": "on", "duration": 0}
    {"cmd": "buzzer", "freq": 1000, "duration": 200}

接收格式（设备 → 服务端）:
    {"type": "sensor", "sensor": "button", "value": true, "id": "btn_confirm"}
    {"type": "sensor", "sensor": "noise", "value": 55.3, "unit": "dB"}
    {"type": "audio", "data": "<base64_encoded_pcm>"}
    {"type": "info", "device_id": "arduino-001", "firmware": "1.0.0"}
"""
from __future__ import annotations

import asyncio
import json
from typing import Optional

from loguru import logger

from app.hardware.config import get_hardware_config
from app.hardware.schemas import (
    ActuatorCommand,
    ActuatorType,
    SensorReading,
    SensorType,
)


class SerialProtocol:
    """
    串口通信协议

    使用 pyserial-asyncio 实现异步串口读写。
    每次读取一行 JSON，解析为传感器数据。
    """

    def __init__(self, port: str = "", baud: int = 0):
        config = get_hardware_config()
        self.port = port or config.HW_SERIAL_PORT
        self.baud = baud or config.HW_SERIAL_BAUD
        self.timeout = config.HW_SERIAL_TIMEOUT
        self._serial = None
        self._reader_lock = asyncio.Lock()

    async def open(self) -> bool:
        """打开串口连接"""
        try:
            import serial_asyncio
            self._serial = await serial_asyncio.open_serial_connection(
                url=self.port,
                baudrate=self.baud,
            )
            logger.info(f"[Serial] 已打开串口 {self.port} @ {self.baud}bps")
            return True
        except ImportError:
            logger.error("[Serial] pyserial-asyncio 未安装: pip install pyserial-asyncio")
            return False
        except Exception as e:
            logger.error(f"[Serial] 打开串口失败: {e}")
            return False

    async def close(self) -> None:
        """关闭串口"""
        if self._serial:
            try:
                self._serial.close()
            except Exception:
                pass
            self._serial = None
            logger.info("[Serial] 串口已关闭")

    @property
    def is_open(self) -> bool:
        return self._serial is not None and self._serial.is_open

    async def read_line(self) -> Optional[dict]:
        """
        读取一行 JSON 数据

        Returns:
            解析后的字典，超时或解析失败返回 None
        """
        if not self.is_open:
            return None

        try:
            async with self._reader_lock:
                line_bytes = await asyncio.wait_for(
                    self._serial.readline(),
                    timeout=self.timeout,
                )
                if not line_bytes:
                    return None

                line = line_bytes.decode("utf-8", errors="ignore").strip()
                if not line:
                    return None

                return json.loads(line)
        except asyncio.TimeoutError:
            return None
        except json.JSONDecodeError as e:
            logger.warning(f"[Serial] JSON 解析失败: {line!r} ({e})")
            return None
        except Exception as e:
            logger.error(f"[Serial] 读取异常: {e}")
            return None

    async def write_command(self, command: dict) -> bool:
        """
        发送 JSON 命令到设备

        Args:
            command: 要发送的字典（自动序列化为 JSON）

        Returns:
            True=发送成功
        """
        if not self.is_open:
            return False

        try:
            data = json.dumps(command, ensure_ascii=False) + "\n"
            self._serial.write(data.encode("utf-8"))
            await self._serial.drain()
            return True
        except Exception as e:
            logger.error(f"[Serial] 发送失败: {e}")
            return False

    def parse_sensor_reading(self, data: dict) -> Optional[SensorReading]:
        """
        将设备上报的 JSON 解析为 SensorReading

        Args:
            data: 设备发送的 JSON 字典

        Returns:
            解析成功返回 SensorReading，否则 None
        """
        if data.get("type") != "sensor":
            return None

        sensor_map = {
            "button": SensorType.BUTTON,
            "noise": SensorType.NOISE_LEVEL,
            "pot": SensorType.POTENTIOMETER,
            "encoder": SensorType.ENCODER,
        }

        sensor_name = data.get("sensor", "")
        sensor_type = sensor_map.get(sensor_name)
        if not sensor_type:
            logger.warning(f"[Serial] 未知传感器类型: {sensor_name}")
            return None

        return SensorReading(
            sensor_type=sensor_type,
            value=data.get("value"),
            unit=data.get("unit", ""),
            metadata={"raw_id": data.get("id", ""), "raw": data},
        )

    def encode_command(self, command: ActuatorCommand) -> dict:
        """
        将 ActuatorCommand 编码为设备可识别的 JSON

        Args:
            command: 执行器命令

        Returns:
            设备 JSON 格式字典
        """
        if command.actuator_type == ActuatorType.LED:
            return {
                "cmd": "led",
                "color": command.params.get("color", "green"),
                "pattern": command.params.get("pattern", "on"),
                "duration": command.duration_ms,
            }
        elif command.actuator_type == ActuatorType.BUZZER:
            return {
                "cmd": "buzzer",
                "freq": command.params.get("frequency_hz", 1000),
                "duration": command.duration_ms or 200,
            }
        elif command.actuator_type == ActuatorType.DISPLAY:
            return {
                "cmd": "display",
                "text": command.params.get("text", ""),
                "line": command.params.get("line", 0),
            }
        elif command.actuator_type == ActuatorType.VIBRATION:
            return {
                "cmd": "vibration",
                "intensity": command.params.get("intensity", 100),
                "duration": command.duration_ms,
            }
        else:
            return {"cmd": command.actuator_type.value, **command.params}
