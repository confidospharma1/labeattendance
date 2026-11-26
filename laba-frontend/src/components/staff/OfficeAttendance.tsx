'use client';

import React, { useState } from 'react';
import { MapPin, LogIn, LogOut, Clock, CheckCircle2, AlertCircle, Loader2, Crosshair, Globe2, Map as MapIcon } from 'lucide-react';
import { apiClient, apiErrorMessage } from '@/lib/api';
import { getCurrentFix, GpsFix } from '@/lib/location';
import { fenceStatus } from '@/lib/geo';
import { FenceMap } from '@/components/map/dynamic';
import { useAttendanceProof, stepLabel } from './useAttendanceProof';

const fmtTime = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' }) : '';

/**
 * Day check-in / check-out for every staff type except route-based marketing executives:
 * office / DC / pharmacy / lab (location geofence), sales executives (DC territory), leadership (anywhere).
 */
export function OfficeAttendance({ today, onChange }: { today: any; onChange: () => void }) {
  const { step, setStep, collect, faceModal } = useAttendanceProof();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [report, setReport] = useState('');
  const [fix, setFix] = useState<GpsFix | null>(null);
  const [checking, setChecking] = useState(false);

  const policy = today.policy;
  const record = today.todayRecord;
  const target = today.target;
  const mode: string = today.mode;
  const win = today.windows;
  const busy = step !== 'idle';
  const anywhere = mode === 'ANYWHERE';
  const status = fix && target ? fenceStatus(target, fix.latitude, fix.longitude) : null;

  const checkPosition = async () => {
    setError(null);
    setChecking(true);
    try {
      setFix(await getCurrentFix());
    } catch (err: any) {
      setError(err.message);
    } finally {
      setChecking(false);
    }
  };

  const run = async (kind: 'in' | 'out') => {
    setError(null);
    setSuccess(null);
    try {
      const proof = await collect({
        face: policy.faceVerificationRequired,
        faceTitle: kind === 'in' ? 'Verify to check in' : 'Verify to check out',
      });
      setFix(proof);
      setStep('sending');
      const res = await apiClient.post(
        kind === 'in' ? '/attendance/check-in' : '/attendance/check-out',
        kind === 'in' ? proof : { ...proof, workReport: report }
      );
      const d = res.data.data;
      const where = d.geoResult
        ? d.geoResult.shape === 'POLYGON'
          ? `inside ${target?.boundaryLabel || target?.refName}`
          : `${Math.round(d.geoResult.distanceMetres)} m from ${target?.refName}`
        : 'location recorded';
      setSuccess(
        `${kind === 'in' ? 'Checked in' : 'Checked out'} · ${where}` +
          (d.faceScore ? ` · face match ${Math.round(d.faceScore * 100)}%` : '') +
          (d.isLate ? ' · marked LATE' : '')
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
  const checkIn = win.checkIn ?? { from: policy.morningStart, to: policy.morningEnd, open: win.inMorningWindow };
  const checkOut = win.checkOut ?? { from: policy.eveningStart, to: policy.eveningEnd, open: win.inEveningWindow };

  const fenceText = anywhere
    ? 'You can mark attendance from the office or anywhere. Your location is recorded.'
    : !target
      ? ''
      : target.shape === 'POLYGON'
        ? `Mark from anywhere inside the ${target.boundaryLabel || target.refName} boundary`
        : `You must be within ${target.radiusMetres} m of ${target.refName}`;

  return (
    <div className="space-y-4">
      {faceModal}

      {/* Where + when */}
      <section className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-50 text-brand-700 flex items-center justify-center flex-shrink-0">
            {anywhere ? <Globe2 className="w-5 h-5" /> : mode === 'TERRITORY' ? <MapIcon className="w-5 h-5" /> : <MapPin className="w-5 h-5" />}
          </div>
          <div className="min-w-0">
            <div className="text-xs text-slate-500">{anywhere ? 'Attendance' : mode === 'TERRITORY' ? 'Your sales territory' : 'Your work location'}</div>
            <div className="font-semibold text-ink truncate">{anywhere ? 'Office / anywhere' : target?.refName || '—'}</div>
            <div className="text-xs text-slate-500 mt-0.5">{fenceText}</div>
            {today.targetError && <div className="text-xs text-red-700 mt-1">{today.targetError}</div>}
          </div>
        </div>

        {today.shift && (
          <div className="flex items-center gap-2 text-xs px-3 py-2 rounded-xl bg-slate-50 text-slate-700">
            <Clock className="w-3.5 h-3.5" />
            <span>
              <strong>{today.shift.name} shift</strong> {today.shift.startTime}–{today.shift.endTime} · late after {today.shift.lateGraceMinutes} min
            </span>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          <Window label="Check-in" from={checkIn.from} to={checkIn.to} open={checkIn.open} />
          <Window label="Check-out" from={checkOut.from} to={checkOut.to} open={checkOut.open} />
        </div>

        {!anywhere && target && (
          <>
            <FenceMap
              fences={[{ ...target, latitude: target.targetLat, longitude: target.targetLng, territory: mode === 'TERRITORY', label: target.refName }]}
              me={fix}
            />
            <button
              onClick={checkPosition}
              disabled={checking || busy}
              className="w-full h-11 rounded-xl border border-slate-300 text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {checking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Crosshair className="w-4 h-4" />}
              Check my position
            </button>
            {status && (
              <div className={`text-sm px-3 py-2 rounded-xl ${status.inside ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-900'}`}>
                {status.inside
                  ? status.polygon
                    ? 'You are inside the boundary.'
                    : `You are inside the geofence (${Math.round(status.distance)} m from the pin).`
                  : status.polygon
                    ? `You are about ${Math.round(status.distance)} m outside the boundary.`
                    : `You are ${Math.round(status.distance)} m away; move within ${target.radiusMetres} m.`}
                {fix && <span className="block text-[11px] opacity-75">GPS accuracy ±{Math.round(fix.accuracy)} m</span>}
              </div>
            )}
          </>
        )}
      </section>

      {/* Status + action */}
      <section className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
        <div className="grid grid-cols-2 gap-2 text-sm">
          <Stamp label="Checked in" time={fmtTime(record?.checkInAt)} late={record?.isLate} />
          <Stamp label="Checked out" time={fmtTime(record?.checkOutAt)} />
        </div>

        {(!checkedIn || (checkedOut && win.canCheckIn)) && (
          <button
            onClick={() => run('in')}
            disabled={busy || !win.canCheckIn || (!anywhere && !target)}
            className="w-full h-14 rounded-2xl bg-brand-700 hover:bg-brand-800 text-white font-semibold text-base flex items-center justify-center gap-2 disabled:bg-slate-200 disabled:text-slate-500"
          >
            {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <LogIn className="w-5 h-5" />}
            {busy ? stepLabel[step] : checkIn.open ? (checkIn.isLate ? 'Check in now (late)' : 'Check in now') : `Check-in opens ${checkIn.from}`}
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
              disabled={busy || !win.canCheckOut || !reportOk}
              className="w-full h-14 rounded-2xl bg-ink hover:bg-brand-800 text-white font-semibold text-base flex items-center justify-center gap-2 disabled:bg-slate-200 disabled:text-slate-500"
            >
              {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <LogOut className="w-5 h-5" />}
              {busy
                ? stepLabel[step]
                : !checkOut.open
                  ? `Check-out opens ${checkOut.from}`
                  : !reportOk
                    ? 'Write your work report to check out'
                    : 'Check out now'}
            </button>
          </>
        )}

        {checkedOut && !win.canCheckIn && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-50 text-emerald-800 text-sm font-medium">
            <CheckCircle2 className="w-5 h-5" /> Attendance complete
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

function Stamp({ label, time, late }: { label: string; time: string; late?: boolean }) {
  return (
    <div className="rounded-xl bg-slate-50 p-3">
      <div className="text-xs text-slate-500">
        {label} {late && <span className="ml-1 px-1.5 rounded bg-amber-100 text-amber-800 font-semibold">late</span>}
      </div>
      <div className={`font-bold text-lg ${time ? 'text-ink' : 'text-slate-300'}`}>{time || '--:--'}</div>
    </div>
  );
}
