'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/providers/AuthProvider';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api';
import {
  Users,
  Building2,
  CheckCircle2,
  Clock,
  AlertTriangle,
  LogOut,
  Download,
  RefreshCw,
  MapPin,
  FileCheck2,
  Check,
  X,
  Loader2,
  Plus,
  Calendar,
} from 'lucide-react';
import { AddBranchModal } from '@/components/branch/AddBranchModal';
import { WeeklyScheduleModal } from '@/components/schedule/WeeklyScheduleModal';
import { AddEmployeeModal } from '@/components/employee/AddEmployeeModal';

interface EmployeeItem {
  id: string;
  employeeCode: string;
  fullName: string;
  email: string;
  mobile: string;
  employeeType: string;
  status: string;
  assignedBranch: { id: string; name: string; branchCode: string } | null;
  createdAt: string;
}

interface DashboardSummary {
  workDate: string;
  totalActiveEmployees: number;
  presentCount: number;
  absentCount: number;
  checkedInOnlyCount: number;
  checkedOutCount: number;
  correctedCount: number;
  recordsSummary: any[];
}

export default function AdminDashboard() {
  const { user, logout, loading: authLoading } = useAuth();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<'attendance' | 'employees' | 'branches' | 'corrections'>('attendance');
  const [employees, setEmployees] = useState<EmployeeItem[]>([]);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [branches, setBranches] = useState<any[]>([]);
  const [corrections, setCorrections] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloadingExcel, setDownloadingExcel] = useState(false);
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [isAddBranchOpen, setIsAddBranchOpen] = useState(false);
  const [isAddEmployeeOpen, setIsAddEmployeeOpen] = useState(false);
  const [selectedFieldEmployee, setSelectedFieldEmployee] = useState<any | null>(null);

  const fetchAdminData = useCallback(async () => {
    try {
      setLoading(true);
      const [empRes, summaryRes, branchRes, corrRes] = await Promise.all([
        apiClient.get('/employees?limit=50'),
        apiClient.get('/attendance/dashboard'),
        apiClient.get('/branches'),
        apiClient.get('/attendance/corrections'),
      ]);

      setEmployees(empRes.data.data.items || []);
      setSummary(summaryRes.data.data || null);
      setBranches(branchRes.data.data.branches || []);
      setCorrections(corrRes.data.data || []);
    } catch (err) {
      console.error('Failed to load admin dashboard data', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
      return;
    }

    if (user && user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') {
      router.push('/employee');
      return;
    }

    if (user) {
      fetchAdminData();
    }
  }, [user, authLoading, router, fetchAdminData]);

  const handleDownloadExcel = async () => {
    try {
      setDownloadingExcel(true);
      const response = await apiClient.get('/reports/attendance/export', {
        responseType: 'blob',
      });

      const blob = new Blob([response.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `LABA_Attendance_Report_${new Date().toISOString().slice(0, 10)}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
    } catch (err) {
      alert('Failed to download Excel report. Ensure backend is running.');
    } finally {
      setDownloadingExcel(false);
    }
  };

  const handleReviewCorrection = async (id: string, status: 'APPROVED' | 'REJECTED') => {
    const adminReason = prompt(`Enter admin remarks for ${status.toLowerCase()}ing this request:`, status === 'APPROVED' ? 'Approved after verification' : 'Rejected per policy');
    if (!adminReason) return;

    try {
      setReviewingId(id);
      await apiClient.patch(`/attendance/corrections/${id}`, {
        status,
        adminReason,
      });
      fetchAdminData();
    } catch (err: any) {
      alert(err?.response?.data?.error?.message || 'Failed to update correction');
    } finally {
      setReviewingId(null);
    }
  };

  if (authLoading || (!user && loading)) {
    return (
      <div className="min-h-screen bg-[#F7F6F2] flex items-center justify-center">
        <div className="text-sm text-[#737373]">Loading Administrative Portal...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F7F6F2]">
      {/* Admin Header */}
      <header className="bg-white border-b border-[#E5E5E5] px-6 py-4 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-[#171717] text-white flex items-center justify-center rounded font-bold text-sm">
              L
            </div>
            <div>
              <div className="font-semibold text-sm leading-tight text-[#171717]">
                LABA Management Portal
              </div>
              <div className="text-xs text-[#737373]">
                {user?.role === 'SUPER_ADMIN' ? 'Super Admin' : 'Admin'} • Organization Central Hub
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={() => fetchAdminData()}
              className="p-1.5 text-[#737373] hover:text-[#171717] hover:bg-[#F0EFEB] rounded transition-colors"
              title="Refresh"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              onClick={handleDownloadExcel}
              disabled={downloadingExcel}
              className="flex items-center space-x-1.5 px-3 py-1.5 bg-[#171717] hover:bg-black text-white rounded text-xs font-medium transition-colors disabled:opacity-50"
            >
              {downloadingExcel ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
              <span>Export Excel (6 Sheets)</span>
            </button>
            <span className="text-xs font-medium text-[#171717] hidden sm:inline">
              {user?.email}
            </span>
            <button
              onClick={() => logout()}
              className="flex items-center space-x-1.5 px-3 py-1.5 border border-[#E5E5E5] hover:bg-[#F0EFEB] rounded text-xs font-medium text-[#171717] transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Admin Content */}
      <main className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Metric Cards Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white border border-[#E5E5E5] rounded-lg p-4">
            <div className="flex items-center space-x-2 text-xs text-[#737373] mb-1">
              <Users className="w-3.5 h-3.5" />
              <span>Total Active Staff</span>
            </div>
            <div className="text-2xl font-bold text-[#171717]">
              {summary ? summary.totalActiveEmployees : employees.length}
            </div>
            <div className="text-xs text-[#737373] mt-1">Across Andhra Pradesh Branches</div>
          </div>

          <div className="bg-white border border-[#E5E5E5] rounded-lg p-4">
            <div className="flex items-center space-x-2 text-xs text-[#737373] mb-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>Present Today</span>
            </div>
            <div className="text-2xl font-bold text-emerald-700">
              {summary ? summary.presentCount : '0'}
            </div>
            <div className="text-xs text-[#737373] mt-1">
              {summary ? `${summary.checkedOutCount} checked out` : 'Waiting for check-ins'}
            </div>
          </div>

          <div className="bg-white border border-[#E5E5E5] rounded-lg p-4">
            <div className="flex items-center space-x-2 text-xs text-[#737373] mb-1">
              <Clock className="w-3.5 h-3.5 text-amber-600" />
              <span>Pending Check-Out</span>
            </div>
            <div className="text-2xl font-bold text-amber-700">
              {summary ? summary.checkedInOnlyCount : '0'}
            </div>
            <div className="text-xs text-[#737373] mt-1">Evening window: 16:30 – 17:00 IST</div>
          </div>

          <div className="bg-white border border-[#E5E5E5] rounded-lg p-4">
            <div className="flex items-center space-x-2 text-xs text-[#737373] mb-1">
              <AlertTriangle className="w-3.5 h-3.5 text-red-600" />
              <span>Absent Today</span>
            </div>
            <div className="text-2xl font-bold text-red-700">
              {summary ? summary.absentCount : '0'}
            </div>
            <div className="text-xs text-[#737373] mt-1">Evaluated post 09:20 IST window</div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center space-x-2 border-b border-[#E5E5E5] pb-2 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('attendance')}
            className={`px-3 py-1.5 rounded transition-colors ${
              activeTab === 'attendance' ? 'bg-[#171717] text-white' : 'text-[#737373] hover:text-[#171717]'
            }`}
          >
            Live Attendance ({summary?.recordsSummary.length || 0})
          </button>
          <button
            onClick={() => setActiveTab('employees')}
            className={`px-3 py-1.5 rounded transition-colors ${
              activeTab === 'employees' ? 'bg-[#171717] text-white' : 'text-[#737373] hover:text-[#171717]'
            }`}
          >
            Employee Directory ({employees.length})
          </button>
          <button
            onClick={() => setActiveTab('branches')}
            className={`px-3 py-1.5 rounded transition-colors ${
              activeTab === 'branches' ? 'bg-[#171717] text-white' : 'text-[#737373] hover:text-[#171717]'
            }`}
          >
            Branches & Geofences ({branches.length})
          </button>
          <button
            onClick={() => setActiveTab('corrections')}
            className={`px-3 py-1.5 rounded transition-colors ${
              activeTab === 'corrections' ? 'bg-[#171717] text-white' : 'text-[#737373] hover:text-[#171717]'
            }`}
          >
            Correction Requests ({corrections.filter((c) => c.status === 'PENDING').length} Pending)
          </button>
        </div>

        {/* Tab 1: Live Attendance */}
        {activeTab === 'attendance' && (
          <div className="bg-white border border-[#E5E5E5] rounded-lg overflow-hidden">
            <div className="px-5 py-4 border-b border-[#E5E5E5]">
              <h3 className="font-semibold text-sm text-[#171717]">Today&apos;s Attendance Stream</h3>
              <p className="text-xs text-[#737373]">Live GPS geofence verifications and check-out work reports</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#F7F6F2] border-b border-[#E5E5E5] text-[#737373] uppercase tracking-wider">
                  <tr>
                    <th className="px-5 py-3 font-semibold">Staff Code</th>
                    <th className="px-5 py-3 font-semibold">Employee</th>
                    <th className="px-5 py-3 font-semibold">Duty Location</th>
                    <th className="px-5 py-3 font-semibold">Check-In</th>
                    <th className="px-5 py-3 font-semibold">Check-Out</th>
                    <th className="px-5 py-3 font-semibold">Status</th>
                    <th className="px-5 py-3 font-semibold">Work Report</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E5E5E5]">
                  {!summary || summary.recordsSummary.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-5 py-8 text-center text-[#737373]">
                        No check-in activity recorded yet for today.
                      </td>
                    </tr>
                  ) : (
                    summary.recordsSummary.map((rec) => (
                      <tr key={rec.id} className="hover:bg-[#F9F9F8]">
                        <td className="px-5 py-3.5 font-mono font-medium text-[#171717]">
                          {rec.employee.employeeCode}
                        </td>
                        <td className="px-5 py-3.5 font-medium text-[#171717]">
                          {rec.employee.fullName}
                          <div className="text-[11px] text-[#737373]">{rec.employee.employeeType}</div>
                        </td>
                        <td className="px-5 py-3.5 text-[#171717]">
                          {rec.checkInLocationName || 'Branch'}
                          {rec.checkInDistanceMetres !== null && (
                            <span className="text-[11px] text-[#737373] block">
                              Offset: {Number(rec.checkInDistanceMetres)}m
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-[#171717]">
                          {rec.checkInAt
                            ? new Date(rec.checkInAt).toLocaleTimeString('en-IN', {
                                hour: '2-digit',
                                minute: '2-digit',
                                timeZone: 'Asia/Kolkata',
                              })
                            : '—'}
                        </td>
                        <td className="px-5 py-3.5 text-[#171717]">
                          {rec.checkOutAt
                            ? new Date(rec.checkOutAt).toLocaleTimeString('en-IN', {
                                hour: '2-digit',
                                minute: '2-digit',
                                timeZone: 'Asia/Kolkata',
                              })
                            : 'Pending'}
                        </td>
                        <td className="px-5 py-3.5">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-[11px] font-medium ${
                              rec.status === 'CHECKED_OUT'
                                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                : 'bg-amber-50 text-amber-800 border border-amber-200'
                            }`}
                          >
                            {rec.status}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-[#737373] max-w-xs truncate italic">
                          {rec.workReport || 'Pending Check-Out'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 2: Employee Directory */}
        {activeTab === 'employees' && (
          <div className="bg-white border border-[#E5E5E5] rounded-lg overflow-hidden">
            <div className="px-5 py-4 border-b border-[#E5E5E5] flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-sm text-[#171717]">Employee Directory</h3>
                <p className="text-xs text-[#737373]">
                  Office Staff & Field Staff registered across LABA Andhra Pradesh branches
                </p>
              </div>
              <button
                onClick={() => setIsAddEmployeeOpen(true)}
                className="flex items-center space-x-1 px-3 py-1.5 bg-[#171717] hover:bg-black text-white rounded text-xs font-medium transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Employee</span>
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#F7F6F2] border-b border-[#E5E5E5] text-[#737373] uppercase tracking-wider">
                  <tr>
                    <th className="px-5 py-3 font-semibold">Code</th>
                    <th className="px-5 py-3 font-semibold">Full Name</th>
                    <th className="px-5 py-3 font-semibold">Category</th>
                    <th className="px-5 py-3 font-semibold">Assigned Branch</th>
                    <th className="px-5 py-3 font-semibold">Mobile</th>
                    <th className="px-5 py-3 font-semibold">Status</th>
                    <th className="px-5 py-3 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E5E5E5]">
                  {employees.map((emp) => (
                    <tr key={emp.id} className="hover:bg-[#F0EFEB]/50">
                      <td className="px-5 py-3.5 font-mono font-medium text-[#171717]">{emp.employeeCode}</td>
                      <td className="px-5 py-3.5 font-medium text-[#171717]">
                        {emp.fullName}
                        <div className="text-[11px] text-[#737373]">{emp.email}</div>
                      </td>
                      <td className="px-5 py-3.5">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[11px] font-medium ${
                            emp.employeeType === 'OFFICE_STAFF'
                              ? 'bg-blue-50 text-blue-800 border border-blue-200'
                              : 'bg-purple-50 text-purple-800 border border-purple-200'
                          }`}
                        >
                          {emp.employeeType}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-[#171717]">
                        {emp.assignedBranch ? (
                          <div className="flex items-center space-x-1">
                            <Building2 className="w-3.5 h-3.5 text-[#737373]" />
                            <span>{emp.assignedBranch.name}</span>
                          </div>
                        ) : (
                          <span className="text-[#737373] italic">Dynamic Schedule</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-[#737373] font-mono">{emp.mobile}</td>
                      <td className="px-5 py-3.5">
                        <span className="inline-block px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-50 text-emerald-800 border border-emerald-200">
                          {emp.status}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        {emp.employeeType === 'FIELD_STAFF' ? (
                          <button
                            onClick={() => setSelectedFieldEmployee(emp)}
                            className="inline-flex items-center space-x-1 px-2.5 py-1 text-[11px] font-medium bg-[#171717] hover:bg-black text-white rounded transition-colors"
                          >
                            <Calendar className="w-3 h-3" />
                            <span>7-Day Schedule</span>
                          </button>
                        ) : (
                          <span className="text-[11px] text-[#737373]">Fixed Branch</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 3: Branches & Geofences */}
        {activeTab === 'branches' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between bg-white p-4 rounded-lg border border-[#E5E5E5]">
              <div>
                <h3 className="font-semibold text-sm text-[#171717]">Pharmacy Branch Network</h3>
                <p className="text-xs text-[#737373]">
                  GPS geofencing centers and active boundaries across Andhra Pradesh
                </p>
              </div>
              <button
                onClick={() => setIsAddBranchOpen(true)}
                className="flex items-center space-x-1 px-3 py-1.5 bg-[#171717] hover:bg-black text-white rounded text-xs font-medium transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Branch</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {branches.map((b) => (
                <div key={b.id} className="bg-white border border-[#E5E5E5] rounded-lg p-5 space-y-3">
                  <div className="flex items-center justify-between border-b border-[#E5E5E5] pb-2">
                    <div className="font-bold text-sm text-[#171717]">{b.name}</div>
                    <span className="text-xs font-mono text-[#737373]">{b.branchCode}</span>
                  </div>
                  <div className="text-xs text-[#737373] space-y-1">
                    <div>Address: <strong className="text-[#171717]">{b.address}</strong></div>
                    <div>District: <strong className="text-[#171717]">{b.district}, {b.state}</strong></div>
                  </div>
                  <div className="p-2.5 bg-[#F9F9F8] border border-[#E5E5E5] rounded text-xs space-y-1">
                    <div className="flex items-center space-x-1.5 font-medium text-[#171717]">
                      <MapPin className="w-3.5 h-3.5 text-blue-600" />
                      <span>Coordinates: {Number(b.latitude).toFixed(4)}°, {Number(b.longitude).toFixed(4)}°</span>
                    </div>
                    <div className="text-[#737373] pl-5">
                      Geofence Radius: <strong className="text-emerald-700">{b.geofenceRadiusMetres} metres</strong>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab 4: Correction Requests */}
        {activeTab === 'corrections' && (
          <div className="bg-white border border-[#E5E5E5] rounded-lg overflow-hidden">
            <div className="px-5 py-4 border-b border-[#E5E5E5]">
              <h3 className="font-semibold text-sm text-[#171717]">Attendance Correction Requests</h3>
              <p className="text-xs text-[#737373]">Employee-submitted adjustment requests requiring administrative review</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#F7F6F2] border-b border-[#E5E5E5] text-[#737373] uppercase tracking-wider">
                  <tr>
                    <th className="px-5 py-3 font-semibold">Employee</th>
                    <th className="px-5 py-3 font-semibold">Type</th>
                    <th className="px-5 py-3 font-semibold">Reason</th>
                    <th className="px-5 py-3 font-semibold">Status</th>
                    <th className="px-5 py-3 font-semibold">Requested At</th>
                    <th className="px-5 py-3 font-semibold text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E5E5E5]">
                  {corrections.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-5 py-8 text-center text-[#737373]">
                        No attendance correction requests recorded.
                      </td>
                    </tr>
                  ) : (
                    corrections.map((corr) => (
                      <tr key={corr.id} className="hover:bg-[#F9F9F8]">
                        <td className="px-5 py-3.5 font-medium text-[#171717]">
                          {corr.employee.fullName}
                          <div className="text-[11px] text-[#737373] font-mono">{corr.employee.employeeCode}</div>
                        </td>
                        <td className="px-5 py-3.5 text-[#171717]">{corr.correctionType}</td>
                        <td className="px-5 py-3.5 text-[#737373] max-w-sm">{corr.employeeReason}</td>
                        <td className="px-5 py-3.5">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-[11px] font-medium ${
                              corr.status === 'APPROVED'
                                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                : corr.status === 'REJECTED'
                                ? 'bg-red-50 text-red-800 border border-red-200'
                                : 'bg-amber-50 text-amber-800 border border-amber-200'
                            }`}
                          >
                            {corr.status}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-[#737373]">
                          {new Date(corr.requestedAt).toLocaleDateString('en-IN', {
                            timeZone: 'Asia/Kolkata',
                          })}
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          {corr.status === 'PENDING' ? (
                            <div className="flex items-center justify-end space-x-1.5">
                              <button
                                onClick={() => handleReviewCorrection(corr.id, 'APPROVED')}
                                disabled={reviewingId === corr.id}
                                className="p-1 text-emerald-700 hover:bg-emerald-50 border border-emerald-200 rounded"
                                title="Approve"
                              >
                                <Check className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleReviewCorrection(corr.id, 'REJECTED')}
                                disabled={reviewingId === corr.id}
                                className="p-1 text-red-700 hover:bg-red-50 border border-red-200 rounded"
                                title="Reject"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <span className="text-[11px] text-[#737373]">{corr.adminReason || 'Reviewed'}</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Modals */}
        <AddBranchModal
          isOpen={isAddBranchOpen}
          onClose={() => setIsAddBranchOpen(false)}
          onSuccess={fetchAdminData}
        />

        <WeeklyScheduleModal
          isOpen={Boolean(selectedFieldEmployee)}
          employee={selectedFieldEmployee}
          onClose={() => setSelectedFieldEmployee(null)}
          onSuccess={fetchAdminData}
        />

        <AddEmployeeModal
          isOpen={isAddEmployeeOpen}
          branches={branches}
          onClose={() => setIsAddEmployeeOpen(false)}
          onSuccess={fetchAdminData}
        />
      </main>
    </div>
  );
}
