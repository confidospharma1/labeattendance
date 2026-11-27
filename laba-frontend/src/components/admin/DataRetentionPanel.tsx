'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Database, Download, Loader2, AlertTriangle, CheckCircle2, CalendarClock, Trash2, X, HardDrive, Info } from 'lucide-react';
import { apiClient, apiErrorMessage } from '@/lib/api';
import { fmtDate } from '@/lib/staff';
import { saveFile, filenameFrom } from '@/lib/download';

export interface RetentionStatus {
  retentionDays: number;
  options: number[];
  warningDays: number;
  storage: { usedBytes: number; historyBytes: number; faceBytes: number; limitBytes: number; percentUsed: number } | null;
  projection: { bytesPerDay: number; projectedBytes: number; recommendedDays: number; daysUntilFull: number | null } | null;
  history: { oldest: string | null; attendanceRecords: number; fieldTasks: number; camps: number; daysWithData: number; keepFrom: string };
  latestArchivable: string;
  lastPurgeAt: string | null;
  lastPurgedThrough: string | null;
  lastArchiveAt: string | null;
  alert: null | {
    deleteOn: string;
    daysLeft: number;
    from: string;
    through: string;
    attendanceRecords: number;
    fieldTasks: number;
    camps: number;
    schedule: { deleteOn: string; dataDate: string; records: number }[];
  };
}

export const fmtBytes = (b?: number | null) => {
  if (b === null || b === undefined) return '—';
  if (b < 1024) return `${b} B`;
  if (b < 1024 ** 2) return `${(b / 1024).toFixed(0)} KB`;
  if (b < 1024 ** 3) return `${(b / 1024 ** 2).toFixed(b < 10 * 1024 ** 2 ? 1 : 0)} MB`;
  return `${(b / 1024 ** 3).toFixed(2)} GB`;
};

const daysText = (n: number) => (n === 0 ? 'today' : n === 1 ? 'tomorrow' : `in ${n} days`);

/** Banner shown on every admin tab during the warning window before old data is deleted. */
export function RetentionBanner({ status, onOpen }: { status: RetentionStatus | null; onOpen: () => void }) {
  const [hidden, setHidden] = useState(false);
  if (!status?.alert || hidden) return null;
  const a = status.alert;
  return (
    <div className="bg-amber-50 border border-amber-300 rounded-2xl p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center gap-3" role="alert">
      <div className="flex items-start gap-3 flex-1 min-w-0">
        <span className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center flex-shrink-0">
          <AlertTriangle className="w-5 h-5" />
        </span>
        <div className="min-w-0">
          <div className="text-sm font-bold text-amber-900">
            Old attendance data will be deleted {daysText(a.daysLeft)} ({fmtDate(a.deleteOn)})
          </div>
          <div className="text-xs text-amber-800">
            Records from {fmtDate(a.from)} to {fmtDate(a.through)} ({a.attendanceRecords} attendance, {a.fieldTasks} route stops, {a.camps} camps) pass the{' '}
            {status.retentionDays}-day limit. Download them as Excel to keep a copy.
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2 self-end sm:self-auto">
        <button onClick={onOpen} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold whitespace-nowrap">
          <Download className="w-3.5 h-3.5" /> Download Excel
        </button>
        <button onClick={() => setHidden(true)} className="p-2 rounded-lg text-amber-800 hover:bg-amber-100" aria-label="Hide for now">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

export function DataRetentionPanel({ isSuperAdmin, onChanged }: { isSuperAdmin: boolean; onChanged?: (s: RetentionStatus) => void }) {
  const [status, setStatus] = useState<RetentionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [through, setThrough] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [working, setWorking] = useState<null | 'download' | 'delete'>(null);
  const [done, setDone] = useState<string | null>(null);

  const apply = useCallback(
    (s: RetentionStatus) => {
      setStatus(s);
      setDays(s.retentionDays);
      setThrough((t) => t || s.alert?.through || s.latestArchivable);
      onChanged?.(s);
    },
    [onChanged]
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get('/retention/status');
      apply(res.data.data);
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not load storage status.'));
    } finally {
      setLoading(false);
    }
  }, [apply]);

  useEffect(() => {
    load();
  }, [load]);

  const saveDays = async () => {
    if (!days) return;
    setSaving(true);
    setError(null);
    try {
      const res = await apiClient.patch('/retention/settings', { retentionDays: days });
      apply(res.data.data);
      setDone(`Attendance history is now kept for ${days} days.`);
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not save.'));
    } finally {
      setSaving(false);
    }
  };

  const archiveAndClear = async () => {
    setConfirming(false);
    setError(null);
    setDone(null);
    setWorking('download');
    try {
      const res = await apiClient.get(`/retention/archive?through=${through}`, { responseType: 'blob' });
      const token = res.headers['x-archive-token'];
      const archivedThrough = res.headers['x-archive-through'] || through;
      const name = filenameFrom(res.headers['content-disposition'], `J-Track_Archive_to_${through}.xlsx`);
      const { savedTo } = await saveFile(new Blob([res.data]), name);
      if (!token) throw new Error('The server did not confirm the archive. Nothing was deleted.');
      setWorking('delete');
      const del = await apiClient.post('/retention/purge', { through: archivedThrough, token });
      const r = del.data.data;
      setDone(
        `Saved ${name} to ${savedTo}. Deleted data through ${fmtDate(r.through)}: ${r.attendanceRecords} attendance records, ${r.fieldTasks} route stops, ${r.camps} camps, ${r.corrections} corrections.`
      );
      setThrough('');
      await load();
    } catch (err: any) {
      let msg = apiErrorMessage(err, err?.message || 'Download failed. Nothing was deleted.');
      // Blob error bodies need decoding
      if (err?.response?.data instanceof Blob) {
        try {
          msg = JSON.parse(await err.response.data.text())?.error?.message || msg;
        } catch {
          /* keep msg */
        }
      }
      setError(msg);
    } finally {
      setWorking(null);
    }
  };

  if (loading && !status) {
    return (
      <div className="py-20 flex justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-brand-600" />
      </div>
    );
  }

  const st = status?.storage;
  const pj = status?.projection;
  const pct = st ? Math.min(100, st.percentUsed) : 0;
  const barColor = pct >= 85 ? 'bg-red-500' : pct >= 65 ? 'bg-amber-500' : 'bg-brand-600';
  const nothingToArchive = !status?.history.oldest || (through && status.history.oldest > through);

  return (
    <div className="space-y-4 sm:space-y-5">
      <div>
        <h2 className="text-base sm:text-lg font-bold text-ink flex items-center gap-2">
          <Database className="w-5 h-5 text-brand-700" /> Data & storage
        </h2>
        <p className="text-xs text-[#64748B]">
          The free database holds 1 GB. Attendance history is kept for a set number of days, then deleted automatically.
          You are warned {status?.warningDays ?? 5} days before, and can download it as Excel at any time.
        </p>
      </div>

      {error && <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-800">{error}</div>}
      {done && (
        <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 flex items-start gap-2">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" /> {done}
        </div>
      )}

      {status?.alert && (
        <div className="bg-amber-50 border border-amber-300 rounded-2xl p-4 space-y-3">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-700 flex-shrink-0" />
            <div>
              <div className="text-sm font-bold text-amber-900">
                Deletion {daysText(status.alert.daysLeft)} · {fmtDate(status.alert.deleteOn)}
              </div>
              <div className="text-xs text-amber-800">
                {status.alert.attendanceRecords} attendance records, {status.alert.fieldTasks} route stops and {status.alert.camps} camps dated{' '}
                {fmtDate(status.alert.from)} – {fmtDate(status.alert.through)} reach the {status.retentionDays}-day limit within {status.warningDays} days.
              </div>
            </div>
          </div>
          {status.alert.schedule.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-xs min-w-[320px]">
                <thead className="text-[10px] uppercase tracking-wide text-amber-800">
                  <tr>
                    <th className="text-left py-1">Attendance of</th>
                    <th className="text-left py-1">Deleted on</th>
                    <th className="text-right py-1">Records</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-amber-200">
                  {status.alert.schedule.slice(-10).map((d) => (
                    <tr key={d.dataDate}>
                      <td className="py-1.5 text-amber-950">{fmtDate(d.dataDate)}</td>
                      <td className="py-1.5 text-amber-950">{fmtDate(d.deleteOn)}</td>
                      <td className="py-1.5 text-right font-semibold text-amber-950">{d.records}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Storage */}
        <section className="bg-white border border-[#E2E8F0] rounded-2xl p-4 sm:p-5 space-y-4">
          <h3 className="text-sm font-bold text-ink flex items-center gap-2">
            <HardDrive className="w-4 h-4 text-[#64748B]" /> Database storage
          </h3>
          {st ? (
            <>
              <div>
                <div className="flex items-end justify-between mb-1.5">
                  <span className="text-2xl font-bold text-ink">{fmtBytes(st.usedBytes)}</span>
                  <span className="text-xs text-[#64748B]">
                    of {fmtBytes(st.limitBytes)} · {st.percentUsed}%
                  </span>
                </div>
                <div className="h-3 rounded-full bg-[#EEF2F7] overflow-hidden" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
                  <div className={`h-full rounded-full ${barColor}`} style={{ width: `${Math.max(1, pct)}%` }} />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <Stat label="Attendance history" value={fmtBytes(st.historyBytes)} />
                <Stat label="Face enrolments" value={fmtBytes(st.faceBytes)} />
                <Stat label="Everything else" value={fmtBytes(Math.max(0, st.usedBytes - st.historyBytes - st.faceBytes))} />
              </div>
              {pj && pj.bytesPerDay > 0 && (
                <p className="text-xs text-[#475569] bg-[#F8FAFC] border border-[#EEF2F7] rounded-lg p-3 flex gap-2">
                  <Info className="w-4 h-4 flex-shrink-0 text-brand-600" />
                  <span>
                    About <strong>{fmtBytes(pj.bytesPerDay)}</strong> of history is added per working day. Keeping {status!.retentionDays} days needs about{' '}
                    <strong>{fmtBytes(pj.projectedBytes)}</strong>.{' '}
                    {pj.daysUntilFull !== null && <>At this rate the database is full in about {pj.daysUntilFull} days without clean-up. </>}
                    Recommended: <strong>{pj.recommendedDays} days</strong>.
                  </span>
                </p>
              )}
            </>
          ) : (
            <p className="text-xs text-[#64748B]">Storage size is not available on this database.</p>
          )}
        </section>

        {/* Retention period */}
        <section className="bg-white border border-[#E2E8F0] rounded-2xl p-4 sm:p-5 space-y-4">
          <h3 className="text-sm font-bold text-ink flex items-center gap-2">
            <CalendarClock className="w-4 h-4 text-[#64748B]" /> Keep attendance history for
          </h3>
          <div className="grid grid-cols-3 gap-2">
            {(status?.options ?? [30, 60, 90, 120, 180, 365]).map((d) => (
              <button
                key={d}
                disabled={!isSuperAdmin}
                onClick={() => setDays(d)}
                className={`relative py-2.5 rounded-xl border text-sm font-bold transition-colors disabled:cursor-not-allowed ${
                  days === d ? 'bg-brand-700 border-brand-700 text-white' : 'bg-white border-[#E2E8F0] text-ink hover:border-brand-300'
                }`}
              >
                {d} days
                {pj?.recommendedDays === d && (
                  <span className={`block text-[10px] font-semibold ${days === d ? 'text-white/80' : 'text-emerald-700'}`}>Recommended</span>
                )}
              </button>
            ))}
          </div>
          {isSuperAdmin ? (
            <button
              onClick={saveDays}
              disabled={saving || days === status?.retentionDays}
              className="w-full sm:w-auto px-4 py-2 rounded-lg bg-brand-700 hover:bg-brand-800 text-white text-xs font-semibold disabled:opacity-40"
            >
              {saving ? 'Saving…' : 'Save retention period'}
            </button>
          ) : (
            <p className="text-[11px] text-[#64748B]">Only the super admin can change this.</p>
          )}
          <dl className="text-xs text-[#475569] space-y-1.5 border-t border-[#EEF2F7] pt-3">
            <Row k="Oldest data kept" v={status?.history.oldest ? fmtDate(status.history.oldest) : 'No history yet'} />
            <Row k="Stored" v={`${status?.history.attendanceRecords ?? 0} attendance · ${status?.history.fieldTasks ?? 0} route stops · ${status?.history.camps ?? 0} camps`} />
            <Row k="Last clean-up" v={status?.lastPurgedThrough ? `Data through ${fmtDate(status.lastPurgedThrough)}` : 'Never'} />
          </dl>
        </section>
      </div>

      {/* Archive & clear */}
      <section className="bg-white border border-[#E2E8F0] rounded-2xl p-4 sm:p-5 space-y-3">
        <h3 className="text-sm font-bold text-ink flex items-center gap-2">
          <Download className="w-4 h-4 text-[#64748B]" /> Download Excel and clear history
        </h3>
        <p className="text-xs text-[#64748B]">
          Downloads every attendance record, field-route stop, camp check-in and correction up to the date you pick (sheets: Attendance, Staff Summary, Field
          Routes, Camps, Corrections). As soon as the file is saved, that data is deleted from J-Track to free space. Today&apos;s attendance is never included.
        </p>
        <div className="flex flex-col sm:flex-row sm:items-end gap-3">
          <label className="text-xs text-[#475569] flex-1 sm:flex-none">
            Data up to and including
            <input
              type="date"
              value={through}
              max={status?.latestArchivable}
              onChange={(e) => setThrough(e.target.value)}
              className="mt-1 block w-full sm:w-48 px-3 py-2 border border-[#E2E8F0] rounded-lg text-sm"
            />
          </label>
          <button
            onClick={() => setConfirming(true)}
            disabled={!through || !!working || !!nothingToArchive}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-brand-700 hover:bg-brand-800 text-white text-sm font-semibold disabled:opacity-40"
          >
            {working ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            {working === 'download' ? 'Preparing Excel…' : working === 'delete' ? 'Clearing data…' : 'Download Excel & clear'}
          </button>
        </div>
        {nothingToArchive && <p className="text-[11px] text-[#94A3B8]">There is no stored history up to this date.</p>}
      </section>

      {confirming && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => setConfirming(false)}>
          <div className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start gap-3">
              <span className="w-10 h-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center flex-shrink-0">
                <Trash2 className="w-5 h-5" />
              </span>
              <div>
                <h4 className="font-bold text-ink">Download and delete history?</h4>
                <p className="text-xs text-[#475569] mt-1">
                  J-Track will download all attendance history up to <strong>{fmtDate(through)}</strong> as Excel, then permanently delete it from the
                  database. Employees, locations and face enrolments are kept. If the download fails, nothing is deleted.
                </p>
              </div>
            </div>
            <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
              <button onClick={() => setConfirming(false)} className="px-4 py-2.5 rounded-lg border border-[#E2E8F0] text-sm font-semibold">
                Cancel
              </button>
              <button onClick={archiveAndClear} className="px-4 py-2.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-semibold">
                Download & delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-[#F8FAFC] border border-[#EEF2F7] rounded-lg p-2">
      <div className="text-sm font-bold text-ink">{value}</div>
      <div className="text-[10px] text-[#64748B]">{label}</div>
    </div>
  );
}
function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-[#64748B]">{k}</dt>
      <dd className="text-right font-medium text-ink">{v}</dd>
    </div>
  );
}
