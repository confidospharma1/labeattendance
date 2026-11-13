'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/providers/AuthProvider';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api';
import { LogOut, Building2, Calendar, ShieldCheck, RefreshCw } from 'lucide-react';
import { formatISTDate } from '@/lib/utils';
import { CheckInCard } from '@/components/attendance/CheckInCard';
import { CheckOutCard } from '@/components/attendance/CheckOutCard';
import { AttendanceHistory } from '@/components/attendance/AttendanceHistory';

export default function EmployeeDashboard() {
  const { user, logout, loading: authLoading } = useAuth();
  const router = useRouter();

  const [todayStatus, setTodayStatus] = useState<any>(null);
  const [historyRecords, setHistoryRecords] = useState<any[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  const fetchAttendanceData = useCallback(async () => {
    try {
      setLoadingData(true);
      const [todayRes, historyRes] = await Promise.all([
        apiClient.get('/attendance/today'),
        apiClient.get('/attendance/my-history?limit=10'),
      ]);

      setTodayStatus(todayRes.data.data);
      setHistoryRecords(historyRes.data.data || []);
    } catch (err) {
      console.error('Failed to load attendance details', err);
    } finally {
      setLoadingData(false);
    }
  }, []);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
      return;
    }

    if (user) {
      fetchAttendanceData();
    }
  }, [user, authLoading, router, fetchAttendanceData]);

  if (authLoading || (!user && loadingData)) {
    return (
      <div className="min-h-screen bg-[#F7F6F2] flex items-center justify-center">
        <div className="text-sm text-[#737373]">Loading dashboard...</div>
      </div>
    );
  }

  if (!user) return null;

  const emp = user.employee;

  return (
    <div className="min-h-screen bg-[#F7F6F2]">
      {/* Top Header */}
      <header className="bg-white border-b border-[#E5E5E5] px-4 py-3.5 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 bg-[#171717] text-white flex items-center justify-center rounded font-bold text-sm">
              L
            </div>
            <div>
              <div className="font-semibold text-sm leading-tight text-[#171717]">
                LABE Attendance
              </div>
              <div className="text-xs text-[#737373]">
                {emp?.employeeCode || user.role} • {emp?.employeeType || user.role}
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={() => fetchAttendanceData()}
              className="p-1.5 text-[#737373] hover:text-[#171717] hover:bg-[#F0EFEB] rounded transition-colors"
              title="Refresh Attendance Status"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <span className="text-xs font-medium text-[#171717] hidden sm:inline">
              {emp?.fullName || user.email}
            </span>
            <button
              onClick={() => logout()}
              className="p-1.5 text-[#737373] hover:text-[#171717] hover:bg-[#F0EFEB] rounded transition-colors"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-4xl mx-auto p-4 sm:p-6 space-y-5">
        {/* Profile Card */}
        <div className="bg-white border border-[#E5E5E5] rounded-lg p-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-[#E5E5E5]">
            <div>
              <h2 className="text-lg font-bold text-[#171717]">{emp?.fullName || 'Employee'}</h2>
              <p className="text-xs text-[#737373]">
                ID: <span className="font-mono text-[#171717]">{emp?.employeeCode}</span> • Mobile: {emp?.mobile}
              </p>
            </div>
            <div className="inline-flex items-center space-x-1 px-2.5 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded text-xs font-medium self-start sm:self-auto">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Status: {emp?.status || 'ACTIVE'}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-4 text-xs">
            <div className="flex items-center space-x-2 text-[#737373]">
              <Building2 className="w-4 h-4 flex-shrink-0" />
              <span>
                {emp?.employeeType === 'FIELD_STAFF' ? 'Assigned Field Territory:' : 'Assigned Branch:'}{' '}
                <strong className="text-[#171717]">
                  {emp?.employeeType === 'FIELD_STAFF'
                    ? (todayStatus?.enforcement?.refName ? `${todayStatus.enforcement.refName} (Google Maps Boundary)` : 'Dynamic Field Route')
                    : (emp?.assignedBranch ? emp.assignedBranch.name : todayStatus?.enforcement?.refName || 'Pharmacy Branch')}
                </strong>
              </span>
            </div>
            <div className="flex items-center space-x-2 text-[#737373]">
              <Calendar className="w-4 h-4 flex-shrink-0" />
              <span>
                Today:{' '}
                <strong className="text-[#171717]">{formatISTDate(new Date())}</strong>
              </span>
            </div>
          </div>
        </div>

        {/* Attendance Action Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <CheckInCard todayStatus={todayStatus} onRefresh={fetchAttendanceData} />
          <CheckOutCard todayStatus={todayStatus} onRefresh={fetchAttendanceData} />
        </div>

        {/* History Table */}
        <AttendanceHistory records={historyRecords} onRefresh={fetchAttendanceData} />
      </main>
    </div>
  );
}
