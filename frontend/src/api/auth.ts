import api from '../services/api';
import type { ApiResponse, User } from '../types';

export interface SmsSendRequest {
  phone: string;
}

export interface LoginRequest {
  phone: string;
  code: string;
}

export interface LoginResponse {
  user: User;
}

export interface UserProfile {
  id: number;
  phone: string;
  role: 'patient' | 'therapist';
  nickname: string;
  birth_year: number | null;
  cochlear_info: Record<string, unknown>;
  consent_flags: Record<string, boolean>;
}

export interface PreferencesUpdate {
  font_scale?: number;
  volume?: number;
  voice_guide?: boolean;
  high_contrast?: boolean;
  large_text?: boolean;
}

/** 发送短信验证码 */
export async function sendSmsCode(phone: string): Promise<void> {
  await api.post('/auth/sms/send', { phone });
}

/** 手机号+验证码登录 */
export async function loginWithPhone(data: LoginRequest): Promise<LoginResponse> {
  const res = await api.post<ApiResponse<LoginResponse>>('/auth/login', data);
  return res.data;
}

/** 获取当前用户信息 */
export async function getMe(): Promise<UserProfile> {
  const res = await api.get<ApiResponse<UserProfile>>('/auth/me');
  return res.data;
}

/** 更新无障碍偏好 */
export async function updatePreferences(data: PreferencesUpdate): Promise<void> {
  await api.put('/auth/users/me/preferences', data);
}

/** 登出 */
export async function logout(): Promise<void> {
  await api.post('/auth/logout');
}
