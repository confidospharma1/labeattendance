import axios from 'axios';

const isProduction = process.env.NODE_ENV === 'production';
const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  (isProduction ? 'https://labeattendance.onrender.com/api/v1' : 'http://localhost:5000/api/v1');

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true, // Mandatory for cross-origin / subdomain HTTP-only cookies
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
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

