'use client';

import React, { useState } from 'react';
import { Tent, MapPin, Clock, Loader2, LogIn, LogOut, CheckCircle2, AlertCircle, ExternalLink } from 'lucide-react';
import { apiClient, apiErrorMessage } from '@/lib/api';
import { fmtDate, fmtIST } from '@/lib/staff';
import { FenceMap } from '@/components/map/dynamic';
import { useAttendanceProof, stepLabel } from './useAttendanceProof';

const STATUS: Record<string, { label: string; cls: string }> = {
  UPCOMING: { label: 'Upcoming', cls: 'bg-slate-100 text-slate-700' },
  OPEN: { label: 'Open now', cls: 'bg-brand-50 text-brand-700' },
  AT_CAMP: { label: 'Checked in', cls: 'bg-blue-50 text-blue-700' },
  DONE: { label: 'Done', cls: 'bg-emerald-50 text-emerald-700' },
  MISSED: { label: 'Missed', cls: 'bg-red-50 text-red-700' },
  CANCELLED: { label: 'Cancelled', cls: 'bg-slate-100 text-slate-500' },
};

/** Camps the staff member is assigned to. Attendance only at the camp location and time. */
export function CampList({ camps, faceRequired, onChange }: { camps: any[]; faceRequired: boolean; onChange: () => void }) {
  if (camps.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-8 text-center text-slate-500 text-sm">
        <Tent className="w-8 h-8 mx-auto mb-2 text-slate-400" />
        You are not assigned to any camp right now.
      </div>
    );
  }
  return (
    <div className="space-y-4">
      {camps.map((c) => (
        <CampCard key={c.id} camp={c} faceRequired={faceRequired} onChange={onChange} />
      ))}
    </div>
  );
}

function CampCard({ camp, faceRequired, onChange }: { camp: any; faceRequired: boolean; onChange: () => void }) {
  const { step, setStep, collect, faceModal } = useAttendanceProof();
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState('');
  const busy = step !== 'idle';
  const st = STATUS[camp.status] ?? STATUS.UPCOMING;

  const act = async (kind: 'in' | 'out') => {
    setError(null);
    try {
      const proof = await collect({ face: faceRequired, faceTitle: `Verify at ${camp.name}` });
      setStep('sending');
      await apiClient.post(`/camps/${camp.id}/${kind === 'in' ? 'check-in' : 'check-out'}`, kind === 'in' ? proof : { ...proof, report });
      setReport('');
      onChange();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setStep('idle');
    }
  };

  return (
    <article className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      {faceModal}
      <div className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h4 className="font-semibold text-ink">{camp.name}</h4>
            <div className="text-sm text-slate-600 flex items-center gap-1 mt-0.5">
              <MapPin className="w-3.5 h-3.5 flex-shrink-0" /> <span className="truncate">{camp.locationName}</span>
            </div>
            <div className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
              <Clock className="w-3.5 h-3.5" /> {fmtDate(camp.campDate)} · {camp.startTime}–{camp.endTime}
            </div>
          </div>
          <span className={`text-[11px] font-semibold px-2 py-1 rounded-full whitespace-nowrap ${st.cls}`}>{st.label}</span>
        </div>
        {camp.description && <p className="text-sm text-slate-600">{camp.description}</p>}
        <FenceMap heightClass="h-44" fences={[{ ...camp, shape: camp.geofenceShape, label: camp.locationName }]} />
        <a
          href={`https://www.google.com/maps/dir/?api=1&destination=${camp.latitude},${camp.longitude}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-xs font-medium text-brand-700"
        >
          <ExternalLink className="w-3.5 h-3.5" /> Directions
        </a>
        {camp.checkInAt && (
          <div className="text-xs text-slate-600">
            In {fmtIST(camp.checkInAt)}
            {camp.checkOutAt && ` · Out ${fmtIST(camp.checkOutAt)}`}
          </div>
        )}
        {camp.report && (
          <div className="p-3 rounded-xl bg-emerald-50 text-sm text-emerald-900 flex gap-1.5">
            <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" /> {camp.report}
          </div>
        )}
      </div>

      {(camp.canCheckIn || camp.canCheckOut) && (
        <div className="border-t border-slate-100 p-4 space-y-3 bg-slate-50/60">
          {camp.canCheckIn && (
            <button
              onClick={() => act('in')}
              disabled={busy}
              className="w-full h-12 rounded-xl bg-brand-700 text-white font-semibold flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <LogIn className="w-5 h-5" />}
              {busy ? stepLabel[step] : "I'm at the camp – check in"}
            </button>
          )}
          {camp.canCheckOut && (
            <>
              <textarea
                value={report}
                onChange={(e) => setReport(e.target.value)}
                rows={2}
                maxLength={2000}
                placeholder="Camp report, e.g. 120 patients screened"
                className="w-full rounded-xl border border-slate-300 p-3 text-sm"
              />
              <button
                onClick={() => act('out')}
                disabled={busy || report.trim().length < 5}
                className="w-full h-12 rounded-xl bg-ink text-white font-semibold flex items-center justify-center gap-2 disabled:opacity-40"
              >
                {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <LogOut className="w-5 h-5" />}
                {busy ? stepLabel[step] : 'Check out of camp'}
              </button>
            </>
          )}
          {error && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-800 flex gap-2">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>
      )}
    </article>
  );
}
