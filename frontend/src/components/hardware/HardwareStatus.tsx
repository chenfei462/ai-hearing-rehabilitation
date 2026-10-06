/**
 * 硬件状态指示器组件
 *
 * 在页面顶部显示硬件设备连接状态。
 * 点击可展开查看设备详情和控制面板。
 */
import { useState } from 'react';
import {
  Box,
  Chip,
  IconButton,
  Collapse,
  Paper,
  Typography,
  Stack,
  Tooltip,
  CircularProgress,
  Alert,
} from '@mui/material';
import {
  Memory,
  ExpandMore,
  ExpandLess,
  Refresh,
  Link,
  LinkOff,
  Circle,
} from '@mui/icons-material';
import { useHardware } from '../../hooks/useHardware';
import { DeviceState, DeviceStatus } from '../../services/hardwareService';

// 状态颜色映射
const statusColors: Record<DeviceStatus, 'success' | 'error' | 'warning' | 'default'> = {
  connected: 'success',
  disconnected: 'default',
  connecting: 'warning',
  reconnecting: 'warning',
  error: 'error',
};

// 状态文本映射
const statusLabels: Record<DeviceStatus, string> = {
  connected: '已连接',
  disconnected: '未连接',
  connecting: '连接中',
  reconnecting: '重连中',
  error: '异常',
};

// 设备类型名称
const deviceTypeNames: Record<string, string> = {
  esp32_station: 'ESP32 训练站',
  arduino_basic: 'Arduino 设备',
  mock_device: '模拟设备',
};

interface HardwareStatusProps {
  /** 是否默认展开 */
  defaultExpanded?: boolean;
  /** 是否显示控制按钮 */
  showControls?: boolean;
}

export default function HardwareStatus({
  defaultExpanded = false,
  showControls = true,
}: HardwareStatusProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const {
    devices,
    onlineCount,
    totalCount,
    loading,
    error,
    refresh,
    connectDevice,
    disconnectDevice,
  } = useHardware({ pollInterval: 5000 });

  // 如果没有设备，显示简化状态
  if (totalCount === 0 && !loading) {
    return (
      <Chip
        icon={<Memory />}
        label="无硬件设备"
        size="small"
        variant="outlined"
        color="default"
      />
    );
  }

  return (
    <Box>
      {/* 状态指示器 */}
      <Chip
        icon={<Memory />}
        label={
          loading ? (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <CircularProgress size={12} />
              <span>检测中</span>
            </Box>
          ) : (
            `硬件 ${onlineCount}/${totalCount}`
          )
        }
        size="small"
        color={onlineCount > 0 ? 'success' : 'default'}
        variant={onlineCount > 0 ? 'filled' : 'outlined'}
        onClick={() => setExpanded(!expanded)}
        onDelete={showControls ? () => setExpanded(!expanded) : undefined}
        deleteIcon={expanded ? <ExpandLess /> : <ExpandMore />}
        sx={{ cursor: 'pointer' }}
      />

      {/* 展开面板 */}
      <Collapse in={expanded}>
        <Paper
          elevation={3}
          sx={{
            position: 'absolute',
            top: '100%',
            right: 0,
            mt: 1,
            p: 2,
            minWidth: 320,
            maxWidth: 400,
            zIndex: 1000,
          }}
        >
          {/* 标题栏 */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="subtitle1" fontWeight={600}>
              硬件设备
            </Typography>
            <Tooltip title="刷新">
              <IconButton size="small" onClick={refresh} disabled={loading}>
                <Refresh fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>

          {/* 错误提示 */}
          {error && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => {}}>
              {error}
            </Alert>
          )}

          {/* 设备列表 */}
          <Stack spacing={1.5}>
            {devices.map((device) => (
              <DeviceCard
                key={device.device_id}
                device={device}
                onConnect={() => connectDevice(device.device_id)}
                onDisconnect={() => disconnectDevice(device.device_id)}
                showControls={showControls}
              />
            ))}
          </Stack>
        </Paper>
      </Collapse>
    </Box>
  );
}

// ── 设备卡片子组件 ──────────────────────────────────────────

interface DeviceCardProps {
  device: DeviceState;
  onConnect: () => void;
  onDisconnect: () => void;
  showControls: boolean;
}

function DeviceCard({ device, onConnect, onDisconnect, showControls }: DeviceCardProps) {
  const isConnected = device.status === 'connected';
  const isBusy = device.status === 'connecting' || device.status === 'reconnecting';

  return (
    <Paper
      variant="outlined"
      sx={{
        p: 1.5,
        borderColor: isConnected ? 'success.light' : 'divider',
      }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        {/* 设备信息 */}
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
            <Circle
              sx={{
                fontSize: 10,
                color: isConnected ? 'success.main' : device.status === 'error' ? 'error.main' : 'grey.400',
              }}
            />
            <Typography variant="body2" fontWeight={600}>
              {device.info ? deviceTypeNames[device.info.device_type] || device.info.device_type : device.device_id}
            </Typography>
          </Box>

          <Typography variant="caption" color="text.secondary">
            {device.device_id}
          </Typography>

          {device.info && (
            <Typography variant="caption" display="block" color="text.secondary">
              固件: {device.info.firmware_version}
              {device.info.ip_address && ` | IP: ${device.info.ip_address}`}
            </Typography>
          )}

          {device.error_message && (
            <Typography variant="caption" color="error" display="block">
              {device.error_message}
            </Typography>
          )}
        </Box>

        {/* 状态和操作 */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Chip
            label={statusLabels[device.status]}
            size="small"
            color={statusColors[device.status]}
            variant="outlined"
          />

          {showControls && (
            <Tooltip title={isConnected ? '断开' : '连接'}>
              <IconButton
                size="small"
                onClick={isConnected ? onDisconnect : onConnect}
                disabled={isBusy}
              >
                {isConnected ? <LinkOff fontSize="small" /> : <Link fontSize="small" />}
              </IconButton>
            </Tooltip>
          )}
        </Box>
      </Box>
    </Paper>
  );
}
