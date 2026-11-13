import React, { useState } from 'react';
import { Calendar, CheckCircle2, Clock, AlertTriangle, FileEdit } from 'lucide-react';
import { CorrectionModal } from './CorrectionModal';

interface AttendanceHistoryProps {
  records: any[];
  onRefresh: () => void;
}

export const AttendanceHistory: React.FC<AttendanceHistoryProps> = ({ records, onRefresh }) => {
  const [selectedRecord, setSelectedRecord] = useState<any | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const handleOpenCorrection = (record?: any) => {
    setSelectedRecord(record || null);
    setModalOpen(true);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'CHECKED_OUT':
        return (
          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3" />
            <span>Complete</span>
          </span>
        );
      case 'CHECKED_IN':
        return (
          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[11px] font-medium bg-amber-50 text-amber-700 border border-amber-200">
            <Clock className="w-3 h-3" />
            <span>Checked In Only</span>
          </span>
        );
      case 'CORRECTED':
        return (
          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[11px] font-medium bg-blue-50 text-blue-700 border border-blue-200">
            <CheckCircle2 className="w-3 h-3" />
            <span>Corrected</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[11px] font-medium bg-zinc-100 text-zinc-600 border border-zinc-200">
            <span>{status}</span>
          </span>
        );
    }
  };

  return (
    <div className="bg-white border border-[#E5E5E5] rounded-lg p-5">
      <div className="flex items-center justify-between pb-3 border-b border-[#E5E5E5] mb-4">
        <div className="flex items-center space-x-2">
          <Calendar className="w-4 h-4 text-[#737373]" />
          <h3 className="text-sm font-bold text-[#171717]">Attendance History</h3>
        </div>
        <button
          onClick={() => handleOpenCorrection()}
          className="flex items-center space-x-1 px-2.5 py-1 text-xs font-medium text-[#171717] bg-[#F7F6F2] hover:bg-[#EAE8E1] border border-[#E5E5E5] rounded transition-colors"
        >
          <FileEdit className="w-3.5 h-3.5" />
          <span>Request Correction</span>
        </button>
      </div>

      {records.length === 0 ? (
        <div className="text-center py-8 text-xs text-[#737373]">
          No previous attendance records found.
        </div>
      ) : (
        <>
          {/* Mobile Card View (< 640px) */}
          <div className="block sm:hidden space-y-3">
            {records.map((rec) => (
              <div
                key={rec.id}
                className="bg-[#FBFBFA] border border-[#E5E5E5] rounded-lg p-3.5 space-y-2.5 shadow-2xs"
              >
                <div className="flex items-center justify-between border-b border-[#EAE9E4] pb-2">
                  <span className="font-semibold text-xs text-[#171717]">
                    {new Date(rec.workDate).toLocaleDateString('en-IN', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                      timeZone: 'Asia/Kolkata',
                    })}
                  </span>
                  <div>{getStatusBadge(rec.status)}</div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px] bg-white p-2 rounded border border-[#EAE9E4]">
                  <div>
                    <span className="text-[#737373] block text-[10px] uppercase">Check-In</span>
                    <strong className="text-[#171717]">
                      {rec.checkInAt
                        ? new Date(rec.checkInAt).toLocaleTimeString('en-IN', {
                            hour: '2-digit',
                            minute: '2-digit',
                            timeZone: 'Asia/Kolkata',
                          })
                        : '—'}
                    </strong>
                  </div>
                  <div>
                    <span className="text-[#737373] block text-[10px] uppercase">Check-Out</span>
                    <strong className="text-[#171717]">
                      {rec.checkOutAt
                        ? new Date(rec.checkOutAt).toLocaleTimeString('en-IN', {
                            hour: '2-digit',
                            minute: '2-digit',
                            timeZone: 'Asia/Kolkata',
                          })
                        : 'Pending'}
                    </strong>
                  </div>
                </div>

                <div className="text-[11px] text-[#737373] space-y-1">
                  <div>
                    Location: <strong className="text-[#171717]">{rec.checkInLocationName || 'Branch'}</strong>
                  </div>
                  {rec.workReport && (
                    <div className="italic text-[#171717] bg-white p-1.5 rounded border border-[#EAE9E4]">
                      &quot;{rec.workReport}&quot;
                    </div>
                  )}
                </div>

                <div className="pt-1 flex justify-end">
                  <button
                    onClick={() => handleOpenCorrection(rec)}
                    className="w-full py-1.5 text-center text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100 transition-colors"
                  >
                    Request Correction
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop Table View (>= 640px) */}
          <div className="hidden sm:block overflow-x-auto -mx-1 sm:mx-0">
            <table className="w-full text-left text-xs min-w-[560px]">
              <thead>
                <tr className="border-b border-[#E5E5E5] text-[#737373]">
                  <th className="pb-2 font-medium">Work Date</th>
                  <th className="pb-2 font-medium">Location</th>
                  <th className="pb-2 font-medium">Check-In</th>
                  <th className="pb-2 font-medium">Check-Out</th>
                  <th className="pb-2 font-medium">Status</th>
                  <th className="pb-2 font-medium">Work Report</th>
                  <th className="pb-2 font-medium text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E5E5]">
                {records.map((rec) => (
                  <tr key={rec.id} className="hover:bg-[#F9F9F8]">
                    <td className="py-2.5 font-medium text-[#171717]">
                      {new Date(rec.workDate).toLocaleDateString('en-IN', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        timeZone: 'Asia/Kolkata',
                      })}
                    </td>
                    <td className="py-2.5 text-[#737373]">
                      {rec.checkInLocationName || 'Branch'}
                    </td>
                    <td className="py-2.5 text-[#171717]">
                      {rec.checkInAt
                        ? new Date(rec.checkInAt).toLocaleTimeString('en-IN', {
                            hour: '2-digit',
                            minute: '2-digit',
                            timeZone: 'Asia/Kolkata',
                          })
                        : '—'}
                    </td>
                    <td className="py-2.5 text-[#171717]">
                      {rec.checkOutAt
                        ? new Date(rec.checkOutAt).toLocaleTimeString('en-IN', {
                            hour: '2-digit',
                            minute: '2-digit',
                            timeZone: 'Asia/Kolkata',
                          })
                        : '—'}
                    </td>
                    <td className="py-2.5">{getStatusBadge(rec.status)}</td>
                    <td className="py-2.5 text-[#737373] max-w-xs truncate">
                      {rec.workReport || '—'}
                    </td>
                    <td className="py-2.5 text-right">
                      <button
                        onClick={() => handleOpenCorrection(rec)}
                        className="text-blue-600 hover:text-blue-800 text-[11px] font-medium"
                      >
                        Correction
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <CorrectionModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        attendanceRecord={selectedRecord}
        onSuccess={onRefresh}
      />
    </div>
  );
};

