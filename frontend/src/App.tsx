import { Routes, Route } from 'react-router-dom';
import { Box } from '@mui/material';
import AppShell from './components/layout/AppShell';
import HomePage from './pages/HomePage';
import TrainingPage from './pages/TrainingPage';
import DialoguePage from './pages/DialoguePage';
import PronunciationPage from './pages/PronunciationPage';
import ReportPage from './pages/ReportPage';
import SettingsPage from './pages/SettingsPage';
import LoginPage from './pages/LoginPage';
import NotFoundPage from './pages/NotFoundPage';

export default function App() {
  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<AppShell />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/training" element={<TrainingPage />} />
          <Route path="/dialogue" element={<DialoguePage />} />
          <Route path="/pronunciation" element={<PronunciationPage />} />
          <Route path="/report" element={<ReportPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </Box>
  );
}
