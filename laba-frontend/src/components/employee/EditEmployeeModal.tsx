'use client';

import React, { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api';
import { X, Loader2, UserCheck, AlertCircle } from 'lucide-react';

interface EditEmployeeModalProps {
  isOpen: boolean;
  employee: any | null;
  branches: Array<{ id: string; name: string; branchCode: string }>;
  onClose: () => void;
  onSuccess: () => void;
}

export const EditEmployeeModal: React.FC<EditEmployeeModalProps> = ({
  isOpen,
  employee,
  branches,
  onClose,
  onSuccess,
}) => {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [mobile, setMobile] = useState('');
  const [employeeType, setEmployeeType] = useState('OFFICE_STAFF');
  const [status, setStatus] = useState('ACTIVE');
  const [branchId, setBranchId] = useState('');
  const [profileNotes, setProfileNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (employee) {
      setFullName(employee.fullName || '');
      setEmail(employee.email || employee.user?.email || '');
      setMobile(employee.mobile || '');
      setEmployeeType(employee.employeeType || 'OFFICE_STAFF');
      setStatus(employee.status || 'ACTIVE');
      setBranchId(employee.assignedBranch?.id || '');
      setProfileNotes(employee.profileNotes || '');
      setErrorMsg(null);
    }
  }, [employee]);

  if (!isOpen || !employee) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      setErrorMsg(null);

      await apiClient.patch(`/employees/${employee.id}`, {
        fullName: fullName.trim(),
        email: email.trim().toLowerCase(),
        mobile: mobile.trim(),
        employeeType,
        status,
        branchId: employeeType === 'OFFICE_STAFF' && branchId ? branchId : null,
        profileNotes: profileNotes.trim() || undefined,
      });

      onSuccess();
      onClose();
    } catch (err: any) {
      const msg = err.response?.data?.error?.message || err.message || 'Failed to update employee';
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
              <UserCheck className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-semibold text-sm text-[#171717]">Edit Employee Profile</h3>
              <p className="text-[11px] text-[#737373]">
                {employee.employeeCode} • {employee.fullName}
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#171717] mb-1">
                Full Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white border border-[#E5E5E5] rounded-lg focus:outline-none focus:border-[#171717] text-[#171717]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#171717] mb-1">
                Mobile (10 Digits) <span className="text-red-500">*</span>
              </label>
              <input
                type="tel"
                required
                pattern="^[6-9]\d{9}$"
                value={mobile}
                onChange={(e) => setMobile(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white border border-[#E5E5E5] rounded-lg focus:outline-none focus:border-[#171717] text-[#171717]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#171717] mb-1">
              Email Address <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-white border border-[#E5E5E5] rounded-lg focus:outline-none focus:border-[#171717] text-[#171717]"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#171717] mb-1">
                Employee Role / Type
              </label>
              <select
                value={employeeType}
                onChange={(e) => setEmployeeType(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white border border-[#E5E5E5] rounded-lg focus:outline-none focus:border-[#171717] text-[#171717]"
              >
                <option value="OFFICE_STAFF">Office Staff (Branch Tied)</option>
                <option value="FIELD_STAFF">Field Staff (Mobile/Traveling)</option>
                <option value="ADMIN">Admin (Regional Manager)</option>
                <option value="SUPER_ADMIN">Super Admin (Organization Head)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#171717] mb-1">
                Account Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white border border-[#E5E5E5] rounded-lg focus:outline-none focus:border-[#171717] text-[#171717]"
              >
                <option value="ACTIVE">Active</option>
                <option value="SUSPENDED">Suspended</option>
                <option value="DEACTIVATED">Deactivated</option>
              </select>
            </div>
          </div>

          {employeeType === 'OFFICE_STAFF' && (
            <div>
              <label className="block text-xs font-semibold text-[#171717] mb-1">
                Assigned Pharmacy Branch <span className="text-red-500">*</span>
              </label>
              <select
                value={branchId}
                onChange={(e) => setBranchId(e.target.value)}
                required={employeeType === 'OFFICE_STAFF'}
                className="w-full px-3 py-2 text-xs bg-white border border-[#E5E5E5] rounded-lg focus:outline-none focus:border-[#171717] text-[#171717]"
              >
                <option value="">Select Branch...</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.branchCode})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-[#171717] mb-1">
              Admin Notes / Remarks
            </label>
            <textarea
              rows={2}
              value={profileNotes}
              onChange={(e) => setProfileNotes(e.target.value)}
              placeholder="e.g. Senior pharmacist transfer from Kadapa to Kurnool"
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
              <span>{submitting ? 'Saving Changes...' : 'Save Changes'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
