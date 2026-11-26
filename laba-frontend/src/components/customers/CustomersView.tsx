'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Plus, Loader2, Search, Phone, MapPin, X, Check, Trash2, Navigation, Map as MapIcon, List } from 'lucide-react';
import { apiClient, apiErrorMessage } from '@/lib/api';
import { getCurrentFix } from '@/lib/location';
import { FenceMap } from '@/components/map/dynamic';

const TYPES = ['Pharmacy', 'Clinic', 'Hospital', 'Doctor', 'Diagnostic centre', 'Distributor', 'Other'];
const empty = { name: '', customerType: 'Pharmacy', contactPerson: '', mobile: '', address: '', notes: '', latitude: null as number | null, longitude: null as number | null, branchId: '' };

/**
 * Customer data for sales executives (their DC's customers) and admins (all DCs).
 * `admin` shows the DC filter and delete.
 */
export function CustomersView({ admin = false, branches = [] }: { admin?: boolean; branches?: any[] }) {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [branchId, setBranchId] = useState('');
  const [form, setForm] = useState<typeof empty | null>(null);
  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<'list' | 'map'>('list');

  const dcs = branches.filter((b) => b.locationType === 'DISTRIBUTION_CENTER');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const q = new URLSearchParams({ ...(search.trim() && { search: search.trim() }), ...(admin && branchId && { branchId }) });
      setItems((await apiClient.get(`/customers?${q}`)).data.data || []);
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not load customers.'));
    } finally {
      setLoading(false);
    }
  }, [search, branchId, admin]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  const useGps = async () => {
    if (!form) return;
    setLocating(true);
    try {
      const fix = await getCurrentFix();
      setForm((f) => f && { ...f, latitude: fix.latitude, longitude: fix.longitude });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLocating(false);
    }
  };

  const save = async () => {
    if (!form) return;
    setSaving(true);
    setError(null);
    try {
      await apiClient.post('/customers', {
        ...form,
        mobile: form.mobile.replace(/\D/g, '').slice(-10) || null,
        branchId: admin ? form.branchId || null : undefined,
      });
      setForm(null);
      load();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (c: any) => {
    if (!confirm(`Delete customer ${c.name}?`)) return;
    try {
      await apiClient.delete(`/customers/${c.id}`);
      load();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  };

  const field = 'w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500';
  const located = items.filter((c) => c.latitude != null && c.longitude != null);

  return (
    <div className="space-y-3">
      <div className="bg-white rounded-2xl border border-slate-200 p-3 space-y-2">
        <div className="flex items-center gap-2">
          <div className="flex-1 flex items-center gap-2 px-3 border border-slate-200 rounded-xl">
            <Search className="w-4 h-4 text-slate-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search customers" className="flex-1 py-2.5 text-sm focus:outline-none" />
          </div>
          <button onClick={() => setView(view === 'list' ? 'map' : 'list')} className="p-2.5 rounded-xl border border-slate-200" aria-label="Toggle map">
            {view === 'list' ? <MapIcon className="w-4 h-4" /> : <List className="w-4 h-4" />}
          </button>
          <button onClick={() => setForm({ ...empty })} className="p-2.5 rounded-xl bg-brand-700 text-white" aria-label="Add customer">
            <Plus className="w-4 h-4" />
          </button>
        </div>
        {admin && (
          <select value={branchId} onChange={(e) => setBranchId(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm bg-white">
            <option value="">All distribution centres</option>
            {dcs.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {error && <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-800">{error}</div>}

      {form && (
        <div className="bg-white rounded-2xl border-2 border-brand-600 p-4 space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="font-semibold">New customer</div>
            <button onClick={() => setForm(null)} aria-label="Close">
              <X className="w-5 h-5" />
            </button>
          </div>
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Shop / clinic name *" className={field} />
          <div className="grid grid-cols-2 gap-2">
            <select value={form.customerType} onChange={(e) => setForm({ ...form, customerType: e.target.value })} className={field}>
              {TYPES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
            <input value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value })} placeholder="Mobile" inputMode="tel" className={field} />
          </div>
          <input value={form.contactPerson} onChange={(e) => setForm({ ...form, contactPerson: e.target.value })} placeholder="Contact person" className={field} />
          <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Address" className={field} />
          {admin && (
            <select value={form.branchId} onChange={(e) => setForm({ ...form, branchId: e.target.value })} className={field}>
              <option value="">Distribution centre…</option>
              {dcs.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          )}
          <button type="button" onClick={useGps} className="w-full py-2.5 rounded-xl border border-slate-300 text-sm flex items-center justify-center gap-2">
            {locating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Navigation className="w-4 h-4" />}
            {form.latitude != null ? `Location saved (${form.latitude.toFixed(5)}, ${form.longitude!.toFixed(5)})` : 'Use my current location'}
          </button>
          <input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Notes" className={field} />
          <button
            onClick={save}
            disabled={saving || form.name.trim().length < 2}
            className="w-full h-12 rounded-xl bg-brand-700 text-white font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />} Save customer
          </button>
        </div>
      )}

      {view === 'map' ? (
        <FenceMap heightClass="h-96" points={located.map((c) => ({ latitude: c.latitude, longitude: c.longitude, label: c.name }))} />
      ) : (
        <div className="space-y-2">
          {loading && items.length === 0 && (
            <div className="py-10 flex justify-center">
              <Loader2 className="w-5 h-5 animate-spin" />
            </div>
          )}
          {!loading && items.length === 0 && <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">No customers yet.</div>}
          {items.map((c) => (
            <div key={c.id} className="bg-white rounded-2xl border border-slate-200 p-3 flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-ink text-sm">
                  {c.name} <span className="text-xs font-normal text-slate-500">· {c.customerType || 'Customer'}</span>
                </div>
                {c.contactPerson && <div className="text-xs text-slate-600">{c.contactPerson}</div>}
                {c.address && <div className="text-xs text-slate-500 truncate">{c.address}</div>}
                {admin && c.branch && <div className="text-[11px] text-slate-400">{c.branch.name}</div>}
                <div className="flex gap-3 mt-1.5 text-xs">
                  {c.mobile && (
                    <a href={`tel:${c.mobile}`} className="flex items-center gap-1 text-brand-700 font-medium">
                      <Phone className="w-3.5 h-3.5" /> {c.mobile}
                    </a>
                  )}
                  {c.latitude != null && (
                    <a
                      href={`https://www.google.com/maps/dir/?api=1&destination=${c.latitude},${c.longitude}`}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1 text-brand-700 font-medium"
                    >
                      <MapPin className="w-3.5 h-3.5" /> Directions
                    </a>
                  )}
                </div>
              </div>
              {admin && (
                <button onClick={() => remove(c)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg" aria-label="Delete customer">
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
