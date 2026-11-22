'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertCircle, CheckCircle2, Loader2, Building2, Route } from 'lucide-react';
import { apiClient, apiErrorMessage } from '@/lib/api';
import { AuthShell } from '@/components/common/AuthShell';

const fieldCls =
  'w-full h-12 px-3 text-sm bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 text-ink placeholder:text-slate-400';

export default function RegisterPage() {
  const [branches, setBranches] = useState<{ id: string; name: string; district: string }[]>([]);
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    mobile: '',
    employeeType: 'OFFICE_STAFF' as 'OFFICE_STAFF' | 'FIELD_STAFF',
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

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (form.password !== form.confirm) return setError('Passwords do not match.');
    if (form.employeeType === 'OFFICE_STAFF' && !form.branchId) return setError('Select your branch.');
    setSubmitting(true);
    try {
      const { confirm, branchId, ...rest } = form;
      const res = await apiClient.post('/auth/register', {
        ...rest,
        ...(form.employeeType === 'OFFICE_STAFF' ? { branchId } : {}),
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
        <div className="grid grid-cols-2 gap-2">
          {[
            { v: 'OFFICE_STAFF', label: 'Office staff', icon: Building2 },
            { v: 'FIELD_STAFF', label: 'Field staff', icon: Route },
          ].map(({ v, label, icon: Icon }) => (
            <button
              type="button"
              key={v}
              onClick={() => setForm((f) => ({ ...f, employeeType: v as any }))}
              className={`h-16 rounded-xl border-2 flex flex-col items-center justify-center gap-1 text-sm font-semibold ${
                form.employeeType === v ? 'border-brand-600 bg-brand-50 text-brand-800' : 'border-slate-200 text-slate-600'
              }`}
            >
              <Icon className="w-5 h-5" /> {label}
            </button>
          ))}
        </div>

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
        {form.employeeType === 'OFFICE_STAFF' && (
          <select required value={form.branchId} onChange={set('branchId')} className={fieldCls}>
            <option value="">Select your branch</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name} ({b.district})
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
