'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api';
import {
  TrendingUp,
  MapPin,
  FileText,
  Clock,
  Building2,
  RefreshCw,
  Loader2,
  CheckCircle,
} from 'lucide-react';

interface TrendDay {
  date: string;
  dayOfWeek: string;
  totalPresent: number;
  officePresent: number;
  fieldPresent: number;
  absentCount: number;
  reportCount: number;
  geofenceValidCount: number;
  rate: number;
}

interface BranchMetric {
  id: string;
  name: string;
  branchCode: string;
  district: string;
  totalStaff: number;
  presentToday: number;
  attendanceRate: number;
  geofenceComplianceRate: number;
  radiusMetres: number;
}

interface AnalyticsData {
  timeframeDays: number;
  totalActiveEmployees: number;
  kpis: {
    overallAttendanceRate: number;
    workReportCompletionRate: number;
    geofenceComplianceRate: number;
    totalAttendanceEntries: number;
  };
  trends: TrendDay[];
  branchPerformance: BranchMetric[];
}

export const AnalyticsView: React.FC = () => {
  const [days, setDays] = useState<number>(7);
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalytics = useCallback(async (timeframe: number) => {
    try {
      setLoading(true);
      setError(null);
      const res = await apiClient.get(`/attendance/analytics?days=${timeframe}`);
      setData(res.data.data);
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || err.message || 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAnalytics(days);
  }, [days, fetchAnalytics]);

  const maxDailyPresent = data?.trends
    ? Math.max(...data.trends.map((t) => t.totalPresent), data.totalActiveEmployees || 1)
    : 10;

  return (
    <div className="space-y-6">
      {/* Analytics Header Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 border border-[#E5E5E5] rounded-xl shadow-sm">
        <div>
          <h2 className="text-base font-bold text-[#171717] flex items-center space-x-2">
            <TrendingUp className="w-5 h-5 text-blue-600" />
            <span>Attendance & Geofence Intelligence</span>
          </h2>
          <p className="text-xs text-[#737373]">
            Cross-branch compliance, workforce presence, and location verification trends
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <div className="inline-flex rounded-lg border border-[#E5E5E5] p-0.5 bg-[#F7F6F2]">
            {[7, 14, 30].map((d) => (
              <button
                key={d}
                onClick={() => setDays(d)}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                  days === d
                    ? 'bg-white text-[#171717] shadow-sm font-semibold'
                    : 'text-[#737373] hover:text-[#171717]'
                }`}
              >
                {d} Days
              </button>
            ))}
          </div>

          <button
            onClick={() => fetchAnalytics(days)}
            disabled={loading}
            className="p-1.5 border border-[#E5E5E5] hover:bg-[#F9F9F8] rounded-lg text-[#737373] hover:text-[#171717] transition-colors"
            title="Refresh analytics"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {loading && !data ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white border border-[#E5E5E5] rounded-xl">
          <Loader2 className="w-8 h-8 animate-spin text-[#171717] mb-3" />
          <p className="text-xs text-[#737373]">Aggregating attendance telemetry across branches...</p>
        </div>
      ) : error ? (
        <div className="p-6 bg-red-50 border border-red-200 rounded-xl text-center">
          <p className="text-sm font-semibold text-red-800">{error}</p>
          <button
            onClick={() => fetchAnalytics(days)}
            className="mt-3 px-4 py-1.5 bg-red-600 text-white rounded-lg text-xs font-medium"
          >
            Retry Analytics
          </button>
        </div>
      ) : data ? (
        <>
          {/* Top 4 KPI Metrics */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <div className="bg-white border border-[#E5E5E5] rounded-xl p-4 shadow-sm hover:border-[#CCCCCC] transition-all">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-[#737373]">Overall Attendance</span>
                <span className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <CheckCircle className="w-4 h-4" />
                </span>
              </div>
              <div className="text-2xl font-bold text-[#171717]">
                {data.kpis.overallAttendanceRate}%
              </div>
              <div className="mt-2 w-full bg-[#F0EFEB] rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-emerald-600 h-1.5 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, data.kpis.overallAttendanceRate)}%` }}
                />
              </div>
              <p className="text-[11px] text-[#737373] mt-2">
                Active average over last {days} days
              </p>
            </div>

            <div className="bg-white border border-[#E5E5E5] rounded-xl p-4 shadow-sm hover:border-[#CCCCCC] transition-all">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-[#737373]">Geofence Integrity</span>
                <span className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                  <MapPin className="w-4 h-4" />
                </span>
              </div>
              <div className="text-2xl font-bold text-blue-700">
                {data.kpis.geofenceComplianceRate}%
              </div>
              <div className="mt-2 w-full bg-[#F0EFEB] rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-blue-600 h-1.5 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, data.kpis.geofenceComplianceRate)}%` }}
                />
              </div>
              <p className="text-[11px] text-[#737373] mt-2">
                Check-ins strictly inside radius
              </p>
            </div>

            <div className="bg-white border border-[#E5E5E5] rounded-xl p-4 shadow-sm hover:border-[#CCCCCC] transition-all">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-[#737373]">Work Reports Completed</span>
                <span className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
                  <FileText className="w-4 h-4" />
                </span>
              </div>
              <div className="text-2xl font-bold text-purple-700">
                {data.kpis.workReportCompletionRate}%
              </div>
              <div className="mt-2 w-full bg-[#F0EFEB] rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-purple-600 h-1.5 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, data.kpis.workReportCompletionRate)}%` }}
                />
              </div>
              <p className="text-[11px] text-[#737373] mt-2">
                Mandatory check-out report compliance
              </p>
            </div>

            <div className="bg-white border border-[#E5E5E5] rounded-xl p-4 shadow-sm hover:border-[#CCCCCC] transition-all">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-[#737373]">Total Verified Records</span>
                <span className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                  <Clock className="w-4 h-4" />
                </span>
              </div>
              <div className="text-2xl font-bold text-amber-700">
                {data.kpis.totalAttendanceEntries}
              </div>
              <p className="text-[11px] text-[#737373] mt-2">
                {data.totalActiveEmployees} active employees enrolled
              </p>
            </div>
          </div>

          {/* Visual Trend Chart */}
          <div className="bg-white border border-[#E5E5E5] rounded-xl p-5 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 pb-4 border-b border-[#E5E5E5]">
              <div>
                <h3 className="text-sm font-bold text-[#171717]">Attendance Trajectory & Distribution</h3>
                <p className="text-xs text-[#737373]">
                  Daily breakdown between Office Staff and Traveling Field Staff
                </p>
              </div>

              <div className="flex items-center space-x-4 text-xs text-[#737373] mt-2 sm:mt-0">
                <div className="flex items-center space-x-1.5">
                  <div className="w-3 h-3 rounded-sm bg-[#171717]" />
                  <span>Office Staff</span>
                </div>
                <div className="flex items-center space-x-1.5">
                  <div className="w-3 h-3 rounded-sm bg-blue-600" />
                  <span>Field Staff</span>
                </div>
                <div className="flex items-center space-x-1.5">
                  <div className="w-3 h-3 rounded-sm bg-gray-200" />
                  <span>Absent</span>
                </div>
              </div>
            </div>

            {/* Interactive Responsive Bar Chart */}
            <div className="overflow-x-auto pb-2">
              <div className="min-w-[500px] h-60 flex items-end justify-between gap-2 sm:gap-4 px-2">
                {data.trends.map((t) => {
                  const officeHeight = maxDailyPresent > 0 ? (t.officePresent / maxDailyPresent) * 160 : 0;
                  const fieldHeight = maxDailyPresent > 0 ? (t.fieldPresent / maxDailyPresent) * 160 : 0;
                  const absentHeight = maxDailyPresent > 0 ? (t.absentCount / maxDailyPresent) * 160 : 0;

                  return (
                    <div
                      key={t.date}
                      className="flex-1 flex flex-col items-center group relative h-full justify-end cursor-pointer"
                    >
                      {/* Tooltip on hover */}
                      <div className="absolute -top-16 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20 bg-[#171717] text-white text-[11px] py-1 px-2.5 rounded shadow-lg whitespace-nowrap">
                        <div className="font-bold">{t.dayOfWeek}, {t.date}</div>
                        <div>Present: {t.totalPresent} ({t.rate}%)</div>
                        <div className="text-gray-300">Office: {t.officePresent} • Field: {t.fieldPresent}</div>
                      </div>

                      {/* Stacked bar */}
                      <div className="w-full max-w-[42px] flex flex-col justify-end rounded-t overflow-hidden transition-all group-hover:brightness-110">
                        {absentHeight > 0 && (
                          <div
                            style={{ height: `${Math.max(4, absentHeight)}px` }}
                            className="bg-gray-200 w-full transition-all"
                            title={`Absent: ${t.absentCount}`}
                          />
                        )}
                        {fieldHeight > 0 && (
                          <div
                            style={{ height: `${Math.max(4, fieldHeight)}px` }}
                            className="bg-blue-600 w-full transition-all"
                            title={`Field Staff: ${t.fieldPresent}`}
                          />
                        )}
                        {officeHeight > 0 && (
                          <div
                            style={{ height: `${Math.max(4, officeHeight)}px` }}
                            className="bg-[#171717] w-full transition-all"
                            title={`Office Staff: ${t.officePresent}`}
                          />
                        )}
                      </div>

                      {/* Date label */}
                      <div className="mt-3 text-center">
                        <div className="text-[11px] font-bold text-[#171717]">{t.dayOfWeek}</div>
                        <div className="text-[10px] text-[#737373]">{t.date.slice(5)}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Branch-by-Branch Comparison Table */}
          <div className="bg-white border border-[#E5E5E5] rounded-xl overflow-hidden shadow-sm">
            <div className="px-5 py-4 border-b border-[#E5E5E5] flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm text-[#171717] flex items-center space-x-2">
                  <Building2 className="w-4 h-4 text-[#737373]" />
                  <span>Branch Performance Matrix</span>
                </h3>
                <p className="text-xs text-[#737373]">
                  Location geofence radius compliance and active staffing per store
                </p>
              </div>
              <span className="text-xs font-semibold px-2.5 py-1 bg-[#F7F6F2] rounded-full text-[#171717]">
                {data.branchPerformance.length} Branches
              </span>
            </div>

            {/* Mobile Branch Cards (< 640px) */}
            <div className="block sm:hidden divide-y divide-[#E5E5E5] p-3 space-y-3">
              {data.branchPerformance.map((b) => (
                <div
                  key={b.id}
                  className="bg-[#FBFBFA] border border-[#E5E5E5] rounded-xl p-3.5 space-y-2.5 shadow-2xs"
                >
                  <div className="flex items-start justify-between border-b border-[#EAE9E4] pb-2">
                    <div>
                      <div className="font-bold text-xs text-[#171717]">{b.name}</div>
                      <div className="text-[11px] text-[#737373] font-mono">
                        {b.branchCode} • {b.district}
                      </div>
                    </div>
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold ${
                        b.geofenceComplianceRate >= 90
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}
                    >
                      {b.geofenceComplianceRate}% GPS Match
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px] bg-white p-2 rounded-lg border border-[#EAE9E4]">
                    <div>
                      <span className="text-[#737373] block text-[10px] uppercase">Assigned Staff</span>
                      <strong className="text-[#171717]">{b.totalStaff} Members</strong>
                    </div>
                    <div>
                      <span className="text-[#737373] block text-[10px] uppercase">Present Today</span>
                      <strong className="text-emerald-700">{b.presentToday} Present</strong>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-[11px] mb-1">
                      <span className="text-[#737373]">Attendance Rate</span>
                      <strong className="text-[#171717]">{b.attendanceRate}%</strong>
                    </div>
                    <div className="w-full bg-[#EAE9E4] rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-emerald-600 h-2 rounded-full transition-all"
                        style={{ width: `${Math.min(100, b.attendanceRate)}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop Table View (>= 640px) */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#F7F6F2] text-[#737373] uppercase tracking-wider font-semibold border-b border-[#E5E5E5]">
                  <tr>
                    <th className="px-5 py-3">Pharmacy Branch</th>
                    <th className="px-5 py-3">District</th>
                    <th className="px-5 py-3 text-center">Assigned Staff</th>
                    <th className="px-5 py-3 text-center">Today Present</th>
                    <th className="px-5 py-3">Attendance Rate</th>
                    <th className="px-5 py-3 text-center">Geofence Compliance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E5E5E5]">
                  {data.branchPerformance.map((b) => (
                    <tr key={b.id} className="hover:bg-[#F9F9F8] transition-colors">
                      <td className="px-5 py-3">
                        <div className="font-semibold text-[#171717]">{b.name}</div>
                        <div className="text-[11px] text-[#737373] font-mono">{b.branchCode}</div>
                      </td>
                      <td className="px-5 py-3 text-[#737373]">{b.district}</td>
                      <td className="px-5 py-3 text-center font-bold text-[#171717]">{b.totalStaff}</td>
                      <td className="px-5 py-3 text-center font-bold text-emerald-700">{b.presentToday}</td>
                      <td className="px-5 py-3">
                        <div className="flex items-center space-x-2">
                          <div className="w-24 bg-gray-100 rounded-full h-2 overflow-hidden">
                            <div
                              className="bg-emerald-600 h-2 rounded-full"
                              style={{ width: `${Math.min(100, b.attendanceRate)}%` }}
                            />
                          </div>
                          <span className="font-bold text-[#171717]">{b.attendanceRate}%</span>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-center">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold ${
                            b.geofenceComplianceRate >= 90
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}
                        >
                          {b.geofenceComplianceRate}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
};

