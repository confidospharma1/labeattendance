'use client';

import React, { useState } from 'react';
import { FileSpreadsheet, Download, Loader2 } from 'lucide-react';
import { apiClient, apiErrorMessage } from '@/lib/api';
import { CATEGORIES, istToday } from '@/lib/staff';
import { saveFile, filenameFrom } from '@/lib/download';

const shift = (ymd: string, days: number) => new Date(new Date(`${ymd}T00:00:00Z`).getTime() + days * 86_400_000).toISOString().slice(0, 10);

/** Download what staff wrote about their work (check-out reports, field visit notes & surveys, camp reports) as Excel. */
export function WorkReportsExport({ employees = [] }: { employees?: any[] }) {
  const today = istToday();
  const [from, setFrom] = useState(shift(today, -6));
  const [to, setTo] = useState(today);
  const [category, setCategory] = useState('ALL');
  const [employeeId, setEmployeeId] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const staff = employees.filter((e) => category === 'ALL' || e.staffCategory === category);

  const download = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const params = new URLSearchParams({ from, to, category });
      if (employeeId) params.set('employeeId', employeeId);
      const res = await apiClient.get(`/reports/work-reports/export?${params}`, { responseType: 'blob' });
      const name = filenameFrom(res.headers['content-disposition'], `J-Track_Work_Reports_${from}_to_${to}.xlsx`);
      const { savedTo } = await saveFile(new Blob([res.data]), name);
      setMsg({ ok: true, text: `Saved ${name} to ${savedTo}.` });
    } catch (err: any) {
      // Errors arrive as a Blob because of responseType: 'blob'
      const data = err?.response?.data;
      let text = data instanceof Blob ? 'Could not download the work reports.' : apiErrorMessage(err, 'Could not download the work reports.');
      if (data instanceof Blob) {
        try {
          text = JSON.parse(await data.text())?.error?.message || text;
        } catch {
          /* keep the generic message */
        }
      }
      setMsg({ ok: false, text });
    } finally {
      setBusy(false);
    }
  };

  const field = 'h-9 px-2 text-xs border border-[#E2E8F0] rounded-lg bg-white w-full';
  return (
    <section className="bg-white border border-[#E2E8F0] rounded-2xl p-3.5 sm:p-5">
      <div className="flex items-start gap-3">
        <span className="w-9 h-9 rounded-xl bg-brand-50 text-brand-700 flex items-center justify-center flex-shrink-0">
          <FileSpreadsheet className="w-4 h-4" />
        </span>
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-ink">Staff work reports (Excel)</h3>
          <p className="text-[11px] text-[#64748B]">
            Daily check-out reports, field visit notes with survey details, and camp reports written by staff.
          </p>
        </div>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-2 mt-3 items-end">
        <label className="text-[11px] text-[#475569] space-y-1">
          <span className="block">From</span>
          <input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className={field} />
        </label>
        <label className="text-[11px] text-[#475569] space-y-1">
          <span className="block">To</span>
          <input type="date" value={to} min={from} max={today} onChange={(e) => setTo(e.target.value)} className={field} />
        </label>
        <label className="text-[11px] text-[#475569] space-y-1">
          <span className="block">Staff category</span>
          <select
            value={category}
            onChange={(e) => {
              setCategory(e.target.value);
              setEmployeeId('');
            }}
            className={field}
          >
            <option value="ALL">All categories</option>
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-[11px] text-[#475569] space-y-1">
          <span className="block">Employee</span>
          <select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} className={field}>
            <option value="">All staff</option>
            {staff.map((e) => (
              <option key={e.id} value={e.id}>
                {e.fullName} ({e.employeeCode})
              </option>
            ))}
          </select>
        </label>
        <button
          onClick={download}
          disabled={busy || !from || !to}
          className="col-span-2 lg:col-span-1 h-9 px-3 rounded-lg bg-brand-700 hover:bg-brand-800 text-white text-xs font-semibold inline-flex items-center justify-center gap-1.5 disabled:opacity-50"
        >
          {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
          Download reports
        </button>
      </div>
      {msg && <div className={`mt-2 text-xs ${msg.ok ? 'text-emerald-700' : 'text-red-700'}`}>{msg.text}</div>}
    </section>
  );
}
