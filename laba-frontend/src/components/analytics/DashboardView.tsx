'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  LabelList,
} from 'recharts';
import { CheckCircle2, Clock, MapPin, Timer, RefreshCw, Loader2, Users, ScanFace, AlertTriangle, MousePointerClick } from 'lucide-react';
import { apiClient, apiErrorMessage } from '@/lib/api';
import { fmtDate, istToday } from '@/lib/staff';

/** What a click on a chart asks the attendance board to show. */
export interface BoardFocus {
  date?: string;
  status?: string;
  category?: string;
  location?: string;
  nonce: number;
}

interface Props {
  summary: any | null;
  onFocus: (f: Omit<BoardFocus, 'nonce'>) => void;
  refreshKey?: number;
}

// Status colours carry meaning (always shown with a text label); one indigo hue for single-series bars.
const C = {
  onTime: '#16A34A',
  checkedOut: '#15803D',
  onDuty: '#22C55E',
  late: '#F59E0B',
  absent: '#DC2626',
  notYet: '#94A3B8',
  muted: '#E2E8F0',
  corrected: '#2563EB',
  bar: '#4F46E5',
  barActive: '#312E81',
  grid: '#EEF2F7',
  axis: '#64748B',
};

const RANGES = [7, 14, 30, 90];

export function DashboardView({ summary, onFocus, refreshKey = 0 }: Props) {
  const [days, setDays] = useState(14);
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeDay, setActiveDay] = useState<string | null>(null);
  const [activeCat, setActiveCat] = useState<string | null>(null);
  const [activeLoc, setActiveLoc] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get(`/attendance/analytics?days=${days}`);
      setData(res.data.data);
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not load analytics.'));
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  const k = data?.kpis;
  const total = summary?.totalActiveEmployees ?? 0;

  // Today, split into exclusive groups
  const today = useMemo(() => {
    if (!summary) return [];
    const parts = [
      { key: 'PRESENT', label: 'On duty', value: summary.checkedInOnlyCount ?? 0, color: C.onDuty },
      { key: 'COMPLETED', label: 'Checked out', value: summary.checkedOutCount ?? 0, color: C.checkedOut },
      { key: 'CORRECTED', label: 'Corrected', value: summary.correctedCount ?? 0, color: C.corrected },
      { key: 'NOT_YET', label: 'Not yet', value: summary.notYetCount ?? 0, color: C.notYet },
      { key: 'ABSENT', label: 'Absent', value: summary.absentCount ?? 0, color: C.absent },
    ];
    const rest = Math.max(0, total - parts.reduce((a, p) => a + p.value, 0));
    if (rest) parts.push({ key: 'ALL', label: 'Other (holiday / no route)', value: rest, color: C.muted });
    return parts.filter((p) => p.value > 0);
  }, [summary, total]);

  const focusDay = (date: string) => {
    setActiveDay(date);
    onFocus({ date, status: 'ALL', category: 'ALL', location: 'ALL' });
  };

  const tiles = [
    {
      label: 'Present today',
      value: `${summary?.presentCount ?? 0}`,
      sub: `of ${total} staff · ${summary?.lateCount ?? 0} late`,
      icon: CheckCircle2,
      tone: 'bg-emerald-50 text-emerald-700',
      onClick: () => onFocus({ date: istToday(), status: 'PRESENT', category: 'ALL', location: 'ALL' }),
    },
    {
      label: `Attendance · ${days} days`,
      value: k?.totalCheckIns ? `${k.attendanceRate}%` : '—',
      sub: `${k?.totalCheckIns ?? 0} check-ins`,
      icon: Users,
      tone: 'bg-brand-50 text-brand-700',
    },
    {
      label: 'On time',
      value: k?.totalCheckIns ? `${k.punctualityRate}%` : '—',
      sub: `${k?.lateCount ?? 0} late check-ins`,
      icon: Clock,
      tone: 'bg-amber-50 text-amber-700',
      onClick: () => onFocus({ date: istToday(), status: 'LATE', category: 'ALL', location: 'ALL' }),
    },
    {
      label: 'Inside geofence',
      value: k?.totalCheckIns ? `${k.geofenceComplianceRate}%` : '—',
      sub: `${k?.avgHoursWorked ?? 0} h average day`,
      icon: MapPin,
      tone: 'bg-sky-50 text-sky-700',
    },
  ];

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2 justify-between">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-ink">Dashboard</h2>
          <p className="text-[11px] sm:text-xs text-[#64748B] flex items-center gap-1">
            <MousePointerClick className="w-3.5 h-3.5" /> Click any chart or card to filter the staff list below
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-lg border border-[#E2E8F0] p-0.5 bg-white" role="group" aria-label="Date range">
            {RANGES.map((d) => (
              <button
                key={d}
                onClick={() => setDays(d)}
                className={`px-2.5 sm:px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                  days === d ? 'bg-brand-700 text-white' : 'text-[#475569] hover:text-brand-700'
                }`}
              >
                {d}d
              </button>
            ))}
          </div>
          <button onClick={load} className="p-2 rounded-lg border border-[#E2E8F0] bg-white hover:bg-[#F4F6FB]" aria-label="Refresh analytics">
            <RefreshCw className={`w-4 h-4 text-[#475569] ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* KPI tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
        {tiles.map(({ label, value, sub, icon: Icon, tone, onClick }) => {
          const Tag = onClick ? 'button' : 'div';
          return (
            <Tag
              key={label}
              onClick={onClick}
              className={`text-left bg-white border border-[#E2E8F0] rounded-2xl p-3 sm:p-4 flex items-start gap-3 ${
                onClick ? 'hover:border-brand-300 hover:shadow-sm transition-all cursor-pointer' : ''
              }`}
            >
              <span className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${tone}`}>
                <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
              </span>
              <span className="min-w-0 block">
                <span className="block text-[11px] sm:text-xs text-[#64748B] truncate">{label}</span>
                <span className="block text-xl sm:text-2xl font-bold text-ink leading-tight">{value}</span>
                <span className="block text-[10px] sm:text-[11px] text-[#94A3B8] truncate">{sub}</span>
              </span>
            </Tag>
          );
        })}
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-800 flex items-center justify-between gap-2">
          {error}
          <button onClick={load} className="px-3 py-1 rounded-lg bg-red-600 text-white font-semibold">
            Retry
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Today */}
        <Card title="Today at a glance" subtitle={`${fmtDate(istToday())} · ${total} active staff`}>
          {today.length === 0 ? (
            <Empty text="No active staff yet." />
          ) : (
            <div className="space-y-4">
              <div className="flex h-9 w-full rounded-lg overflow-hidden gap-[2px] bg-white" role="img" aria-label="Today's attendance split">
                {today.map((p) => (
                  <button
                    key={p.key + p.label}
                    title={`${p.label}: ${p.value}`}
                    onClick={() => onFocus({ date: istToday(), status: p.key, category: 'ALL', location: 'ALL' })}
                    style={{ width: `${(p.value / Math.max(1, total)) * 100}%`, background: p.color }}
                    className="h-full min-w-[6px] hover:opacity-80 transition-opacity first:rounded-l-lg last:rounded-r-lg"
                  />
                ))}
              </div>
              <ul className="grid grid-cols-2 gap-2">
                {today.map((p) => (
                  <li key={p.key + p.label}>
                    <button
                      onClick={() => onFocus({ date: istToday(), status: p.key, category: 'ALL', location: 'ALL' })}
                      className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg border border-[#EEF2F7] hover:border-brand-200 hover:bg-[#F8FAFC] text-left"
                    >
                      <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: p.color }} />
                      <span className="text-[11px] text-[#475569] truncate flex-1">{p.label}</span>
                      <span className="text-sm font-bold text-ink">{p.value}</span>
                    </button>
                  </li>
                ))}
              </ul>
              <div className="grid grid-cols-3 gap-2 text-center pt-1 border-t border-[#EEF2F7]">
                <Mini icon={ScanFace} label="Face verified" value={`${k?.faceVerifiedRate ?? 0}%`} />
                <Mini icon={Timer} label="Work reports" value={`${k?.workReportRate ?? 0}%`} />
                <Mini icon={AlertTriangle} label="Mock GPS" value={`${k?.mockLocationFlags ?? 0}`} warn={!!k?.mockLocationFlags} />
              </div>
            </div>
          )}
        </Card>

        {/* Daily trend */}
        <Card
          className="lg:col-span-2"
          title="Daily attendance"
          subtitle={data ? `${fmtDate(data.from)} – ${fmtDate(data.to)} · click a day to open it` : 'Loading…'}
          legend={[
            ['On time', C.onTime],
            ['Late', C.late],
            ['Not present', C.muted],
          ]}
        >
          {loading && !data ? (
            <Spinner />
          ) : (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={data?.trends ?? []} margin={{ top: 8, right: 4, left: -18, bottom: 0 }} barCategoryGap={days > 30 ? 1 : '22%'}>
                <CartesianGrid vertical={false} stroke={C.grid} />
                <XAxis
                  dataKey="date"
                  tickFormatter={(d: string) => (days <= 14 ? `${d.slice(8)}/${d.slice(5, 7)}` : d.slice(8))}
                  tick={{ fontSize: 10, fill: C.axis }}
                  tickLine={false}
                  axisLine={{ stroke: C.muted }}
                  interval="preserveStartEnd"
                  minTickGap={6}
                />
                <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: C.axis }} tickLine={false} axisLine={false} width={40} />
                <Tooltip cursor={{ fill: 'rgba(79,70,229,0.06)' }} content={<DayTip />} />
                {(['onTime', 'late', 'absent'] as const).map((key, i) => (
                  <Bar
                    key={key}
                    dataKey={key}
                    stackId="a"
                    fill={key === 'onTime' ? C.onTime : key === 'late' ? C.late : C.muted}
                    radius={i === 2 ? [4, 4, 0, 0] : 0}
                    cursor="pointer"
                    onClick={(d: any) => d?.date && focusDay(d.date)}
                    stroke="#fff"
                    strokeWidth={1}
                  >
                    {(data?.trends ?? []).map((t: any) => (
                      <Cell key={t.date} fillOpacity={activeDay && activeDay !== t.date ? 0.45 : 1} />
                    ))}
                  </Bar>
                ))}
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>

        {/* Categories */}
        <Card className="lg:col-span-1" title="Attendance by staff category" subtitle={`Average over ${days} days · click to filter`}>
          {loading && !data ? (
            <Spinner />
          ) : !data?.categories?.length ? (
            <Empty text="No staff yet." />
          ) : (
            <HBars
              rows={data.categories.map((c: any) => ({ id: c.key, name: c.label, value: c.rate, note: `${c.staff} staff · ${c.lateDays} late` }))}
              active={activeCat}
              onClick={(id) => {
                setActiveCat(id);
                onFocus({ category: id, status: 'ALL', location: 'ALL' });
              }}
            />
          )}
        </Card>

        {/* Locations */}
        <Card className="lg:col-span-1" title="Attendance by location" subtitle={`Average over ${days} days · click to filter`}>
          {loading && !data ? (
            <Spinner />
          ) : !data?.locations?.length ? (
            <Empty text="No locations with assigned staff yet." />
          ) : (
            <HBars
              rows={data.locations.map((l: any) => ({
                id: l.id,
                name: l.name,
                value: l.rate,
                note: `${l.presentToday}/${l.staff} in today${l.geofenceRate !== null ? ` · ${l.geofenceRate}% in fence` : ''}`,
              }))}
              active={activeLoc}
              onClick={(id) => {
                setActiveLoc(id);
                onFocus({ location: id, status: 'ALL', category: 'ALL' });
              }}
            />
          )}
        </Card>

        {/* Check-in times */}
        <Card
          className="lg:col-span-1"
          title="Check-in times (IST)"
          subtitle={`When staff mark in · ${days} days`}
          legend={[
            ['On time', C.onTime],
            ['Late', C.late],
          ]}
        >
          {loading && !data ? (
            <Spinner />
          ) : (
            <ResponsiveContainer width="100%" height={230}>
              <BarChart data={data?.checkInHours ?? []} margin={{ top: 8, right: 4, left: -18, bottom: 0 }} barCategoryGap="18%">
                <CartesianGrid vertical={false} stroke={C.grid} />
                <XAxis dataKey="label" tickFormatter={(l: string) => l.slice(0, 2)} tick={{ fontSize: 10, fill: C.axis }} tickLine={false} axisLine={{ stroke: C.muted }} interval={0} minTickGap={0} />
                <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: C.axis }} tickLine={false} axisLine={false} width={40} />
                <Tooltip cursor={{ fill: 'rgba(79,70,229,0.06)' }} content={<HourTip />} />
                <Bar dataKey="onTime" stackId="h" fill={C.onTime} stroke="#fff" strokeWidth={1} />
                <Bar dataKey="late" stackId="h" fill={C.late} radius={[4, 4, 0, 0]} stroke="#fff" strokeWidth={1} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>
    </div>
  );
}

function Card({
  title,
  subtitle,
  legend,
  className = '',
  children,
}: {
  title: string;
  subtitle?: string;
  legend?: [string, string][];
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={`bg-white border border-[#E2E8F0] rounded-2xl p-3.5 sm:p-5 min-w-0 ${className}`}>
      <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-ink">{title}</h3>
          {subtitle && <p className="text-[11px] text-[#64748B]">{subtitle}</p>}
        </div>
        {legend && (
          <div className="flex flex-wrap gap-3 text-[11px] text-[#475569]">
            {legend.map(([l, c]) => (
              <span key={l} className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm" style={{ background: c }} />
                {l}
              </span>
            ))}
          </div>
        )}
      </div>
      {children}
    </section>
  );
}

/** Horizontal bars for a single percentage measure, value labelled at the bar end. */
function HBars({
  rows,
  active,
  onClick,
}: {
  rows: { id: string; name: string; value: number; note: string }[];
  active: string | null;
  onClick: (id: string) => void;
}) {
  const height = Math.max(120, rows.length * 44 + 10);
  return (
    <div className="max-h-[320px] overflow-y-auto -mr-1 pr-1">
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={rows} layout="vertical" margin={{ top: 0, right: 40, left: 0, bottom: 0 }} barCategoryGap={10}>
          <XAxis type="number" domain={[0, 100]} hide />
          <YAxis
            type="category"
            dataKey="name"
            width={132}
            tickLine={false}
            axisLine={false}
            tick={<NameTick />}
            interval={0}
          />
          <Tooltip cursor={{ fill: 'rgba(79,70,229,0.06)' }} content={<RowTip />} />
          <Bar dataKey="value" radius={[0, 4, 4, 0]} cursor="pointer" onClick={(d: any) => d?.id && onClick(d.id)} background={{ fill: '#F1F5F9', radius: 4 } as any}>
            {rows.map((r) => (
              <Cell key={r.id} fill={active === r.id ? C.barActive : C.bar} fillOpacity={active && active !== r.id ? 0.55 : 1} />
            ))}
            <LabelList dataKey="value" position="right" formatter={(v: number) => `${v}%`} style={{ fontSize: 11, fontWeight: 700, fill: '#0F172A' }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Single-line axis label, shortened with an ellipsis (the full name is in the tooltip). */
function NameTick({ x, y, payload }: any) {
  const name = String(payload?.value ?? '');
  const short = name.length > 20 ? `${name.slice(0, 19)}…` : name;
  return (
    <text x={x - 6} y={y} dy={4} textAnchor="end" fontSize={11} fill="#334155">
      <title>{name}</title>
      {short}
    </text>
  );
}

function TipBox({ children }: { children: React.ReactNode }) {
  return <div className="bg-white border border-[#E2E8F0] shadow-lg rounded-lg px-3 py-2 text-[11px] text-[#334155] space-y-0.5 min-w-[140px]">{children}</div>;
}
function TipRow({ color, label, value }: { color?: string; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1.5">
      {color && <span className="w-2 h-2 rounded-sm" style={{ background: color }} />}
      <span className="flex-1">{label}</span>
      <strong className="text-ink">{value}</strong>
    </div>
  );
}

function DayTip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const t = payload[0].payload;
  return (
    <TipBox>
      <div className="font-bold text-ink">
        {t.dayOfWeek}, {fmtDate(t.date)}
      </div>
      {t.holiday ? (
        <div className="text-violet-700">Holiday: {t.holiday}</div>
      ) : (
        <>
          <TipRow color={C.onTime} label="On time" value={t.onTime} />
          <TipRow color={C.late} label="Late" value={t.late} />
          <TipRow color={C.muted} label="Not present" value={t.absent} />
          <div className="pt-1 border-t border-[#EEF2F7] mt-1">
            Attendance <strong className="text-ink">{t.rate ?? 0}%</strong> of {t.expected}
          </div>
        </>
      )}
    </TipBox>
  );
}

function HourTip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const h = payload[0].payload;
  return (
    <TipBox>
      <div className="font-bold text-ink">
        {h.label} – {String(h.hour + 1).padStart(2, '0')}:00
      </div>
      <TipRow color={C.onTime} label="On time" value={h.onTime} />
      <TipRow color={C.late} label="Late" value={h.late} />
    </TipBox>
  );
}

function RowTip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const r = payload[0].payload;
  return (
    <TipBox>
      <div className="font-bold text-ink">{r.name}</div>
      <TipRow label="Attendance" value={`${r.value}%`} />
      <div className="text-[#64748B]">{r.note}</div>
    </TipBox>
  );
}

function Mini({ icon: Icon, label, value, warn }: { icon: any; label: string; value: string; warn?: boolean }) {
  return (
    <div>
      <Icon className={`w-3.5 h-3.5 mx-auto mb-0.5 ${warn ? 'text-red-600' : 'text-[#64748B]'}`} />
      <div className={`text-sm font-bold ${warn ? 'text-red-700' : 'text-ink'}`}>{value}</div>
      <div className="text-[10px] text-[#64748B]">{label}</div>
    </div>
  );
}

function Spinner() {
  return (
    <div className="h-[230px] flex items-center justify-center">
      <Loader2 className="w-6 h-6 animate-spin text-brand-600" />
    </div>
  );
}
function Empty({ text }: { text: string }) {
  return <div className="h-[160px] flex items-center justify-center text-xs text-[#64748B] text-center">{text}</div>;
}
