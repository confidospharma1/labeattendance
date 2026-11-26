import React from 'react';

export const APP_NAME = 'J-Track';
export const APP_TAGLINE = 'Attendance & field tracking';

/** J-Track mark: a location pin with a "J", on an indigo gradient tile. */
export function LogoMark({ size = 36, light = false }: { size?: number; light?: boolean }) {
  return (
    <span
      className={`inline-flex items-center justify-center rounded-xl shadow-sm flex-shrink-0 ${
        light ? 'bg-white' : 'bg-gradient-to-br from-brand-500 to-brand-800'
      }`}
      style={{ width: size, height: size }}
      aria-hidden
    >
      <svg viewBox="0 0 24 24" width={size * 0.62} height={size * 0.62} fill="none">
        <path
          d="M12 2.5c-3.9 0-7 3-7 6.9 0 4.8 5.6 10.6 6.4 11.4.3.3.9.3 1.2 0 .8-.8 6.4-6.6 6.4-11.4 0-3.9-3.1-6.9-7-6.9Z"
          fill={light ? '#4338CA' : '#fff'}
        />
        <path d="M13.6 6.4v4.4a2.2 2.2 0 0 1-4.1 1.1" stroke={light ? '#fff' : '#4338CA'} strokeWidth="2" strokeLinecap="round" />
      </svg>
    </span>
  );
}

/** Mark + wordmark. */
export function Logo({ size = 36, light = false, subtitle }: { size?: number; light?: boolean; subtitle?: string }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <LogoMark size={size} light={light} />
      <span className="leading-tight">
        <span className={`block font-extrabold tracking-tight ${light ? 'text-white' : 'text-ink'}`} style={{ fontSize: size * 0.48 }}>
          J<span className={light ? 'text-amber-300' : 'text-brand-600'}>-</span>Track
        </span>
        {subtitle && <span className={`block text-[11px] ${light ? 'text-brand-100' : 'text-slate-500'}`}>{subtitle}</span>}
      </span>
    </span>
  );
}
