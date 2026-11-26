'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Plus, Loader2, Trash2, Edit2, Clock, X, Check } from 'lucide-react';
import { apiClient, apiErrorMessage } from '@/lib/api';

const empty = {
  name: '',
  branchId: '',
  startTime: '09:00',
  endTime: '17:00',
  checkInBeforeMinutes: 30,
  lateGraceMinutes: 15,
  checkInAfterMinutes: 60,
  checkOutBeforeMinutes: 15,
  checkOutAfterMinutes: 120,
  isActive: true,
};

const input = 'w-full px-2.5 py-2 border border-[#E5E5E5] rounded-lg text-xs bg-white focus:outline-none focus:ring-1 focus:ring-black';
const addMin = (t: string, m: number) => {
  const [h, mm] = t.split(':').map(Number);
  const total = (((h * 60 + mm + m) % 1440) + 1440) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
};

/** Shift master for shift-wise attendance (pharmacy hubs & shops, labs, any location). */
export function ShiftsPanel({ branches }: { branches: any[] }) {
  const [shifts, setShifts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState<typeof empty | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setShifts((await apiClient.get('/shifts')).data.data || []);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    if (!form) return;
    setSaving(true);
    setError(null);
    try {
      const body = { ...form, branchId: form.branchId || null };
      if (editingId) await apiClient.patch(`/shifts/${editingId}`, body);
      else await apiClient.post('/shifts', body);
      setForm(null);
      setEditingId(null);
      load();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (s: any) => {
    if (!confirm(`Delete shift "${s.name}"? ${s.employeeCount} staff on it will fall back to the organisation windows.`)) return;
    try {
      await apiClient.delete(`/shifts/${s.id}`);
      load();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  };

  const num = (k: keyof typeof empty) => (
    <input
      type="number"
      min={0}
      value={form ? (form[k] as number) : 0}
      onChange={(e) => setForm((f) => f && { ...f, [k]: Number(e.target.value) })}
      className={input}
    />
  );

  return (
    <div className="space-y-4">
      <div className="bg-white border border-[#E5E5E5] rounded-xl p-4 flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-[200px]">
          <h3 className="font-semibold text-sm">Shifts</h3>
          <p className="text-[11px] text-[#737373]">
            Shift-wise attendance for pharmacy hub & shop staff and laboratory staff. Assign a shift on the employee. Overnight shifts (e.g. 22:00–06:00) are supported.
          </p>
        </div>
        <button
          onClick={() => {
            setForm({ ...empty });
            setEditingId(null);
          }}
          className="px-3 py-2 bg-[#171717] text-white rounded-lg text-xs font-semibold flex items-center gap-1.5"
        >
          <Plus className="w-3.5 h-3.5" /> New shift
        </button>
      </div>

      {error && <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-800">{error}</div>}

      {form && (
        <div className="bg-white border border-[#171717] rounded-xl p-4 space-y-3 text-xs">
          <div className="flex items-center justify-between">
            <div className="font-semibold text-sm">{editingId ? 'Edit shift' : 'New shift'}</div>
            <button onClick={() => setForm(null)} aria-label="Close">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <label className="col-span-2">
              <span className="block font-semibold mb-1">Name *</span>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Morning / Evening / Night" className={input} />
            </label>
            <label>
              <span className="block font-semibold mb-1">Start *</span>
              <input type="time" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} className={input} />
            </label>
            <label>
              <span className="block font-semibold mb-1">End *</span>
              <input type="time" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} className={input} />
            </label>
            <label className="col-span-2 sm:col-span-4">
              <span className="block font-semibold mb-1">Location (optional)</span>
              <select value={form.branchId} onChange={(e) => setForm({ ...form, branchId: e.target.value })} className={input}>
                <option value="">Any location</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className="block font-semibold mb-1">Check-in opens (min before)</span>
              {num('checkInBeforeMinutes')}
            </label>
            <label>
              <span className="block font-semibold mb-1">Late after (min)</span>
              {num('lateGraceMinutes')}
            </label>
            <label>
              <span className="block font-semibold mb-1">Check-in closes (min after)</span>
              {num('checkInAfterMinutes')}
            </label>
            <label>
              <span className="block font-semibold mb-1">Check-out opens (min before end)</span>
              {num('checkOutBeforeMinutes')}
            </label>
            <label>
              <span className="block font-semibold mb-1">Check-out closes (min after end)</span>
              {num('checkOutAfterMinutes')}
            </label>
            <label className="flex items-center gap-2 col-span-2 sm:col-span-3 pt-5">
              <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} /> Active
            </label>
          </div>
          <div className="p-2.5 rounded-lg bg-[#F7F6F2] text-[11px] text-[#404040]">
            Check-in allowed <strong>{addMin(form.startTime, -form.checkInBeforeMinutes)}–{addMin(form.startTime, form.checkInAfterMinutes)}</strong>, marked late after{' '}
            <strong>{addMin(form.startTime, form.lateGraceMinutes)}</strong>. Check-out allowed{' '}
            <strong>{addMin(form.endTime, -form.checkOutBeforeMinutes)}–{addMin(form.endTime, form.checkOutAfterMinutes)}</strong> IST.
          </div>
          <div className="flex justify-end">
            <button onClick={save} disabled={saving || form.name.trim().length < 2} className="px-4 py-2 bg-[#171717] text-white rounded-lg font-semibold flex items-center gap-1.5 disabled:opacity-50">
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} Save shift
            </button>
          </div>
        </div>
      )}

      <div className="bg-white border border-[#E5E5E5] rounded-xl divide-y divide-[#F0EFEB]">
        {loading && shifts.length === 0 && (
          <div className="p-10 flex justify-center">
            <Loader2 className="w-5 h-5 animate-spin" />
          </div>
        )}
        {!loading && shifts.length === 0 && <div className="p-10 text-center text-xs text-[#737373]">No shifts yet.</div>}
        {shifts.map((s) => (
          <div key={s.id} className="p-3 sm:p-4 flex items-center gap-3">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${s.isActive ? 'bg-brand-50 text-brand-700' : 'bg-slate-100 text-slate-400'}`}>
              <Clock className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0 text-xs">
              <div className="font-semibold text-[#171717]">
                {s.name} <span className="font-mono font-normal">{s.startTime}–{s.endTime}</span>
                {!s.isActive && <span className="ml-1 text-[10px] text-slate-500">(inactive)</span>}
              </div>
              <div className="text-[11px] text-[#737373]">
                {s.branch ? s.branch.name : 'Any location'} · {s.employeeCount} staff · in {addMin(s.startTime, -s.checkInBeforeMinutes)}–{addMin(s.startTime, s.checkInAfterMinutes)}, late
                after {addMin(s.startTime, s.lateGraceMinutes)}
              </div>
            </div>
            <button
              onClick={() => {
                setEditingId(s.id);
                setForm({
                  name: s.name,
                  branchId: s.branchId || '',
                  startTime: s.startTime,
                  endTime: s.endTime,
                  checkInBeforeMinutes: s.checkInBeforeMinutes,
                  lateGraceMinutes: s.lateGraceMinutes,
                  checkInAfterMinutes: s.checkInAfterMinutes,
                  checkOutBeforeMinutes: s.checkOutBeforeMinutes,
                  checkOutAfterMinutes: s.checkOutAfterMinutes,
                  isActive: s.isActive,
                });
              }}
              className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
              aria-label="Edit shift"
            >
              <Edit2 className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => remove(s)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg" aria-label="Delete shift">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
