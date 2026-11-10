'use client';

import React, { useState } from 'react';
import { apiClient } from '@/lib/api';
import { X, Sliders, Check, Loader2, AlertCircle } from 'lucide-react';

interface PolicyModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentPolicy: any;
  onSuccess: () => void;
}

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

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 overflow-y-auto">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full p-5 border border-[#E5E5E5] space-y-4 my-8">
        <div className="flex items-center justify-between border-b border-[#E5E5E5] pb-3">
          <div className="flex items-center space-x-2">
            <Sliders className="w-4 h-4 text-[#171717]" />
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
            <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <div className="font-semibold text-[#171717] mb-1">Morning Check-In Window (IST)</div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[#737373] mb-1">Start Time (HH:MM)</label>
                <input
                  type="text"
                  placeholder="09:00"
                  value={morningStart}
                  onChange={(e) => setMorningStart(e.target.value)}
                  required
                  className="w-full p-2 border border-[#E5E5E5] rounded focus:outline-none focus:ring-1 focus:ring-black font-mono"
                />
              </div>
              <div>
                <label className="block text-[#737373] mb-1">End Time (HH:MM)</label>
                <input
                  type="text"
                  placeholder="09:20"
                  value={morningEnd}
                  onChange={(e) => setMorningEnd(e.target.value)}
                  required
                  className="w-full p-2 border border-[#E5E5E5] rounded focus:outline-none focus:ring-1 focus:ring-black font-mono"
                />
              </div>
            </div>
          </div>

          <div>
            <div className="font-semibold text-[#171717] mb-1">Evening Check-Out Window (IST)</div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[#737373] mb-1">Start Time (HH:MM)</label>
                <input
                  type="text"
                  placeholder="16:30"
                  value={eveningStart}
                  onChange={(e) => setEveningStart(e.target.value)}
                  required
                  className="w-full p-2 border border-[#E5E5E5] rounded focus:outline-none focus:ring-1 focus:ring-black font-mono"
                />
              </div>
              <div>
                <label className="block text-[#737373] mb-1">End Time (HH:MM)</label>
                <input
                  type="text"
                  placeholder="17:00"
                  value={eveningEnd}
                  onChange={(e) => setEveningEnd(e.target.value)}
                  required
                  className="w-full p-2 border border-[#E5E5E5] rounded focus:outline-none focus:ring-1 focus:ring-black font-mono"
                />
              </div>
            </div>
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
