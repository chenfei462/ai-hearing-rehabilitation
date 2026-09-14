import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
});

// 请求拦截器：添加鉴权 token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// 响应拦截器：统一处理错误
api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    if (error.response) {
      const { code, message } = error.response.data;
      if (code === 40101) {
        localStorage.removeItem('token');
        window.location.href = '/login';
      }
      return Promise.reject({ code, message });
    }
    return Promise.reject({ code: 50001, message: '网络错误' });
  },
);

export default api;
