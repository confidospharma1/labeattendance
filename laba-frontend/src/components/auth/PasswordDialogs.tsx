'use client';

import React, { useState } from 'react';
import { KeyRound, Eye, EyeOff, X, Loader2, CheckCircle2 } from 'lucide-react';
import { apiClient, apiErrorMessage } from '@/lib/api';

const RULES: [string, (p: string) => boolean][] = [
  ['At least 8 characters', (p) => p.length >= 8],
  ['One uppercase letter', (p) => /[A-Z]/.test(p)],
  ['One number', (p) => /[0-9]/.test(p)],
];
const strongEnough = (p: string) => RULES.every(([, ok]) => ok(p));

function Shell({ title, subtitle, onClose, children }: { title: string; subtitle?: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-[60] bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="bg-white w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl shadow-xl p-5 pb-[max(env(safe-area-inset-bottom),1.25rem)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-start gap-3">
            <span className="w-9 h-9 rounded-xl bg-brand-50 text-brand-700 flex items-center justify-center flex-shrink-0">
              <KeyRound className="w-4 h-4" />
            </span>
            <div>
              <h2 className="text-sm font-bold text-ink">{title}</h2>
              {subtitle && <p className="text-[11px] text-[#64748B]">{subtitle}</p>}
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[#EEF2F7] text-[#64748B]" aria-label="Close">
            <X className="w-4 h-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function PasswordInput({ label, value, onChange, autoComplete }: { label: string; value: string; onChange: (v: string) => void; autoComplete: string }) {
  const [show, setShow] = useState(false);
  return (
    <label className="block text-xs text-[#475569]">
      <span className="block font-semibold mb-1">{label}</span>
      <span className="relative block">
        <input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          required
          className="w-full h-10 pl-3 pr-10 text-sm [&::-ms-reveal]:hidden border border-[#E2E8F0] rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-brand-200"
        />
        <button
          type="button"
          onClick={() => setShow(!show)}
          className="absolute right-1 top-1 p-2 text-[#64748B]"
          aria-label={show ? 'Hide password' : 'Show password'}
        >
          {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </span>
    </label>
  );
}

function Rules({ value }: { value: string }) {
  return (
    <ul className="grid gap-1 text-[11px]">
      {RULES.map(([label, ok]) => (
        <li key={label} className={`flex items-center gap-1.5 ${ok(value) ? 'text-emerald-700' : 'text-[#94A3B8]'}`}>
          <CheckCircle2 className="w-3.5 h-3.5" /> {label}
        </li>
      ))}
    </ul>
  );
}

function SubmitButton({ busy, disabled, children }: { busy: boolean; disabled: boolean; children: React.ReactNode }) {
  return (
    <button
      type="submit"
      disabled={busy || disabled}
      className="w-full h-10 rounded-lg bg-brand-700 hover:bg-brand-800 text-white text-sm font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-50"
    >
      {busy && <Loader2 className="w-4 h-4 animate-spin" />}
      {children}
    </button>
  );
}

/** Any signed-in user (staff, admin, super admin) changes their own password. */
export function ChangePasswordDialog({ onClose }: { onClose: () => void }) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const mismatch = confirm.length > 0 && confirm !== next;
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (next === current) return setError('The new password must be different from the current one.');
    setBusy(true);
    try {
      await apiClient.post('/auth/change-password', { currentPassword: current, newPassword: next, confirmPassword: confirm });
      setDone(true);
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not change the password.'));
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <Shell title="Password changed" onClose={onClose}>
        <p className="text-sm text-[#334155]">Your password has been updated. Use the new password the next time you sign in.</p>
        <button onClick={onClose} className="mt-4 w-full h-10 rounded-lg bg-brand-700 text-white text-sm font-semibold">
          Done
        </button>
      </Shell>
    );
  }

  return (
    <Shell title="Change password" subtitle="Enter your current password, then choose a new one." onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <PasswordInput label="Current password" value={current} onChange={setCurrent} autoComplete="current-password" />
        <PasswordInput label="New password" value={next} onChange={setNext} autoComplete="new-password" />
        <Rules value={next} />
        <PasswordInput label="Confirm new password" value={confirm} onChange={setConfirm} autoComplete="new-password" />
        {mismatch && <div className="text-[11px] text-red-700">The passwords do not match.</div>}
        {error && <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg p-2">{error}</div>}
        <SubmitButton busy={busy} disabled={!current || !strongEnough(next) || confirm !== next}>
          Change password
        </SubmitButton>
      </form>
    </Shell>
  );
}

/** Admin sets a new password for a staff member who forgot theirs. */
export function ResetPasswordDialog({ employee, onClose }: { employee: { id: string; fullName: string; employeeCode: string }; onClose: () => void }) {
  const [next, setNext] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await apiClient.post(`/employees/${employee.id}/reset-password`, { newPassword: next });
      setDone(true);
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not reset the password.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Shell title="Reset password" subtitle={`${employee.fullName} (${employee.employeeCode})`} onClose={onClose}>
      {done ? (
        <>
          <p className="text-sm text-[#334155]">
            The new password is set and any login lock is cleared. Share it with {employee.fullName} privately and ask them to change it
            after signing in (menu → Change password).
          </p>
          <button onClick={onClose} className="mt-4 w-full h-10 rounded-lg bg-brand-700 text-white text-sm font-semibold">
            Done
          </button>
        </>
      ) : (
        <form onSubmit={submit} className="space-y-3">
          <p className="text-[11px] text-[#64748B]">Use this when a staff member forgets their password. Their old password stops working.</p>
          <PasswordInput label="New password" value={next} onChange={setNext} autoComplete="new-password" />
          <Rules value={next} />
          {error && <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg p-2">{error}</div>}
          <SubmitButton busy={busy} disabled={!strongEnough(next)}>
            Set new password
          </SubmitButton>
        </form>
      )}
    </Shell>
  );
}
