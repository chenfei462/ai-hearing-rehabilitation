/** 统一 API 客户端：携带 httpOnly Cookie，并解包 Axios 响应为 ApiResponse。 */
import axios from 'axios';
import type { AxiosRequestConfig } from 'axios';

interface ApiClient {
  get<T>(url: string, config?: AxiosRequestConfig): Promise<T>;
  post<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T>;
  put<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T>;
}

const client = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  timeout: 30000,
  withCredentials: true, // 自动携带 cookies
});

// 响应拦截器：统一处理错误
client.interceptors.response.use(
  (response) => response.data,
  (error) => {
    if (error.response) {
      const { code, message } = error.response.data;
      if (code === 40101) {
        // Token 无效或过期，跳转登录页
        window.location.href = '/login';
      }
      return Promise.reject({ code, message });
    }
    return Promise.reject({ code: 50001, message: '网络错误' });
  },
);

const api: ApiClient = {
  get: (url, config) => client.get(url, config).then((response) => response as never),
  post: (url, data, config) => client.post(url, data, config).then((response) => response as never),
  put: (url, data, config) => client.put(url, data, config).then((response) => response as never),
};

export default api;
