import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
  withCredentials: true, // 自动携带 cookies
});

// 响应拦截器：统一处理错误
api.interceptors.response.use(
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

export default api;
