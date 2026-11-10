import React, { useState } from 'react';
import { useGPS } from '@/hooks/useGPS';
import { apiClient } from '@/lib/api';
import { FileText, Navigation, Clock, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

interface CheckOutCardProps {
  todayStatus: any;
  onRefresh: () => void;
}

export const CheckOutCard: React.FC<CheckOutCardProps> = ({ todayStatus, onRefresh }) => {
  const { requestCoordinates, accuracy, loading: gpsLoading, error: gpsError } = useGPS();
  const [workReport, setWorkReport] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successInfo, setSuccessInfo] = useState<string | null>(null);

  const policy = todayStatus?.policy;
  const windows = todayStatus?.windows;
  const record = todayStatus?.todayRecord;

  const isCheckedIn = Boolean(record?.checkInAt);
  const isCheckedOut = Boolean(record?.checkOutAt);

  const trimmedReport = workReport.trim();
  const nonWhitespaceLength = workReport.replace(/\s+/g, '').length;
  const isReportValid = nonWhitespaceLength >= 5 && workReport.length <= 500;

  const handleCheckOut = async () => {
    if (!isReportValid) {
      setErrorMessage('Work report is mandatory and must contain at least 5 characters.');
      return;
    }

    setErrorMessage(null);
    setSuccessInfo(null);
    setSubmitting(true);

    try {
      const coords = await requestCoordinates();

      const response = await apiClient.post('/attendance/check-out', {
        latitude: coords.latitude,
        longitude: coords.longitude,
        accuracy: coords.accuracy,
        workReport: trimmedReport,
      });

      const dist = response.data?.data?.geoResult?.distanceMetres;
      setSuccessInfo(
        dist !== undefined
          ? `Check-out recorded! Distance: ${Math.round(dist)}m from authorized location.`
          : 'Check-out completed successfully!'
      );
      onRefresh();
    } catch (err: any) {
      const msg =
        err?.response?.data?.error?.message ||
        err?.message ||
        'Check-out failed. Please verify your GPS signal and branch location.';
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
            <div className="w-7 h-7 rounded bg-amber-50 text-amber-700 flex items-center justify-center font-bold text-xs">
              02
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#171717]">Evening Check-Out</h3>
              <p className="text-xs text-[#737373]">
                Window: {policy?.eveningStart || '16:30'} – {policy?.eveningEnd || '17:00'} IST
              </p>
            </div>
          </div>
          {isCheckedOut ? (
            <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Completed</span>
            </span>
          ) : windows?.inEveningWindow ? (
            <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200 animate-pulse">
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

        {/* Work Report Section */}
        {isCheckedOut ? (
          <div className="mt-4 p-3 bg-[#F9F9F8] border border-[#E5E5E5] rounded text-xs space-y-2">
            <div className="font-semibold text-emerald-800 flex items-center space-x-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>Checked out at: {new Date(record.checkOutAt).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' })} IST</span>
            </div>
            <div className="text-[#171717] bg-white p-2.5 border border-[#E5E5E5] rounded italic">
              &ldquo;{record.workReport}&rdquo;
            </div>
          </div>
        ) : (
          <div className="mt-4 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <label className="font-semibold text-[#171717] flex items-center space-x-1.5">
                <FileText className="w-3.5 h-3.5 text-[#737373]" />
                <span>Daily Work Report <span className="text-red-500">*</span></span>
              </label>
              <span className={`text-[11px] font-mono ${nonWhitespaceLength < 5 ? 'text-amber-600 font-medium' : 'text-[#737373]'}`}>
                {nonWhitespaceLength}/5 min chars ({workReport.length}/500)
              </span>
            </div>
            <textarea
              value={workReport}
              onChange={(e) => setWorkReport(e.target.value)}
              placeholder="Mandatory summary of daily pharmacy activities, stock inventory checks, client visits, or field duties..."
              rows={3}
              maxLength={500}
              disabled={!isCheckedIn || isCheckedOut || submitting}
              className="w-full text-xs p-2.5 border border-[#E5E5E5] rounded focus:outline-none focus:ring-1 focus:ring-black placeholder-[#A3A3A3] resize-none disabled:bg-[#F9F9F8] disabled:cursor-not-allowed"
            />
            {!isCheckedIn && (
              <div className="text-[11px] text-amber-700 bg-amber-50 p-2 rounded border border-amber-200">
                You must complete morning check-in before check-out is unlocked.
              </div>
            )}
          </div>
        )}

        {/* Errors */}
        {(errorMessage || gpsError) && (
          <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded text-xs text-red-800 flex items-start space-x-2">
            <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
            <span>{errorMessage || gpsError}</span>
          </div>
        )}

        {/* Success */}
        {successInfo && (
          <div className="mt-3 p-3 bg-emerald-50 border border-emerald-200 rounded text-xs text-emerald-800">
            {successInfo}
          </div>
        )}
      </div>

      {/* Action Button */}
      <div className="mt-5 pt-3 border-t border-[#E5E5E5]">
        <button
          onClick={handleCheckOut}
          disabled={!isCheckedIn || isCheckedOut || !isReportValid || submitting || gpsLoading}
          className={`w-full py-2.5 px-4 rounded text-xs font-semibold flex items-center justify-center space-x-2 transition-all ${
            isCheckedOut
              ? 'bg-zinc-100 text-zinc-400 cursor-not-allowed border border-zinc-200'
              : !isCheckedIn || !isReportValid
              ? 'bg-zinc-100 text-zinc-400 cursor-not-allowed border border-zinc-200'
              : 'bg-[#171717] hover:bg-black text-white shadow-sm'
          }`}
        >
          {submitting || gpsLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>{gpsLoading ? 'Acquiring GPS...' : 'Submitting Check-Out...'}</span>
            </>
          ) : isCheckedOut ? (
            <>
              <CheckCircle2 className="w-4 h-4" />
              <span>Evening Check-Out Complete</span>
            </>
          ) : (
            <>
              <Navigation className="w-4 h-4" />
              <span>Submit Report & Check Out</span>
            </>
          )}
        </button>
        {accuracy !== null && !isCheckedOut && (
          <div className="text-center text-[10px] text-[#737373] mt-1.5">
            Current GPS Accuracy: ±{Math.round(accuracy)}m
          </div>
        )}
      </div>
    </div>
  );
};

