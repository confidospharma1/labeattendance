'use client';

import React, { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api';
import { X, Loader2, Clock, AlertCircle } from 'lucide-react';

interface EditAttendanceModalProps {
  isOpen: boolean;
  record: any | null;
  onClose: () => void;
  onSuccess: () => void;
}

export const EditAttendanceModal: React.FC<EditAttendanceModalProps> = ({
  isOpen,
  record,
  onClose,
  onSuccess,
}) => {
  const [status, setStatus] = useState('CHECKED_OUT');
  const [checkInTime, setCheckInTime] = useState('');
  const [checkOutTime, setCheckOutTime] = useState('');
  const [workReport, setWorkReport] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (record) {
      setStatus(record.status || 'CHECKED_OUT');
      setCheckInTime(
        record.checkInAt
          ? new Date(record.checkInAt).toISOString().slice(0, 16)
          : ''
      );
      setCheckOutTime(
        record.checkOutAt
          ? new Date(record.checkOutAt).toISOString().slice(0, 16)
          : ''
      );
      setWorkReport(record.workReport || '');
      setNotes('');
      setErrorMsg(null);
    }
  }, [record]);

  if (!isOpen || !record) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      setErrorMsg(null);

      await apiClient.patch(`/attendance/records/${record.id}`, {
        status,
        checkInAt: checkInTime ? new Date(checkInTime).toISOString() : undefined,
        checkOutAt: checkOutTime ? new Date(checkOutTime).toISOString() : undefined,
        workReport: workReport.trim() || undefined,
        notes: notes.trim() || undefined,
      });

      onSuccess();
      onClose();
    } catch (err: any) {
      const msg = err.response?.data?.error?.message || err.message || 'Failed to update attendance record';
      setErrorMsg(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/50 backdrop-blur-sm animate-in fade-in duration-150 overflow-y-auto">
      <div className="w-full max-w-lg bg-white border border-[#E5E5E5] rounded-xl shadow-xl overflow-hidden my-auto max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#E5E5E5] bg-[#F7F6F2]">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#171717] text-white flex items-center justify-center font-bold text-xs">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-semibold text-sm text-[#171717]">Edit Attendance Record</h3>
              <p className="text-[11px] text-[#737373]">
                {record.employee?.fullName} ({record.employee?.employeeCode})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-[#737373] hover:text-[#171717] hover:bg-[#E5E5E5] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4">
          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-start space-x-2">
              <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-[#171717] mb-1">
              Attendance Status <span className="text-red-500">*</span>
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-white border border-[#E5E5E5] rounded-lg focus:outline-none focus:border-[#171717] text-[#171717]"
            >
              <option value="CHECKED_IN">Checked-In Only</option>
              <option value="CHECKED_OUT">Checked-Out (Complete Day)</option>
              <option value="CORRECTED">Corrected (Approved Adjustment)</option>
              <option value="ABSENT">Absent</option>
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#171717] mb-1">
                Check-In Timestamp
              </label>
              <input
                type="datetime-local"
                value={checkInTime}
                onChange={(e) => setCheckInTime(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white border border-[#E5E5E5] rounded-lg focus:outline-none focus:border-[#171717] text-[#171717]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#171717] mb-1">
                Check-Out Timestamp
              </label>
              <input
                type="datetime-local"
                value={checkOutTime}
                onChange={(e) => setCheckOutTime(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white border border-[#E5E5E5] rounded-lg focus:outline-none focus:border-[#171717] text-[#171717]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#171717] mb-1">
              Daily Work Report
            </label>
            <textarea
              rows={3}
              value={workReport}
              onChange={(e) => setWorkReport(e.target.value)}
              placeholder="Summary of employee's daily clinical and counter activities..."
              className="w-full px-3 py-2 text-xs bg-white border border-[#E5E5E5] rounded-lg focus:outline-none focus:border-[#171717] text-[#171717]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#171717] mb-1">
              Admin Adjustment Reason
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Approved manual correction per store manager call"
              className="w-full px-3 py-2 text-xs bg-white border border-[#E5E5E5] rounded-lg focus:outline-none focus:border-[#171717] text-[#171717]"
            />
          </div>

          {/* Footer actions */}
          <div className="pt-3 border-t border-[#E5E5E5] flex items-center justify-end space-x-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 border border-[#E5E5E5] hover:bg-[#F9F9F8] rounded-lg text-xs font-medium text-[#171717] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 bg-[#171717] hover:bg-black text-white rounded-lg text-xs font-medium transition-colors flex items-center space-x-1.5 disabled:opacity-50"
            >
              {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>{submitting ? 'Saving...' : 'Update Record'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
