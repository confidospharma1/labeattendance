'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { UserCheck, UserX, Loader2, Inbox, ScanFace, RotateCcw } from 'lucide-react';
import { apiClient, apiErrorMessage } from '@/lib/api';

interface Props {
  branches: any[];
  employees: any[];
  onChanged: () => void;
}

export function ApprovalsPanel({ branches, employees, onChanged }: Props) {
  const [pending, setPending] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [choices, setChoices] = useState<Record<string, { employeeType: string; branchId: string }>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.get('/employees/pending');
      const list = res.data.data || [];
      setPending(list);
      setChoices(
        Object.fromEntries(
          list.map((e: any) => [e.id, { employeeType: e.employeeType, branchId: e.branchAssignments?.[0]?.branch?.id || '' }])
        )
      );
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const act = async (id: string, action: 'approve' | 'reject') => {
    setError(null);
    let body: any = {};
    if (action === 'reject') {
      const reason = window.prompt('Reason for rejecting this registration?');
      if (!reason) return;
      body = { reason };
    } else {
      const c = choices[id];
      body = { employeeType: c.employeeType, ...(c.employeeType === 'OFFICE_STAFF' && c.branchId ? { branchId: c.branchId } : {}) };
    }
    setBusyId(id);
    try {
      await apiClient.post(`/employees/${id}/${action}`, body);
      await load();
      onChanged();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-5">
      <section className="bg-white border border-[#E5E5E5] rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-[#E5E5E5] flex items-center justify-between">
          <h3 className="font-bold text-sm text-[#171717]">Pending staff registrations</h3>
          <span className="text-xs text-[#737373]">{pending.length} waiting</span>
        </div>
        {error && <div className="m-4 p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800">{error}</div>}
        {loading ? (
          <div className="p-8 flex justify-center">
            <Loader2 className="w-5 h-5 animate-spin text-[#737373]" />
          </div>
        ) : pending.length === 0 ? (
          <div className="p-10 text-center text-sm text-[#737373]">
            <Inbox className="w-8 h-8 mx-auto mb-2 text-[#D4D4D4]" />
            No registrations waiting for approval.
          </div>
        ) : (
          <ul className="divide-y divide-[#F0EFEB]">
            {pending.map((e) => {
              const c = choices[e.id] || { employeeType: e.employeeType, branchId: '' };
              return (
                <li key={e.id} className="p-4 flex flex-col lg:flex-row lg:items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm text-[#171717]">
                      {e.fullName} <span className="font-mono text-xs text-[#737373]">{e.employeeCode}</span>
                    </div>
                    <div className="text-xs text-[#737373]">
                      {e.user?.email} · {e.mobile} · registered {new Date(e.createdAt).toLocaleDateString('en-IN')}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      value={c.employeeType}
                      onChange={(ev) => setChoices((s) => ({ ...s, [e.id]: { ...c, employeeType: ev.target.value } }))}
                      className="h-9 px-2 text-xs border border-[#E5E5E5] rounded-lg bg-white"
                    >
                      <option value="OFFICE_STAFF">Office staff</option>
                      <option value="FIELD_STAFF">Field staff</option>
                    </select>
                    {c.employeeType === 'OFFICE_STAFF' && (
                      <select
                        value={c.branchId}
                        onChange={(ev) => setChoices((s) => ({ ...s, [e.id]: { ...c, branchId: ev.target.value } }))}
                        className="h-9 px-2 text-xs border border-[#E5E5E5] rounded-lg bg-white max-w-[14rem]"
                      >
                        <option value="">Select branch</option>
                        {branches.map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.name}
                          </option>
                        ))}
                      </select>
                    )}
                    <button
                      onClick={() => act(e.id, 'approve')}
                      disabled={busyId === e.id || (c.employeeType === 'OFFICE_STAFF' && !c.branchId)}
                      className="h-9 px-3 rounded-lg bg-brand-700 hover:bg-brand-800 text-white text-xs font-semibold inline-flex items-center gap-1.5 disabled:opacity-40"
                    >
                      {busyId === e.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserCheck className="w-3.5 h-3.5" />}
                      Approve
                    </button>
                    <button
                      onClick={() => act(e.id, 'reject')}
                      disabled={busyId === e.id}
                      className="h-9 px-3 rounded-lg border border-red-200 text-red-700 bg-red-50 hover:bg-red-100 text-xs font-semibold inline-flex items-center gap-1.5"
                    >
                      <UserX className="w-3.5 h-3.5" /> Reject
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <FaceAdmin employees={employees.filter((e) => e.employeeType === 'OFFICE_STAFF' || e.employeeType === 'FIELD_STAFF')} />
    </div>
  );
}

function FaceAdmin({ employees }: { employees: any[] }) {
  const [employeeId, setEmployeeId] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const view = async (id: string) => {
    setEmployeeId(id);
    setPhoto(null);
    setMsg(null);
    if (!id) return;
    try {
      const res = await apiClient.get(`/face/${id}/photo`);
      setPhoto(res.data.data.photo);
    } catch (err) {
      setMsg(apiErrorMessage(err));
    }
  };

  const reset = async () => {
    if (!employeeId || !window.confirm('Delete this face profile? The employee must enrol again before marking attendance.')) return;
    setBusy(true);
    try {
      await apiClient.delete(`/face/${employeeId}`);
      setPhoto(null);
      setMsg('Face profile deleted. The employee will be asked to enrol again.');
    } catch (err) {
      setMsg(apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="bg-white border border-[#E5E5E5] rounded-xl p-4">
      <h3 className="font-bold text-sm text-[#171717] flex items-center gap-2">
        <ScanFace className="w-4 h-4 text-brand-700" /> Face profiles
      </h3>
      <p className="text-xs text-[#737373] mt-1">View an employee&apos;s enrolled photo, or reset it if they changed phones or the enrolment was wrong.</p>
      <div className="flex flex-wrap items-center gap-2 mt-3">
        <select value={employeeId} onChange={(e) => view(e.target.value)} className="h-9 px-2 text-xs border border-[#E5E5E5] rounded-lg bg-white min-w-[14rem]">
          <option value="">Select employee</option>
          {employees.map((e) => (
            <option key={e.id} value={e.id}>
              {e.fullName} ({e.employeeCode})
            </option>
          ))}
        </select>
        {photo && (
          <button onClick={reset} disabled={busy} className="h-9 px-3 rounded-lg border border-red-200 text-red-700 bg-red-50 text-xs font-semibold inline-flex items-center gap-1.5">
            <RotateCcw className="w-3.5 h-3.5" /> Reset face
          </button>
        )}
      </div>
      {photo && <img src={photo} alt="Enrolled face" className="mt-3 w-32 h-24 object-cover rounded-lg border border-[#E5E5E5]" />}
      {msg && <div className="mt-3 text-xs text-[#525252]">{msg}</div>}
    </section>
  );
}
