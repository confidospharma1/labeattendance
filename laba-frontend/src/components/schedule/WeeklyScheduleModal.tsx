'use client';

import React, { useState } from 'react';
import dynamic from 'next/dynamic';
import { apiClient } from '@/lib/api';
import { X, Calendar, Loader2, Check, MapPin, Compass, Sparkles, Map } from 'lucide-react';
import { AP_VILLAGES_MANDALS, findTerritory } from '@/lib/geoData';

const FieldTerritoryMapPicker = dynamic(() => import('./FieldTerritoryMapPicker'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-80 bg-[#F0EFEB] rounded-xl flex items-center justify-center text-xs text-[#737373]">
      <Loader2 className="w-5 h-5 animate-spin mr-2 text-[#171717]" />
      <span>Loading Interactive Territory Map...</span>
    </div>
  ),
});

interface WeeklyScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  employee: any;
  onSuccess: () => void;
}

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

// Recommended 6-day village route preset
const SAMPLE_6DAY_ROUTE = [
  { name: 'Chagalamarri', lat: 14.9645, lng: 78.5891 },
  { name: 'Allagadda', lat: 15.1311, lng: 78.5134 },
  { name: 'Koilkuntla', lat: 15.2346, lng: 78.3168 },
  { name: 'Banaganapalle', lat: 15.3186, lng: 78.2274 },
  { name: 'Sirvel', lat: 15.3197, lng: 78.5303 },
  { name: 'Nandyal', lat: 15.4788, lng: 78.4836 },
];

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
    DAYS.map((day, idx) => {
      const isSunday = idx === 6;
      const sample = SAMPLE_6DAY_ROUTE[idx];
      return {
        dayOffset: idx,
        dayOfWeek: idx,
        dayName: day,
        scheduleType: isSunday ? 'WEEKLY_OFF' : 'LOCATION_ASSIGNED',
        locationName: isSunday ? 'Sunday Weekly Off' : (sample ? sample.name : 'Chagalamarri'),
        latitude: isSunday ? undefined : (sample ? sample.lat : 14.9645),
        longitude: isSunday ? undefined : (sample ? sample.lng : 78.5891),
        geofenceRadiusMetres: 6000, // 6km covers the entire village boundary
        attendanceEnabled: !isSunday,
        mapConfirmed: !isSunday,
      };
    })
  );

  // Active day index being edited on the interactive territory map
  const [mapDayIndex, setMapDayIndex] = useState<number | null>(null);

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

  const handleSelectVillage = (index: number, villageName: string) => {
    const resolved = findTerritory(villageName);
    if (resolved) {
      setSchedules((prev) => {
        const updated = [...prev];
        updated[index] = {
          ...updated[index],
          scheduleType: 'LOCATION_ASSIGNED',
          locationName: resolved.name,
          latitude: resolved.latitude,
          longitude: resolved.longitude,
          geofenceRadiusMetres: resolved.boundaryRadius || 6000,
          attendanceEnabled: true,
          mapConfirmed: true,
        };
        return updated;
      });
    } else {
      handleScheduleChange(index, 'locationName', villageName);
    }
  };

  const handleMapConfirm = (location: {
    locationName: string;
    latitude: number;
    longitude: number;
    boundaryRadius: number;
  }) => {
    if (mapDayIndex === null) return;
    setSchedules((prev) => {
      const updated = [...prev];
      updated[mapDayIndex] = {
        ...updated[mapDayIndex],
        scheduleType: 'LOCATION_ASSIGNED',
        locationName: location.locationName,
        latitude: location.latitude,
        longitude: location.longitude,
        geofenceRadiusMetres: location.boundaryRadius || 6000,
        attendanceEnabled: true,
        mapConfirmed: true,
      };
      return updated;
    });
    setMapDayIndex(null);
  };

  const applySampleRoute = () => {
    setSchedules((prev) =>
      prev.map((s, idx) => {
        if (idx === 6) {
          return {
            ...s,
            scheduleType: 'WEEKLY_OFF',
            locationName: 'Sunday Weekly Off',
            attendanceEnabled: false,
            mapConfirmed: false,
          };
        }
        const sample = SAMPLE_6DAY_ROUTE[idx];
        return {
          ...s,
          scheduleType: 'LOCATION_ASSIGNED',
          locationName: sample.name,
          latitude: sample.lat,
          longitude: sample.lng,
          geofenceRadiusMetres: 6000,
          attendanceEnabled: true,
          mapConfirmed: true,
        };
      })
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      await apiClient.post(`/schedules/field-staff/${employee.id}/weekly`, {
        startDate: weekStartDate,
        weekStartDate: weekStartDate,
        schedules: schedules.map((s) => ({
          dayOffset: s.dayOffset,
          dayOfWeek: s.dayOffset,
          scheduleType: s.scheduleType,
          locationName: s.locationName || undefined,
          latitude: s.scheduleType === 'LOCATION_ASSIGNED' ? Number(s.latitude) : undefined,
          longitude: s.scheduleType === 'LOCATION_ASSIGNED' ? Number(s.longitude) : undefined,
          geofenceRadiusMetres: s.scheduleType === 'LOCATION_ASSIGNED' ? Number(s.geofenceRadiusMetres || 6000) : undefined,
          attendanceEnabled: s.attendanceEnabled,
        })),
      });

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || 'Failed to assign 6-day field route schedule');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-2 sm:p-4 overflow-y-auto animate-in fade-in duration-150">
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full p-4 sm:p-6 border border-[#E5E5E5] space-y-4 my-auto max-h-[96vh] flex flex-col">
        {/* If Interactive Map Picker is active, render the Map View */}
        {mapDayIndex !== null ? (
          <div className="flex-1 flex flex-col space-y-3">
            <FieldTerritoryMapPicker
              dayName={schedules[mapDayIndex].dayName}
              initialLocationName={schedules[mapDayIndex].locationName || 'Chagalamarri'}
              initialLatitude={schedules[mapDayIndex].latitude || 14.9645}
              initialLongitude={schedules[mapDayIndex].longitude || 78.5891}
              initialRadiusMetres={schedules[mapDayIndex].geofenceRadiusMetres || 6000}
              onConfirm={handleMapConfirm}
              onCancel={() => setMapDayIndex(null)}
            />
          </div>
        ) : (
          <>
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-[#E5E5E5] pb-3 shrink-0">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-lg bg-[#171717] text-white flex items-center justify-center">
                  <Compass className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#171717]">Field Officer 6-Day Territory Route</h3>
                  <p className="text-xs text-[#737373]">
                    Assign village/mandal boundaries for {employee.fullName} ({employee.employeeCode})
                  </p>
                </div>
              </div>
              <button onClick={onClose} className="text-[#737373] hover:text-[#171717] p-1 rounded">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Explainability Banner */}
            <div className="bg-blue-50/70 border border-blue-200/80 rounded-lg p-3 text-xs text-blue-900 shrink-0 space-y-1">
              <div className="font-semibold flex items-center space-x-1.5">
                <MapPin className="w-3.5 h-3.5 text-blue-700" />
                <span>Interactive Map & Whole Village Boundary Selection</span>
              </div>
              <p className="text-blue-800/90 text-[11px] leading-relaxed">
                Field officers visit entire villages or mandals. Click <strong>&quot;Select &amp; Bound on Map&quot;</strong> to search any village or district (e.g. <strong>Chagalamarri</strong>). The map navigates and bounds the entire village territory (~6 km boundary). Attendance will be accepted anywhere inside that territory on time.
              </p>
            </div>

            {error && (
              <div className="p-2.5 bg-red-50 border border-red-200 rounded text-xs text-red-800 shrink-0">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4 text-xs overflow-y-auto pr-1 flex-1">
              {/* Week Date Picker & Quick Actions */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-2 border-b border-[#E5E5E5]">
                <div className="flex items-center space-x-2">
                  <Calendar className="w-4 h-4 text-[#737373]" />
                  <label className="font-medium text-[#171717]">Week Starting Date (Monday):</label>
                  <input
                    type="date"
                    value={weekStartDate}
                    onChange={(e) => setWeekStartDate(e.target.value)}
                    required
                    className="p-1.5 border border-[#E5E5E5] rounded focus:outline-none focus:ring-1 focus:ring-black text-xs"
                  />
                </div>

                <button
                  type="button"
                  onClick={applySampleRoute}
                  className="inline-flex items-center space-x-1.5 px-2.5 py-1.5 bg-[#F0EFEB] hover:bg-[#E5E5E5] text-[#171717] rounded text-xs font-medium transition-colors"
                  title="Populate standard 6-day Nandyal/Kurnool village tour"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                  <span>Load 6-Day Sample Tour</span>
                </button>
              </div>

              {/* 7 Days Schedule List */}
              <div className="space-y-3">
                {schedules.map((s, idx) => {
                  const isSunday = idx === 6;
                  const isVillageAssigned = s.scheduleType === 'LOCATION_ASSIGNED';

                  return (
                    <div
                      key={s.dayName}
                      className={`p-3 rounded-lg border transition-all ${
                        isSunday
                          ? 'bg-zinc-50 border-zinc-200'
                          : isVillageAssigned
                          ? 'bg-white border-blue-200 shadow-xs'
                          : 'bg-white border-[#E5E5E5]'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2.5">
                        {/* Day indicator */}
                        <div className="w-28 shrink-0">
                          <div className="font-bold text-[#171717] text-xs flex items-center space-x-1.5">
                            <span className="w-5 h-5 rounded-full bg-[#171717] text-white flex items-center justify-center text-[10px]">
                              {idx + 1}
                            </span>
                            <span>{s.dayName}</span>
                          </div>
                          <span className="text-[10px] text-[#737373] pl-6">
                            {isSunday ? 'Weekly Rest' : `Duty Day ${idx + 1}`}
                          </span>
                        </div>

                        {/* Duty Type & Location inputs */}
                        <div className="flex-1 space-y-2">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[10px] text-[#737373] mb-0.5">Duty Status</label>
                              <select
                                value={s.scheduleType}
                                onChange={(e) => handleScheduleChange(idx, 'scheduleType', e.target.value)}
                                className="w-full p-1.5 border border-[#E5E5E5] rounded bg-white text-xs font-medium"
                              >
                                <option value="LOCATION_ASSIGNED">📍 Village / Mandal Territory (Geofenced)</option>
                                <option value="UNASSIGNED">Free Field Duty (Any Location)</option>
                                <option value="WEEKLY_OFF">Weekly Off</option>
                                <option value="ATTENDANCE_DISABLED">Attendance Disabled</option>
                              </select>
                            </div>

                            {isVillageAssigned && (
                              <div>
                                <label className="block text-[10px] text-[#737373] mb-0.5">
                                  Assigned Village / Mandal
                                </label>
                                <div className="flex items-center space-x-1.5">
                                  <input
                                    type="text"
                                    placeholder="e.g. Chagalamarri, Allagadda..."
                                    value={s.locationName || ''}
                                    onChange={(e) => {
                                      handleScheduleChange(idx, 'locationName', e.target.value);
                                      const found = findTerritory(e.target.value);
                                      if (found) {
                                        handleScheduleChange(idx, 'latitude', found.latitude);
                                        handleScheduleChange(idx, 'longitude', found.longitude);
                                        handleScheduleChange(idx, 'geofenceRadiusMetres', found.boundaryRadius || 6000);
                                      }
                                    }}
                                    className="w-full p-1.5 border border-[#E5E5E5] rounded text-xs font-semibold text-[#171717]"
                                    required={isVillageAssigned}
                                  />
                                  <button
                                    type="button"
                                    onClick={() => setMapDayIndex(idx)}
                                    className="px-2.5 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded text-xs font-medium flex items-center space-x-1 shrink-0 transition-colors shadow-xs"
                                    title={`Open interactive map to bound ${s.dayName} territory`}
                                  >
                                    <Map className="w-3.5 h-3.5" />
                                    <span className="hidden sm:inline">Map &amp; Bound</span>
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Quick Village Chips & Map Confirmed Badge */}
                          {isVillageAssigned && (
                            <div className="space-y-1.5 pt-1">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="text-[10px] text-[#737373] font-medium mr-1">Quick Select:</span>
                                {['Chagalamarri', 'Allagadda', 'Koilkuntla', 'Banaganapalle', 'Sirvel', 'Nandyal', 'Dhone'].map((village) => (
                                  <button
                                    key={village}
                                    type="button"
                                    onClick={() => handleSelectVillage(idx, village)}
                                    className={`px-2 py-0.5 text-[10px] rounded-full border transition-all ${
                                      s.locationName?.toLowerCase() === village.toLowerCase()
                                        ? 'bg-blue-600 text-white border-blue-600 font-semibold'
                                        : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-700 border-zinc-200'
                                    }`}
                                  >
                                    {village}
                                  </button>
                                ))}
                              </div>

                              <div className="flex items-center justify-between flex-wrap gap-1 text-[11px] text-emerald-700 bg-emerald-50/80 px-2.5 py-1.5 rounded border border-emerald-200">
                                <div className="flex items-center space-x-1.5">
                                  <Check className="w-3 h-3 text-emerald-600 shrink-0" />
                                  <span>
                                    Bounded Territory: <strong>{s.locationName || 'Village'}</strong> (~{((s.geofenceRadiusMetres || 6000) / 1000).toFixed(0)} km whole village boundary)
                                  </span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => setMapDayIndex(idx)}
                                  className="text-red-700 hover:text-red-800 font-semibold text-[10px] underline ml-auto"
                                >
                                  View on Map &rarr;
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Modal Footer */}
              <div className="flex justify-end space-x-2 pt-3 border-t border-[#E5E5E5] shrink-0">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3 py-1.5 border border-[#E5E5E5] text-[#737373] hover:text-[#171717] rounded text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-1.5 bg-[#171717] hover:bg-black text-white rounded font-medium flex items-center space-x-1.5 disabled:opacity-50 text-xs shadow-xs"
                >
                  {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  <span>Save 6-Day Field Route</span>
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
};
