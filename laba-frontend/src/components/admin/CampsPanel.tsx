'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Loader2, Trash2, Edit2, Tent, X, Check, Users, Camera, MapPin } from 'lucide-react';
import { apiClient, apiErrorMessage } from '@/lib/api';
import { FenceValue, isBoundary } from '@/lib/geo';
import { categoryInfo, fmtDate, fmtIST, istToday } from '@/lib/staff';
import { GeofenceEditor } from '@/components/map/dynamic';

const input = 'w-full px-2.5 py-2 border border-[#E5E5E5] rounded-lg text-xs bg-white focus:outline-none focus:ring-1 focus:ring-black';

const emptyForm = () => ({
  name: '',
  description: '',
  branchId: '',
  campDate: istToday(),
  startTime: '09:00',
  endTime: '17:00',
  locationName: '',
  address: '',
  employeeIds: [] as string[],
});
const emptyFence = (): FenceValue => ({ latitude: 14.4673, longitude: 78.8242, radiusMetres: 200, shape: 'CIRCLE', boundary: null, boundaryLabel: null });

/** Camps: assigned staff can mark attendance only at the camp location and time. */
export function CampsPanel({ employees, branches }: { employees: any[]; branches: any[] }) {
  const [camps, setCamps] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState<ReturnType<typeof emptyForm> | null>(null);
  const [fence, setFence] = useState<FenceValue>(emptyFence());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [staffSearch, setStaffSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selfie, setSelfie] = useState<string | null>(null);

  const staff = useMemo(
    () => employees.filter((e) => e.status === 'ACTIVE' && (e.employeeType === 'OFFICE_STAFF' || e.employeeType === 'FIELD_STAFF')),
    [employees]
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setCamps((await apiClient.get('/camps')).data.data || []);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const openNew = () => {
    setEditingId(null);
    setForm(emptyForm());
    setFence(emptyFence());
  };

  const openEdit = (c: any) => {
    setEditingId(c.id);
    setForm({
      name: c.name,
      description: c.description || '',
      branchId: c.branchId || '',
      campDate: c.campDate,
      startTime: c.startTime,
      endTime: c.endTime,
      locationName: c.locationName,
      address: c.address || '',
      employeeIds: c.assignments.map((a: any) => a.employeeId),
    });
    setFence({
      latitude: c.latitude,
      longitude: c.longitude,
      radiusMetres: c.radiusMetres,
      shape: c.geofenceShape === 'POLYGON' && isBoundary(c.boundary) ? 'POLYGON' : 'CIRCLE',
      boundary: isBoundary(c.boundary) ? c.boundary : null,
      boundaryLabel: c.boundaryLabel,
    });
  };

  const save = async () => {
    if (!form) return;
    setError(null);
    if (fence.shape === 'POLYGON' && !fence.boundary) return setError('Pick or draw the camp boundary, or use a radius.');
    setSaving(true);
    try {
      const body = {
        ...form,
        branchId: form.branchId || null,
        description: form.description || null,
        address: form.address || null,
        latitude: fence.latitude,
        longitude: fence.longitude,
        radiusMetres: fence.radiusMetres,
        geofenceShape: fence.shape,
        boundary: fence.shape === 'POLYGON' ? fence.boundary : null,
        boundaryLabel: fence.shape === 'POLYGON' ? fence.boundaryLabel : null,
      };
      if (editingId) await apiClient.patch(`/camps/${editingId}`, body);
      else await apiClient.post('/camps', body);
      setForm(null);
      load();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (c: any) => {
    if (!confirm(`Delete camp "${c.name}"?`)) return;
    try {
      const res = await apiClient.delete(`/camps/${c.id}`);
      if (res.data.data?.message) alert(res.data.data.message);
      load();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  };

  const showSelfie = async (assignmentId: string) => {
    try {
      setSelfie((await apiClient.get(`/camps/assignments/${assignmentId}/selfie`)).data.data.selfie);
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  };

  const toggleStaff = (id: string) =>
    setForm((f) => f && { ...f, employeeIds: f.employeeIds.includes(id) ? f.employeeIds.filter((x) => x !== id) : [...f.employeeIds, id] });

  const q = staffSearch.trim().toLowerCase();
  const staffList = staff.filter((e) => !q || e.fullName.toLowerCase().includes(q) || e.employeeCode.toLowerCase().includes(q));

  return (
    <div className="space-y-4">
      <div className="bg-white border border-[#E5E5E5] rounded-xl p-4 flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-[200px]">
          <h3 className="font-semibold text-sm">Camp attendance</h3>
          <p className="text-[11px] text-[#737373]">Assigned staff can mark attendance only inside the camp geofence, from 30 min before start until the end time.</p>
        </div>
        <button onClick={openNew} className="px-3 py-2 bg-[#171717] text-white rounded-lg text-xs font-semibold flex items-center gap-1.5">
          <Plus className="w-3.5 h-3.5" /> New camp
        </button>
      </div>

      {error && <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-800">{error}</div>}

      {form && (
        <div className="bg-white border border-[#171717] rounded-xl p-4 space-y-3 text-xs">
          <div className="flex items-center justify-between">
            <div className="font-semibold text-sm">{editingId ? 'Edit camp' : 'New camp'}</div>
            <button onClick={() => setForm(null)} aria-label="Close">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <label className="col-span-2">
              <span className="block font-semibold mb-1">Camp name *</span>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Free BP & sugar camp" className={input} />
            </label>
            <label>
              <span className="block font-semibold mb-1">Date *</span>
              <input type="date" value={form.campDate} onChange={(e) => setForm({ ...form, campDate: e.target.value })} className={input} />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label>
                <span className="block font-semibold mb-1">From</span>
                <input type="time" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} className={input} />
              </label>
              <label>
                <span className="block font-semibold mb-1">To</span>
                <input type="time" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} className={input} />
              </label>
            </div>
            <label className="col-span-2">
              <span className="block font-semibold mb-1">Location name *</span>
              <input value={form.locationName} onChange={(e) => setForm({ ...form, locationName: e.target.value })} placeholder="Village / hall / landmark" className={input} />
            </label>
            <label className="col-span-2">
              <span className="block font-semibold mb-1">Organised by (optional)</span>
              <select value={form.branchId} onChange={(e) => setForm({ ...form, branchId: e.target.value })} className={input}>
                <option value="">—</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="col-span-2 sm:col-span-4">
              <span className="block font-semibold mb-1">Notes</span>
              <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className={input} />
            </label>
          </div>

          <div>
            <div className="font-semibold mb-1">Camp geofence</div>
            <GeofenceEditor value={fence} onChange={setFence} />
          </div>

          <div>
            <div className="font-semibold mb-1 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5" /> Assigned staff ({form.employeeIds.length})
            </div>
            <input value={staffSearch} onChange={(e) => setStaffSearch(e.target.value)} placeholder="Search staff" className={`${input} mb-2`} />
            <div className="max-h-48 overflow-y-auto border border-[#E5E5E5] rounded-lg divide-y divide-[#F5F5F4]">
              {staffList.map((e) => (
                <label key={e.id} className="flex items-center gap-2 px-3 py-1.5 hover:bg-[#FBFBFA]">
                  <input type="checkbox" checked={form.employeeIds.includes(e.id)} onChange={() => toggleStaff(e.id)} />
                  <span className="font-medium">{e.fullName}</span>
                  <span className="text-[#737373] font-mono">{e.employeeCode}</span>
                  <span className="text-[#A3A3A3] truncate">{categoryInfo(e.staffCategory)?.short ?? ''} {e.designation ? `· ${e.designation}` : ''}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex justify-end">
            <button
              onClick={save}
              disabled={saving || form.name.trim().length < 3 || form.locationName.trim().length < 2}
              className="px-4 py-2 bg-[#171717] text-white rounded-lg font-semibold flex items-center gap-1.5 disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} Save camp
            </button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {loading && camps.length === 0 && (
          <div className="p-10 flex justify-center">
            <Loader2 className="w-5 h-5 animate-spin" />
          </div>
        )}
        {!loading && camps.length === 0 && (
          <div className="bg-white border border-dashed border-[#D4D4D4] rounded-xl p-10 text-center text-xs text-[#737373]">No camps in the last week or next 60 days.</div>
        )}
        {camps.map((c) => (
          <div key={c.id} className={`bg-white border rounded-xl p-4 text-xs ${c.isCancelled ? 'border-dashed border-[#D4D4D4] opacity-60' : 'border-[#E5E5E5]'}`}>
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center flex-shrink-0">
                <Tent className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm text-[#171717]">
                  {c.name} {c.isCancelled && <span className="text-red-600 text-[10px]">CANCELLED</span>}
                </div>
                <div className="text-[#737373] flex flex-wrap gap-x-2">
                  <span>
                    {fmtDate(c.campDate)} · {c.startTime}–{c.endTime}
                  </span>
                  <span className="flex items-center gap-0.5">
                    <MapPin className="w-3 h-3" /> {c.locationName} · {c.geofenceShape === 'POLYGON' ? c.boundaryLabel || 'boundary' : `${c.radiusMetres} m`}
                  </span>
                </div>
              </div>
              {!c.isCancelled && (
                <>
                  <button onClick={() => openEdit(c)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg" aria-label="Edit camp">
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => remove(c)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg" aria-label="Delete camp">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </>
              )}
            </div>
            {c.assignments.length > 0 && (
              <div className="mt-3 grid sm:grid-cols-2 gap-1.5">
                {c.assignments.map((a: any) => (
                  <div key={a.id} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-[#F7F6F2]">
                    <span className="flex-1 truncate">
                      <strong>{a.employee.fullName}</strong> <span className="font-mono text-[#737373]">{a.employee.employeeCode}</span>
                    </span>
                    <span className={a.checkInAt ? 'text-emerald-700 font-semibold' : 'text-[#A3A3A3]'}>
                      {a.checkInAt ? `${fmtIST(a.checkInAt)}${a.checkOutAt ? `–${fmtIST(a.checkOutAt)}` : ''}` : 'not marked'}
                    </span>
                    {a.hasCheckInSelfie && (
                      <button onClick={() => showSelfie(a.id)} className="text-[#525252]" aria-label="Selfie">
                        <Camera className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {selfie && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => setSelfie(null)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={selfie} alt="Camp selfie" className="max-w-sm w-full rounded-xl" />
        </div>
      )}
    </div>
  );
}
