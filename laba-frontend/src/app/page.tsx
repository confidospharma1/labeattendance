'use client';

import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api';
import { Activity, Database } from 'lucide-react';

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

  useEffect(() => {
    apiClient
      .get('/health')
      .then((res) => {
        setHealth(res.data.data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || 'Failed to connect to backend API');
        setLoading(false);
      });
  }, []);

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
          <h2 className="text-sm font-semibold uppercase tracking-wider text-[#737373]">
            System Status & Connectivity
          </h2>

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
                  <span className="text-emerald-700">Healthy (v{health?.version})</span>
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
                ) : error ? (
                  <span className="text-red-600">Offline</span>
                ) : (
                  <span className="text-emerald-700">{health?.database}</span>
                )}
              </div>
            </div>
          </div>

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

