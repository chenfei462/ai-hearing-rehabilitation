import { createTheme, Theme } from '@mui/material/styles';

// 基础老年友好配置
const elderlyOverrides = {
  typography: {
    fontSize: 18,
    fontFamily: [
      '-apple-system',
      'BlinkMacSystemFont',
      '"Segoe UI"',
      'Roboto',
      '"Helvetica Neue"',
      'Arial',
      '"PingFang SC"',
      '"Microsoft YaHei"',
      'sans-serif',
    ].join(','),
    h1: { fontSize: '2.5rem', fontWeight: 700 },
    h2: { fontSize: '2rem', fontWeight: 700 },
    h3: { fontSize: '1.75rem', fontWeight: 600 },
    h4: { fontSize: '1.5rem', fontWeight: 600 },
    h5: { fontSize: '1.25rem', fontWeight: 600 },
    h6: { fontSize: '1.125rem', fontWeight: 600 },
    body1: { fontSize: '1.125rem', lineHeight: 1.6 },
    body2: { fontSize: '1rem', lineHeight: 1.6 },
    button: { fontSize: '1.125rem', fontWeight: 600 },
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          minHeight: 48,
          minWidth: 48,
          padding: '12px 24px',
          borderRadius: 12,
          textTransform: 'none' as const,
        },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          minHeight: 48,
          minWidth: 48,
        },
      },
    },
    MuiListItem: {
      styleOverrides: {
        root: {
          minHeight: 56,
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 16,
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          fontSize: '0.95rem',
        },
      },
    },
  },
};

// 默认老年友好主题
export const defaultTheme: Theme = createTheme({
  ...elderlyOverrides,
  palette: {
    primary: {
      main: '#1976d2',
      light: '#42a5f5',
      dark: '#1565c0',
      contrastText: '#ffffff',
    },
    secondary: {
      main: '#9c27b0',
      light: '#ba68c8',
      dark: '#7b1fa2',
    },
    success: {
      main: '#2e7d32',
      light: '#4caf50',
      dark: '#1b5e20',
    },
    warning: {
      main: '#ed6c02',
      light: '#ff9800',
      dark: '#e65100',
    },
    error: {
      main: '#d32f2f',
      light: '#ef5350',
      dark: '#c62828',
    },
    background: {
      default: '#f5f5f5',
      paper: '#ffffff',
    },
    text: {
      primary: '#212121',
      secondary: '#616161',
    },
  },
});

// 大字体主题（字号更大，触控目标更大）
export const largeFontTheme: Theme = createTheme({
  ...elderlyOverrides,
  typography: {
    ...elderlyOverrides.typography,
    fontSize: 20,
    h1: { fontSize: '2.75rem', fontWeight: 700 },
    h2: { fontSize: '2.25rem', fontWeight: 700 },
    h3: { fontSize: '2rem', fontWeight: 600 },
    h4: { fontSize: '1.75rem', fontWeight: 600 },
    h5: { fontSize: '1.5rem', fontWeight: 600 },
    h6: { fontSize: '1.25rem', fontWeight: 600 },
    body1: { fontSize: '1.25rem', lineHeight: 1.7 },
    body2: { fontSize: '1.125rem', lineHeight: 1.7 },
    button: { fontSize: '1.25rem', fontWeight: 600 },
  },
  components: {
    ...elderlyOverrides.components,
    MuiButton: {
      styleOverrides: {
        root: {
          minHeight: 56,
          minWidth: 56,
          padding: '14px 28px',
          borderRadius: 12,
          textTransform: 'none' as const,
        },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          minHeight: 56,
          minWidth: 56,
        },
      },
    },
  },
  palette: {
    primary: {
      main: '#1976d2',
      light: '#42a5f5',
      dark: '#1565c0',
      contrastText: '#ffffff',
    },
    secondary: {
      main: '#9c27b0',
    },
    background: {
      default: '#f5f5f5',
      paper: '#ffffff',
    },
    text: {
      primary: '#212121',
      secondary: '#616161',
    },
  },
});

// 高对比度主题（文字更粗、对比度更高）
export const highContrastTheme: Theme = createTheme({
  ...elderlyOverrides,
  typography: {
    ...elderlyOverrides.typography,
    fontSize: 18,
    h1: { fontSize: '2.5rem', fontWeight: 800 },
    h2: { fontSize: '2rem', fontWeight: 800 },
    h3: { fontSize: '1.75rem', fontWeight: 700 },
    h4: { fontSize: '1.5rem', fontWeight: 700 },
    h5: { fontSize: '1.25rem', fontWeight: 700 },
    h6: { fontSize: '1.125rem', fontWeight: 700 },
    body1: { fontSize: '1.125rem', fontWeight: 500, lineHeight: 1.6 },
    body2: { fontSize: '1rem', fontWeight: 500, lineHeight: 1.6 },
    button: { fontSize: '1.125rem', fontWeight: 700 },
  },
  components: {
    ...elderlyOverrides.components,
    MuiButton: {
      styleOverrides: {
        root: {
          minHeight: 48,
          minWidth: 48,
          padding: '12px 24px',
          borderRadius: 12,
          textTransform: 'none' as const,
          borderWidth: 2,
        },
      },
      defaultProps: {
        variant: 'contained',
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 16,
          border: '2px solid #212121',
        },
      },
    },
  },
  palette: {
    primary: {
      main: '#0d47a1',
      light: '#1565c0',
      dark: '#002171',
      contrastText: '#ffffff',
    },
    secondary: {
      main: '#7b1fa2',
    },
    success: {
      main: '#1b5e20',
    },
    warning: {
      main: '#e65100',
    },
    error: {
      main: '#b71c1c',
    },
    background: {
      default: '#ffffff',
      paper: '#ffffff',
    },
    text: {
      primary: '#000000',
      secondary: '#212121',
    },
  },
});

// 根据模式获取主题
export function getTheme(mode: 'default' | 'large' | 'high-contrast'): Theme {
  switch (mode) {
    case 'large':
      return largeFontTheme;
    case 'high-contrast':
      return highContrastTheme;
    default:
      return defaultTheme;
  }
}

// 导出旧 theme 以兼容现有引用
export const theme = defaultTheme;

export default defaultTheme;
