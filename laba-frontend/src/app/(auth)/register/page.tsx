'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { apiClient, apiErrorMessage } from '@/lib/api';
import { AuthShell } from '@/components/common/AuthShell';
import { CATEGORIES, categoryInfo, locationTypeLabel, StaffCategory } from '@/lib/staff';

const fieldCls =
  'w-full h-12 px-3 text-sm bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 text-ink placeholder:text-slate-400';

export default function RegisterPage() {
  const [branches, setBranches] = useState<{ id: string; name: string; district: string; locationType?: string }[]>([]);
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    mobile: '',
    staffCategory: 'HEAD_OFFICE' as StaffCategory,
    designation: '',
    dateOfJoining: '',
    branchId: '',
    password: '',
    confirm: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  useEffect(() => {
    apiClient
      .get('/auth/branches')
      .then((r) => setBranches(r.data.data || []))
      .catch(() => setError('Could not load branches. Check your internet connection.'));
  }, []);

  const info = categoryInfo(form.staffCategory);
  const locations = branches.filter((b) => !info?.locationTypes || !b.locationType || info.locationTypes.includes(b.locationType as any));

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (form.password !== form.confirm) return setError('Passwords do not match.');
    if (info?.locationRequired && !form.branchId) return setError('Select your work location.');
    setSubmitting(true);
    try {
      const { confirm, branchId, designation, dateOfJoining, ...rest } = form;
      const res = await apiClient.post('/auth/register', {
        ...rest,
        ...(branchId && { branchId }),
        ...(designation.trim() && { designation: designation.trim() }),
        ...(dateOfJoining && { dateOfJoining }),
      });
      setDone(res.data.data.employeeCode);
    } catch (err) {
      setError(apiErrorMessage(err, 'Registration failed.'));
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <AuthShell title="Registration submitted" subtitle="Staff registration">
        <div className="text-center py-4">
          <CheckCircle2 className="w-14 h-14 text-brand-600 mx-auto" />
          <p className="mt-4 text-ink font-semibold">Your employee code is {done}</p>
          <p className="text-sm text-slate-600 mt-2">
            An admin will review and approve your account. After approval, sign in and set up face verification.
          </p>
          <Link href="/login" className="mt-6 inline-flex h-12 items-center justify-center px-6 rounded-xl bg-brand-700 text-white font-semibold">
            Back to sign in
          </Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Create staff account" subtitle="Register, then wait for admin approval">
      <form onSubmit={submit} className="space-y-3">
        <label className="block">
          <span className="text-xs font-semibold text-slate-600">I work as</span>
          <select
            value={form.staffCategory}
            onChange={(e) => setForm((f) => ({ ...f, staffCategory: e.target.value as StaffCategory, branchId: '' }))}
            className={fieldCls + " mt-1"}
          >
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label} ({c.short})
              </option>
            ))}
          </select>
          {info && <span className="block mt-1 text-xs text-slate-500">{info.how}</span>}
        </label>

        <input required value={form.fullName} onChange={set('fullName')} placeholder="Full name" className={fieldCls} />
        <input required type="email" inputMode="email" value={form.email} onChange={set('email')} placeholder="Email" className={fieldCls} />
        <input
          required
          inputMode="numeric"
          pattern="[6-9][0-9]{9}"
          maxLength={10}
          value={form.mobile}
          onChange={set('mobile')}
          placeholder="Mobile (10 digits)"
          className={fieldCls}
        />
        <input value={form.designation} onChange={set('designation')} placeholder="Designation (e.g. Pharmacist)" className={fieldCls} />
        <label className="block">
          <span className="text-xs font-semibold text-slate-600">Date of joining</span>
          <input type="date" value={form.dateOfJoining} onChange={set('dateOfJoining')} className={fieldCls + " mt-1"} />
        </label>
        {info?.locationTypes && (
          <select required={info.locationRequired} value={form.branchId} onChange={set('branchId')} className={fieldCls}>
            <option value="">{info.locationRequired ? 'Select your work location' : 'Distribution centre (optional)'}</option>
            {locations.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name} · {locationTypeLabel(b.locationType)} ({b.district})
              </option>
            ))}
          </select>
        )}
        <input required type="password" value={form.password} onChange={set('password')} placeholder="Password (8+ chars, 1 capital, 1 number)" className={fieldCls} />
        <input required type="password" value={form.confirm} onChange={set('confirm')} placeholder="Confirm password" className={fieldCls} />

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-800 text-sm flex items-start gap-2">
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full h-12 rounded-xl bg-brand-700 hover:bg-brand-800 text-white font-semibold flex items-center justify-center gap-2 disabled:opacity-60"
        >
          {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
          Submit registration
        </button>
      </form>
      <div className="mt-5 text-center text-sm text-slate-600">
        Already approved?{' '}
        <Link href="/login" className="font-semibold text-brand-700">
          Sign in
        </Link>
      </div>
    </AuthShell>
  );
}
