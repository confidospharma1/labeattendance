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
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
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

