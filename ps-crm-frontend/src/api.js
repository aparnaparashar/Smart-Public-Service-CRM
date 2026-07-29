import axios from 'axios';

const resolveApiBaseUrl = () => {
  const configuredUrl = process.env.REACT_APP_API_URL || process.env.REACT_APP_API_BASE_URL;
  const trimmed = configuredUrl?.trim() || '';

  // In production builds on Vercel, ALWAYS use the /api proxy path
  // to avoid cross-origin requests (CORS). The Vercel rewrite in
  // vercel.json proxies /api/* to the Railway backend.
  if (process.env.NODE_ENV === 'production') {
    // If someone accidentally sets an absolute URL in Vercel env vars,
    // ignore it and force the proxy path.
    if (!trimmed || /^https?:\/\//i.test(trimmed)) {
      return '/api';
    }
  }

  if (!trimmed) {
    return '/api';
  }

  const withoutTrailingSlash = trimmed.replace(/\/+$/, '');

  if (/^https?:\/\//i.test(withoutTrailingSlash) || withoutTrailingSlash.startsWith('/')) {
    return withoutTrailingSlash;
  }

  if (/^(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/i.test(withoutTrailingSlash)) {
    return `http://${withoutTrailingSlash}`;
  }

  return `https://${withoutTrailingSlash}`;
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