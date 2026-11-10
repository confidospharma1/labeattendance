'use client';

import { useEffect, useState, useCallback } from 'react';
import { apiClient } from '@/lib/api';
import { Activity, Database, RefreshCw } from 'lucide-react';

interface HealthData {
  status: string;
  service: string;
  version: string;
  database: string;
  uptime: number;
  timestamp: string;
  timezone: string;
}

export default function Home() {
  const [health, setHealth] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  const checkHealth = useCallback(async (isManual = false) => {
    if (isManual) {
      setLoading(true);
      setError(null);
    }
    try {
      const res = await apiClient.get('/health');
      if (res.data?.data) {
        setHealth(res.data.data);
        setError(null);
      } else {
        throw new Error('Unexpected health check response');
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to connect to backend API');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkHealth();
  }, [checkHealth]);

  // Automatic retry for Render spin-up latency (tries up to 5 times every 3.5s if initially disconnected)
  useEffect(() => {
    if (error && retryCount < 5) {
      const timer = setTimeout(() => {
        setRetryCount((prev) => prev + 1);
        checkHealth();
      }, 3500);
      return () => clearTimeout(timer);
    }
  }, [error, retryCount, checkHealth]);

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6 bg-[#F7F6F2]">
      <div className="w-full max-w-xl bg-white border border-[#E5E5E5] rounded-lg p-8 shadow-sm">
        <div className="flex items-center space-x-3 mb-6 border-b border-[#E5E5E5] pb-4">
          <div className="w-10 h-10 bg-[#171717] text-white flex items-center justify-center rounded font-bold text-lg">
            L
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-[#171717]">
              LABA Attendance Management System
            </h1>
            <p className="text-sm text-[#737373]">
              Multi-Branch GPS Geofencing Attendance Platform
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-[#737373]">
              System Status & Connectivity
            </h2>
            <button
              onClick={() => {
                setRetryCount(0);
                checkHealth(true);
              }}
              disabled={loading}
              className="text-xs text-[#737373] hover:text-[#171717] flex items-center space-x-1 disabled:opacity-50"
              title="Refresh connectivity status"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>{loading ? 'Checking...' : 'Refresh'}</span>
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="border border-[#E5E5E5] rounded p-3 bg-[#F7F6F2]">
              <div className="flex items-center space-x-2 text-xs text-[#737373] mb-1">
                <Activity className="w-3.5 h-3.5" />
                <span>Backend API</span>
              </div>
              <div className="font-medium text-sm">
                {loading ? (
                  <span className="text-amber-600">Connecting...</span>
                ) : error ? (
                  <span className="text-red-600">Disconnected</span>
                ) : (
                  <span className="text-emerald-700 flex items-center space-x-1.5 font-semibold">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    <span>Connected</span>
                  </span>
                )}
              </div>
            </div>

            <div className="border border-[#E5E5E5] rounded p-3 bg-[#F7F6F2]">
              <div className="flex items-center space-x-2 text-xs text-[#737373] mb-1">
                <Database className="w-3.5 h-3.5" />
                <span>Neon PostgreSQL</span>
              </div>
              <div className="font-medium text-sm">
                {loading ? (
                  <span className="text-amber-600">Checking...</span>
                ) : error || health?.database !== 'connected' ? (
                  <span className="text-red-600">Offline</span>
                ) : (
                  <span className="text-emerald-700 flex items-center space-x-1.5 font-semibold">
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    <span>Online</span>
                  </span>
                )}
              </div>
            </div>
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded text-xs text-red-800 flex items-center justify-between">
              <span>{error} {retryCount < 5 ? `(Auto-retrying ${retryCount + 1}/5...)` : ''}</span>
              <button
                onClick={() => {
                  setRetryCount(0);
                  checkHealth(true);
                }}
                className="underline font-semibold ml-2"
              >
                Retry
              </button>
            </div>
          )}

          <div className="border border-[#E5E5E5] rounded p-4 text-xs text-[#737373] space-y-2">
            <div className="flex justify-between">
              <span>Timezone Standard:</span>
              <span className="font-mono text-[#171717]">Asia/Kolkata (IST)</span>
            </div>
            <div className="flex justify-between">
              <span>Active Pharmacy Branches:</span>
              <span className="font-mono text-[#171717]">5–6 Branches (AP)</span>
            </div>
            <div className="flex justify-between">
              <span>Verification Method:</span>
              <span className="font-mono text-[#171717]">GPS Geofencing (Haversine)</span>
            </div>
          </div>

          <div className="pt-4 flex flex-col space-y-2">
            <a
              href="/login"
              className="w-full text-center py-2.5 px-4 bg-[#171717] hover:bg-[#333333] text-white font-medium rounded text-sm transition-colors"
            >
              Go to Employee & Admin Portal
            </a>
          </div>
        </div>
      </div>
    </main>
  );
}
