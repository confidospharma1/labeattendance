'use client';

import React, { useState } from 'react';
import { MapPin, LogIn, LogOut, Clock, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { apiClient, apiErrorMessage } from '@/lib/api';
import { useAttendanceProof, stepLabel } from './useAttendanceProof';

const fmtTime = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' }) : '';

export function OfficeAttendance({ today, onChange }: { today: any; onChange: () => void }) {
  const { step, setStep, collect, faceModal } = useAttendanceProof();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [report, setReport] = useState('');

  const policy = today.policy;
  const record = today.todayRecord;
  const target = today.target;
  const busy = step !== 'idle';

  const run = async (kind: 'in' | 'out') => {
    setError(null);
    setSuccess(null);
    try {
      const proof = await collect({
        face: policy.faceVerificationRequired,
        faceTitle: kind === 'in' ? 'Verify to check in' : 'Verify to check out',
      });
      setStep('sending');
      const res = await apiClient.post(
        kind === 'in' ? '/attendance/check-in' : '/attendance/check-out',
        kind === 'in' ? proof : { ...proof, workReport: report }
      );
      const d = res.data.data;
      setSuccess(
        `${kind === 'in' ? 'Checked in' : 'Checked out'} at ${target?.refName} · ${Math.round(d.geoResult.distanceMetres)} m from centre` +
          (d.faceScore ? ` · face match ${Math.round(d.faceScore * 100)}%` : '')
      );
      setReport('');
      onChange();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setStep('idle');
    }
  };

  const checkedIn = !!record?.checkInAt;
  const checkedOut = !!record?.checkOutAt;
  const reportOk = report.replace(/\s+/g, '').length >= (policy.minReportLength || 5);

  return (
    <div className="space-y-4">
      {faceModal}

      {/* Branch card */}
      <section className="bg-white rounded-2xl border border-slate-200 p-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-50 text-brand-700 flex items-center justify-center flex-shrink-0">
            <MapPin className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-xs text-slate-500">Your branch</div>
            <div className="font-semibold text-ink truncate">{target?.refName || '—'}</div>
            {target && <div className="text-xs text-slate-500 mt-0.5">You must be within {target.radiusMetres} m of the branch</div>}
            {today.targetError && <div className="text-xs text-red-700 mt-1">{today.targetError}</div>}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 mt-4">
          <Window label="Check-in" from={policy.morningStart} to={policy.morningEnd} open={today.windows.inMorningWindow} />
          <Window label="Check-out" from={policy.eveningStart} to={policy.eveningEnd} open={today.windows.inEveningWindow} />
        </div>
      </section>

      {/* Status + action */}
      <section className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
        <div className="grid grid-cols-2 gap-2 text-sm">
          <Stamp label="Checked in" time={fmtTime(record?.checkInAt)} />
          <Stamp label="Checked out" time={fmtTime(record?.checkOutAt)} />
        </div>

        {!checkedIn && (
          <button
            onClick={() => run('in')}
            disabled={busy || !today.windows.canCheckIn || !target}
            className="w-full h-14 rounded-2xl bg-brand-700 hover:bg-brand-800 text-white font-semibold text-base flex items-center justify-center gap-2 disabled:bg-slate-200 disabled:text-slate-500"
          >
            {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <LogIn className="w-5 h-5" />}
            {busy ? stepLabel[step] : today.windows.inMorningWindow ? 'Check in now' : `Check-in opens ${policy.morningStart}`}
          </button>
        )}

        {checkedIn && !checkedOut && (
          <>
            <label className="block">
              <span className="text-sm font-medium text-ink">Today&apos;s work report</span>
              <textarea
                value={report}
                onChange={(e) => setReport(e.target.value)}
                rows={3}
                maxLength={1000}
                placeholder="What did you work on today?"
                className="mt-1 w-full rounded-xl border border-slate-300 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </label>
            <button
              onClick={() => run('out')}
              disabled={busy || !today.windows.canCheckOut || !reportOk}
              className="w-full h-14 rounded-2xl bg-ink hover:bg-black text-white font-semibold text-base flex items-center justify-center gap-2 disabled:bg-slate-200 disabled:text-slate-500"
            >
              {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <LogOut className="w-5 h-5" />}
              {busy
                ? stepLabel[step]
                : !today.windows.inEveningWindow
                  ? `Check-out opens ${policy.eveningStart}`
                  : !reportOk
                    ? 'Write your work report to check out'
                    : 'Check out now'}
            </button>
          </>
        )}

        {checkedOut && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-50 text-emerald-800 text-sm font-medium">
            <CheckCircle2 className="w-5 h-5" /> Attendance complete for today
          </div>
        )}

        {error && (
          <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-800 flex gap-2">
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}
        {success && <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-sm text-emerald-800">{success}</div>}
      </section>
    </div>
  );
}

function Window({ label, from, to, open }: { label: string; from: string; to: string; open: boolean }) {
  return (
    <div className={`rounded-xl p-3 border ${open ? 'bg-brand-50 border-brand-200' : 'bg-slate-50 border-slate-200'}`}>
      <div className="flex items-center gap-1.5 text-xs text-slate-500">
        <Clock className="w-3.5 h-3.5" /> {label}
      </div>
      <div className="font-semibold text-ink text-sm mt-0.5">
        {from} – {to}
      </div>
      <div className={`text-[11px] font-medium mt-0.5 ${open ? 'text-brand-700' : 'text-slate-400'}`}>{open ? 'Open now' : 'Closed'}</div>
    </div>
  );
}

function Stamp({ label, time }: { label: string; time: string }) {
  return (
    <div className="rounded-xl bg-slate-50 p-3">
      <div className="text-xs text-slate-500">{label}</div>
      <div className={`font-bold text-lg ${time ? 'text-ink' : 'text-slate-300'}`}>{time || '--:--'}</div>
    </div>
  );
}
