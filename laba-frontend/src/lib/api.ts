import axios from 'axios';

export const getApiBaseUrl = (): string => {
  // 1. If executing in browser and accessed via vercel.app or any external public host
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    if (host !== 'localhost' && host !== '127.0.0.1' && !host.startsWith('192.168.')) {
      return 'https://labeattendance.onrender.com/api/v1';
    }
  }

  // 2. If explicitly configured in environment variable
  if (process.env.NEXT_PUBLIC_API_URL && !process.env.NEXT_PUBLIC_API_URL.includes('localhost')) {
    return process.env.NEXT_PUBLIC_API_URL;
  }

  // 3. If running in production build mode
  if (process.env.NODE_ENV === 'production') {
    return 'https://labeattendance.onrender.com/api/v1';
  }

  // 4. Default development fallback
  return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';
};

export const apiClient = axios.create({
  baseURL: getApiBaseUrl(),
  withCredentials: true, // Mandatory for cross-origin / subdomain HTTP-only cookies
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 45000, // 45s to allow for free-tier Render server wakeups
});

apiClient.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    // Guarantee that requests from vercel.app or public hosts always target Render
    if (host !== 'localhost' && host !== '127.0.0.1' && !host.startsWith('192.168.')) {
      config.baseURL = 'https://labeattendance.onrender.com/api/v1';
    }

    const token = localStorage.getItem('laba_token');
    if (token && !config.headers.Authorization) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    // If 401 Unauthorized occurs on client side, let caller or AuthProvider handle redirection
    return Promise.reject(error);
  }
);
