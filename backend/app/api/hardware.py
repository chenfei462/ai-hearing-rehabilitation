"""
硬件管理 API

提供设备状态查询、控制命令发送、训练事件推送等端点。
所有端点均需要认证（除健康检查外）。

端点列表:
  GET  /api/hardware/devices          - 列出所有设备
  GET  /api/hardware/devices/{id}     - 查询单个设备状态
  POST /api/hardware/devices/{id}/command - 发送控制命令
  POST /api/hardware/training-event   - 推送训练事件
  GET  /api/hardware/ws-info          - WebSocket 连接信息
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Any

from app.api.deps import get_current_user
from app.hardware.manager import device_manager
from app.hardware.schemas import (
    ActuatorCommand,
    ActuatorType,
    TrainingEvent,
    TrainingEventType,
)
from app.schemas.common import ApiResponse

router = APIRouter()


# ── 请求模型 ─────────────────────────────────────────────────

class CommandRequest(BaseModel):
    """执行器控制命令请求"""
    actuator_type: str                  # "led", "buzzer", "display", "vibration"
    action: str                         # "on", "off", "blink", "buzz", "show_text"
    params: dict[str, Any] = {}
    duration_ms: int = 0


class TrainingEventRequest(BaseModel):
    """训练事件请求"""
    event_type: str                     # TrainingEventType 值
    device_id: str = ""                 # 空=广播到所有设备
    data: dict[str, Any] = {}


class LEDRequest(BaseModel):
    """LED 快捷控制"""
    color: str = "green"                # "green", "red", "blue", "yellow", "white"
    pattern: str = "on"                 # "on", "off", "blink_slow", "blink_fast", "pulse"
    duration_ms: int = 0


class BuzzerRequest(BaseModel):
    """蜂鸣器快捷控制"""
    frequency_hz: int = 1000
    duration_ms: int = 200


# ── 设备管理 ─────────────────────────────────────────────────

@router.get("/devices", response_model=ApiResponse)
async def list_devices(
    current_user=Depends(get_current_user),
):
    """列出所有注册设备及其状态"""
    states = device_manager.get_all_states()
    return {
        "code": 0,
        "data": {
            "devices": [s.model_dump() for s in states],
            "total": len(states),
            "online": sum(1 for s in states if s.status.value == "connected"),
        },
        "message": "ok",
    }


@router.get("/devices/{device_id}", response_model=ApiResponse)
async def get_device_state(
    device_id: str,
    current_user=Depends(get_current_user),
):
    """查询单个设备状态"""
    device = device_manager.get_device(device_id)
    if not device:
        raise HTTPException(
            status_code=404,
            detail={"code": 40401, "message": f"设备 {device_id} 未注册"},
        )

    state = device.get_state()
    return {
        "code": 0,
        "data": state.model_dump(),
        "message": "ok",
    }


@router.post("/devices/{device_id}/connect", response_model=ApiResponse)
async def connect_device(
    device_id: str,
    current_user=Depends(get_current_user),
):
    """手动触发设备连接"""
    device = device_manager.get_device(device_id)
    if not device:
        raise HTTPException(
            status_code=404,
            detail={"code": 40401, "message": f"设备 {device_id} 未注册"},
        )

    success = await device_manager.connect_device(device_id)
    return {
        "code": 0,
        "data": {"connected": success},
        "message": "连接成功" if success else "连接失败",
    }


@router.post("/devices/{device_id}/disconnect", response_model=ApiResponse)
async def disconnect_device(
    device_id: str,
    current_user=Depends(get_current_user),
):
    """手动断开设备"""
    device = device_manager.get_device(device_id)
    if not device:
        raise HTTPException(
            status_code=404,
            detail={"code": 40401, "message": f"设备 {device_id} 未注册"},
        )

    await device.disconnect()
    return {
        "code": 0,
        "data": {"disconnected": True},
        "message": "ok",
    }


# ── 设备控制 ─────────────────────────────────────────────────

@router.post("/devices/{device_id}/command", response_model=ApiResponse)
async def send_command(
    device_id: str,
    request: CommandRequest,
    current_user=Depends(get_current_user),
):
    """
    发送执行器控制命令

    支持的执行器类型:
      - led: LED 指示灯 (params: color, pattern)
      - buzzer: 蜂鸣器 (params: frequency_hz)
      - display: OLED 显示屏 (params: text, line)
      - vibration: 振动马达 (params: intensity)
    """
    device = device_manager.get_device(device_id)
    if not device:
        raise HTTPException(
            status_code=404,
            detail={"code": 40401, "message": f"设备 {device_id} 未注册"},
        )

    if not device.is_online:
        raise HTTPException(
            status_code=503,
            detail={"code": 50301, "message": f"设备 {device_id} 未连接"},
        )

    try:
        actuator_type = ActuatorType(request.actuator_type)
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail={"code": 40001, "message": f"不支持的执行器类型: {request.actuator_type}"},
        )

    command = ActuatorCommand(
        actuator_type=actuator_type,
        action=request.action,
        params=request.params,
        duration_ms=request.duration_ms,
    )

    success = await device_manager.send_command(device_id, command)
    return {
        "code": 0,
        "data": {"sent": success},
        "message": "命令已发送" if success else "命令发送失败",
    }


@router.post("/devices/{device_id}/led", response_model=ApiResponse)
async def control_led(
    device_id: str,
    request: LEDRequest,
    current_user=Depends(get_current_user),
):
    """LED 快捷控制"""
    device = device_manager.get_device(device_id)
    if not device or not device.is_online:
        raise HTTPException(status_code=503, detail={"code": 50301, "message": "设备不可用"})

    from app.hardware.schemas import LEDCommand, LEDColor, LEDPattern
    cmd = LEDCommand(
        color=LEDColor(request.color),
        pattern=LEDPattern(request.pattern),
        duration_ms=request.duration_ms,
    )
    success = await device.send_command(cmd)
    return {"code": 0, "data": {"sent": success}, "message": "ok"}


@router.post("/devices/{device_id}/buzzer", response_model=ApiResponse)
async def control_buzzer(
    device_id: str,
    request: BuzzerRequest,
    current_user=Depends(get_current_user),
):
    """蜂鸣器快捷控制"""
    device = device_manager.get_device(device_id)
    if not device or not device.is_online:
        raise HTTPException(status_code=503, detail={"code": 50301, "message": "设备不可用"})

    from app.hardware.schemas import BuzzerCommand
    cmd = BuzzerCommand(
        frequency_hz=request.frequency_hz,
        duration_ms=request.duration_ms,
    )
    success = await device.send_command(cmd)
    return {"code": 0, "data": {"sent": success}, "message": "ok"}


# ── 训练事件 ─────────────────────────────────────────────────

@router.post("/training-event", response_model=ApiResponse)
async def push_training_event(
    request: TrainingEventRequest,
    current_user=Depends(get_current_user),
):
    """
    推送训练事件到硬件设备

    训练事件会触发设备的视觉/听觉反馈:
      - session_start: 蓝灯亮
      - answer_correct: 绿灯 + 正向蜂鸣
      - answer_wrong: 红灯 + 负向蜂鸣
      - level_up: 绿灯快闪
      - level_down: 红灯慢闪
      - session_complete: 显示成绩
    """
    try:
        event_type = TrainingEventType(request.event_type)
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail={"code": 40001, "message": f"未知训练事件类型: {request.event_type}"},
        )

    event = TrainingEvent(
        event_type=event_type,
        data=request.data,
    )

    success = await device_manager.send_training_event(event, request.device_id)
    return {
        "code": 0,
        "data": {"delivered": success},
        "message": "事件已推送" if success else "无设备接收",
    }


# ── WebSocket 信息 ───────────────────────────────────────────

@router.get("/ws-info", response_model=ApiResponse)
async def get_ws_info(current_user=Depends(get_current_user)):
    """获取 WebSocket 连接信息（供设备端使用）"""
    from app.hardware.config import get_hardware_config
    config = get_hardware_config()
    return {
        "code": 0,
        "data": {
            "ws_url": f"ws://<server_ip>:{config.HW_WS_PORT}{config.HW_WS_PATH}",
            "host": config.HW_WS_HOST,
            "port": config.HW_WS_PORT,
            "path": config.HW_WS_PATH,
            "protocol": "JSON Lines",
            "heartbeat_interval_s": config.HW_HEARTBEAT_INTERVAL_S,
        },
        "message": "ok",
    }
