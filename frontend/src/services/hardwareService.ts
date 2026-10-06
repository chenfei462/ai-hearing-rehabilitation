/**
 * 硬件管理 API 服务
 *
 * 提供设备状态查询、控制命令、训练事件推送等功能。
 */
import api from './api';
import type { ApiResponse } from '../types';

// ── 类型定义 ────────────────────────────────────────────────

export type DeviceStatus = 'disconnected' | 'connecting' | 'connected' | 'error' | 'reconnecting';

export type DeviceType = 'esp32_station' | 'arduino_basic' | 'mock_device';

export interface DeviceInfo {
  device_id: string;
  device_type: DeviceType;
  firmware_version: string;
  ip_address: string;
  mac_address: string;
  sensors: string[];
  actuators: string[];
  battery_level: number | null;
  uptime_seconds: number;
}

export interface DeviceState {
  device_id: string;
  status: DeviceStatus;
  last_seen: number;
  reconnect_count: number;
  error_message: string;
  sensor_readings: Record<string, unknown>;
  info: DeviceInfo | null;
}

export interface DeviceListResponse {
  devices: DeviceState[];
  total: number;
  online: number;
}

export interface CommandRequest {
  actuator_type: string;
  action: string;
  params?: Record<string, unknown>;
  duration_ms?: number;
}

export interface LEDRequest {
  color?: string;
  pattern?: string;
  duration_ms?: number;
}

export interface BuzzerRequest {
  frequency_hz?: number;
  duration_ms?: number;
}

export interface TrainingEventRequest {
  event_type: string;
  device_id?: string;
  data?: Record<string, unknown>;
}

// ── API 调用 ────────────────────────────────────────────────

export const hardwareService = {
  /** 列出所有设备 */
  listDevices() {
    return api.get<ApiResponse<DeviceListResponse>>('/hardware/devices');
  },

  /** 查询单个设备状态 */
  getDevice(deviceId: string) {
    return api.get<ApiResponse<DeviceState>>(`/hardware/devices/${deviceId}`);
  },

  /** 连接设备 */
  connectDevice(deviceId: string) {
    return api.post<ApiResponse<DeviceState>>(`/hardware/devices/${deviceId}/connect`);
  },

  /** 断开设备 */
  disconnectDevice(deviceId: string) {
    return api.post<ApiResponse<DeviceState>>(`/hardware/devices/${deviceId}/disconnect`);
  },

  /** 发送控制命令 */
  sendCommand(deviceId: string, command: CommandRequest) {
    return api.post<ApiResponse<unknown>>(`/hardware/devices/${deviceId}/command`, command);
  },

  /** LED 控制 */
  controlLED(deviceId: string, request: LEDRequest) {
    return api.post<ApiResponse<unknown>>(`/hardware/devices/${deviceId}/led`, request);
  },

  /** 蜂鸣器控制 */
  controlBuzzer(deviceId: string, request: BuzzerRequest) {
    return api.post<ApiResponse<unknown>>(`/hardware/devices/${deviceId}/buzzer`, request);
  },

  /** 推送训练事件 */
  pushTrainingEvent(request: TrainingEventRequest) {
    return api.post<ApiResponse<unknown>>('/hardware/training-event', request);
  },

  /** 获取 WebSocket 连接信息 */
  getWSInfo() {
    return api.get<ApiResponse<unknown>>('/hardware/ws-info');
  },
};
