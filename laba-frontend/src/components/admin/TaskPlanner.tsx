'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Trash2, Copy, Loader2, MapPin, Clock, Navigation, CheckCircle2, X, Image as ImageIcon } from 'lucide-react';
import { apiClient, apiErrorMessage } from '@/lib/api';
import { GeofenceEditor, FenceMap } from '@/components/map/dynamic';
import { FenceValue } from '@/lib/geo';
import { categoryInfo } from '@/lib/staff';


const istToday = () => new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10);
const shiftDate = (d: string, days: number) => new Date(new Date(`${d}T00:00:00Z`).getTime() + days * 86400_000).toISOString().slice(0, 10);

const STATUS: Record<string, string> = {
  PENDING: 'bg-slate-100 text-slate-700',
  VISITED: 'bg-blue-50 text-blue-700',
  COMPLETED: 'bg-emerald-50 text-emerald-700',
  LATE_COMPLETED: 'bg-amber-50 text-amber-700',
  MISSED: 'bg-red-50 text-red-700',
  CANCELLED: 'bg-slate-100 text-slate-400 line-through',
};

const emptyForm = {
  title: '',
  description: '',
  locationName: '',
  address: '',
  latitude: 14.4673,
  longitude: 78.8242,
  radiusMetres: 100,
  shape: 'CIRCLE' as FenceValue['shape'],
  boundary: null as FenceValue['boundary'],
  boundaryLabel: null as string | null,
  deadlineTime: '17:00',
};

export function TaskPlanner({ employees, initialEmployeeId }: { employees: any[]; initialEmployeeId?: string }) {
  const fieldStaff = useMemo(() => employees.filter((e) => e.employeeType === 'FIELD_STAFF' && e.status === 'ACTIVE'), [employees]);
  const [showRoute, setShowRoute] = useState(true);
  const [date, setDate] = useState(istToday());
  const [employeeId, setEmployeeId] = useState(initialEmployeeId || '');
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selfie, setSelfie] = useState<string | null>(null);

  useEffect(() => {
    if (initialEmployeeId) setEmployeeId(initialEmployeeId);
  }, [initialEmployeeId]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const q = new URLSearchParams({ date, ...(employeeId ? { employeeId } : {}) });
      const res = await apiClient.get(`/field-tasks?${q}`);
      setTasks(res.data.data || []);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [date, employeeId]);

  useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    setError(null);
    setSaving(true);
    try {
      const { shape, ...rest } = form;
      await apiClient.post('/field-tasks', {
        employeeId,
        taskDate: date,
        ...rest,
        geofenceShape: shape,
        boundary: shape === 'POLYGON' ? form.boundary : null,
        boundaryLabel: shape === 'POLYGON' ? form.boundaryLabel : null,
        description: form.description || undefined,
        address: form.address || undefined,
      });
      setForm((f) => ({ ...emptyForm, latitude: f.latitude, longitude: f.longitude, radiusMetres: f.radiusMetres, shape: f.shape, boundary: f.boundary, boundaryLabel: f.boundaryLabel, deadlineTime: f.deadlineTime }));
      setShowForm(false);
      load();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (t: any) => {
    const msg = t.status === 'PENDING' ? `Delete task "${t.title}"?` : `"${t.title}" has activity. Cancel it (kept for records)?`;
    if (!window.confirm(msg)) return;
    try {
      await apiClient.delete(`/field-tasks/${t.id}`);
      load();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  };

  const copyPrevious = async () => {
    if (!employeeId) return;
    const from = shiftDate(date, -1);
    if (!window.confirm(`Copy all tasks from ${from} to ${date} for this employee?`)) return;
    try {
      await apiClient.post('/field-tasks/copy', { employeeId, fromDate: from, toDate: date });
      load();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  };

  const viewSelfie = async (id: string) => {
    try {
      const res = await apiClient.get(`/field-tasks/${id}/selfie`);
      setSelfie(res.data.data.selfie);
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  };

  const grouped = useMemo(() => {
    const map = new Map<string, { employee: any; tasks: any[] }>();
    for (const t of tasks) {
      const g = map.get(t.employeeId) || { employee: t.employee, tasks: [] };
      g.tasks.push(t);
      map.set(t.employeeId, g);
    }
    return Array.from(map.values());
  }, [tasks]);

  const valid = employeeId && form.title.trim().length >= 3 && form.locationName.trim().length >= 2 && (form.shape === 'CIRCLE' || !!form.boundary);

  return (
    <div className="space-y-4">
      {/* Controls */}
      <section className="bg-white border border-[#E2E8F0] rounded-xl p-4 flex flex-col md:flex-row md:items-end gap-3">
        <label className="block">
          <span className="text-xs font-semibold text-[#475569]">Date</span>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="mt-1 h-10 px-3 text-sm border border-[#E2E8F0] rounded-lg block" />
        </label>
        <label className="block flex-1">
          <span className="text-xs font-semibold text-[#475569]">Field staff</span>
          <select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} className="mt-1 h-10 px-3 text-sm border border-[#E2E8F0] rounded-lg w-full bg-white">
            <option value="">All field staff</option>
            {fieldStaff.map((e) => (
              <option key={e.id} value={e.id}>
                {e.fullName} ({e.employeeCode})
              </option>
            ))}
          </select>
        </label>
        <div className="flex gap-2">
          <button
            onClick={copyPrevious}
            disabled={!employeeId}
            className="h-10 px-3 rounded-lg border border-[#E2E8F0] text-xs font-semibold text-ink inline-flex items-center gap-1.5 disabled:opacity-40"
            title="Copy previous day's tasks"
          >
            <Copy className="w-3.5 h-3.5" /> Copy previous day
          </button>
          <button onClick={() => setShowRoute((v) => !v)} className="h-10 px-3 rounded-lg border border-[#E2E8F0] text-xs font-semibold">
            {showRoute ? 'Hide' : 'Show'} route maps
          </button>
          <button
            onClick={() => setShowForm(true)}
            disabled={!employeeId}
            className="h-10 px-3 rounded-lg bg-brand-700 hover:bg-brand-800 text-white text-xs font-semibold inline-flex items-center gap-1.5 disabled:opacity-40"
          >
            <Plus className="w-4 h-4" /> Add task
          </button>
        </div>
      </section>
      {!employeeId && <p className="text-xs text-[#64748B]">Select a field staff member to add or copy tasks.</p>}
      {error && <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800">{error}</div>}

      {/* Add task form */}
      {showForm && (
        <section className="bg-white border-2 border-brand-200 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm">New task for {fieldStaff.find((e) => e.id === employeeId)?.fullName} on {date}</h3>
            <button onClick={() => setShowForm(false)} className="p-1 rounded hover:bg-[#EEF2F7]">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="grid md:grid-cols-2 gap-3">
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Task title, e.g. Stock audit at Sri Sai Medicals" className="h-10 px-3 text-sm border border-[#E2E8F0] rounded-lg" />
            <input value={form.locationName} onChange={(e) => setForm({ ...form, locationName: e.target.value })} placeholder="Location name" className="h-10 px-3 text-sm border border-[#E2E8F0] rounded-lg" />
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="What should the staff do? (optional)" rows={2} className="md:col-span-2 px-3 py-2 text-sm border border-[#E2E8F0] rounded-lg" />
            <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Address (optional)" className="md:col-span-2 h-10 px-3 text-sm border border-[#E2E8F0] rounded-lg" />
          </div>

          <label className="block max-w-xs">
            <span className="text-xs font-semibold text-[#475569]">Deadline (IST)</span>
            <input type="time" value={form.deadlineTime} onChange={(e) => setForm({ ...form, deadlineTime: e.target.value })} className="mt-1 h-10 px-3 text-sm border border-[#E2E8F0] rounded-lg w-full" />
          </label>

          <div>
            <div className="text-xs font-semibold text-[#475569] mb-1">Stop geofence: a radius around the outlet, or the exact village / area boundary</div>
            <GeofenceEditor
              value={{ latitude: form.latitude, longitude: form.longitude, radiusMetres: form.radiusMetres, shape: form.shape, boundary: form.boundary, boundaryLabel: form.boundaryLabel }}
              onChange={(v) => setForm((f) => ({ ...f, ...v, locationName: f.locationName || (v.shape === 'POLYGON' && v.boundaryLabel ? v.boundaryLabel : f.locationName) }))}
              maxRadius={2000}
              polygonHint="The executive can check in anywhere inside this area."
            />
          </div>

          <div className="flex justify-end gap-2">
            <button onClick={() => setShowForm(false)} className="h-10 px-4 rounded-lg border border-[#E2E8F0] text-xs font-semibold">
              Cancel
            </button>
            <button onClick={save} disabled={!valid || saving} className="h-10 px-4 rounded-lg bg-brand-700 hover:bg-brand-800 text-white text-xs font-semibold inline-flex items-center gap-1.5 disabled:opacity-40">
              {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Save task
            </button>
          </div>
        </section>
      )}

      {/* Task list */}
      {loading ? (
        <div className="p-8 flex justify-center">
          <Loader2 className="w-5 h-5 animate-spin text-[#64748B]" />
        </div>
      ) : grouped.length === 0 ? (
        <div className="bg-white border border-dashed border-[#CBD5E1] rounded-xl p-10 text-center text-sm text-[#64748B]">No tasks on {date}.</div>
      ) : (
        grouped.map(({ employee, tasks: list }) => {
          const done = list.filter((t) => t.status === 'COMPLETED' || t.status === 'LATE_COMPLETED').length;
          return (
            <section key={employee.id} className="bg-white border border-[#E2E8F0] rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-[#E2E8F0] flex items-center justify-between">
                <div className="font-semibold text-sm">
                  {employee.fullName} <span className="font-mono text-xs text-[#64748B]">{employee.employeeCode}</span>
                  <span className="ml-1 text-[11px] font-normal text-[#64748B]">{categoryInfo(employees.find((e) => e.id === employee.id)?.staffCategory)?.label ?? ''}</span>
                </div>
                <span className="text-xs text-[#64748B]">
                  {done}/{list.length} completed
                </span>
              </div>
              {showRoute && (
                <div className="p-3 border-b border-[#EEF2F7]">
                  <FenceMap
                    heightClass="h-60"
                    fences={list.filter((t) => t.status !== 'CANCELLED').map((t) => ({ ...t, shape: t.geofenceShape, label: `${t.sequence}. ${t.locationName}` }))}
                    route={list
                      .filter((t) => t.status !== 'CANCELLED')
                      .map((t) => ({ latitude: t.latitude, longitude: t.longitude, label: `${t.sequence}. ${t.title}`, color: t.status === 'COMPLETED' || t.status === 'LATE_COMPLETED' ? '#059669' : t.displayStatus === 'MISSED' ? '#DC2626' : '#4338CA' }))}
                  />
                </div>
              )}
              <ul className="divide-y divide-[#EEF2F7]">
                {list.map((t) => (
                  <li key={t.id} className="p-4 flex flex-col md:flex-row gap-3">
                    <div className="w-7 h-7 rounded-full bg-brand-700 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">{t.sequence}</div>
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-sm">{t.title}</span>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${STATUS[t.displayStatus] || STATUS.PENDING}`}>{t.displayStatus.replace('_', ' ')}</span>
                        {t.lateAccessStatus !== 'NONE' && <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">Late access: {t.lateAccessStatus}</span>}
                      </div>
                      <div className="text-xs text-[#64748B] flex flex-wrap gap-x-3 gap-y-1">
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="w-3 h-3" /> {t.locationName}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Navigation className="w-3 h-3" /> {t.geofenceShape === 'POLYGON' ? `inside ${t.boundaryLabel || 'boundary'}` : `${t.radiusMetres} m`}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Clock className="w-3 h-3" /> by {t.deadlineTime}
                        </span>
                        {t.visitedAt && (
                          <span className="inline-flex items-center gap-1 text-blue-700">
                            Visited {new Date(t.visitedAt).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' })} · {Math.round(Number(t.visitDistanceMetres))} m
                            {t.visitFaceScore ? ` · face ${Math.round(t.visitFaceScore * 100)}%` : ''}
                          </span>
                        )}
                      </div>
                      {t.surveyData && (
                        <div className="text-[11px] bg-blue-50 text-blue-900 rounded-lg p-2 grid sm:grid-cols-2 gap-x-3">
                          {Object.entries(t.surveyData).map(([k, v]) => (
                            <div key={k}>
                              <span className="text-blue-700">{k.replace(/([A-Z])/g, ' $1').toLowerCase()}:</span> {String(v)}
                            </div>
                          ))}
                        </div>
                      )}
                      {t.completionNote && (
                        <div className="text-xs bg-emerald-50 text-emerald-900 rounded-lg p-2 flex gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" /> {t.completionNote}
                        </div>
                      )}
                    </div>
                    <div className="flex md:flex-col gap-2 md:items-end">
                      {t.hasVisitSelfie && (
                        <button onClick={() => viewSelfie(t.id)} className="h-8 px-2 rounded-lg border border-[#E2E8F0] text-xs inline-flex items-center gap-1">
                          <ImageIcon className="w-3.5 h-3.5" /> Selfie
                        </button>
                      )}
                      {t.status !== 'CANCELLED' && t.status !== 'COMPLETED' && t.status !== 'LATE_COMPLETED' && (
                        <button onClick={() => remove(t)} className="h-8 px-2 rounded-lg border border-red-200 bg-red-50 text-red-700 text-xs inline-flex items-center gap-1">
                          <Trash2 className="w-3.5 h-3.5" /> {t.status === 'PENDING' ? 'Delete' : 'Cancel'}
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          );
        })
      )}

      {selfie && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => setSelfie(null)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={selfie} alt="Visit selfie" className="max-w-xs w-full rounded-xl border-4 border-white" />
        </div>
      )}
    </div>
  );
}
