'use client';

import React, { useState } from 'react';
import {
  MapPin,
  Navigation,
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2,
  FileText,
  Hourglass,
  Send,
  ExternalLink,
  CalendarX,
} from 'lucide-react';
import { apiClient, apiErrorMessage } from '@/lib/api';
import { FenceMap } from '@/components/map/dynamic';
import { useAttendanceProof, stepLabel } from './useAttendanceProof';

const SURVEY_FIELDS: { key: string; label: string; type?: string; wide?: boolean }[] = [
  { key: 'outletName', label: 'Outlet / doctor name' },
  { key: 'outletType', label: 'Type (pharmacy, clinic…)' },
  { key: 'contactPerson', label: 'Contact person' },
  { key: 'contactMobile', label: 'Contact mobile', type: 'tel' },
  { key: 'productsDiscussed', label: 'Products discussed', wide: true },
  { key: 'orderValue', label: 'Order value (₹)', type: 'number' },
  { key: 'nextVisitDate', label: 'Next visit', type: 'date' },
  { key: 'competitorInfo', label: 'Competitor info', wide: true },
  { key: 'feedback', label: 'Feedback', wide: true },
];

const STATUS_STYLE: Record<string, { label: string; cls: string }> = {
  PENDING: { label: 'To visit', cls: 'bg-slate-100 text-slate-700' },
  VISITED: { label: 'Checked in', cls: 'bg-blue-50 text-blue-700' },
  COMPLETED: { label: 'Completed', cls: 'bg-emerald-50 text-emerald-700' },
  LATE_COMPLETED: { label: 'Completed late', cls: 'bg-amber-50 text-amber-700' },
  MISSED: { label: 'Deadline passed', cls: 'bg-red-50 text-red-700' },
  CANCELLED: { label: 'Cancelled', cls: 'bg-slate-100 text-slate-500' },
};

export function FieldTaskList({
  data,
  faceRequired,
  onChange,
  survey = false,
}: {
  data: any;
  faceRequired: boolean;
  onChange: () => void;
  /** Marketing executives record survey data when closing a stop. */
  survey?: boolean;
}) {
  const today: any[] = data?.today || [];
  const overdue: any[] = data?.overdue || [];
  const done = today.filter((t) => t.status === 'COMPLETED' || t.status === 'LATE_COMPLETED').length;
  const route = today.filter((t) => t.status !== 'CANCELLED');

  return (
    <div className="space-y-4">
      <section className="bg-white rounded-2xl border border-slate-200 p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs text-slate-500">Today&apos;s route</div>
            <div className="font-bold text-ink text-lg">
              {done} of {today.length} tasks done
            </div>
          </div>
          <div className="w-14 h-14 rounded-full border-4 border-brand-100 flex items-center justify-center font-bold text-brand-700">
            {today.length ? Math.round((done / today.length) * 100) : 0}%
          </div>
        </div>
        <p className="text-xs text-slate-500 mt-2">
          Go to each location, check in inside the allowed radius, then write what you did before the deadline. Your day ends when the last task is
          completed.
        </p>
        {route.length > 0 && (
          <div className="mt-3">
            <FenceMap
              heightClass="h-52"
              fences={route.map((t) => ({ ...t, shape: t.geofenceShape, label: `${t.sequence}. ${t.locationName}` }))}
              route={route.map((t) => ({
                latitude: t.latitude,
                longitude: t.longitude,
                label: `${t.sequence}. ${t.title}`,
                color: t.status === 'COMPLETED' || t.status === 'LATE_COMPLETED' ? '#059669' : t.displayStatus === 'MISSED' ? '#DC2626' : '#4338CA',
              }))}
            />
          </div>
        )}
      </section>

      {today.length === 0 && (
        <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-8 text-center text-slate-500">
          <CalendarX className="w-8 h-8 mx-auto mb-2 text-slate-400" />
          No tasks assigned for today. Check with your admin.
        </div>
      )}

      {today.map((t) => (
        <TaskCard key={t.id} task={t} faceRequired={faceRequired} onChange={onChange} survey={survey} />
      ))}

      {overdue.length > 0 && (
        <>
          <h3 className="text-sm font-semibold text-slate-700 pt-2">Unfinished tasks from earlier days</h3>
          {overdue.map((t) => (
            <TaskCard key={t.id} task={t} faceRequired={faceRequired} onChange={onChange} survey={survey} />
          ))}
        </>
      )}
    </div>
  );
}

function TaskCard({ task, faceRequired, onChange, survey }: { task: any; faceRequired: boolean; onChange: () => void; survey?: boolean }) {
  const { step, setStep, collect, faceModal } = useAttendanceProof();
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [lateReason, setLateReason] = useState('');
  const [showLate, setShowLate] = useState(false);
  const [sendingLate, setSendingLate] = useState(false);
  const busy = step !== 'idle';
  const style = STATUS_STYLE[task.displayStatus] || STATUS_STYLE.PENDING;
  const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${task.latitude},${task.longitude}`;

  const visit = async () => {
    setError(null);
    try {
      const proof = await collect({ face: faceRequired, faceTitle: `Verify at ${task.locationName}` });
      setStep('sending');
      await apiClient.post(`/field-tasks/${task.id}/visit`, proof);
      onChange();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setStep('idle');
    }
  };

  const complete = async () => {
    setError(null);
    try {
      const gps = await collect({ face: false, faceTitle: '' });
      setStep('sending');
      const filled = Object.fromEntries(Object.entries(answers).filter(([, v]) => v.trim() !== ''));
      await apiClient.post(`/field-tasks/${task.id}/complete`, {
        ...gps,
        completionNote: note,
        ...(survey && Object.keys(filled).length > 0 && { survey: filled }),
      });
      setNote('');
      setAnswers({});
      onChange();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setStep('idle');
    }
  };

  const requestLate = async () => {
    setError(null);
    setSendingLate(true);
    try {
      await apiClient.post(`/field-tasks/${task.id}/late-request`, { reason: lateReason });
      setShowLate(false);
      setLateReason('');
      onChange();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSendingLate(false);
    }
  };

  const deadlineLabel = new Date(task.deadlineAt).toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <article className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      {faceModal}
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-8 h-8 rounded-full bg-brand-700 text-white text-sm font-bold flex items-center justify-center flex-shrink-0">
              {task.sequence}
            </div>
            <div className="min-w-0">
              <h4 className="font-semibold text-ink leading-snug">{task.title}</h4>
              <div className="flex items-center gap-1 text-sm text-slate-600 mt-0.5">
                <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="truncate">{task.locationName}</span>
              </div>
            </div>
          </div>
          <span className={`text-[11px] font-semibold px-2 py-1 rounded-full whitespace-nowrap ${style.cls}`}>{style.label}</span>
        </div>

        {task.description && <p className="text-sm text-slate-600 mt-3 whitespace-pre-line">{task.description}</p>}

        <div className="flex flex-wrap gap-2 mt-3 text-xs">
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-100 text-slate-700">
            <Clock className="w-3.5 h-3.5" /> Due {deadlineLabel}
          </span>
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-100 text-slate-700">
            <Navigation className="w-3.5 h-3.5" />{' '}
            {task.geofenceShape === 'POLYGON' ? `Anywhere inside ${task.boundaryLabel || 'the boundary'}` : `Within ${task.radiusMetres} m`}
          </span>
          <a
            href={mapsUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-brand-50 text-brand-700 font-medium"
          >
            <ExternalLink className="w-3.5 h-3.5" /> Directions
          </a>
        </div>

        {task.lateAccessActive && (
          <div className="mt-3 text-xs p-2 rounded-lg bg-amber-50 text-amber-800">
            Late access approved until{' '}
            {new Date(task.lateAccessUntil).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' })}
          </div>
        )}
        {task.lateAccessStatus === 'REQUESTED' && (
          <div className="mt-3 text-xs p-2 rounded-lg bg-amber-50 text-amber-800 flex items-center gap-1.5">
            <Hourglass className="w-3.5 h-3.5" /> Late-access request sent. Waiting for admin.
          </div>
        )}
        {task.lateAccessStatus === 'REJECTED' && !task.lateAccessActive && (
          <div className="mt-3 text-xs p-2 rounded-lg bg-red-50 text-red-800">
            Late access rejected{task.lateReviewNote ? `: ${task.lateReviewNote}` : ''}
          </div>
        )}

        {task.completionNote && (
          <div className="mt-3 p-3 rounded-xl bg-emerald-50 text-sm text-emerald-900">
            <div className="flex items-center gap-1.5 font-semibold text-emerald-800 text-xs mb-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> Your note
            </div>
            {task.completionNote}
          </div>
        )}
      </div>

      {/* Actions */}
      {(task.canVisit || task.canComplete || task.canRequestLate) && (
        <div className="border-t border-slate-100 p-4 space-y-3 bg-slate-50/60">
          {task.canVisit && (
            <button
              onClick={visit}
              disabled={busy}
              className="w-full h-12 rounded-xl bg-brand-700 hover:bg-brand-800 text-white font-semibold flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <MapPin className="w-5 h-5" />}
              {busy ? stepLabel[step] : "I'm here – check in"}
            </button>
          )}

          {task.canComplete && (
            <>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                maxLength={2000}
                placeholder="What did you do at this location? (min 10 characters)"
                className="w-full rounded-xl border border-slate-300 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
              {survey && (
                <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-3 space-y-2">
                  <div className="text-xs font-semibold text-blue-900">Survey (optional)</div>
                  <div className="grid grid-cols-2 gap-2">
                    {SURVEY_FIELDS.map((f) => (
                      <input
                        key={f.key}
                        type={f.type || 'text'}
                        inputMode={f.type === 'tel' ? 'tel' : f.type === 'number' ? 'decimal' : undefined}
                        value={answers[f.key] || ''}
                        onChange={(e) => setAnswers((a) => ({ ...a, [f.key]: e.target.value }))}
                        placeholder={f.label}
                        aria-label={f.label}
                        className={`${f.wide ? 'col-span-2' : ''} w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white`}
                      />
                    ))}
                  </div>
                </div>
              )}
              <button
                onClick={complete}
                disabled={busy || note.trim().length < 10}
                className="w-full h-12 rounded-xl bg-ink hover:bg-brand-800 text-white font-semibold flex items-center justify-center gap-2 disabled:opacity-40"
              >
                {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <FileText className="w-5 h-5" />}
                {busy ? stepLabel[step] : 'Submit task note'}
              </button>
            </>
          )}

          {task.canRequestLate &&
            (showLate ? (
              <>
                <textarea
                  value={lateReason}
                  onChange={(e) => setLateReason(e.target.value)}
                  rows={2}
                  maxLength={1000}
                  placeholder="Why are you late? (min 10 characters)"
                  className="w-full rounded-xl border border-slate-300 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
                <button
                  onClick={requestLate}
                  disabled={sendingLate || lateReason.trim().length < 10}
                  className="w-full h-12 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-semibold flex items-center justify-center gap-2 disabled:opacity-40"
                >
                  {sendingLate ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                  Send late-access request
                </button>
              </>
            ) : (
              <button
                onClick={() => setShowLate(true)}
                className="w-full h-12 rounded-xl border-2 border-amber-500 text-amber-700 font-semibold flex items-center justify-center gap-2"
              >
                <Hourglass className="w-5 h-5 flex-shrink-0" /> Ask admin for late access
              </button>
            ))}

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
