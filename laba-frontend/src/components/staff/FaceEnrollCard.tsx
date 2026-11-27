'use client';

import React, { useState } from 'react';
import { ScanFace, ShieldCheck, Loader2, AlertCircle } from 'lucide-react';
import { FaceCapture } from '@/components/face/FaceCapture';
import { apiClient, apiErrorMessage } from '@/lib/api';

export function FaceEnrollCard({ onEnrolled }: { onEnrolled: () => void }) {
  const [consent, setConsent] = useState(false);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <section className="bg-white rounded-2xl border border-brand-100 shadow-sm p-5">
      <div className="flex items-start gap-3">
        <div className="w-11 h-11 rounded-xl bg-brand-50 text-brand-700 flex items-center justify-center flex-shrink-0">
          <ScanFace className="w-6 h-6" />
        </div>
        <div>
          <h2 className="font-bold text-ink">Set up face verification</h2>
          <p className="text-sm text-slate-600 mt-1">
            One-time step. Your face is checked each time you mark attendance so nobody else can mark it for you.
          </p>
        </div>
      </div>

      <label className="mt-4 flex items-start gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-700">
        <input
          type="checkbox"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
          className="mt-0.5 w-5 h-5 accent-brand-700"
        />
        <span>
          I agree that J-Track stores a face template (numbers, not a photo) of me, used only to verify my attendance.
          I can ask my admin to delete it.
        </span>
      </label>

      {error && (
        <div className="mt-3 p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-800 flex gap-2">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <button
        disabled={!consent || saving}
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
        className="mt-4 w-full h-12 rounded-xl bg-brand-700 hover:bg-brand-800 text-white font-semibold flex items-center justify-center gap-2 disabled:opacity-40"
      >
        {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <ShieldCheck className="w-5 h-5" />}
        {saving ? 'Saving…' : 'Start face enrolment'}
      </button>

      {open && (
        <FaceCapture
          mode="enroll"
          onClose={() => setOpen(false)}
          onEnrolled={async (enrollment) => {
            setOpen(false);
            setSaving(true);
            try {
              await apiClient.post('/face/enroll', { ...enrollment, consent: true });
              onEnrolled();
            } catch (err) {
              setError(apiErrorMessage(err, 'Could not save your face. Please try again.'));
            } finally {
              setSaving(false);
            }
          }}
        />
      )}
    </section>
  );
}
