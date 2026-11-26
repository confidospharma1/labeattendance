'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { LogOut, RefreshCw, Home, History, Loader2, AlertCircle, Tent, Store, Route } from 'lucide-react';
import { useAuth } from '@/providers/AuthProvider';
import { apiClient, apiErrorMessage } from '@/lib/api';
import { formatISTDate } from '@/lib/utils';
import { categoryInfo } from '@/lib/staff';
import { Logo } from '@/components/common/Logo';
import { AttendanceHistory } from '@/components/attendance/AttendanceHistory';
import { OfficeAttendance } from '@/components/staff/OfficeAttendance';
import { FieldTaskList } from '@/components/staff/FieldTaskList';
import { FaceEnrollCard } from '@/components/staff/FaceEnrollCard';
import { CampList } from '@/components/staff/CampList';
import { CustomersView } from '@/components/customers/CustomersView';

type Tab = 'home' | 'camps' | 'customers' | 'history';

export default function EmployeeHome() {
  const { user, logout, loading: authLoading } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('home');
  const [today, setToday] = useState<any>(null);
  const [tasks, setTasks] = useState<any>(null);
  const [camps, setCamps] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [todayRes, historyRes, campsRes] = await Promise.all([
        apiClient.get('/attendance/today'),
        apiClient.get('/attendance/my-history?limit=30'),
        apiClient.get('/camps/my').catch(() => ({ data: { data: [] } })),
      ]);
      const t = todayRes.data.data;
      setToday(t);
      setHistory(historyRes.data.data || []);
      setCamps(campsRes.data.data || []);
      // Route-based staff (marketing executives / unclassified field staff) work from task stops
      setTasks(t.mode === 'FIELD_TASKS' ? (await apiClient.get('/field-tasks/my')).data.data : null);
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not load your attendance.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace('/login');
      return;
    }
    if (user.role === 'ADMIN' || user.role === 'SUPER_ADMIN') {
      router.replace('/admin');
      return;
    }
    load();
  }, [user, authLoading, router, load]);

  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-6 h-6 animate-spin text-brand-700" />
      </div>
    );
  }

  const emp = user.employee;
  const mode: string | undefined = today?.mode;
  const isRoute = mode === 'FIELD_TASKS';
  const isSales = today?.employee?.staffCategory === 'SALES_EXECUTIVE';
  const needsFace = today?.policy?.faceVerificationRequired && today?.face && !today.face.enrolled;
  const firstName = emp?.fullName?.split(' ')[0] || 'there';
  const cat = categoryInfo(today?.employee?.staffCategory);
  const openCamps = camps.filter((c) => c.canCheckIn || c.canCheckOut).length;

  const tabs: { id: Tab; label: string; icon: any; badge?: number }[] = [
    { id: 'home', label: isRoute ? 'Route' : 'Today', icon: isRoute ? Route : Home },
    ...(camps.length > 0 ? [{ id: 'camps' as Tab, label: 'Camps', icon: Tent, badge: openCamps }] : []),
    ...(isSales ? [{ id: 'customers' as Tab, label: 'Customers', icon: Store }] : []),
    { id: 'history', label: 'History', icon: History },
  ];

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      <header className="bg-gradient-to-br from-brand-600 via-brand-700 to-brand-900 text-white pt-[max(env(safe-area-inset-top),0.75rem)] rounded-b-3xl shadow-lg shadow-brand-900/10">
        <div className="max-w-xl mx-auto px-4 pb-7">
          <div className="flex items-center justify-between h-12">
            <Logo light size={32} />
            <div className="flex items-center gap-1">
              <button onClick={load} className="p-2 rounded-full hover:bg-white/10" aria-label="Refresh">
                <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
              </button>
              <button onClick={() => logout()} className="p-2 rounded-full hover:bg-white/10" aria-label="Sign out">
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
          <div className="mt-3">
            <div className="text-brand-100 text-sm">{formatISTDate(new Date())}</div>
            <h1 className="text-2xl font-bold">Hello, {firstName}</h1>
            <div className="text-brand-100 text-xs mt-1">
              {emp?.employeeCode}
              {today?.employee?.designation && ` · ${today.employee.designation}`} · {cat?.label ?? (emp?.employeeType === 'FIELD_STAFF' ? 'Field staff' : 'Office staff')}
              {today?.employee?.location && ` · ${today.employee.location.name}`}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-xl mx-auto px-4 -mt-2 pt-4 space-y-4">
        {error && (
          <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-800 flex gap-2">
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {loading && !today && (
          <div className="py-16 flex justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-brand-700" />
          </div>
        )}

        {today && needsFace && tab !== 'history' && <FaceEnrollCard onEnrolled={load} />}

        {today && !needsFace && tab === 'home' && (
          <>
            {openCamps > 0 && (
              <button
                onClick={() => setTab('camps')}
                className="w-full p-3 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-sm font-medium flex items-center gap-2"
              >
                <Tent className="w-4 h-4" /> You have a camp open for attendance now
              </button>
            )}
            {isRoute ? (
              <FieldTaskList
                data={tasks}
                faceRequired={today.policy.faceVerificationRequired}
                onChange={load}
                survey={today.employee.staffCategory === 'MARKETING_EXECUTIVE'}
              />
            ) : (
              <OfficeAttendance today={today} onChange={load} />
            )}
          </>
        )}

        {today && !needsFace && tab === 'camps' && <CampList camps={camps} faceRequired={today.policy.faceVerificationRequired} onChange={load} />}
        {today && tab === 'customers' && isSales && <CustomersView />}
        {today && tab === 'history' && <AttendanceHistory records={history} onRefresh={load} />}
      </main>

      <nav className="fixed bottom-0 inset-x-0 bg-white border-t border-slate-200 pb-[env(safe-area-inset-bottom)]">
        <div className="max-w-xl mx-auto flex">
          {tabs.map(({ id, label, icon: Icon, badge }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`relative flex-1 h-16 flex flex-col items-center justify-center gap-1 text-xs font-medium ${tab === id ? 'text-brand-700' : 'text-slate-500'}`}
            >
              <Icon className="w-5 h-5" />
              {label}
              {!!badge && <span className="absolute top-2 right-1/4 min-w-4 h-4 px-1 rounded-full bg-amber-500 text-white text-[10px] leading-4">{badge}</span>}
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
