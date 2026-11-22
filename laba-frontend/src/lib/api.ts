import axios from 'axios';

const OVERRIDE_KEY = 'labe_api_url';
const DEFAULT_API = 'http://localhost:5000/api/v1';

/**
 * API base URL, in priority order:
 * 1. A server address saved on this device (Settings on the login screen) - handy for testing the APK
 * 2. NEXT_PUBLIC_API_URL baked in at build time (.env.local / .env.production / APK build)
 * 3. Local development default
 */
export const getApiBaseUrl = (): string => {
  if (typeof window !== 'undefined') {
    const override = localStorage.getItem(OVERRIDE_KEY);
    if (override) return override;
  }
  return process.env.NEXT_PUBLIC_API_URL || DEFAULT_API;
};

export const setApiBaseUrlOverride = (url: string | null) => {
  if (typeof window === 'undefined') return;
  if (url) localStorage.setItem(OVERRIDE_KEY, url.replace(/\/+$/, ''));
  else localStorage.removeItem(OVERRIDE_KEY);
};

export const apiClient = axios.create({
  baseURL: getApiBaseUrl(),
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
  timeout: 60000, // free-tier servers can take ~50 s to wake up
});

apiClient.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    config.baseURL = getApiBaseUrl();
    const token = localStorage.getItem('labe_token');
    if (token && !config.headers.Authorization) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

/** Extracts a human-readable message from an API error. */
export const apiErrorMessage = (err: any, fallback = 'Something went wrong. Please try again.') => {
  if (err?.code === 'ECONNABORTED') return 'The server took too long to respond. Check your internet and try again.';
  if (err?.message === 'Network Error') return 'Cannot reach the server. Check your internet connection.';
  const details = err?.response?.data?.error?.details;
  if (Array.isArray(details) && details[0]?.message) return details[0].message;
  return err?.response?.data?.error?.message || err?.message || fallback;
};
