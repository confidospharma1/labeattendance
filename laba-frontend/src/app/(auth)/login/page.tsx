'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '@/providers/AuthProvider';
import { Lock, Mail, AlertCircle, Loader2, Settings2 } from 'lucide-react';
import { apiErrorMessage, getApiBaseUrl, setApiBaseUrlOverride } from '@/lib/api';
import { AuthShell, inputCls } from '@/components/common/AuthShell';

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address').trim(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});
type LoginFormValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const { login } = useAuth();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showServer, setShowServer] = useState(false);
  const [server, setServer] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({ resolver: zodResolver(loginSchema) });

  const onSubmit = async (data: LoginFormValues) => {
    try {
      setSubmitting(true);
      setErrorMsg(null);
      await login(data);
    } catch (err) {
      setErrorMsg(apiErrorMessage(err, 'Login failed. Please check your email and password.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell title="Sign in" subtitle="Mark your attendance with GPS and face verification">
      {errorMsg && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-800 text-sm flex items-start gap-2">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Field label="Email" error={errors.email?.message} icon={<Mail className="w-4 h-4" />}>
          <input type="email" inputMode="email" autoComplete="email" {...register('email')} placeholder="you@labe.in" disabled={submitting} className={inputCls} />
        </Field>
        <Field label="Password" error={errors.password?.message} icon={<Lock className="w-4 h-4" />}>
          <input type="password" autoComplete="current-password" {...register('password')} placeholder="••••••••" disabled={submitting} className={inputCls} />
        </Field>

        <button
          type="submit"
          disabled={submitting}
          className="w-full h-12 rounded-xl bg-brand-700 hover:bg-brand-800 text-white font-semibold flex items-center justify-center gap-2 disabled:opacity-60"
        >
          {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
          {submitting ? 'Signing in…' : 'Sign in'}
        </button>
      </form>

      <div className="mt-5 text-center text-sm text-slate-600">
        New staff member?{' '}
        <Link href="/register" className="font-semibold text-brand-700">
          Register here
        </Link>
      </div>

      <div className="mt-6 pt-4 border-t border-slate-100">
        <button
          type="button"
          onClick={() => {
            setServer(getApiBaseUrl());
            setShowServer((s) => !s);
          }}
          className="mx-auto flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600"
        >
          <Settings2 className="w-3.5 h-3.5" /> Server settings
        </button>
        {showServer && (
          <div className="mt-3 space-y-2">
            <input value={server} onChange={(e) => setServer(e.target.value)} className={`${inputCls} pl-3 text-xs`} placeholder="http://10.0.2.2:5000/api/v1" />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setApiBaseUrlOverride(server.trim() || null);
                  setShowServer(false);
                }}
                className="flex-1 h-9 rounded-lg bg-slate-800 text-white text-xs font-semibold"
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => {
                  setApiBaseUrlOverride(null);
                  setServer(getApiBaseUrl());
                }}
                className="flex-1 h-9 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700"
              >
                Reset to default
              </button>
            </div>
          </div>
        )}
      </div>
    </AuthShell>
  );
}

function Field({ label, error, icon, children }: { label: string; error?: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-ink mb-1.5">{label}</span>
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">{icon}</div>
        {children}
      </div>
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </label>
  );
}
