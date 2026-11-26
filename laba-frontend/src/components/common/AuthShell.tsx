import React from 'react';
import { Logo } from './Logo';

export const inputCls =
  'w-full h-12 pl-9 pr-3 text-sm bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 text-ink placeholder:text-slate-400 disabled:bg-slate-50';

/** Branded layout for the sign-in and registration screens. */
export function AuthShell({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col lg:flex-row">
      <div className="relative overflow-hidden bg-gradient-to-br from-brand-600 via-brand-700 to-brand-900 text-white pt-[max(env(safe-area-inset-top),2.5rem)] pb-16 px-6 lg:w-[44%] lg:flex lg:items-center lg:pb-10">
        {/* decorative rings */}
        <div className="pointer-events-none absolute -right-16 -top-16 w-64 h-64 rounded-full border-[28px] border-white/5" />
        <div className="pointer-events-none absolute -left-10 bottom-0 w-40 h-40 rounded-full bg-amber-300/10 blur-2xl" />
        <div className="relative max-w-md mx-auto w-full">
          <Logo light size={46} />
          <h1 className="text-2xl lg:text-3xl font-bold mt-6 leading-tight">Attendance & field tracking</h1>
          <p className="text-brand-100 text-sm mt-2">{subtitle}</p>
          <ul className="hidden lg:block mt-8 space-y-2 text-sm text-brand-100">
            <li>• GPS geofences with exact town / village boundaries</li>
            <li>• On-device face verification</li>
            <li>• Shifts, field routes, camps and live admin board</li>
          </ul>
        </div>
      </div>
      <div className="flex-1 px-4 -mt-10 pb-10 lg:mt-0 lg:flex lg:items-center">
        <div className="max-w-md w-full mx-auto bg-white rounded-2xl shadow-xl shadow-brand-900/5 border border-slate-100 p-5 sm:p-7">
          <h2 className="text-lg font-bold text-ink mb-4">{title}</h2>
          {children}
        </div>
      </div>
    </div>
  );
}
