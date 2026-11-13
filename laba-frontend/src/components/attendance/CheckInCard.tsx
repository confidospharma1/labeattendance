import React, { useState } from 'react';
import { useGPS } from '@/hooks/useGPS';
import { apiClient } from '@/lib/api';
import { MapPin, Navigation, Clock, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

interface CheckInCardProps {
  todayStatus: any;
  onRefresh: () => void;
}

export const CheckInCard: React.FC<CheckInCardProps> = ({ todayStatus, onRefresh }) => {
  const { requestCoordinates, accuracy, loading: gpsLoading, error: gpsError } = useGPS();
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successInfo, setSuccessInfo] = useState<string | null>(null);

  const policy = todayStatus?.policy;
  const windows = todayStatus?.windows;
  const record = todayStatus?.todayRecord;
  const enforcement = todayStatus?.enforcement;
  const enforcementError = todayStatus?.enforcementError;

  const isCheckedIn = Boolean(record?.checkInAt);

  const handleCheckIn = async () => {
    setErrorMessage(null);
    setSuccessInfo(null);
    setSubmitting(true);

    try {
      const coords = await requestCoordinates();

      const response = await apiClient.post('/attendance/check-in', {
        latitude: coords.latitude,
        longitude: coords.longitude,
        accuracy: coords.accuracy,
      });

      const dist = response.data?.data?.geoResult?.distanceMetres;
      setSuccessInfo(
        dist !== undefined
          ? `Check-in recorded! Distance: ${Math.round(dist)}m from geofence center.`
          : 'Check-in recorded successfully!'
      );
      onRefresh();
    } catch (err: any) {
      const msg =
        err?.response?.data?.error?.message ||
        err?.message ||
        'Check-in failed. Please verify your GPS signal and branch location.';
      setErrorMessage(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-white border border-[#E5E5E5] rounded-lg p-5 flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between pb-3 border-b border-[#E5E5E5]">
          <div className="flex items-center space-x-2">
            <div className="w-7 h-7 rounded bg-blue-50 text-blue-700 flex items-center justify-center font-bold text-xs">
              01
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#171717]">Morning Check-In</h3>
              <p className="text-xs text-[#737373]">
                Window: {policy?.morningStart || '09:00'} – {policy?.morningEnd || '09:20'} IST
              </p>
            </div>
          </div>
          {isCheckedIn ? (
            <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Checked In</span>
            </span>
          ) : windows?.inMorningWindow ? (
            <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200 animate-pulse">
              <Clock className="w-3.5 h-3.5" />
              <span>Window Open</span>
            </span>
          ) : (
            <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded text-xs font-medium bg-zinc-100 text-zinc-600 border border-zinc-200">
              <Clock className="w-3.5 h-3.5" />
              <span>Window Closed</span>
            </span>
          )}
        </div>

        {/* Location Target details */}
        <div className="mt-4 p-3 bg-[#F9F9F8] border border-[#E5E5E5] rounded text-xs space-y-1.5">
          {enforcement?.type === 'FIELD_SCHEDULE' || (enforcement?.radiusMetres && enforcement.radiusMetres >= 800) ? (
            <>
              <div className="flex items-center space-x-2 text-[#171717] font-semibold">
                <MapPin className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />
                <span>Assigned Territory / Area: {enforcement?.refName || 'Resolving location...'}</span>
              </div>
              <div className="text-[#525252] pl-5 text-[11px] leading-relaxed">
                Boundary: <strong className="text-blue-700">Google Maps Area Boundary</strong>. Attendance is accepted anywhere inside this authorized area on time.
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center space-x-2 text-[#171717] font-medium">
                <MapPin className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />
                <span>Target: {enforcement?.refName || 'Resolving location...'}</span>
              </div>
              {enforcement?.radiusMetres ? (
                <div className="text-[#737373] pl-5">
                  Geofence Radius: <strong className="text-[#171717]">{enforcement.radiusMetres}m</strong>
                </div>
              ) : enforcement?.unrestricted ? (
                <div className="text-[#737373] pl-5">
                  Attendance Mode: <strong className="text-emerald-700">Unrestricted Field Duty</strong>
                </div>
              ) : null}
            </>
          )}
        </div>

        {/* Checked in info */}
        {isCheckedIn && record?.checkInAt && (
          <div className="mt-3 p-3 bg-emerald-50 border border-emerald-200 rounded text-xs text-emerald-900 space-y-1">
            <div className="font-semibold flex items-center space-x-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>Recorded at: {new Date(record.checkInAt).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' })} IST</span>
            </div>
            <div className="text-emerald-700 text-[11px]">
              Location: {record.checkInLocationName || 'Authorized Geofence'}
              {record.checkInDistanceMetres !== null && (
                <span> • Distance: {Number(record.checkInDistanceMetres)}m</span>
              )}
            </div>
          </div>
        )}

        {/* Error message */}
        {(errorMessage || gpsError || enforcementError) && (
          <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded text-xs text-red-800 flex items-start space-x-2">
            <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
            <span>{errorMessage || gpsError || enforcementError}</span>
          </div>
        )}

        {/* Success message */}
        {successInfo && (
          <div className="mt-3 p-3 bg-emerald-50 border border-emerald-200 rounded text-xs text-emerald-800">
            {successInfo}
          </div>
        )}
      </div>

      {/* Action Button */}
      <div className="mt-5 pt-3 border-t border-[#E5E5E5]">
        <button
          onClick={handleCheckIn}
          disabled={isCheckedIn || submitting || gpsLoading || Boolean(enforcementError)}
          className={`w-full py-2.5 px-4 rounded text-xs font-semibold flex items-center justify-center space-x-2 transition-all ${
            isCheckedIn
              ? 'bg-zinc-100 text-zinc-400 cursor-not-allowed border border-zinc-200'
              : 'bg-[#171717] hover:bg-black text-white shadow-sm disabled:opacity-50'
          }`}
        >
          {submitting || gpsLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>{gpsLoading ? 'Acquiring GPS...' : 'Verifying Geofence...'}</span>
            </>
          ) : isCheckedIn ? (
            <>
              <CheckCircle2 className="w-4 h-4" />
              <span>Morning Check-In Complete</span>
            </>
          ) : (
            <>
              <Navigation className="w-4 h-4" />
              <span>Check In Now</span>
            </>
          )}
        </button>
        {accuracy !== null && !isCheckedIn && (
          <div className="text-center text-[10px] text-[#737373] mt-1.5">
            Current GPS Accuracy: ±{Math.round(accuracy)}m
          </div>
        )}
      </div>
    </div>
  );
};

