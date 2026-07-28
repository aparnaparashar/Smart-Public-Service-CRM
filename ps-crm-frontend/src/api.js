import axios from 'axios';

const resolveApiBaseUrl = () => {
  const configuredUrl = process.env.REACT_APP_API_URL || process.env.REACT_APP_API_BASE_URL;
  if (configuredUrl && configuredUrl.trim()) {
    return configuredUrl.trim().replace(/\/$/, '');
  }
  return '/api';
};

const API_BASE_URL = resolveApiBaseUrl();

console.log('[API] Using backend URL:', API_BASE_URL);

const API = axios.create({
  baseURL: API_BASE_URL,
  timeout: 60000, // 60 second timeout (OTP/email can be slow in production)
});

API.interceptors.request.use((req) => {
  const user = localStorage.getItem('user');
  if (user) {
    try {
      req.headers.Authorization = `Bearer ${JSON.parse(user).token}`;
    } catch (e) {
      console.warn('[API] Failed to parse user token');
    }
  }
  return req;
});

// ✅ Add response error handling
API.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.code === 'ECONNABORTED') {
      console.error('[API] Request timeout - backend may be slow or unreachable');
    } else if (!error.response) {
      console.error('[API] Network error - could not reach backend:', error.message);
    }
    return Promise.reject(error);
  }
);

export default API;