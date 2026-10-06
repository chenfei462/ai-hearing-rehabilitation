// 通用 API 响应格式
export interface ApiResponse<T> {
  code: number;
  data: T;
  message: string;
}

export interface AccuracyPoint {
  date: string;
  accuracy: number;
  session_count: number;
}

export interface LevelProgress {
  level: string;
  theta: number;
  se: number;
  session_count: number;
  avg_accuracy: number;
}

export interface DailyActivity {
  date: string;
  session_count: number;
  total_items: number;
  duration_minutes: number;
}

export interface TrainingSummary {
  total_sessions: number;
  total_items: number;
  correct_items: number;
  avg_accuracy: number;
  total_duration_minutes: number;
  accuracy_curve: AccuracyPoint[];
  adherence_rate: number;
  daily_activity: DailyActivity[];
  level_progress: LevelProgress[];
  streak_days: number;
  last_training_date: string | null;
}

export interface LevelDistribution {
  level: string;
  count: number;
}

export interface WeeklyReportData {
  user_id: number;
  week_start: string;
  week_end: string;
  total_sessions: number;
  total_duration_minutes: number;
  avg_accuracy: number;
  adherence_rate: number;
  accuracy_trend: 'improving' | 'stable' | 'declining';
  level_progress: LevelProgress[];
  daily_breakdown: DailyActivity[];
  highlight: string;
  suggestion: string;
}

export interface PatientSummary {
  user_id: number;
  nickname: string;
  phone: string;
  last_training_date: string | null;
  total_sessions: number;
  avg_accuracy: number;
  adherence_rate: number;
  current_level: string;
  streak_days: number;
  alert: string | null;
}

// 分页响应
export interface PaginatedResponse<T> {
  list: T[];
  total: number;
  page: number;
  page_size: number;
}

// 用户
export interface User {
  id: number;
  phone: string;
  role: 'patient' | 'therapist';
  nickname: string;
  birth_year?: number | null;
  cochlear_info?: Record<string, unknown>;
  consent_flags?: Record<string, boolean>;
  created_at?: string;
}

// 训练级别
export type TrainingLevel = 'syllable' | 'word' | 'sentence' | 'noise';

// 训练会话
export interface TrainingSession {
  id: number;
  user_id: number;
  level: TrainingLevel;
  start_time: string;
  end_time: string | null;
  total_items: number;
  correct_items: number;
  accuracy: number;
  status: 'active' | 'completed';
}

// 训练题目
export interface TrainingItem {
  id: number;
  level: TrainingLevel;
  content_type: string;
  text: string;
  audio_url: string;
  phonemes: string[];
  difficulty_b: number;
  tags: Record<string, unknown>;
}

// 对话场景
export interface DialogueScenario {
  id: string;
  name: string;
  description: string;
  rounds: number;
}

// 对话会话启动响应
export interface DialogueSessionStart {
  session_id: number;
  scenario: string;
  greeting_text: string;
  greeting_audio_url: string | null;
  max_turns: number;
}

// 对话轮次
export interface DialogueTurn {
  turn_index: number;
  user_text: string;
  ai_text: string;
  ai_audio_url: string | null;
  latency_ms: number;
  remaining_turns: number;
}

// 对话会话结束响应
export interface DialogueSessionFinish {
  session_id: number;
  scenario: string;
  turn_count: number;
  summary: string;
  duration_seconds: number;
}

// 发音练习任务
export interface PronunciationTask {
  task_id: number;
  text: string;
  phonemes: string[];
  demo_audio_url: string | null;
  difficulty: 'easy' | 'medium' | 'hard';
}

// 音素对齐详情
export interface PhonemeDetail {
  target: string;
  asr: string;
  score: number;
  is_match: boolean;
}

// 发音评估结果
export interface PronunciationResult {
  id: number;
  overall: number;
  accuracy: number;
  fluency: number;
  completeness: number;
  phoneme_details: PhonemeDetail[];
  suggestions: string[];
  tts_demo_url: string | null;
  latency_ms: number;
}

// 发音历史记录
export interface PronunciationHistoryItem {
  id: number;
  target_text: string;
  overall: number;
  accuracy: number;
  fluency: number;
  completeness: number;
  suggestions: string[];
  created_at: string | null;
}

// 发音统计
export interface PronunciationStats {
  total_attempts: number;
  average_score: number;
  best_score: number;
  improvement_trend: number;
}

// 用户能力
export interface UserAbility {
  id: number;
  user_id: number;
  level: TrainingLevel;
  theta: number;
  se: number;
  updated_at: string;
}
