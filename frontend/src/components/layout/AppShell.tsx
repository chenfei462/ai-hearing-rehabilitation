import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  AppBar,
  Toolbar,
  Typography,
  BottomNavigation,
  BottomNavigationAction,
  Box,
  Container,
  IconButton,
} from '@mui/material';
import {
  Home as HomeIcon,
  School as TrainingIcon,
  RecordVoiceOver as DialogueIcon,
  Mic as PronunciationIcon,
  Assessment as ReportIcon,
  Settings as SettingsIcon,
} from '@mui/icons-material';
import { useA11yStore } from '../../stores/a11yStore';

const navItems = [
  { label: '首页', icon: <HomeIcon sx={{ fontSize: 28 }} />, path: '/' },
  { label: '训练', icon: <TrainingIcon sx={{ fontSize: 28 }} />, path: '/training' },
  { label: '对话', icon: <DialogueIcon sx={{ fontSize: 28 }} />, path: '/dialogue' },
  { label: '发音', icon: <PronunciationIcon sx={{ fontSize: 28 }} />, path: '/pronunciation' },
  { label: '报告', icon: <ReportIcon sx={{ fontSize: 28 }} />, path: '/report' },
];

export default function AppShell() {
  const navigate = useNavigate();
  const location = useLocation();
  const { highContrast } = useA11yStore();
  const currentNav = navItems.findIndex((item) => item.path === location.pathname);

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100vh',
        bgcolor: 'background.default',
      }}
    >
      {/* 顶部应用栏 */}
      <AppBar
        position="sticky"
        sx={{
          bgcolor: highContrast ? 'primary.dark' : 'primary.main',
        }}
      >
        <Toolbar sx={{ minHeight: 64 }}>
          <Typography
            variant="h5"
            component="div"
            sx={{ flexGrow: 1, fontWeight: 700, letterSpacing: 1 }}
          >
            AI 听觉康复助手
          </Typography>
          <IconButton
            color="inherit"
            onClick={() => navigate('/settings')}
            aria-label="设置"
            sx={{ ml: 1 }}
          >
            <SettingsIcon sx={{ fontSize: 28 }} />
          </IconButton>
        </Toolbar>
      </AppBar>

      {/* 主内容区 */}
      <Container
        component="main"
        maxWidth="md"
        sx={{
          flex: 1,
          py: 3,
          px: { xs: 2, sm: 3 },
          pb: 12, // 为底部导航留空间
        }}
      >
        <Outlet />
      </Container>

      {/* 底部大标签导航 */}
      <BottomNavigation
        showLabels
        value={currentNav >= 0 ? currentNav : 0}
        onChange={(_, newValue) => navigate(navItems[newValue].path)}
        sx={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          height: 72,
          borderTop: 2,
          borderColor: highContrast ? 'text.primary' : 'divider',
          bgcolor: 'background.paper',
          zIndex: 1200,
          '& .MuiBottomNavigationAction-root': {
            minWidth: 'auto',
            py: 1,
            color: highContrast ? 'text.primary' : 'text.secondary',
            '&.Mui-selected': {
              color: 'primary.main',
              fontWeight: 700,
            },
          },
          '& .MuiBottomNavigationAction-label': {
            fontSize: '1.125rem', // 18px 老年适配
            mt: 0.5,
            '&.Mui-selected': {
              fontSize: '1.25rem', // 20px 选中状态
            },
          },
        }}
      >
        {navItems.map((item) => (
          <BottomNavigationAction
            key={item.path}
            label={item.label}
            icon={item.icon}
            aria-label={item.label}
          />
        ))}
      </BottomNavigation>
    </Box>
  );
}
