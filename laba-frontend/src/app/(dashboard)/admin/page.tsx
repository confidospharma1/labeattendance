'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/providers/AuthProvider';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api';
import {
  Users,
  Building2,
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
  Database,
  Menu,
  Search,
  ExternalLink,
  LayoutDashboard,
  Route,
  Tent,
  Timer,
  Store,
  UserCheck,
  Hourglass,
} from 'lucide-react';
import { AddBranchModal } from '@/components/branch/AddBranchModal';
import { EditBranchModal } from '@/components/branch/EditBranchModal';
import { ApprovalsPanel } from '@/components/admin/ApprovalsPanel';
import { TaskPlanner } from '@/components/admin/TaskPlanner';
import { LateRequestsPanel } from '@/components/admin/LateRequestsPanel';
import { AddEmployeeModal } from '@/components/employee/AddEmployeeModal';
import { EditEmployeeModal } from '@/components/employee/EditEmployeeModal';
import { EditAttendanceModal } from '@/components/attendance/EditAttendanceModal';
import { ConfirmDeleteModal } from '@/components/common/ConfirmDeleteModal';
import { PolicyModal } from '@/components/policy/PolicyModal';
import { Logo } from '@/components/common/Logo';
import { DashboardView, BoardFocus } from '@/components/analytics/DashboardView';
import { WorkReportsExport } from '@/components/admin/WorkReportsExport';
import { DataRetentionPanel, RetentionBanner, RetentionStatus } from '@/components/admin/DataRetentionPanel';
import { saveFile, filenameFrom } from '@/lib/download';
import { AttendanceBoard } from '@/components/admin/AttendanceBoard';
import { ShiftsPanel } from '@/components/admin/ShiftsPanel';
import { CampsPanel } from '@/components/admin/CampsPanel';
import { CustomersView } from '@/components/customers/CustomersView';
import { categoryInfo, fmtDate, locationTypeLabel } from '@/lib/staff';

interface EmployeeItem {
  id: string;
  employeeCode: string;
  fullName: string;
  email: string;
  mobile: string;
  employeeType: string;
  staffCategory?: string | null;
  designation?: string | null;
  dateOfJoining?: string | null;
  shift?: { id: string; name: string; startTime: string; endTime: string } | null;
  status: string;
  assignedBranch: { id: string; name: string; branchCode: string; locationType?: string } | null;
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
    'attendance' | 'employees' | 'branches' | 'corrections' | 'data' | 'policy' | 'approvals' | 'tasks' | 'late' | 'shifts' | 'camps' | 'customers'
  >('attendance');
  const [plannerEmployeeId, setPlannerEmployeeId] = useState<string | undefined>(undefined);
  const [boardRefresh, setBoardRefresh] = useState(0);
  const [boardFocus, setBoardFocus] = useState<BoardFocus | null>(null);
  const [retention, setRetention] = useState<RetentionStatus | null>(null);

  const [employees, setEmployees] = useState<EmployeeItem[]>([]);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [branches, setBranches] = useState<any[]>([]);
  const [corrections, setCorrections] = useState<any[]>([]);
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
      const [empRes, summaryRes, branchRes, corrRes, policyRes, retentionRes] = await Promise.all([
        apiClient.get('/employees?limit=500'),
        apiClient.get('/attendance/dashboard'),
        apiClient.get('/branches?limit=500'),
        apiClient.get('/attendance/corrections'),
        apiClient.get('/policies/current').catch(() => ({ data: { data: null } })),
        apiClient.get('/retention/status').catch(() => ({ data: { data: null } })),
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
      setRetention(retentionRes.data.data || null);
      setBoardRefresh((n) => n + 1);
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

      const name = filenameFrom(response.headers['content-disposition'], `J-Track_Attendance_Report_${new Date().toISOString().slice(0, 10)}.xlsx`);
      await saveFile(new Blob([response.data]), name);
    } catch (err) {
      console.error('Failed to export Excel report', err);
      alert('Could not download the Excel report. Please try again.');
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
      <div className="min-h-screen flex items-center justify-center bg-[#F4F6FB]">
        <div className="flex flex-col items-center gap-4">
          <Logo size={44} subtitle="Admin console" />
          <Loader2 className="w-6 h-6 animate-spin text-brand-600" />
        </div>
      </div>
    );
  }

  const pendingCorrections = corrections.filter((c) => c.status === 'PENDING').length;
  const NAV: { id: typeof activeTab; label: string; icon: any; badge?: number; superOnly?: boolean }[] = [
    { id: 'attendance', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'tasks', label: 'Field routes', icon: Route },
    { id: 'camps', label: 'Camps', icon: Tent },
    { id: 'shifts', label: 'Shifts', icon: Timer },
    { id: 'employees', label: 'Employees', icon: Users },
    { id: 'branches', label: 'Locations', icon: Building2 },
    { id: 'customers', label: 'Customers', icon: Store },
    { id: 'approvals', label: 'Approvals', icon: UserCheck, badge: (summary as any)?.pendingApprovals ?? 0 },
    { id: 'late', label: 'Late requests', icon: Hourglass, badge: (summary as any)?.pendingLateRequests ?? 0 },
    { id: 'corrections', label: 'Corrections', icon: FileCheck2, badge: pendingCorrections },
    { id: 'policy', label: 'Policy', icon: Sliders },
    { id: 'data', label: 'Data & storage', icon: Database, badge: retention?.alert ? 1 : 0 },
  ];

  return (
    <div className="min-h-screen bg-[#F4F6FB]">
      {/* Header */}
      <header className="bg-white/90 backdrop-blur border-b border-[#E2E8F0] px-4 sm:px-6 py-3 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
          <Logo size={36} subtitle={`${user?.role === 'SUPER_ADMIN' ? 'Super admin' : 'Admin'} console`} />

          <div className="hidden md:flex items-center gap-2">
            <button
              onClick={() => fetchAdminData()}
              className="p-2 text-[#64748B] hover:text-brand-700 hover:bg-brand-50 rounded-lg transition-colors"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={handleDownloadExcel}
              disabled={downloadingExcel}
              className="flex items-center gap-1.5 px-3 py-2 bg-brand-700 hover:bg-brand-800 text-white rounded-lg text-xs font-semibold transition-colors disabled:opacity-50"
            >
              {downloadingExcel ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
              Export Excel
            </button>
            <div className="flex items-center gap-2 pl-2 ml-1 border-l border-[#E2E8F0]">
              <span className="w-8 h-8 rounded-full bg-brand-100 text-brand-800 flex items-center justify-center text-xs font-bold uppercase">
                {(user?.email || '?').slice(0, 1)}
              </span>
              <span className="text-xs font-medium text-[#475569] max-w-[14rem] truncate">{user?.email}</span>
              <button onClick={() => logout()} className="p-2 text-[#64748B] hover:text-red-600 hover:bg-red-50 rounded-lg" title="Sign out">
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="flex items-center gap-1 md:hidden">
            <button onClick={() => fetchAdminData()} className="p-2 text-[#64748B] rounded-lg" aria-label="Refresh">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="p-2 text-ink hover:bg-[#EEF2F7] rounded-lg" aria-label="Toggle menu">
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden pt-3 mt-3 border-t border-[#E2E8F0] space-y-2">
            <div className="text-xs text-[#64748B] px-1">
              Signed in as <strong className="text-ink">{user?.email}</strong>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => {
                  handleDownloadExcel();
                  setMobileMenuOpen(false);
                }}
                disabled={downloadingExcel}
                className="flex items-center justify-center gap-2 py-2.5 bg-brand-700 text-white rounded-lg text-xs font-semibold"
              >
                {downloadingExcel ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                Export Excel
              </button>
              <button
                onClick={() => logout()}
                className="flex items-center justify-center gap-2 py-2.5 border border-[#E2E8F0] rounded-lg text-xs font-semibold text-red-600"
              >
                <LogOut className="w-3.5 h-3.5" /> Sign out
              </button>
            </div>
          </div>
        )}
      </header>

      {/* Navigation */}
      <nav className="sticky top-[61px] z-20 bg-[#F4F6FB]/95 backdrop-blur border-b border-[#E2E8F0]">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 overflow-x-auto">
          <div className="flex gap-1 py-2 min-w-max xl:min-w-0 xl:flex-wrap">
            {NAV.filter((n) => !n.superOnly || user?.role === 'SUPER_ADMIN').map(({ id, label, icon: Icon, badge }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`relative flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                  activeTab === id ? 'bg-brand-700 text-white shadow-sm shadow-brand-900/20' : 'text-[#475569] hover:text-brand-700 hover:bg-white'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
                {!!badge && (
                  <span
                    className={`min-w-[18px] h-[18px] px-1 rounded-full text-[10px] leading-[18px] text-center ${
                      activeTab === id ? 'bg-white text-brand-700' : 'bg-amber-500 text-white'
                    }`}
                  >
                    {badge}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* Main Admin Content */}
      <main className="max-w-7xl mx-auto p-3 sm:p-6 space-y-5 sm:space-y-6">
        <RetentionBanner status={retention} onOpen={() => setActiveTab('data')} />

        {activeTab === 'attendance' && (
          <DashboardView
            summary={summary}
            refreshKey={boardRefresh}
            onFocus={(f) => setBoardFocus({ ...f, nonce: Date.now() })}
          />
        )}

        {activeTab === 'tasks' && <TaskPlanner employees={employees} initialEmployeeId={plannerEmployeeId} />}
        {activeTab === 'approvals' && <ApprovalsPanel branches={branches} employees={employees} onChanged={fetchAdminData} />}
        {activeTab === 'late' && <LateRequestsPanel onChanged={fetchAdminData} />}

        {activeTab === 'data' && <DataRetentionPanel isSuperAdmin={user?.role === 'SUPER_ADMIN'} onChanged={setRetention} />}

        {/* Tab 1: All staff attendance (every employee, by category & location) */}
        {activeTab === 'attendance' && (
          <AttendanceBoard
            refreshKey={boardRefresh}
            focus={boardFocus}
            onEditRecord={(rec) => setEditingAttendance(rec)}
            onDeleteRecord={(rec) =>
              setDeletingItem({
                type: 'attendance',
                id: rec.id,
                name: `Attendance record of ${rec.employee?.fullName}`,
                warning: 'This will delete this check-in/out record from the database.',
              })
            }
          />
        )}
        {activeTab === 'attendance' && <WorkReportsExport employees={employees} />}

        {activeTab === 'shifts' && <ShiftsPanel branches={branches} />}
        {activeTab === 'camps' && <CampsPanel employees={employees} branches={branches} />}
        {activeTab === 'customers' && (
          <div className="max-w-3xl">
            <CustomersView admin branches={branches} />
          </div>
        )}

        {/* Tab 2: Employee Directory */}
        {activeTab === 'employees' && (
          <div className="bg-white border border-[#E2E8F0] rounded-xl overflow-hidden shadow-xs">
            <div className="px-5 py-4 border-b border-[#E2E8F0] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="font-semibold text-sm text-ink flex items-center space-x-2">
                  <span>Employee Directory</span>
                  <span className="px-2 py-0.5 bg-slate-100 text-ink rounded-full text-[11px] font-bold">
                    {employees.length} Staff
                  </span>
                </h3>
                <p className="text-xs text-[#64748B]">
                  All staff by category: office, distribution centres, field, pharmacy, laboratory and leadership
                </p>
              </div>
              <button
                onClick={() => setIsAddEmployeeOpen(true)}
                className="inline-flex items-center space-x-1 px-3 py-1.5 bg-brand-700 hover:bg-brand-800 text-white rounded-lg text-xs font-medium transition-colors self-start sm:self-auto"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Employee</span>
              </button>
            </div>

            {employees.length === 0 ? (
              <div className="px-5 py-12 text-center text-xs text-[#64748B]">
                No staff registered yet. Click &quot;Add Employee&quot; to register your first team member.
              </div>
            ) : (
              <>
                {/* Mobile Cards View (< 640px) */}
                <div className="block sm:hidden divide-y divide-[#E2E8F0] p-3 space-y-3">
                  {employees.map((emp) => (
                    <div
                      key={emp.id}
                      className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-3.5 space-y-2.5 shadow-2xs"
                    >
                      <div className="flex items-start justify-between border-b border-[#E8ECF3] pb-2">
                        <div>
                          <div className="font-bold text-xs text-ink">{emp.fullName}</div>
                          <div className="text-[11px] text-[#64748B]">{emp.email}</div>
                          <span className="inline-block mt-1 font-mono text-[10px] text-[#64748B] bg-slate-100 px-1.5 py-0.5 rounded">
                            {emp.employeeCode}
                          </span>
                        </div>
                        <div className="flex flex-col items-end space-y-1">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold ${
                              emp.employeeType === 'FIELD_STAFF'
                                ? 'bg-purple-50 text-purple-800 border border-purple-200'
                                : 'bg-blue-50 text-blue-800 border border-blue-200'
                            }`}
                          >
                            {categoryInfo(emp.staffCategory)?.label ?? emp.employeeType}
                          </span>
                          <span
                            className={`inline-block px-1.5 py-0.2 rounded text-[9px] font-semibold ${
                              emp.status === 'ACTIVE'
                                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                : 'bg-red-50 text-red-800 border border-red-200'
                            }`}
                          >
                            {emp.status}
                          </span>
                        </div>
                      </div>

                      <div className="text-xs text-[#64748B] space-y-1">
                        <div className="flex items-center space-x-1.5">
                          <Building2 className="w-3.5 h-3.5 text-[#64748B] shrink-0" />
                          <span>
                            Branch:{' '}
                            <strong className="text-ink">
                              {emp.assignedBranch ? emp.assignedBranch.name : emp.staffCategory === 'LEADERSHIP' ? 'Office / anywhere' : emp.employeeType === 'FIELD_STAFF' ? 'Field route' : '—'}
                            </strong>
                          </span>
                        </div>
                        <div>
                          Mobile: <strong className="text-ink font-mono">{emp.mobile}</strong>
                        </div>
                        {(emp.designation || emp.dateOfJoining) && (
                          <div>
                            {emp.designation && <strong className="text-ink">{emp.designation}</strong>}
                            {emp.dateOfJoining && <span> · DOJ {fmtDate(emp.dateOfJoining)}</span>}
                          </div>
                        )}
                        {emp.shift && (
                          <div>
                            Shift: <strong className="text-ink">{emp.shift.name} {emp.shift.startTime}–{emp.shift.endTime}</strong>
                          </div>
                        )}
                      </div>

                      <div className="pt-2 flex items-center justify-end space-x-2 border-t border-[#E8ECF3]">
                        {emp.employeeType === 'FIELD_STAFF' && (
                          <button
                            onClick={() => {
                              setPlannerEmployeeId(emp.id);
                              setActiveTab('tasks');
                            }}
                            className="flex items-center space-x-1 px-2.5 py-1 text-xs font-semibold bg-brand-50 hover:bg-brand-100 text-brand-800 border border-brand-200 rounded-lg transition-colors"
                            title="Plan daily tasks"
                          >
                            <Calendar className="w-3 h-3" />
                            <span>Tasks</span>
                          </button>
                        )}
                        <button
                          onClick={() => setEditingEmployee(emp)}
                          className="flex items-center space-x-1 px-2.5 py-1 text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
                        >
                          <Edit2 className="w-3 h-3" />
                          <span>Edit</span>
                        </button>
                        <button
                          onClick={() =>
                            setDeletingItem({
                              type: 'employee',
                              id: emp.id,
                              name: `${emp.fullName} (${emp.employeeCode})`,
                              warning:
                                'This will permanently remove this employee and their login user account from the entire database.',
                            })
                          }
                          className="flex items-center space-x-1 px-2.5 py-1 text-xs font-semibold text-red-700 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>Delete</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Desktop Table View (>= 640px) */}
                <div className="hidden sm:block overflow-x-auto">
                  <table className="w-full text-left text-xs min-w-[700px]">
                    <thead className="bg-[#F4F6FB] border-b border-[#E2E8F0] text-[#64748B] uppercase tracking-wider">
                      <tr>
                        <th className="px-5 py-3 font-semibold">Code</th>
                        <th className="px-5 py-3 font-semibold">Full Name</th>
                        <th className="px-5 py-3 font-semibold">Category</th>
                        <th className="px-5 py-3 font-semibold">Designation / DOJ</th>
                        <th className="px-5 py-3 font-semibold">Location / Shift</th>
                        <th className="px-5 py-3 font-semibold">Mobile</th>
                        <th className="px-5 py-3 font-semibold">Status</th>
                        <th className="px-5 py-3 font-semibold text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E2E8F0]">
                      {employees.map((emp) => (
                        <tr key={emp.id} className="hover:bg-[#EEF2F7]/50">
                          <td className="px-5 py-3.5 font-mono font-medium text-ink">{emp.employeeCode}</td>
                          <td className="px-5 py-3.5 font-medium text-ink">
                            {emp.fullName}
                            <div className="text-[11px] text-[#64748B]">{emp.email}</div>
                          </td>
                          <td className="px-5 py-3.5">
                            <span
                              className={`inline-block px-2 py-0.5 rounded text-[11px] font-medium ${
                                emp.employeeType === 'FIELD_STAFF'
                                  ? 'bg-purple-50 text-purple-800 border border-purple-200'
                                  : emp.employeeType === 'OFFICE_STAFF'
                                  ? 'bg-blue-50 text-blue-800 border border-blue-200'
                                  : 'bg-slate-100 text-neutral-700 border border-neutral-200'
                              }`}
                            >
                              {categoryInfo(emp.staffCategory)?.label ?? emp.employeeType.replace('_', ' ')}
                            </span>
                          </td>
                          <td className="px-5 py-3.5 text-ink">
                            {emp.designation || <span className="text-[#94A3B8]">—</span>}
                            {emp.dateOfJoining && <div className="text-[11px] text-[#64748B]">DOJ {fmtDate(emp.dateOfJoining)}</div>}
                          </td>
                          <td className="px-5 py-3.5 text-ink">
                            {emp.assignedBranch ? (
                              <div className="flex items-center space-x-1">
                                <Building2 className="w-3.5 h-3.5 text-[#64748B]" />
                                <span>{emp.assignedBranch.name}</span>
                              </div>
                            ) : (
                              <span className="text-[#64748B] italic">{emp.staffCategory === 'LEADERSHIP' ? 'Office / anywhere' : emp.employeeType === 'FIELD_STAFF' ? 'Field route' : '—'}</span>
                            )}
                            {emp.shift && (
                              <div className="text-[11px] text-[#64748B]">
                                {emp.shift.name} {emp.shift.startTime}–{emp.shift.endTime}
                              </div>
                            )}
                          </td>
                          <td className="px-5 py-3.5 text-[#64748B] font-mono">{emp.mobile}</td>
                          <td className="px-5 py-3.5">
                            <span
                              className={`inline-block px-2 py-0.5 rounded text-[11px] font-medium ${
                                emp.status === 'ACTIVE'
                                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                  : emp.status === 'PENDING_APPROVAL'
                                  ? 'bg-amber-50 text-amber-800 border border-amber-200'
                                  : 'bg-red-50 text-red-800 border border-red-200'
                              }`}
                            >
                              {emp.status}
                            </span>
                          </td>
                          <td className="px-5 py-3.5 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end space-x-1.5">
                              {emp.employeeType === 'FIELD_STAFF' && (
                                <button
                                  onClick={() => {
                                    setPlannerEmployeeId(emp.id);
                                    setActiveTab('tasks');
                                  }}
                                  className="inline-flex items-center space-x-1 px-2.5 py-1 text-[11px] font-semibold bg-brand-50 hover:bg-brand-100 text-brand-800 border border-brand-200 rounded transition-colors mr-1"
                                  title="Plan daily tasks"
                                >
                                  <Calendar className="w-3 h-3" />
                                  <span>Tasks</span>
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
                                    warning:
                                      'This will permanently remove this employee and their login user account from the entire database.',
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
              </>
            )}
          </div>
        )}

        {/* Tab 3: Branches & Geofences */}
        {activeTab === 'branches' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-white p-4 rounded-xl border border-[#E2E8F0] gap-3">
              <div>
                <h3 className="font-semibold text-sm text-ink flex items-center space-x-2">
                  <span>Work Locations</span>
                  <span className="px-2 py-0.5 bg-slate-100 text-ink rounded-full text-[11px] font-bold">
                    {branches.length} {branches.length === 1 ? 'Location' : 'Locations'}
                  </span>
                </h3>
                <p className="text-xs text-[#64748B]">
                  Head office, regional office, distribution centres, pharmacies and labs, each with a radius or exact-boundary geofence
                </p>
              </div>
              <div className="flex items-center space-x-2 w-full sm:w-auto">
                <div className="relative flex-1 sm:w-64">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#64748B]" />
                  <input
                    type="text"
                    value={branchSearch}
                    onChange={(e) => setBranchSearch(e.target.value)}
                    placeholder="Search branch, district, code..."
                    className="w-full pl-8 pr-3 py-1.5 text-xs border border-[#E2E8F0] rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-500 bg-[#F8FAFC]"
                  />
                  {branchSearch && (
                    <button
                      onClick={() => setBranchSearch('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-[#64748B] hover:text-brand-700"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
                <button
                  onClick={() => setIsAddBranchOpen(true)}
                  className="inline-flex items-center space-x-1 px-3 py-1.5 bg-brand-700 hover:bg-brand-800 text-white rounded-lg text-xs font-medium transition-colors shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Location</span>
                </button>
              </div>
            </div>

            {branches.length === 0 ? (
              <div className="bg-white border border-dashed border-[#CBD5E1] rounded-xl p-8 text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-[#64748B]">
                  <Building2 className="w-6 h-6" />
                </div>
                <div className="text-sm font-semibold text-ink">No Work Locations Yet</div>
                <p className="text-xs text-[#64748B] max-w-sm mx-auto">
                  Create your first pharmacy branch location with a GPS geofence anchor point to start tracking attendance.
                </p>
                <button
                  onClick={() => setIsAddBranchOpen(true)}
                  className="inline-flex items-center space-x-1.5 px-4 py-2 bg-brand-700 hover:bg-brand-800 text-white rounded-lg text-xs font-medium transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add First Location</span>
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
                    <div className="bg-white border border-[#E2E8F0] rounded-xl p-8 text-center space-y-2">
                      <p className="text-xs text-[#64748B]">No branches found matching &quot;{branchSearch}&quot;.</p>
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
                        className="bg-white border border-[#E2E8F0] rounded-xl p-5 space-y-3 shadow-xs hover:border-[#CBD5E1] transition-all flex flex-col justify-between"
                      >
                        <div className="space-y-3">
                          <div className="flex items-start justify-between border-b border-[#E2E8F0] pb-2.5">
                            <div>
                              <div className="font-bold text-sm text-ink">{b.name}</div>
                              <div className="text-[11px] text-[#64748B]">{locationTypeLabel(b.locationType)}</div>
                              <div className="flex items-center space-x-2 mt-0.5">
                                <span className="text-[11px] font-mono text-[#64748B] bg-slate-100 px-1.5 py-0.5 rounded">
                                  {b.branchCode}
                                </span>
                                {b.isActive !== false ? (
                                  <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.2 rounded">
                                    Active
                                  </span>
                                ) : (
                                  <span className="text-[10px] font-semibold text-neutral-500 bg-slate-100 px-1.5 py-0.2 rounded">
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

                          <div className="text-xs text-[#64748B] space-y-1">
                            <div>
                              Address: <strong className="text-ink">{b.address}</strong>
                            </div>
                            <div>
                              District: <strong className="text-ink">{b.district}, {b.state || 'Andhra Pradesh'}</strong>
                            </div>
                            {b.manager && (
                              <div>
                                Manager: <strong className="text-ink">{b.manager.fullName}</strong>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="space-y-2 pt-2">
                          <div className="p-2.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg text-xs space-y-1.5">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-1.5 font-medium text-ink">
                                <MapPin className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                                <span>{Number(b.latitude).toFixed(4)}°, {Number(b.longitude).toFixed(4)}°</span>
                              </div>
                              {b.geofenceShape === 'POLYGON' ? (
                                <span className="text-[11px] font-bold text-red-700 bg-red-50 border border-red-100 px-1.5 py-0.5 rounded truncate max-w-[50%]">
                                  Boundary: {b.boundaryLabel || 'custom'}
                                </span>
                              ) : (
                                <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 px-1.5 py-0.5 rounded">
                                  {b.geofenceRadiusMetres}m radius
                                </span>
                              )}
                            </div>
                            {b.hasTerritory && (
                              <div className="text-[11px] text-violet-700 font-semibold">Sales territory: {b.territoryLabel || 'custom'}</div>
                            )}
                            <div className="flex items-center justify-between text-[11px] text-[#64748B] pt-1 border-t border-[#E8ECF3]">
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
          <div className="bg-white border border-[#E2E8F0] rounded-xl overflow-hidden shadow-xs">
            <div className="px-5 py-4 border-b border-[#E2E8F0] flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-sm text-ink">Attendance Correction Requests</h3>
                <p className="text-xs text-[#64748B]">Employee-submitted adjustment requests requiring administrative review</p>
              </div>
              <span className="text-xs font-bold text-amber-800 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-full">
                {corrections.filter((c) => c.status === 'PENDING').length} Pending
              </span>
            </div>

            {corrections.length === 0 ? (
              <div className="px-5 py-12 text-center text-xs text-[#64748B]">
                No attendance correction requests recorded.
              </div>
            ) : (
              <>
                {/* Mobile Cards View (< 640px) */}
                <div className="block sm:hidden divide-y divide-[#E2E8F0] p-3 space-y-3">
                  {corrections.map((corr) => (
                    <div
                      key={corr.id}
                      className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-3.5 space-y-2.5 shadow-2xs"
                    >
                      <div className="flex items-start justify-between border-b border-[#E8ECF3] pb-2">
                        <div>
                          <div className="font-bold text-xs text-ink">{corr.employee.fullName}</div>
                          <div className="text-[11px] text-[#64748B] font-mono">
                            {corr.employee.employeeCode} • {corr.correctionType}
                          </div>
                        </div>
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold ${
                            corr.status === 'APPROVED'
                              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                              : corr.status === 'REJECTED'
                              ? 'bg-red-50 text-red-800 border border-red-200'
                              : 'bg-amber-50 text-amber-800 border border-amber-200'
                          }`}
                        >
                          {corr.status}
                        </span>
                      </div>

                      <div className="text-xs text-[#64748B] space-y-1.5">
                        <div className="bg-white p-2.5 rounded-lg border border-[#E8ECF3] text-ink">
                          <span className="text-[10px] text-[#64748B] uppercase font-semibold block mb-0.5">
                            Reason for adjustment:
                          </span>
                          {corr.employeeReason}
                        </div>
                        <div className="text-[11px] text-[#64748B]">
                          Requested:{' '}
                          <strong className="text-ink">
                            {new Date(corr.requestedAt).toLocaleDateString('en-IN', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </strong>
                        </div>
                      </div>

                      {corr.status === 'PENDING' && (
                        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[#E8ECF3]">
                          <button
                            onClick={() => handleReviewCorrection(corr.id, 'APPROVED')}
                            disabled={reviewingId === corr.id}
                            className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold flex items-center justify-center space-x-1.5 transition-colors disabled:opacity-50"
                          >
                            {reviewingId === corr.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                            <span>Approve</span>
                          </button>
                          <button
                            onClick={() => handleReviewCorrection(corr.id, 'REJECTED')}
                            disabled={reviewingId === corr.id}
                            className="w-full py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-semibold flex items-center justify-center space-x-1.5 transition-colors disabled:opacity-50"
                          >
                            {reviewingId === corr.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}
                            <span>Reject</span>
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Desktop Table View (>= 640px) */}
                <div className="hidden sm:block overflow-x-auto">
                  <table className="w-full text-left text-xs min-w-[700px]">
                    <thead className="bg-[#F4F6FB] border-b border-[#E2E8F0] text-[#64748B] uppercase tracking-wider">
                      <tr>
                        <th className="px-5 py-3 font-semibold">Employee</th>
                        <th className="px-5 py-3 font-semibold">Type</th>
                        <th className="px-5 py-3 font-semibold">Reason</th>
                        <th className="px-5 py-3 font-semibold">Status</th>
                        <th className="px-5 py-3 font-semibold">Requested At</th>
                        <th className="px-5 py-3 font-semibold text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E2E8F0]">
                      {corrections.map((corr) => (
                        <tr key={corr.id} className="hover:bg-[#F8FAFC]">
                          <td className="px-5 py-3.5 font-medium text-ink">
                            {corr.employee.fullName}
                            <div className="text-[11px] text-[#64748B] font-mono">{corr.employee.employeeCode}</div>
                          </td>
                          <td className="px-5 py-3.5 text-ink">{corr.correctionType}</td>
                          <td className="px-5 py-3.5 text-[#64748B] max-w-sm">{corr.employeeReason}</td>
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
                          <td className="px-5 py-3.5 text-[#64748B]">
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
                              <span className="text-[11px] text-[#64748B] italic">Reviewed</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        )}

        {/* Tab 5: Policy Settings */}
        {activeTab === 'policy' && (
          <div className="bg-white border border-[#E2E8F0] rounded-xl p-6 space-y-6 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-[#E2E8F0] gap-3">
              <div>
                <h3 className="font-bold text-sm text-ink flex items-center space-x-2">
                  <Shield className="w-4 h-4 text-emerald-600" />
                  <span>Company Attendance Policy (v{policy?.version || 1})</span>
                </h3>
                <p className="text-xs text-[#64748B]">
                  Authoritative morning/evening windows, geofencing limits, and work report boundaries
                </p>
              </div>
              {user?.role === 'SUPER_ADMIN' && (
                <button
                  onClick={() => setIsPolicyModalOpen(true)}
                  className="flex items-center space-x-1.5 px-3 py-1.5 bg-brand-700 hover:bg-brand-800 text-white rounded-lg text-xs font-medium transition-colors self-start sm:self-auto"
                >
                  <Sliders className="w-3.5 h-3.5" />
                  <span>Configure New Policy</span>
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg">
                <div className="text-xs text-[#64748B] mb-1">Morning Window</div>
                <div className="text-lg font-bold text-ink">
                  {policy?.morningStart || '09:00'} – {policy?.morningEnd || '09:20'}
                </div>
                <div className="text-[11px] text-[#64748B] mt-1">IST (Check-In)</div>
              </div>

              <div className="p-4 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg">
                <div className="text-xs text-[#64748B] mb-1">Evening Window</div>
                <div className="text-lg font-bold text-ink">
                  {policy?.eveningStart || '16:30'} – {policy?.eveningEnd || '17:00'}
                </div>
                <div className="text-[11px] text-[#64748B] mt-1">IST (Check-Out)</div>
              </div>

              <div className="p-4 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg">
                <div className="text-xs text-[#64748B] mb-1">Default Geofence Radius</div>
                <div className="text-lg font-bold text-blue-700">
                  {policy?.defaultGeofenceRadiusMetres || 100} metres
                </div>
                <div className="text-[11px] text-[#64748B] mt-1">Per-branch override enabled</div>
              </div>

              <div className="p-4 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg">
                <div className="text-xs text-[#64748B] mb-1">GPS Accuracy Max Threshold</div>
                <div className="text-lg font-bold text-amber-700">
                  {policy?.gpsAccuracyRejectMetres || 200} metres
                </div>
                <div className="text-[11px] text-[#64748B] mt-1">Rejects inaccurate spoofing</div>
              </div>
            </div>

            {policy?.notes && (
              <div className="p-3 bg-[#EEF2F7] rounded-lg text-xs text-ink">
                <strong>Policy Notes:</strong> {policy.notes}
              </div>
            )}
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

      </main>
    </div>
  );
}
