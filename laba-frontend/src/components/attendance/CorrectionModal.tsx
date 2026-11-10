import React, { useState } from 'react';
import { apiClient } from '@/lib/api';
import { X, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';

interface CorrectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  attendanceRecord?: any;
  defaultDate?: string;
  onSuccess: () => void;
}

export const CorrectionModal: React.FC<CorrectionModalProps> = ({
  isOpen,
  onClose,
  attendanceRecord,
  defaultDate,
  onSuccess,
}) => {
  const [workDate, setWorkDate] = useState(
    attendanceRecord?.workDate ? attendanceRecord.workDate.slice(0, 10) : defaultDate || new Date().toISOString().slice(0, 10)
  );
  const [correctionType, setCorrectionType] = useState('MISSED_CHECKIN');
  const [employeeReason, setEmployeeReason] = useState('');
  const [proposedCheckIn, setProposedCheckIn] = useState('');
  const [proposedCheckOut, setProposedCheckOut] = useState('');
  const [proposedWorkReport, setProposedWorkReport] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (employeeReason.trim().length < 10) {
      setError('Reason must be at least 10 characters long.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await apiClient.post('/attendance/corrections', {
        attendanceRecordId: attendanceRecord?.id || undefined,
        workDate,
        correctionType,
        employeeReason: employeeReason.trim(),
        proposedCheckIn: proposedCheckIn || undefined,
        proposedCheckOut: proposedCheckOut || undefined,
        proposedWorkReport: proposedWorkReport || undefined,
      });

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || 'Failed to submit correction request.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-5 border border-[#E5E5E5] space-y-4">
        <div className="flex items-center justify-between border-b border-[#E5E5E5] pb-3">
          <h3 className="text-sm font-bold text-[#171717]">Request Attendance Correction</h3>
          <button onClick={onClose} className="text-[#737373] hover:text-[#171717]">
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="p-2.5 bg-red-50 border border-red-200 rounded text-xs text-red-800 flex items-center space-x-1.5">
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3 text-xs">
          <div>
            <label className="block font-medium text-[#171717] mb-1">Work Date</label>
            <input
              type="date"
              value={workDate}
              onChange={(e) => setWorkDate(e.target.value)}
              required
              className="w-full p-2 border border-[#E5E5E5] rounded focus:outline-none focus:ring-1 focus:ring-black"
            />
          </div>

          <div>
            <label className="block font-medium text-[#171717] mb-1">Correction Type</label>
            <select
              value={correctionType}
              onChange={(e) => setCorrectionType(e.target.value)}
              className="w-full p-2 border border-[#E5E5E5] rounded focus:outline-none focus:ring-1 focus:ring-black bg-white"
            >
              <option value="MISSED_CHECKIN">Missed Check-In</option>
              <option value="MISSED_CHECKOUT">Missed Check-Out</option>
              <option value="WRONG_LOCATION">GPS / Geofence Glitch</option>
              <option value="OTHER">Other Reason</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block font-medium text-[#171717] mb-1">Proposed Check-In</label>
              <input
                type="text"
                placeholder="09:15"
                value={proposedCheckIn}
                onChange={(e) => setProposedCheckIn(e.target.value)}
                className="w-full p-2 border border-[#E5E5E5] rounded focus:outline-none focus:ring-1 focus:ring-black"
              />
            </div>
            <div>
              <label className="block font-medium text-[#171717] mb-1">Proposed Check-Out</label>
              <input
                type="text"
                placeholder="16:45"
                value={proposedCheckOut}
                onChange={(e) => setProposedCheckOut(e.target.value)}
                className="w-full p-2 border border-[#E5E5E5] rounded focus:outline-none focus:ring-1 focus:ring-black"
              />
            </div>
          </div>

          <div>
            <label className="block font-medium text-[#171717] mb-1">
              Detailed Reason <span className="text-red-500">* (min 10 chars)</span>
            </label>
            <textarea
              rows={3}
              value={employeeReason}
              onChange={(e) => setEmployeeReason(e.target.value)}
              placeholder="Explain why the attendance could not be marked on time (e.g. emergency client call, temporary network outage)..."
              required
              className="w-full p-2 border border-[#E5E5E5] rounded focus:outline-none focus:ring-1 focus:ring-black resize-none"
            />
          </div>

          <div className="flex justify-end space-x-2 pt-2 border-t border-[#E5E5E5]">
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
              className="px-4 py-1.5 bg-[#171717] text-white hover:bg-black rounded font-medium flex items-center space-x-1.5 disabled:opacity-50"
            >
              {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
              <span>Submit Request</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

