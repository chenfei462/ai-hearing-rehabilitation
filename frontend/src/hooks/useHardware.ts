/**
 * useHardware Hook
 *
 * 提供硬件设备状态管理和控制功能。
 * 定期轮询设备状态，支持手动刷新和设备控制。
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import {
  hardwareService,
  DeviceState,
  DeviceListResponse,
  TrainingEventRequest,
} from '../services/hardwareService';
import { getErrorMessage } from '../utils/errors';

interface UseHardwareOptions {
  /** 自动刷新间隔（毫秒），0=禁用 */
  pollInterval?: number;
  /** 是否自动加载设备列表 */
  autoLoad?: boolean;
}

interface UseHardwareReturn {
  /** 设备列表 */
  devices: DeviceState[];
  /** 在线设备数 */
  onlineCount: number;
  /** 总设备数 */
  totalCount: number;
  /** 是否正在加载 */
  loading: boolean;
  /** 错误信息 */
  error: string | null;
  /** 刷新设备列表 */
  refresh: () => Promise<void>;
  /** 连接设备 */
  connectDevice: (deviceId: string) => Promise<boolean>;
  /** 断开设备 */
  disconnectDevice: (deviceId: string) => Promise<boolean>;
  /** 推送训练事件 */
  pushTrainingEvent: (event: TrainingEventRequest) => Promise<boolean>;
  /** 获取指定设备状态 */
  getDevice: (deviceId: string) => DeviceState | undefined;
}

export function useHardware(options: UseHardwareOptions = {}): UseHardwareReturn {
  const { pollInterval = 5000, autoLoad = true } = options;

  const [devices, setDevices] = useState<DeviceState[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await hardwareService.listDevices();
      const data: DeviceListResponse = response.data;
      setDevices(data.devices || []);
    } catch (err: unknown) {
      setError(getErrorMessage(err, '获取设备列表失败'));
    } finally {
      setLoading(false);
    }
  }, []);

  const connectDevice = useCallback(async (deviceId: string): Promise<boolean> => {
    try {
      await hardwareService.connectDevice(deviceId);
      await refresh();
      return true;
    } catch (err: unknown) {
      setError(getErrorMessage(err, '连接设备失败'));
      return false;
    }
  }, [refresh]);

  const disconnectDevice = useCallback(async (deviceId: string): Promise<boolean> => {
    try {
      await hardwareService.disconnectDevice(deviceId);
      await refresh();
      return true;
    } catch (err: unknown) {
      setError(getErrorMessage(err, '断开设备失败'));
      return false;
    }
  }, [refresh]);

  const pushTrainingEvent = useCallback(async (event: TrainingEventRequest): Promise<boolean> => {
    try {
      await hardwareService.pushTrainingEvent(event);
      return true;
    } catch (err: unknown) {
      console.error('推送训练事件失败:', getErrorMessage(err, '未知错误'));
      return false;
    }
  }, []);

  const getDevice = useCallback((deviceId: string): DeviceState | undefined => {
    return devices.find(d => d.device_id === deviceId);
  }, [devices]);

  // 自动加载
  useEffect(() => {
    if (autoLoad) {
      refresh();
    }
  }, [autoLoad, refresh]);

  // 定期轮询
  useEffect(() => {
    if (pollInterval > 0) {
      intervalRef.current = setInterval(refresh, pollInterval);
      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
        }
      };
    }
  }, [pollInterval, refresh]);

  return {
    devices,
    onlineCount: devices.filter(d => d.status === 'connected').length,
    totalCount: devices.length,
    loading,
    error,
    refresh,
    connectDevice,
    disconnectDevice,
    pushTrainingEvent,
    getDevice,
  };
}
