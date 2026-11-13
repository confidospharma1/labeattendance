'use client';

import React, { useState } from 'react';
import { apiClient } from '@/lib/api';
import { X, Calendar, Loader2, Check } from 'lucide-react';

interface WeeklyScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  employee: any;
  onSuccess: () => void;
}

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export const WeeklyScheduleModal: React.FC<WeeklyScheduleModalProps> = ({
  isOpen,
  onClose,
  employee,
  onSuccess,
}) => {
  const today = new Date();
  const nextMonday = new Date(today);
  nextMonday.setDate(today.getDate() + ((1 + 7 - today.getDay()) % 7 || 7));
  const defaultMondayStr = nextMonday.toISOString().slice(0, 10);

  const [weekStartDate, setWeekStartDate] = useState(defaultMondayStr);
  const [schedules, setSchedules] = useState<any[]>(
    DAYS.map((day, idx) => ({
      dayOfWeek: idx,
      dayName: day,
      scheduleType: idx === 6 ? 'WEEKLY_OFF' : 'UNASSIGNED', // Sunday default weekly off
      locationName: idx === 6 ? 'Sunday Off' : 'Field Client Visits',
      latitude: 14.4673,
      longitude: 78.8242,
      geofenceRadiusMetres: 100,
      attendanceEnabled: idx !== 6,
    }))
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !employee) return null;

  const handleScheduleChange = (index: number, field: string, value: any) => {
    setSchedules((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      if (field === 'scheduleType') {
        if (value === 'WEEKLY_OFF' || value === 'ATTENDANCE_DISABLED') {
          updated[index].attendanceEnabled = false;
        } else {
          updated[index].attendanceEnabled = true;
        }
      }
      return updated;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      await apiClient.post(`/schedules/field-staff/${employee.id}/weekly`, {
        weekStartDate,
        schedules: schedules.map((s) => ({
          dayOfWeek: s.dayOfWeek,
          scheduleType: s.scheduleType,
          locationName: s.locationName || undefined,
          latitude: s.scheduleType === 'LOCATION_ASSIGNED' ? Number(s.latitude) : undefined,
          longitude: s.scheduleType === 'LOCATION_ASSIGNED' ? Number(s.longitude) : undefined,
          geofenceRadiusMetres: s.scheduleType === 'LOCATION_ASSIGNED' ? Number(s.geofenceRadiusMetres) : undefined,
          attendanceEnabled: s.attendanceEnabled,
        })),
      });

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || 'Failed to assign weekly schedule');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-3 sm:p-5 overflow-y-auto animate-in fade-in duration-150">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full p-4 sm:p-6 border border-[#E5E5E5] space-y-4 my-auto max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between border-b border-[#E5E5E5] pb-3 shrink-0">
          <div className="flex items-center space-x-2">
            <Calendar className="w-4 h-4 text-[#171717]" />
            <div>
              <h3 className="text-sm font-bold text-[#171717]">7-Day Field Schedule Assignment</h3>
              <p className="text-xs text-[#737373]">
                {employee.fullName} ({employee.employeeCode})
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-[#737373] hover:text-[#171717]">
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="p-2.5 bg-red-50 border border-red-200 rounded text-xs text-red-800">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block font-medium text-[#171717] mb-1">Week Starting Monday</label>
            <input
              type="date"
              value={weekStartDate}
              onChange={(e) => setWeekStartDate(e.target.value)}
              required
              className="w-full sm:w-48 p-2 border border-[#E5E5E5] rounded focus:outline-none focus:ring-1 focus:ring-black"
            />
          </div>

          <div className="space-y-2 border border-[#E5E5E5] rounded p-3 bg-[#F9F9F8] max-h-96 overflow-y-auto">
            {schedules.map((s, idx) => (
              <div
                key={s.dayName}
                className="bg-white p-2.5 rounded border border-[#E5E5E5] flex flex-col sm:flex-row sm:items-center justify-between gap-2"
              >
                <div className="w-24 font-bold text-[#171717]">{s.dayName}</div>

                <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <select
                    value={s.scheduleType}
                    onChange={(e) => handleScheduleChange(idx, 'scheduleType', e.target.value)}
                    className="p-1.5 border border-[#E5E5E5] rounded bg-white"
                  >
                    <option value="UNASSIGNED">Unassigned (Free Duty)</option>
                    <option value="LOCATION_ASSIGNED">Location Assigned (Geofenced)</option>
                    <option value="WEEKLY_OFF">Weekly Off</option>
                    <option value="ATTENDANCE_DISABLED">Attendance Disabled</option>
                  </select>

                  <input
                    type="text"
                    placeholder="Location / duty notes"
                    value={s.locationName}
                    onChange={(e) => handleScheduleChange(idx, 'locationName', e.target.value)}
                    className="p-1.5 border border-[#E5E5E5] rounded"
                  />
                </div>
              </div>
            ))}
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
              <span>Save 7-Day Schedule</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

