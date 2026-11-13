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
  Sliders,
  Shield,
  Edit2,
  Trash2,
  BarChart3,
  Menu,
  Search,
  ExternalLink,
} from 'lucide-react';
import { AddBranchModal } from '@/components/branch/AddBranchModal';
import { EditBranchModal } from '@/components/branch/EditBranchModal';
import { WeeklyScheduleModal } from '@/components/schedule/WeeklyScheduleModal';
import { AddEmployeeModal } from '@/components/employee/AddEmployeeModal';
import { EditEmployeeModal } from '@/components/employee/EditEmployeeModal';
import { EditAttendanceModal } from '@/components/attendance/EditAttendanceModal';
import { ConfirmDeleteModal } from '@/components/common/ConfirmDeleteModal';
import { PolicyModal } from '@/components/policy/PolicyModal';
import { AnalyticsView } from '@/components/analytics/AnalyticsView';

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

  const [activeTab, setActiveTab] = useState<
    'attendance' | 'employees' | 'branches' | 'corrections' | 'analytics' | 'audit' | 'policy'
  >('attendance');

  const [employees, setEmployees] = useState<EmployeeItem[]>([]);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [branches, setBranches] = useState<any[]>([]);
  const [corrections, setCorrections] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [policy, setPolicy] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloadingExcel, setDownloadingExcel] = useState(false);
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [branchSearch, setBranchSearch] = useState('');

  // Modals state
  const [isAddBranchOpen, setIsAddBranchOpen] = useState(false);
  const [isAddEmployeeOpen, setIsAddEmployeeOpen] = useState(false);
  const [isPolicyModalOpen, setIsPolicyModalOpen] = useState(false);
  const [selectedFieldEmployee, setSelectedFieldEmployee] = useState<any | null>(null);

  // Edit & Delete state
  const [editingEmployee, setEditingEmployee] = useState<any | null>(null);
  const [editingBranch, setEditingBranch] = useState<any | null>(null);
  const [editingAttendance, setEditingAttendance] = useState<any | null>(null);
  const [deletingItem, setDeletingItem] = useState<{
    type: 'employee' | 'branch' | 'attendance';
    id: string;
    name: string;
    warning?: string;
  } | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const fetchAdminData = useCallback(async () => {
    try {
      setLoading(true);
      const [empRes, summaryRes, branchRes, corrRes, policyRes, auditRes] = await Promise.all([
        apiClient.get('/employees?limit=50'),
        apiClient.get('/attendance/dashboard'),
        apiClient.get('/branches?limit=100'),
        apiClient.get('/attendance/corrections'),
        apiClient.get('/policies/current').catch(() => ({ data: { data: null } })),
        apiClient.get('/audit-logs?limit=50').catch(() => ({ data: { data: [] } })),
      ]);

      setEmployees(empRes.data.data.items || []);
      setSummary(summaryRes.data.data || null);
      const branchList =
        branchRes.data?.data?.items ||
        branchRes.data?.data?.branches ||
        (Array.isArray(branchRes.data?.data) ? branchRes.data.data : []);
      setBranches(branchList);
      setCorrections(corrRes.data.data || []);
      setPolicy(policyRes.data.data || null);
      setAuditLogs(auditRes.data.data || []);
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

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `LABE_Attendance_Report_${new Date().toISOString().slice(0, 10)}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error('Failed to export Excel report', err);
    } finally {
      setDownloadingExcel(false);
    }
  };

  const handleReviewCorrection = async (id: string, action: 'APPROVED' | 'REJECTED') => {
    try {
      setReviewingId(id);
      await apiClient.patch(`/attendance/corrections/${id}`, {
        status: action,
        reviewNotes: `Admin ${action.toLowerCase()} via quick dashboard action`,
      });
      await fetchAdminData();
    } catch (err) {
      console.error('Failed to review correction', err);
    } finally {
      setReviewingId(null);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingItem) return;
    try {
      setDeleteLoading(true);
      if (deletingItem.type === 'employee') {
        await apiClient.delete(`/employees/${deletingItem.id}`);
      } else if (deletingItem.type === 'branch') {
        await apiClient.delete(`/branches/${deletingItem.id}`);
      } else if (deletingItem.type === 'attendance') {
        await apiClient.delete(`/attendance/records/${deletingItem.id}`);
      }
      setDeletingItem(null);
      await fetchAdminData();
    } catch (err: any) {
      alert(err.response?.data?.error?.message || err.message || 'Deletion failed');
    } finally {
      setDeleteLoading(false);
    }
  };

  if (authLoading || (loading && !summary && employees.length === 0)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F7F6F2]">
        <div className="flex flex-col items-center space-y-3">
          <Loader2 className="w-8 h-8 animate-spin text-[#171717]" />
          <p className="text-xs text-[#737373]">Loading LABE Management Portal...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F7F6F2]">
      {/* Responsive Admin Header */}
      <header className="bg-white border-b border-[#E5E5E5] px-4 sm:px-6 py-3.5 sticky top-0 z-20 shadow-xs">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-[#171717] text-white flex items-center justify-center rounded-lg font-bold text-sm shadow-xs">
              L
            </div>
            <div>
              <div className="font-bold text-sm leading-tight text-[#171717]">
                LABE Management Portal
              </div>
              <div className="text-[11px] text-[#737373] hidden xs:block">
                {user?.role === 'SUPER_ADMIN' ? 'Super Admin' : 'Admin'} • Organization Central Hub
              </div>
            </div>
          </div>

          {/* Desktop action buttons */}
          <div className="hidden md:flex items-center space-x-2.5">
            <button
              onClick={() => fetchAdminData()}
              className="p-2 text-[#737373] hover:text-[#171717] hover:bg-[#F0EFEB] rounded-lg transition-colors"
              title="Refresh Dashboard"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              onClick={handleDownloadExcel}
              disabled={downloadingExcel}
              className="flex items-center space-x-1.5 px-3 py-1.5 bg-[#171717] hover:bg-black text-white rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
            >
              {downloadingExcel ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
              <span>Export Excel (6 Sheets)</span>
            </button>
            <span className="text-xs font-medium text-[#737373] px-2 py-1 bg-[#F7F6F2] rounded border border-[#E5E5E5]">
              {user?.email}
            </span>
            <button
              onClick={() => logout()}
              className="flex items-center space-x-1.5 px-3 py-1.5 border border-[#E5E5E5] hover:bg-[#F0EFEB] rounded-lg text-xs font-medium text-[#171717] transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          </div>

          {/* Mobile hamburger menu toggle */}
          <div className="flex items-center space-x-2 md:hidden">
            <button
              onClick={() => fetchAdminData()}
              className="p-1.5 text-[#737373] hover:text-[#171717] rounded-lg"
              title="Refresh"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 text-[#171717] hover:bg-[#F0EFEB] rounded-lg"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile dropdown menu */}
        {mobileMenuOpen && (
          <div className="md:hidden pt-3 mt-3 border-t border-[#E5E5E5] space-y-2 animate-in slide-in-from-top-2 duration-150">
            <div className="text-xs text-[#737373] px-2 py-1">
              Signed in as: <strong className="text-[#171717]">{user?.email}</strong>
            </div>
            <button
              onClick={() => {
                handleDownloadExcel();
                setMobileMenuOpen(false);
              }}
              disabled={downloadingExcel}
              className="w-full flex items-center justify-center space-x-2 py-2 px-3 bg-[#171717] text-white rounded-lg text-xs font-medium"
            >
              {downloadingExcel ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
              <span>Export Excel (6 Sheets)</span>
            </button>
            <button
              onClick={() => logout()}
              className="w-full flex items-center justify-center space-x-2 py-2 px-3 border border-[#E5E5E5] hover:bg-[#F0EFEB] rounded-lg text-xs font-medium text-red-600"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        )}
      </header>

      {/* Main Admin Content */}
      <main className="max-w-7xl mx-auto p-4 sm:p-6 space-y-6">
        {/* Metric Cards Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
          <div className="bg-white border border-[#E5E5E5] rounded-xl p-4 shadow-xs">
            <div className="flex items-center space-x-2 text-xs text-[#737373] mb-1">
              <Users className="w-3.5 h-3.5" />
              <span>Total Active Staff</span>
            </div>
            <div className="text-2xl font-bold text-[#171717]">
              {summary ? summary.totalActiveEmployees : employees.length}
            </div>
            <div className="text-[11px] text-[#737373] mt-1">Across Andhra Pradesh Branches</div>
          </div>

          <div className="bg-white border border-[#E5E5E5] rounded-xl p-4 shadow-xs">
            <div className="flex items-center space-x-2 text-xs text-[#737373] mb-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>Present Today</span>
            </div>
            <div className="text-2xl font-bold text-emerald-700">
              {summary ? summary.presentCount : '0'}
            </div>
            <div className="text-[11px] text-[#737373] mt-1">
              {summary ? `${summary.checkedOutCount} checked out` : 'Waiting for check-ins'}
            </div>
          </div>

          <div className="bg-white border border-[#E5E5E5] rounded-xl p-4 shadow-xs">
            <div className="flex items-center space-x-2 text-xs text-[#737373] mb-1">
              <Clock className="w-3.5 h-3.5 text-amber-600" />
              <span>Pending Check-Out</span>
            </div>
            <div className="text-2xl font-bold text-amber-700">
              {summary ? summary.checkedInOnlyCount : '0'}
            </div>
            <div className="text-[11px] text-[#737373] mt-1">Evening: 16:30 – 17:00 IST</div>
          </div>

          <div className="bg-white border border-[#E5E5E5] rounded-xl p-4 shadow-xs">
            <div className="flex items-center space-x-2 text-xs text-[#737373] mb-1">
              <AlertTriangle className="w-3.5 h-3.5 text-red-600" />
              <span>Absent Today</span>
            </div>
            <div className="text-2xl font-bold text-red-700">
              {summary ? summary.absentCount : '0'}
            </div>
            <div className="text-[11px] text-[#737373] mt-1">Post 09:20 IST window</div>
          </div>
        </div>

        {/* Tab Navigation - Responsive Horizontal Scroll */}
        <div className="border-b border-[#E5E5E5] pb-2 overflow-x-auto">
          <div className="flex items-center space-x-2 text-xs font-semibold min-w-max">
            <button
              onClick={() => setActiveTab('attendance')}
              className={`px-3 py-2 rounded-lg transition-all ${
                activeTab === 'attendance'
                  ? 'bg-[#171717] text-white shadow-xs'
                  : 'text-[#737373] hover:text-[#171717] hover:bg-white'
              }`}
            >
              Live Attendance ({summary?.recordsSummary?.length || 0})
            </button>
            <button
              onClick={() => setActiveTab('analytics')}
              className={`px-3 py-2 rounded-lg transition-all flex items-center space-x-1.5 ${
                activeTab === 'analytics'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-[#737373] hover:text-blue-600 hover:bg-white'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>Analytics & Intelligence</span>
            </button>
            <button
              onClick={() => setActiveTab('employees')}
              className={`px-3 py-2 rounded-lg transition-all ${
                activeTab === 'employees'
                  ? 'bg-[#171717] text-white shadow-xs'
                  : 'text-[#737373] hover:text-[#171717] hover:bg-white'
              }`}
            >
              Employee Directory ({employees.length})
            </button>
            <button
              onClick={() => setActiveTab('branches')}
              className={`px-3 py-2 rounded-lg transition-all ${
                activeTab === 'branches'
                  ? 'bg-[#171717] text-white shadow-xs'
                  : 'text-[#737373] hover:text-[#171717] hover:bg-white'
              }`}
            >
              Branches & Geofences ({branches.length})
            </button>
            <button
              onClick={() => setActiveTab('corrections')}
              className={`px-3 py-2 rounded-lg transition-all ${
                activeTab === 'corrections'
                  ? 'bg-[#171717] text-white shadow-xs'
                  : 'text-[#737373] hover:text-[#171717] hover:bg-white'
              }`}
            >
              Correction Requests ({corrections.filter((c) => c.status === 'PENDING').length} Pending)
            </button>
            <button
              onClick={() => setActiveTab('policy')}
              className={`px-3 py-2 rounded-lg transition-all ${
                activeTab === 'policy'
                  ? 'bg-[#171717] text-white shadow-xs'
                  : 'text-[#737373] hover:text-[#171717] hover:bg-white'
              }`}
            >
              Policy Settings
            </button>
            {user?.role === 'SUPER_ADMIN' && (
              <button
                onClick={() => setActiveTab('audit')}
                className={`px-3 py-2 rounded-lg transition-all ${
                  activeTab === 'audit'
                    ? 'bg-[#171717] text-white shadow-xs'
                    : 'text-[#737373] hover:text-[#171717] hover:bg-white'
                }`}
              >
                Audit Trail ({auditLogs.length})
              </button>
            )}
          </div>
        </div>

        {/* Tab: Analytics Intelligence */}
        {activeTab === 'analytics' && <AnalyticsView />}

        {/* Tab 1: Live Attendance */}
        {activeTab === 'attendance' && (
          <div className="bg-white border border-[#E5E5E5] rounded-xl overflow-hidden shadow-xs">
            <div className="px-5 py-4 border-b border-[#E5E5E5]">
              <h3 className="font-semibold text-sm text-[#171717]">Today&apos;s Attendance Stream</h3>
              <p className="text-xs text-[#737373]">Live GPS geofence verifications and check-out work reports</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs min-w-[700px]">
                <thead className="bg-[#F7F6F2] border-b border-[#E5E5E5] text-[#737373] uppercase tracking-wider">
                  <tr>
                    <th className="px-5 py-3 font-semibold">Staff Code</th>
                    <th className="px-5 py-3 font-semibold">Employee</th>
                    <th className="px-5 py-3 font-semibold">Duty Location</th>
                    <th className="px-5 py-3 font-semibold">Check-In</th>
                    <th className="px-5 py-3 font-semibold">Check-Out</th>
                    <th className="px-5 py-3 font-semibold">Status</th>
                    <th className="px-5 py-3 font-semibold">Work Report</th>
                    <th className="px-5 py-3 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E5E5E5]">
                  {!summary || summary.recordsSummary?.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-5 py-8 text-center text-[#737373]">
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
                                : rec.status === 'CORRECTED'
                                ? 'bg-blue-50 text-blue-800 border border-blue-200'
                                : 'bg-amber-50 text-amber-800 border border-amber-200'
                            }`}
                          >
                            {rec.status}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-[#737373] max-w-xs truncate italic">
                          {rec.workReport || 'Pending Check-Out'}
                        </td>
                        <td className="px-5 py-3.5 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end space-x-1.5">
                            <button
                              onClick={() => setEditingAttendance(rec)}
                              className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                              title="Edit Record"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() =>
                                setDeletingItem({
                                  type: 'attendance',
                                  id: rec.id,
                                  name: `Attendance record of ${rec.employee?.fullName}`,
                                  warning: 'This will delete this check-in/out record from the database.',
                                })
                              }
                              className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                              title="Delete Record"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
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
          <div className="bg-white border border-[#E5E5E5] rounded-xl overflow-hidden shadow-xs">
            <div className="px-5 py-4 border-b border-[#E5E5E5] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="font-semibold text-sm text-[#171717]">Employee Directory</h3>
                <p className="text-xs text-[#737373]">
                  Office Staff & Field Staff registered across LABE Andhra Pradesh branches
                </p>
              </div>
              <button
                onClick={() => setIsAddEmployeeOpen(true)}
                className="inline-flex items-center space-x-1 px-3 py-1.5 bg-[#171717] hover:bg-black text-white rounded-lg text-xs font-medium transition-colors self-start sm:self-auto"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Employee</span>
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs min-w-[700px]">
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
                        <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-medium ${
                          emp.status === 'ACTIVE'
                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                            : 'bg-red-50 text-red-800 border border-red-200'
                        }`}>
                          {emp.status}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end space-x-1.5">
                          {emp.employeeType === 'FIELD_STAFF' && (
                            <button
                              onClick={() => setSelectedFieldEmployee(emp)}
                              className="inline-flex items-center space-x-1 px-2 py-1 text-[11px] font-medium bg-[#F0EFEB] hover:bg-[#E5E5E5] text-[#171717] rounded transition-colors mr-1"
                              title="7-Day Schedule"
                            >
                              <Calendar className="w-3 h-3" />
                              <span className="hidden sm:inline">Schedule</span>
                            </button>
                          )}
                          <button
                            onClick={() => setEditingEmployee(emp)}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                            title="Edit Employee"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() =>
                              setDeletingItem({
                                type: 'employee',
                                id: emp.id,
                                name: `${emp.fullName} (${emp.employeeCode})`,
                                warning: 'This will permanently remove this employee and their login user account from the entire database.',
                              })
                            }
                            className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                            title="Delete Employee"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
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
            <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-white p-4 rounded-xl border border-[#E5E5E5] gap-3">
              <div>
                <h3 className="font-semibold text-sm text-[#171717] flex items-center space-x-2">
                  <span>Pharmacy Branch Network</span>
                  <span className="px-2 py-0.5 bg-neutral-100 text-[#171717] rounded-full text-[11px] font-bold">
                    {branches.length} Active {branches.length === 1 ? 'Branch' : 'Branches'}
                  </span>
                </h3>
                <p className="text-xs text-[#737373]">
                  GPS geofencing centers and active boundaries across Andhra Pradesh
                </p>
              </div>
              <div className="flex items-center space-x-2 w-full sm:w-auto">
                <div className="relative flex-1 sm:w-64">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#737373]" />
                  <input
                    type="text"
                    value={branchSearch}
                    onChange={(e) => setBranchSearch(e.target.value)}
                    placeholder="Search branch, district, code..."
                    className="w-full pl-8 pr-3 py-1.5 text-xs border border-[#E5E5E5] rounded-lg focus:outline-none focus:ring-1 focus:ring-black bg-[#FBFBFA]"
                  />
                  {branchSearch && (
                    <button
                      onClick={() => setBranchSearch('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-[#737373] hover:text-[#171717]"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
                <button
                  onClick={() => setIsAddBranchOpen(true)}
                  className="inline-flex items-center space-x-1 px-3 py-1.5 bg-[#171717] hover:bg-black text-white rounded-lg text-xs font-medium transition-colors shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Branch</span>
                </button>
              </div>
            </div>

            {branches.length === 0 ? (
              <div className="bg-white border border-dashed border-[#CCCCCC] rounded-xl p-8 text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-neutral-100 flex items-center justify-center mx-auto text-[#737373]">
                  <Building2 className="w-6 h-6" />
                </div>
                <div className="text-sm font-semibold text-[#171717]">No Pharmacy Branches Found</div>
                <p className="text-xs text-[#737373] max-w-sm mx-auto">
                  Create your first pharmacy branch location with a GPS geofence anchor point to start tracking attendance.
                </p>
                <button
                  onClick={() => setIsAddBranchOpen(true)}
                  className="inline-flex items-center space-x-1.5 px-4 py-2 bg-[#171717] hover:bg-black text-white rounded-lg text-xs font-medium transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add First Branch</span>
                </button>
              </div>
            ) : (
              (() => {
                const filtered = branches.filter((b) => {
                  if (!branchSearch.trim()) return true;
                  const q = branchSearch.toLowerCase();
                  return (
                    b.name?.toLowerCase().includes(q) ||
                    b.branchCode?.toLowerCase().includes(q) ||
                    b.district?.toLowerCase().includes(q) ||
                    b.address?.toLowerCase().includes(q)
                  );
                });

                if (filtered.length === 0) {
                  return (
                    <div className="bg-white border border-[#E5E5E5] rounded-xl p-8 text-center space-y-2">
                      <p className="text-xs text-[#737373]">No branches found matching &quot;{branchSearch}&quot;.</p>
                      <button
                        onClick={() => setBranchSearch('')}
                        className="text-xs text-blue-600 hover:underline font-medium"
                      >
                        Clear search filter
                      </button>
                    </div>
                  );
                }

                return (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filtered.map((b) => (
                      <div
                        key={b.id}
                        className="bg-white border border-[#E5E5E5] rounded-xl p-5 space-y-3 shadow-xs hover:border-[#CCCCCC] transition-all flex flex-col justify-between"
                      >
                        <div className="space-y-3">
                          <div className="flex items-start justify-between border-b border-[#E5E5E5] pb-2.5">
                            <div>
                              <div className="font-bold text-sm text-[#171717]">{b.name}</div>
                              <div className="flex items-center space-x-2 mt-0.5">
                                <span className="text-[11px] font-mono text-[#737373] bg-neutral-100 px-1.5 py-0.5 rounded">
                                  {b.branchCode}
                                </span>
                                {b.isActive !== false ? (
                                  <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.2 rounded">
                                    Active
                                  </span>
                                ) : (
                                  <span className="text-[10px] font-semibold text-neutral-500 bg-neutral-100 px-1.5 py-0.2 rounded">
                                    Inactive
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center space-x-1 shrink-0">
                              <button
                                onClick={() => setEditingBranch(b)}
                                className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                title="Edit Branch"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() =>
                                  setDeletingItem({
                                    type: 'branch',
                                    id: b.id,
                                    name: `${b.name} (${b.branchCode})`,
                                    warning:
                                      'This will permanently remove this branch and all current staff assignments tied to it.',
                                  })
                                }
                                className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                                title="Delete Branch"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          <div className="text-xs text-[#737373] space-y-1">
                            <div>
                              Address: <strong className="text-[#171717]">{b.address}</strong>
                            </div>
                            <div>
                              District: <strong className="text-[#171717]">{b.district}, {b.state || 'Andhra Pradesh'}</strong>
                            </div>
                            {b.manager && (
                              <div>
                                Manager: <strong className="text-[#171717]">{b.manager.fullName}</strong>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="space-y-2 pt-2">
                          <div className="p-2.5 bg-[#F9F9F8] border border-[#E5E5E5] rounded-lg text-xs space-y-1.5">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-1.5 font-medium text-[#171717]">
                                <MapPin className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                                <span>{Number(b.latitude).toFixed(4)}°, {Number(b.longitude).toFixed(4)}°</span>
                              </div>
                              <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 px-1.5 py-0.5 rounded">
                                {b.geofenceRadiusMetres}m radius
                              </span>
                            </div>
                            <div className="flex items-center justify-between text-[11px] text-[#737373] pt-1 border-t border-[#EAE9E4]">
                              <span>
                                {b.activeEmployeeCount !== undefined
                                  ? `${b.activeEmployeeCount} Staff Assigned`
                                  : 'Staff assigned'}
                              </span>
                              <a
                                href={`https://www.google.com/maps/search/?api=1&query=${b.latitude},${b.longitude}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:underline flex items-center space-x-0.5 font-medium"
                              >
                                <span>Google Maps</span>
                                <ExternalLink className="w-2.5 h-2.5" />
                              </a>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()
            )}
          </div>
        )}

        {/* Tab 4: Correction Requests */}
        {activeTab === 'corrections' && (
          <div className="bg-white border border-[#E5E5E5] rounded-xl overflow-hidden shadow-xs">
            <div className="px-5 py-4 border-b border-[#E5E5E5]">
              <h3 className="font-semibold text-sm text-[#171717]">Attendance Correction Requests</h3>
              <p className="text-xs text-[#737373]">Employee-submitted adjustment requests requiring administrative review</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs min-w-[700px]">
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
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          {corr.status === 'PENDING' ? (
                            <div className="flex items-center justify-end space-x-1.5">
                              <button
                                onClick={() => handleReviewCorrection(corr.id, 'APPROVED')}
                                disabled={reviewingId === corr.id}
                                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[11px] font-medium flex items-center space-x-1 transition-colors disabled:opacity-50"
                              >
                                {reviewingId === corr.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                                <span>Approve</span>
                              </button>
                              <button
                                onClick={() => handleReviewCorrection(corr.id, 'REJECTED')}
                                disabled={reviewingId === corr.id}
                                className="px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-[11px] font-medium flex items-center space-x-1 transition-colors disabled:opacity-50"
                              >
                                {reviewingId === corr.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <X className="w-3 h-3" />}
                                <span>Reject</span>
                              </button>
                            </div>
                          ) : (
                            <span className="text-[11px] text-[#737373] italic">Reviewed</span>
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

        {/* Tab 5: Policy Settings */}
        {activeTab === 'policy' && (
          <div className="bg-white border border-[#E5E5E5] rounded-xl p-6 space-y-6 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-[#E5E5E5] gap-3">
              <div>
                <h3 className="font-bold text-sm text-[#171717] flex items-center space-x-2">
                  <Shield className="w-4 h-4 text-emerald-600" />
                  <span>Company Attendance Policy (v{policy?.version || 1})</span>
                </h3>
                <p className="text-xs text-[#737373]">
                  Authoritative morning/evening windows, geofencing limits, and work report boundaries
                </p>
              </div>
              {user?.role === 'SUPER_ADMIN' && (
                <button
                  onClick={() => setIsPolicyModalOpen(true)}
                  className="flex items-center space-x-1.5 px-3 py-1.5 bg-[#171717] hover:bg-black text-white rounded-lg text-xs font-medium transition-colors self-start sm:self-auto"
                >
                  <Sliders className="w-3.5 h-3.5" />
                  <span>Configure New Policy</span>
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 bg-[#F9F9F8] border border-[#E5E5E5] rounded-lg">
                <div className="text-xs text-[#737373] mb-1">Morning Window</div>
                <div className="text-lg font-bold text-[#171717]">
                  {policy?.morningStart || '09:00'} – {policy?.morningEnd || '09:20'}
                </div>
                <div className="text-[11px] text-[#737373] mt-1">IST (Check-In)</div>
              </div>

              <div className="p-4 bg-[#F9F9F8] border border-[#E5E5E5] rounded-lg">
                <div className="text-xs text-[#737373] mb-1">Evening Window</div>
                <div className="text-lg font-bold text-[#171717]">
                  {policy?.eveningStart || '16:30'} – {policy?.eveningEnd || '17:00'}
                </div>
                <div className="text-[11px] text-[#737373] mt-1">IST (Check-Out)</div>
              </div>

              <div className="p-4 bg-[#F9F9F8] border border-[#E5E5E5] rounded-lg">
                <div className="text-xs text-[#737373] mb-1">Default Geofence Radius</div>
                <div className="text-lg font-bold text-blue-700">
                  {policy?.defaultGeofenceRadiusMetres || 100} metres
                </div>
                <div className="text-[11px] text-[#737373] mt-1">Per-branch override enabled</div>
              </div>

              <div className="p-4 bg-[#F9F9F8] border border-[#E5E5E5] rounded-lg">
                <div className="text-xs text-[#737373] mb-1">GPS Accuracy Max Threshold</div>
                <div className="text-lg font-bold text-amber-700">
                  {policy?.gpsAccuracyRejectMetres || 200} metres
                </div>
                <div className="text-[11px] text-[#737373] mt-1">Rejects inaccurate spoofing</div>
              </div>
            </div>

            {policy?.notes && (
              <div className="p-3 bg-[#F0EFEB] rounded-lg text-xs text-[#171717]">
                <strong>Policy Notes:</strong> {policy.notes}
              </div>
            )}
          </div>
        )}

        {/* Tab 6: Audit Trail */}
        {activeTab === 'audit' && (
          <div className="bg-white border border-[#E5E5E5] rounded-xl overflow-hidden shadow-xs">
            <div className="px-5 py-4 border-b border-[#E5E5E5]">
              <h3 className="font-semibold text-sm text-[#171717]">System Audit Log Trail</h3>
              <p className="text-xs text-[#737373]">Immutable record of authentication, geofence, and administration actions</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs min-w-[700px]">
                <thead className="bg-[#F7F6F2] border-b border-[#E5E5E5] text-[#737373] uppercase tracking-wider">
                  <tr>
                    <th className="px-5 py-3 font-semibold">Timestamp</th>
                    <th className="px-5 py-3 font-semibold">Actor</th>
                    <th className="px-5 py-3 font-semibold">Action</th>
                    <th className="px-5 py-3 font-semibold">Entity</th>
                    <th className="px-5 py-3 font-semibold">IP Address</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E5E5E5]">
                  {auditLogs.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-5 py-8 text-center text-[#737373]">
                        No audit logs recorded yet.
                      </td>
                    </tr>
                  ) : (
                    auditLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-[#F9F9F8]">
                        <td className="px-5 py-3 text-[#737373]">
                          {new Date(log.createdAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
                        </td>
                        <td className="px-5 py-3 font-medium text-[#171717]">
                          {log.actor?.email || 'System'}
                          <span className="text-[10px] text-[#737373] block">{log.actorRole}</span>
                        </td>
                        <td className="px-5 py-3">
                          <span className="font-mono text-blue-700 bg-blue-50 px-2 py-0.5 rounded text-[11px]">
                            {log.action}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-[#737373]">{log.entityType}</td>
                        <td className="px-5 py-3 text-[#737373] font-mono">{log.ipAddress || '—'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Reusable Modals */}
        <AddBranchModal
          isOpen={isAddBranchOpen}
          onClose={() => setIsAddBranchOpen(false)}
          onSuccess={fetchAdminData}
        />

        <EditBranchModal
          isOpen={!!editingBranch}
          branch={editingBranch}
          onClose={() => setEditingBranch(null)}
          onSuccess={fetchAdminData}
        />

        <AddEmployeeModal
          isOpen={isAddEmployeeOpen}
          branches={branches}
          onClose={() => setIsAddEmployeeOpen(false)}
          onSuccess={fetchAdminData}
        />

        <EditEmployeeModal
          isOpen={!!editingEmployee}
          employee={editingEmployee}
          branches={branches}
          onClose={() => setEditingEmployee(null)}
          onSuccess={fetchAdminData}
        />

        <EditAttendanceModal
          isOpen={!!editingAttendance}
          record={editingAttendance}
          onClose={() => setEditingAttendance(null)}
          onSuccess={fetchAdminData}
        />

        <ConfirmDeleteModal
          isOpen={!!deletingItem}
          title={`Delete ${deletingItem?.type || 'Record'}`}
          itemName={deletingItem?.name || ''}
          warningText={deletingItem?.warning}
          loading={deleteLoading}
          onConfirm={handleConfirmDelete}
          onClose={() => setDeletingItem(null)}
        />

        <PolicyModal
          isOpen={isPolicyModalOpen}
          currentPolicy={policy}
          onClose={() => setIsPolicyModalOpen(false)}
          onSuccess={fetchAdminData}
        />

        {selectedFieldEmployee && (
          <WeeklyScheduleModal
            isOpen={!!selectedFieldEmployee}
            employee={selectedFieldEmployee}
            onClose={() => setSelectedFieldEmployee(null)}
            onSuccess={fetchAdminData}
          />
        )}
      </main>
    </div>
  );
}
