import React from 'react';

export const inputCls =
  'w-full h-12 pl-9 pr-3 text-sm bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 text-ink placeholder:text-slate-400 disabled:bg-slate-50';

/** Branded layout for the sign-in and registration screens. */
export function AuthShell({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <div className="bg-brand-700 text-white pt-[max(env(safe-area-inset-top),2.5rem)] pb-16 px-6">
        <div className="max-w-md mx-auto">
          <div className="w-12 h-12 rounded-2xl bg-white text-brand-700 flex items-center justify-center font-black text-xl">L</div>
          <h1 className="text-2xl font-bold mt-4">LABE Attendance</h1>
          <p className="text-brand-100 text-sm mt-1">{subtitle}</p>
        </div>
      </div>
      <div className="flex-1 px-4 -mt-10 pb-10">
        <div className="max-w-md mx-auto bg-white rounded-2xl shadow-lg shadow-slate-200/60 border border-slate-100 p-5 sm:p-7">
          <h2 className="text-lg font-bold text-ink mb-4">{title}</h2>
          {children}
        </div>
      </div>
    </div>
  );
}
