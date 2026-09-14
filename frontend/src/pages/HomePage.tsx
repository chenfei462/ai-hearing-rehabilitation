import { Box, Typography, Card, CardContent, Grid, Chip } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import {
  School,
  RecordVoiceOver,
  Mic,
  Assessment,
} from '@mui/icons-material';
import { useSpeechGuide } from '../hooks/useSpeechGuide';
import { useA11yStore } from '../stores/a11yStore';

interface ModuleCard {
  title: string;
  desc: string;
  icon: React.ReactNode;
  path: string;
  color: string;
  chip?: string;
}

const modules: ModuleCard[] = [
  {
    title: '听觉训练',
    desc: '分阶段训练，逐步提升听力能力',
    icon: <School sx={{ fontSize: 56 }} />,
    path: '/training',
    color: '#1976d2',
    chip: '推荐',
  },
  {
    title: '对话陪练',
    desc: 'AI 场景对话，练习日常交流',
    icon: <RecordVoiceOver sx={{ fontSize: 56 }} />,
    path: '/dialogue',
    color: '#9c27b0',
  },
  {
    title: '发音反馈',
    desc: '实时发音评估与纠正指导',
    icon: <Mic sx={{ fontSize: 56 }} />,
    path: '/pronunciation',
    color: '#2e7d32',
  },
  {
    title: '训练报告',
    desc: '查看训练进度与康复数据',
    icon: <Assessment sx={{ fontSize: 56 }} />,
    path: '/report',
    color: '#ed6c02',
  },
];

export default function HomePage() {
  const navigate = useNavigate();
  const { speakButton } = useSpeechGuide();
  const { highContrast } = useA11yStore();

  return (
    <Box>
      <Typography
        variant="h4"
        gutterBottom
        sx={{ mb: 1, fontWeight: 700 }}
      >
        欢迎使用 AI 听觉康复助手
      </Typography>
      <Typography
        variant="body1"
        color="text.secondary"
        sx={{ mb: 4, lineHeight: 1.8 }}
      >
        选择您需要的训练模块，开始今天的康复训练
      </Typography>

      <Grid container spacing={3}>
        {modules.map((mod) => (
          <Grid item xs={12} sm={6} key={mod.path}>
            <Card
              onClick={() => {
                speakButton(mod.title);
                navigate(mod.path);
              }}
              role="button"
              tabIndex={0}
              aria-label={`${mod.title} - ${mod.desc}`}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  speakButton(mod.title);
                  navigate(mod.path);
                }
              }}
              sx={{
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                borderTop: 4,
                borderColor: highContrast ? 'text.primary' : mod.color,
                cursor: 'pointer',
                transition: 'transform 0.2s, box-shadow 0.2s',
                '&:hover': {
                  transform: 'translateY(-4px)',
                  boxShadow: 6,
                },
                '&:focus-visible': {
                  outline: 3,
                  outlineColor: 'primary.main',
                  outlineOffset: 2,
                },
                border: highContrast ? 2 : 0,
              }}
            >
              <CardContent
                sx={{
                  flexGrow: 1,
                  textAlign: 'center',
                  py: 4,
                  px: 3,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 1,
                }}
              >
                <Box
                  sx={{
                    color: mod.color,
                    mb: 1,
                    p: 1.5,
                    borderRadius: '50%',
                    bgcolor: `${mod.color}15`,
                  }}
                >
                  {mod.icon}
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography variant="h5" fontWeight={700}>
                    {mod.title}
                  </Typography>
                  {mod.chip && (
                    <Chip
                      label={mod.chip}
                      size="small"
                      color="primary"
                      sx={{ fontSize: '0.8rem' }}
                    />
                  )}
                </Box>
                <Typography
                  variant="body1"
                  color="text.secondary"
                  sx={{ mt: 0.5, lineHeight: 1.6 }}
                >
                  {mod.desc}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}
