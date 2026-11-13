'use client';

import React, { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api';
import { X, Sliders, Check, Loader2, AlertCircle, Clock } from 'lucide-react';

interface PolicyModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentPolicy: any;
  onSuccess: () => void;
}

const HOURS = Array.from({ length: 12 }, (_, i) => (i + 1).toString().padStart(2, '0'));
const MINUTES = Array.from({ length: 60 }, (_, i) => i.toString().padStart(2, '0'));

function parse24to12(time24: string): { hour: string; minute: string; period: 'AM' | 'PM' } {
  if (!time24 || !time24.includes(':')) {
    return { hour: '09', minute: '00', period: 'AM' };
  }
  const [hStr, mStr] = time24.split(':');
  let h = parseInt(hStr, 10);
  if (isNaN(h)) h = 9;
  const minute = (parseInt(mStr, 10) || 0).toString().padStart(2, '0');
  const period: 'AM' | 'PM' = h >= 12 ? 'PM' : 'AM';
  h = h % 12;
  if (h === 0) h = 12;
  const hour = h.toString().padStart(2, '0');
  return { hour, minute, period };
}

function format12to24(hour: string, minute: string, period: 'AM' | 'PM'): string {
  let h = parseInt(hour, 10);
  if (isNaN(h)) h = 9;
  if (period === 'PM' && h < 12) h += 12;
  if (period === 'AM' && h === 12) h = 0;
  return `${h.toString().padStart(2, '0')}:${minute.padStart(2, '0')}`;
}

interface TimeSelectorProps {
  label: string;
  value: string; // 24-hour "HH:MM" format
  onChange: (time24: string) => void;
}

const TimeSelector: React.FC<TimeSelectorProps> = ({ label, value, onChange }) => {
  const { hour, minute, period } = parse24to12(value);

  const handleHourChange = (newHour: string) => {
    onChange(format12to24(newHour, minute, period));
  };

  const handleMinuteChange = (newMinute: string) => {
    onChange(format12to24(hour, newMinute, period));
  };

  const handlePeriodChange = (newPeriod: 'AM' | 'PM') => {
    onChange(format12to24(hour, minute, newPeriod));
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label className="text-xs text-[#737373] font-medium">{label}</label>
        <span className="text-[10px] font-mono text-[#737373] bg-neutral-100 px-1.5 py-0.5 rounded border border-[#E5E5E5]">
          {hour}:{minute} {period} ({value} IST)
        </span>
      </div>
      <div className="flex items-center space-x-1.5 bg-[#F9F9F8] border border-[#E5E5E5] rounded-lg p-1.5 focus-within:ring-1 focus-within:ring-black">
        {/* Hour (01 - 12) */}
        <div className="flex-1">
          <select
            value={hour}
            onChange={(e) => handleHourChange(e.target.value)}
            className="w-full bg-white border border-[#E5E5E5] rounded px-2 py-1.5 text-xs font-mono font-semibold text-[#171717] focus:outline-none focus:border-black cursor-pointer text-center"
            title="Hour (01 - 12)"
          >
            {HOURS.map((h) => (
              <option key={h} value={h}>
                {h}
              </option>
            ))}
          </select>
        </div>

        <span className="text-sm font-bold text-[#737373]">:</span>

        {/* Minute (00 - 59) */}
        <div className="flex-1">
          <select
            value={minute}
            onChange={(e) => handleMinuteChange(e.target.value)}
            className="w-full bg-white border border-[#E5E5E5] rounded px-2 py-1.5 text-xs font-mono font-semibold text-[#171717] focus:outline-none focus:border-black cursor-pointer text-center"
            title="Minute (00 - 59)"
          >
            {MINUTES.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>

        {/* AM / PM */}
        <div className="flex-1">
          <select
            value={period}
            onChange={(e) => handlePeriodChange(e.target.value as 'AM' | 'PM')}
            className={`w-full border rounded px-2 py-1.5 text-xs font-bold focus:outline-none cursor-pointer text-center ${
              period === 'AM'
                ? 'bg-amber-50 text-amber-800 border-amber-300'
                : 'bg-indigo-50 text-indigo-800 border-indigo-300'
            }`}
            title="AM / PM Period"
          >
            <option value="AM">AM</option>
            <option value="PM">PM</option>
          </select>
        </div>
      </div>
    </div>
  );
};

export const PolicyModal: React.FC<PolicyModalProps> = ({
  isOpen,
  onClose,
  currentPolicy,
  onSuccess,
}) => {
  const [morningStart, setMorningStart] = useState(currentPolicy?.morningStart || '09:00');
  const [morningEnd, setMorningEnd] = useState(currentPolicy?.morningEnd || '09:20');
  const [eveningStart, setEveningStart] = useState(currentPolicy?.eveningStart || '16:30');
  const [eveningEnd, setEveningEnd] = useState(currentPolicy?.eveningEnd || '17:00');
  const [defaultGeofenceRadiusMetres, setDefaultGeofenceRadiusMetres] = useState(
    currentPolicy?.defaultGeofenceRadiusMetres || 100
  );
  const [gpsAccuracyRejectMetres, setGpsAccuracyRejectMetres] = useState(
    currentPolicy?.gpsAccuracyRejectMetres || 200
  );
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && currentPolicy) {
      setMorningStart(currentPolicy.morningStart || '09:00');
      setMorningEnd(currentPolicy.morningEnd || '09:20');
      setEveningStart(currentPolicy.eveningStart || '16:30');
      setEveningEnd(currentPolicy.eveningEnd || '17:00');
      setDefaultGeofenceRadiusMetres(currentPolicy.defaultGeofenceRadiusMetres || 100);
      setGpsAccuracyRejectMetres(currentPolicy.gpsAccuracyRejectMetres || 200);
      setNotes(currentPolicy.notes || '');
      setError(null);
    }
  }, [isOpen, currentPolicy]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation: Start time must precede end time
    if (morningStart >= morningEnd) {
      setError('Morning Check-In Start Time must be before End Time.');
      return;
    }

    if (eveningStart >= eveningEnd) {
      setError('Evening Check-Out Start Time must be before End Time.');
      return;
    }

    setSubmitting(true);

    try {
      await apiClient.post('/policies', {
        morningStart,
        morningEnd,
        eveningStart,
        eveningEnd,
        defaultGeofenceRadiusMetres: Number(defaultGeofenceRadiusMetres),
        gpsAccuracyRejectMetres: Number(gpsAccuracyRejectMetres),
        notes: notes.trim() || undefined,
      });

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || 'Failed to update attendance policy');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-5 border border-[#E5E5E5] space-y-4 my-8">
        <div className="flex items-center justify-between border-b border-[#E5E5E5] pb-3">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-lg bg-[#171717] text-white flex items-center justify-center">
              <Sliders className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#171717]">Company Attendance Policy Settings</h3>
              <p className="text-xs text-[#737373]">Configure authoritative IST windows and GPS boundaries</p>
            </div>
          </div>
          <button onClick={onClose} className="text-[#737373] hover:text-[#171717]">
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="p-2.5 bg-red-50 border border-red-200 rounded text-xs text-red-800 flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* Morning Check-In Window */}
          <div className="bg-[#FAF9F5] border border-[#EAE9E4] rounded-lg p-3 space-y-2.5">
            <div className="flex items-center space-x-1.5 font-semibold text-[#171717]">
              <Clock className="w-3.5 h-3.5 text-amber-600" />
              <span>Morning Check-In Window (IST)</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <TimeSelector
                label="Start Time"
                value={morningStart}
                onChange={setMorningStart}
              />
              <TimeSelector
                label="End Time"
                value={morningEnd}
                onChange={setMorningEnd}
              />
            </div>
            <p className="text-[11px] text-[#737373]">
              Staff must check in between these hours. Check-ins after the end time are recorded as absent.
            </p>
          </div>

          {/* Evening Check-Out Window */}
          <div className="bg-[#FAF9F5] border border-[#EAE9E4] rounded-lg p-3 space-y-2.5">
            <div className="flex items-center space-x-1.5 font-semibold text-[#171717]">
              <Clock className="w-3.5 h-3.5 text-indigo-600" />
              <span>Evening Check-Out Window (IST)</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <TimeSelector
                label="Start Time"
                value={eveningStart}
                onChange={setEveningStart}
              />
              <TimeSelector
                label="End Time"
                value={eveningEnd}
                onChange={setEveningEnd}
              />
            </div>
            <p className="text-[11px] text-[#737373]">
              Staff can submit evening checkout only during this time window.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-[#171717] mb-1">Default Geofence Radius</label>
              <div className="flex items-center space-x-1">
                <input
                  type="number"
                  min={25}
                  max={1000}
                  value={defaultGeofenceRadiusMetres}
                  onChange={(e) => setDefaultGeofenceRadiusMetres(Number(e.target.value))}
                  required
                  className="w-full p-2 border border-[#E5E5E5] rounded focus:outline-none focus:ring-1 focus:ring-black"
                />
                <span className="text-xs text-[#737373]">metres</span>
              </div>
            </div>
            <div>
              <label className="block font-medium text-[#171717] mb-1">GPS Accuracy Max Limit</label>
              <div className="flex items-center space-x-1">
                <input
                  type="number"
                  min={50}
                  max={500}
                  value={gpsAccuracyRejectMetres}
                  onChange={(e) => setGpsAccuracyRejectMetres(Number(e.target.value))}
                  required
                  className="w-full p-2 border border-[#E5E5E5] rounded focus:outline-none focus:ring-1 focus:ring-black"
                />
                <span className="text-xs text-[#737373]">metres</span>
              </div>
            </div>
          </div>

          <div>
            <label className="block font-medium text-[#171717] mb-1">Revision Notes (Optional)</label>
            <textarea
              rows={2}
              placeholder="e.g. Adjusted winter morning shift timings for coastal branches..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full p-2 border border-[#E5E5E5] rounded focus:outline-none focus:ring-1 focus:ring-black resize-none"
            />
          </div>

          <div className="flex justify-end space-x-2 pt-3 border-t border-[#E5E5E5]">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 border border-[#E5E5E5] text-[#737373] hover:text-[#171717] rounded"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-1.5 bg-[#171717] hover:bg-black text-white rounded font-medium flex items-center space-x-1.5 disabled:opacity-50"
            >
              {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              <span>Save Policy Version</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
