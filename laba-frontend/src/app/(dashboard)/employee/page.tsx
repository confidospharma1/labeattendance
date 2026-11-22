'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { LogOut, RefreshCw, Home, History, Loader2, AlertCircle } from 'lucide-react';
import { useAuth } from '@/providers/AuthProvider';
import { apiClient, apiErrorMessage } from '@/lib/api';
import { formatISTDate } from '@/lib/utils';
import { AttendanceHistory } from '@/components/attendance/AttendanceHistory';
import { OfficeAttendance } from '@/components/staff/OfficeAttendance';
import { FieldTaskList } from '@/components/staff/FieldTaskList';
import { FaceEnrollCard } from '@/components/staff/FaceEnrollCard';

export default function EmployeeHome() {
  const { user, logout, loading: authLoading } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState<'home' | 'history'>('home');
  const [today, setToday] = useState<any>(null);
  const [tasks, setTasks] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isField = user?.employee?.employeeType === 'FIELD_STAFF';

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [todayRes, historyRes, tasksRes] = await Promise.all([
        apiClient.get('/attendance/today'),
        apiClient.get('/attendance/my-history?limit=30'),
        isField ? apiClient.get('/field-tasks/my') : Promise.resolve(null),
      ]);
      setToday(todayRes.data.data);
      setHistory(historyRes.data.data || []);
      setTasks(tasksRes?.data.data ?? null);
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not load your attendance.'));
    } finally {
      setLoading(false);
    }
  }, [isField]);

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
  const needsFace = today?.policy?.faceVerificationRequired && today?.face && !today.face.enrolled;
  const firstName = emp?.fullName?.split(' ')[0] || 'there';

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      <header className="bg-brand-700 text-white pt-[max(env(safe-area-inset-top),0.75rem)]">
        <div className="max-w-xl mx-auto px-4 pb-5">
          <div className="flex items-center justify-between h-12">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-white text-brand-700 flex items-center justify-center font-black">L</div>
              <span className="font-semibold">LABE Attendance</span>
            </div>
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
              {emp?.employeeCode} · {isField ? 'Field staff' : 'Office staff'}
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

        {today && tab === 'home' && (
          <>
            {needsFace && <FaceEnrollCard onEnrolled={load} />}
            {!needsFace &&
              (isField ? (
                <FieldTaskList data={tasks} faceRequired={today.policy.faceVerificationRequired} onChange={load} />
              ) : (
                <OfficeAttendance today={today} onChange={load} />
              ))}
          </>
        )}

        {today && tab === 'history' && <AttendanceHistory records={history} onRefresh={load} />}
      </main>

      <nav className="fixed bottom-0 inset-x-0 bg-white border-t border-slate-200 pb-[env(safe-area-inset-bottom)]">
        <div className="max-w-xl mx-auto grid grid-cols-2">
          {[
            { id: 'home', label: isField ? 'Tasks' : 'Today', icon: Home },
            { id: 'history', label: 'History', icon: History },
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id as any)}
              className={`h-16 flex flex-col items-center justify-center gap-1 text-xs font-medium ${
                tab === id ? 'text-brand-700' : 'text-slate-500'
              }`}
            >
              <Icon className="w-5 h-5" />
              {label}
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
