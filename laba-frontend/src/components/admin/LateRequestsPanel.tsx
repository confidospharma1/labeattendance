'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Check, X, Loader2, Hourglass } from 'lucide-react';
import { apiClient, apiErrorMessage } from '@/lib/api';

export function LateRequestsPanel({ onChanged }: { onChanged: () => void }) {
  const [status, setStatus] = useState<'REQUESTED' | 'APPROVED' | 'REJECTED'>('REQUESTED');
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.get(`/field-tasks/late-requests?status=${status}`);
      setItems(res.data.data || []);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    load();
  }, [load]);

  const review = async (id: string, decision: 'APPROVED' | 'REJECTED') => {
    const note = window.prompt(decision === 'APPROVED' ? 'Note for the staff member (optional)' : 'Reason for rejecting') ?? undefined;
    if (decision === 'REJECTED' && !note) return;
    setBusyId(id);
    setError(null);
    try {
      await apiClient.post(`/field-tasks/${id}/late-review`, { decision, ...(note ? { note } : {}) });
      await load();
      onChanged();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section className="bg-white border border-[#E2E8F0] rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-[#E2E8F0] flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="font-bold text-sm text-ink">Late task access</h3>
          <p className="text-xs text-[#64748B]">Field staff who missed a task deadline need your approval to check in and submit their note.</p>
        </div>
        <div className="flex gap-1 text-xs">
          {(['REQUESTED', 'APPROVED', 'REJECTED'] as const).map((s) => (
            <button key={s} onClick={() => setStatus(s)} className={`px-3 h-8 rounded-lg font-semibold ${status === s ? 'bg-brand-700 text-white' : 'text-[#64748B] hover:bg-[#EEF2F7]'}`}>
              {s === 'REQUESTED' ? 'Pending' : s[0] + s.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
      </div>
      {error && <div className="m-4 p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800">{error}</div>}
      {loading ? (
        <div className="p-8 flex justify-center">
          <Loader2 className="w-5 h-5 animate-spin text-[#64748B]" />
        </div>
      ) : items.length === 0 ? (
        <div className="p-10 text-center text-sm text-[#64748B]">
          <Hourglass className="w-8 h-8 mx-auto mb-2 text-[#CBD5E1]" />
          Nothing here.
        </div>
      ) : (
        <ul className="divide-y divide-[#EEF2F7]">
          {items.map((t) => (
            <li key={t.id} className="p-4 flex flex-col md:flex-row md:items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm">
                  {t.employee.fullName} · {t.title}
                </div>
                <div className="text-xs text-[#64748B]">
                  {t.taskDate} · deadline {t.deadlineTime} · {t.locationName}
                </div>
                <div className="text-xs mt-1 text-ink bg-amber-50 rounded-lg p-2">&ldquo;{t.lateRequestReason}&rdquo;</div>
                {t.lateReviewNote && <div className="text-xs mt-1 text-[#64748B]">Admin note: {t.lateReviewNote}</div>}
              </div>
              {status === 'REQUESTED' && (
                <div className="flex gap-2">
                  <button onClick={() => review(t.id, 'APPROVED')} disabled={busyId === t.id} className="h-9 px-3 rounded-lg bg-brand-700 text-white text-xs font-semibold inline-flex items-center gap-1.5">
                    {busyId === t.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} Allow
                  </button>
                  <button onClick={() => review(t.id, 'REJECTED')} disabled={busyId === t.id} className="h-9 px-3 rounded-lg border border-red-200 bg-red-50 text-red-700 text-xs font-semibold inline-flex items-center gap-1.5">
                    <X className="w-3.5 h-3.5" /> Reject
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
