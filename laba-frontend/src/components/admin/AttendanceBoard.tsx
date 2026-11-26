'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshCw, Loader2, Search, Camera, Edit2, Trash2, X, MapPin, Clock, Route, Tent, AlertTriangle, ScanFace } from 'lucide-react';
import { apiClient, apiErrorMessage } from '@/lib/api';
import { CATEGORIES, DAY_STATUS, categoryLabel, fmtIST, fmtDate, istToday, locationTypeLabel } from '@/lib/staff';

interface Props {
  onEditRecord: (record: any) => void;
  onDeleteRecord: (record: any) => void;
  refreshKey?: number;
}

const CATEGORY_ORDER = [...CATEGORIES.map((c) => c.value as string), 'UNCLASSIFIED_OFFICE', 'UNCLASSIFIED_FIELD'];
const STAT_ORDER = ['NOT_YET', 'ABSENT', 'PRESENT', 'COMPLETED', 'CORRECTED', 'NO_TASKS', 'HOLIDAY', 'UPCOMING'];

/** Every active staff member's attendance for a date, grouped by staff category and location. */
export function AttendanceBoard({ onEditRecord, onDeleteRecord, refreshKey = 0 }: Props) {
  const [date, setDate] = useState(istToday());
  const [board, setBoard] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [category, setCategory] = useState<string>('ALL');
  const [status, setStatus] = useState<string>('ALL');
  const [location, setLocation] = useState<string>('ALL');
  const [search, setSearch] = useState('');
  const [selfie, setSelfie] = useState<{ title: string; src: string | null; error?: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get(`/attendance/board?date=${date}`);
      setBoard(res.data.data);
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not load attendance.'));
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  // Live refresh for today
  useEffect(() => {
    if (date !== istToday()) return;
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, [date, load]);

  const rows: any[] = useMemo(() => board?.rows ?? [], [board]);
  const locations = useMemo(() => {
    const m = new Map<string, string>();
    rows.forEach((r) => r.location && m.set(r.location.id, r.location.name));
    return Array.from(m.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter(
      (r) =>
        (category === 'ALL' || r.category === category) &&
        (status === 'ALL' || (status === 'LATE' ? r.isLate : r.status === status)) &&
        (location === 'ALL' || r.location?.id === location) &&
        (!q ||
          r.employee.fullName.toLowerCase().includes(q) ||
          r.employee.employeeCode.toLowerCase().includes(q) ||
          (r.employee.designation || '').toLowerCase().includes(q))
    );
  }, [rows, category, status, location, search]);

  // category → location → rows
  const groups = useMemo(() => {
    const byCat = new Map<string, Map<string, any[]>>();
    for (const r of filtered) {
      const locKey = r.location?.name ?? (r.mode === 'ANYWHERE' ? 'Anywhere' : 'No fixed location');
      if (!byCat.has(r.category)) byCat.set(r.category, new Map());
      const m = byCat.get(r.category)!;
      m.set(locKey, [...(m.get(locKey) ?? []), r]);
    }
    return Array.from(byCat.entries()).sort((a, b) => CATEGORY_ORDER.indexOf(a[0]) - CATEGORY_ORDER.indexOf(b[0]));
  }, [filtered]);

  const viewSelfie = async (r: any, which: 'in' | 'out') => {
    setSelfie({ title: `${r.employee.fullName} · check-${which}`, src: null });
    try {
      const res = await apiClient.get(`/attendance/records/${r.record.id}/selfie?which=${which}`);
      setSelfie({ title: `${r.employee.fullName} · check-${which}`, src: res.data.data.selfie });
    } catch (err) {
      setSelfie({ title: `${r.employee.fullName} · check-${which}`, src: null, error: apiErrorMessage(err) });
    }
  };

  const s = board?.summary;
  const catKeys = board ? Object.keys(board.byCategory).sort((a, b) => CATEGORY_ORDER.indexOf(a) - CATEGORY_ORDER.indexOf(b)) : [];

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="bg-white border border-[#E5E5E5] rounded-xl p-3 sm:p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <div>
            <h3 className="font-semibold text-sm text-[#171717]">All staff attendance</h3>
            <p className="text-[11px] text-[#737373]">
              {board ? `${fmtDate(board.workDate)}${board.isToday ? ' · live, refreshes every minute' : ''}` : 'Loading…'}
              {board?.holiday && <span className="ml-1 text-violet-700 font-semibold">· Holiday: {board.holiday}</span>}
            </p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} className="px-2 py-1.5 border border-[#E5E5E5] rounded-lg text-xs" />
            <button onClick={load} className="p-2 rounded-lg border border-[#E5E5E5] hover:bg-[#F7F6F2]" aria-label="Refresh">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {s && (
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            {[
              ['Total', s.total, 'text-[#171717]', 'ALL'],
              ['Present', s.present, 'text-emerald-700', 'PRESENT'],
              ['Checked out', s.checkedOut, 'text-emerald-900', 'COMPLETED'],
              ['Late', s.late, 'text-amber-700', 'LATE'],
              ['Not yet', s.notYet, 'text-slate-600', 'NOT_YET'],
              ['Absent', s.absent, 'text-red-700', 'ABSENT'],
            ].map(([label, n, cls, key]) => (
              <button
                key={label as string}
                onClick={() => setStatus(status === key ? 'ALL' : (key as string))}
                className={`rounded-lg border p-2 text-left transition-colors ${status === key ? 'border-[#171717] bg-[#F7F6F2]' : 'border-[#E5E5E5] hover:bg-[#FBFBFA]'}`}
              >
                <div className="text-[10px] uppercase tracking-wide text-[#737373]">{label}</div>
                <div className={`text-lg font-bold ${cls}`}>{n as number}</div>
              </button>
            ))}
          </div>
        )}

        {/* Category chips */}
        <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
          <Chip active={category === 'ALL'} onClick={() => setCategory('ALL')} label="All categories" count={s?.total} />
          {catKeys.map((k) => {
            const c = board.byCategory[k];
            return <Chip key={k} active={category === k} onClick={() => setCategory(k)} label={c.label} count={c.total} sub={`${c.present} in`} />;
          })}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <div className="flex items-center gap-1.5 px-2 border border-[#E5E5E5] rounded-lg">
            <Search className="w-3.5 h-3.5 text-[#737373]" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name, code or designation" className="flex-1 py-1.5 text-xs focus:outline-none" />
          </div>
          <select value={location} onChange={(e) => setLocation(e.target.value)} className="px-2 py-1.5 border border-[#E5E5E5] rounded-lg text-xs bg-white">
            <option value="ALL">All locations</option>
            {locations.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="px-2 py-1.5 border border-[#E5E5E5] rounded-lg text-xs bg-white">
            <option value="ALL">All statuses</option>
            <option value="LATE">Late</option>
            {STAT_ORDER.map((k) => (
              <option key={k} value={k}>
                {DAY_STATUS[k].label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-800">{error}</div>}
      {loading && !board && (
        <div className="py-16 flex justify-center">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      )}
      {board && filtered.length === 0 && (
        <div className="bg-white border border-dashed border-[#D4D4D4] rounded-xl p-10 text-center text-xs text-[#737373]">
          {rows.length === 0 ? 'No active staff yet. Add employees in the Employee Directory.' : 'Nobody matches these filters.'}
        </div>
      )}

      {groups.map(([cat, byLoc]) => {
        const all = Array.from(byLoc.values()).flat();
        const present = all.filter((r) => ['PRESENT', 'COMPLETED', 'CORRECTED'].includes(r.status)).length;
        return (
          <section key={cat} className="bg-white border border-[#E5E5E5] rounded-xl overflow-hidden">
            <header className="px-4 py-3 border-b border-[#E5E5E5] flex items-center justify-between bg-[#FBFBFA]">
              <div>
                <h4 className="font-bold text-sm text-[#171717]">{board.byCategory[cat]?.label ?? categoryLabel(cat)}</h4>
                <p className="text-[11px] text-[#737373]">
                  {present} of {all.length} present · {all.filter((r) => r.status === 'ABSENT').length} absent
                </p>
              </div>
            </header>

            {Array.from(byLoc.entries())
              .sort((a, b) => a[0].localeCompare(b[0]))
              .map(([locName, list]) => (
                <div key={locName}>
                  <div className="px-4 py-1.5 bg-[#F7F6F2] border-b border-[#EEEDE9] text-[11px] font-semibold text-[#525252] flex items-center gap-1.5">
                    <MapPin className="w-3 h-3" /> {locName}
                    {list[0]?.location && <span className="font-normal text-[#737373]">· {locationTypeLabel(list[0].location.locationType)} · {list[0].location.district}</span>}
                  </div>

                  {/* Mobile cards */}
                  <div className="sm:hidden divide-y divide-[#F0EFEB]">
                    {list.map((r) => (
                      <div key={r.employee.id} className="p-3 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="font-semibold text-xs text-[#171717] truncate">{r.employee.fullName}</div>
                            <div className="text-[11px] text-[#737373]">
                              <span className="font-mono">{r.employee.employeeCode}</span>
                              {r.employee.designation && ` · ${r.employee.designation}`}
                            </div>
                            {r.employee.dateOfJoining && <div className="text-[10px] text-[#A3A3A3]">DOJ {fmtDate(r.employee.dateOfJoining)}</div>}
                          </div>
                          <StatusBadge status={r.status} late={r.isLate} />
                        </div>
                        <Details r={r} />
                        {r.record && <RowActions r={r} onSelfie={viewSelfie} onEdit={onEditRecord} onDelete={onDeleteRecord} />}
                      </div>
                    ))}
                  </div>

                  {/* Desktop table */}
                  <div className="hidden sm:block overflow-x-auto">
                    <table className="w-full text-xs min-w-[860px]">
                      <thead className="text-[10px] uppercase tracking-wider text-[#737373] border-b border-[#F0EFEB]">
                        <tr>
                          <th className="text-left font-semibold px-4 py-2">Employee</th>
                          <th className="text-left font-semibold px-3 py-2">Designation</th>
                          <th className="text-left font-semibold px-3 py-2">DOJ</th>
                          <th className="text-left font-semibold px-3 py-2">Status</th>
                          <th className="text-left font-semibold px-3 py-2">In</th>
                          <th className="text-left font-semibold px-3 py-2">Out</th>
                          <th className="text-left font-semibold px-3 py-2">Details</th>
                          <th className="text-right font-semibold px-4 py-2">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#F5F5F4]">
                        {list.map((r) => (
                          <tr key={r.employee.id} className="hover:bg-[#FBFBFA] align-top">
                            <td className="px-4 py-2.5">
                              <div className="font-semibold text-[#171717] flex items-center gap-1">
                                {r.employee.fullName}
                                {!r.employee.faceEnrolled && <span title="Face not enrolled"><ScanFace className="w-3 h-3 text-amber-500" /></span>}
                              </div>
                              <div className="font-mono text-[11px] text-[#737373]">{r.employee.employeeCode}</div>
                            </td>
                            <td className="px-3 py-2.5 text-[#404040]">{r.employee.designation || '—'}</td>
                            <td className="px-3 py-2.5 text-[#404040] whitespace-nowrap">{fmtDate(r.employee.dateOfJoining) || '—'}</td>
                            <td className="px-3 py-2.5">
                              <StatusBadge status={r.status} late={r.isLate} />
                            </td>
                            <td className="px-3 py-2.5 font-semibold whitespace-nowrap">{fmtIST(r.record?.checkInAt) || '—'}</td>
                            <td className="px-3 py-2.5 font-semibold whitespace-nowrap">{fmtIST(r.record?.checkOutAt) || '—'}</td>
                            <td className="px-3 py-2.5 max-w-xs">
                              <Details r={r} compact />
                            </td>
                            <td className="px-4 py-2.5 text-right">
                              {r.record && <RowActions r={r} onSelfie={viewSelfie} onEdit={onEditRecord} onDelete={onDeleteRecord} />}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
          </section>
        );
      })}

      {selfie && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => setSelfie(null)}>
          <div className="bg-white rounded-xl p-3 max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-semibold">{selfie.title}</div>
              <button onClick={() => setSelfie(null)} aria-label="Close">
                <X className="w-4 h-4" />
              </button>
            </div>
            {selfie.src ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={selfie.src} alt="Attendance selfie" className="w-full rounded-lg" />
            ) : selfie.error ? (
              <div className="text-xs text-red-700 p-6 text-center">{selfie.error}</div>
            ) : (
              <div className="py-16 flex justify-center">
                <Loader2 className="w-5 h-5 animate-spin" />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Chip({ active, onClick, label, count, sub }: { active: boolean; onClick: () => void; label: string; count?: number; sub?: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex-shrink-0 px-3 py-1.5 rounded-lg border text-[11px] font-semibold whitespace-nowrap transition-colors ${
        active ? 'bg-[#171717] text-white border-[#171717]' : 'bg-white text-[#404040] border-[#E5E5E5] hover:bg-[#F7F6F2]'
      }`}
    >
      {label} <span className={active ? 'text-white/70' : 'text-[#A3A3A3]'}>{count ?? ''}</span>
      {sub && <span className={`ml-1 font-normal ${active ? 'text-white/70' : 'text-emerald-700'}`}>({sub})</span>}
    </button>
  );
}

function StatusBadge({ status, late }: { status: string; late?: boolean }) {
  const st = DAY_STATUS[status] ?? DAY_STATUS.NOT_YET;
  return (
    <span className="inline-flex flex-wrap gap-1">
      <span className={`inline-block px-2 py-0.5 rounded border text-[10px] font-semibold whitespace-nowrap ${st.cls}`}>{st.label}</span>
      {late && <span className="inline-block px-2 py-0.5 rounded border text-[10px] font-semibold bg-amber-50 text-amber-800 border-amber-200">Late</span>}
    </span>
  );
}

function Details({ r, compact }: { r: any; compact?: boolean }) {
  const rec = r.record;
  return (
    <div className={`space-y-1 ${compact ? '' : 'text-[11px]'} text-[#525252]`}>
      {r.shift && (
        <div className="flex items-center gap-1">
          <Clock className="w-3 h-3" /> {r.shift.name} {r.shift.startTime}–{r.shift.endTime}
        </div>
      )}
      {rec?.checkInLocationName && (
        <div className="flex items-center gap-1">
          <MapPin className="w-3 h-3" /> {rec.checkInLocationName}
          {rec.checkInDistanceMetres !== null && rec.checkInLocationRefType !== 'ANYWHERE' && Number(rec.checkInDistanceMetres) > 0 && (
            <span className="text-[#A3A3A3]">· {Math.round(Number(rec.checkInDistanceMetres))} m</span>
          )}
          {rec.checkInFaceScore != null && <span className="text-[#A3A3A3]">· face {Math.round(rec.checkInFaceScore * 100)}%</span>}
        </div>
      )}
      {r.tasks && (
        <div className="flex items-center gap-1">
          <Route className="w-3 h-3" /> Route {r.tasks.completed}/{r.tasks.total} done, {r.tasks.visited} visited
        </div>
      )}
      {r.camps?.map((c: any) => (
        <div key={c.id} className="flex items-center gap-1">
          <Tent className="w-3 h-3" /> {c.name} ({c.time}) {c.checkOutAt ? '· done' : c.checkInAt ? `· in ${fmtIST(c.checkInAt)}` : '· not marked'}
        </div>
      ))}
      {rec?.checkInIsMockLocation && (
        <div className="flex items-center gap-1 text-red-700">
          <AlertTriangle className="w-3 h-3" /> Mock location flagged
        </div>
      )}
      {rec?.workReport && <div className="italic text-[#737373] line-clamp-2">&ldquo;{rec.workReport}&rdquo;</div>}
    </div>
  );
}

function RowActions({
  r,
  onSelfie,
  onEdit,
  onDelete,
}: {
  r: any;
  onSelfie: (r: any, which: 'in' | 'out') => void;
  onEdit: (rec: any) => void;
  onDelete: (rec: any) => void;
}) {
  const rec = { ...r.record, employee: r.employee };
  return (
    <div className="flex items-center justify-end gap-1">
      {r.record.hasCheckInSelfie && (
        <button onClick={() => onSelfie(r, 'in')} className="p-1.5 rounded text-[#525252] hover:bg-[#F0EFEB]" title="Check-in selfie">
          <Camera className="w-3.5 h-3.5" />
        </button>
      )}
      {r.record.hasCheckOutSelfie && (
        <button onClick={() => onSelfie(r, 'out')} className="p-1.5 rounded text-[#525252] hover:bg-[#F0EFEB]" title="Check-out selfie">
          <Camera className="w-3.5 h-3.5 rotate-180" />
        </button>
      )}
      <button onClick={() => onEdit(rec)} className="p-1.5 rounded text-blue-600 hover:bg-blue-50" title="Edit record">
        <Edit2 className="w-3.5 h-3.5" />
      </button>
      <button onClick={() => onDelete(rec)} className="p-1.5 rounded text-red-600 hover:bg-red-50" title="Delete record">
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
