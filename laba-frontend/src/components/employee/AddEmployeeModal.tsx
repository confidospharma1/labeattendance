'use client';

import React, { useState } from 'react';
import { apiClient } from '@/lib/api';
import { X, UserPlus, Loader2, Check, AlertCircle } from 'lucide-react';

interface AddEmployeeModalProps {
  isOpen: boolean;
  onClose: () => void;
  branches: any[];
  onSuccess: () => void;
}

export const AddEmployeeModal: React.FC<AddEmployeeModalProps> = ({
  isOpen,
  onClose,
  branches,
  onSuccess,
}) => {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [mobile, setMobile] = useState('');
  const [employeeType, setEmployeeType] = useState<'OFFICE_STAFF' | 'FIELD_STAFF' | 'ADMIN'>('OFFICE_STAFF');
  const [branchId, setBranchId] = useState(branches[0]?.id || '');
  const [password, setPassword] = useState('Password@123');
  const [contactId, setContactId] = useState('');
  const [profileNotes, setProfileNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (employeeType === 'OFFICE_STAFF' && !branchId) {
      setError('Office Staff must be assigned to an active branch.');
      return;
    }

    if (!/^[6-9]\d{9}$/.test(mobile.trim())) {
      setError('Mobile must be a valid 10-digit Indian phone number starting with 6-9.');
      return;
    }

    setSubmitting(true);

    try {
      await apiClient.post('/employees', {
        fullName: fullName.trim(),
        email: email.trim().toLowerCase(),
        mobile: mobile.trim(),
        employeeType,
        password,
        branchId: employeeType === 'OFFICE_STAFF' ? branchId : undefined,
        contactId: contactId.trim() || undefined,
        profileNotes: profileNotes.trim() || undefined,
      });

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || 'Failed to create employee profile.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 overflow-y-auto">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full p-5 border border-[#E5E5E5] space-y-4 my-8">
        <div className="flex items-center justify-between border-b border-[#E5E5E5] pb-3">
          <div className="flex items-center space-x-2">
            <UserPlus className="w-4 h-4 text-[#171717]" />
            <h3 className="text-sm font-bold text-[#171717]">Register New Employee</h3>
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

        <form onSubmit={handleSubmit} className="space-y-3 text-xs">
          <div>
            <label className="block font-medium text-[#171717] mb-1">Full Name</label>
            <input
              type="text"
              placeholder="e.g. Ramesh Kumar"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              className="w-full p-2 border border-[#E5E5E5] rounded focus:outline-none focus:ring-1 focus:ring-black"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-[#171717] mb-1">Email Address</label>
              <input
                type="email"
                placeholder="ramesh@labe.in"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full p-2 border border-[#E5E5E5] rounded focus:outline-none focus:ring-1 focus:ring-black"
              />
            </div>
            <div>
              <label className="block font-medium text-[#171717] mb-1">Mobile (10 digits)</label>
              <input
                type="tel"
                placeholder="9876543210"
                value={mobile}
                maxLength={10}
                onChange={(e) => setMobile(e.target.value)}
                required
                className="w-full p-2 border border-[#E5E5E5] rounded focus:outline-none focus:ring-1 focus:ring-black font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-[#171717] mb-1">Employee Type</label>
              <select
                value={employeeType}
                onChange={(e) => setEmployeeType(e.target.value as any)}
                className="w-full p-2 border border-[#E5E5E5] rounded focus:outline-none focus:ring-1 focus:ring-black bg-white"
              >
                <option value="OFFICE_STAFF">Office Staff (Fixed Branch)</option>
                <option value="FIELD_STAFF">Field Staff (Dynamic Schedule)</option>
                <option value="ADMIN">Branch Administrator</option>
              </select>
            </div>
            <div>
              <label className="block font-medium text-[#171717] mb-1">Initial Password</label>
              <input
                type="text"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full p-2 border border-[#E5E5E5] rounded focus:outline-none focus:ring-1 focus:ring-black font-mono"
              />
            </div>
          </div>

          {employeeType === 'OFFICE_STAFF' && (
            <div>
              <label className="block font-medium text-[#171717] mb-1">
                Assigned Pharmacy Branch <span className="text-red-500">*</span>
              </label>
              <select
                value={branchId}
                onChange={(e) => setBranchId(e.target.value)}
                required
                className="w-full p-2 border border-[#E5E5E5] rounded focus:outline-none focus:ring-1 focus:ring-black bg-white"
              >
                <option value="">Select Branch...</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.branchCode}) — {b.district}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-[#171717] mb-1">Contact ID / Ref (Optional)</label>
              <input
                type="text"
                placeholder="LABE-CONT-01"
                value={contactId}
                onChange={(e) => setContactId(e.target.value)}
                className="w-full p-2 border border-[#E5E5E5] rounded focus:outline-none focus:ring-1 focus:ring-black"
              />
            </div>
            <div>
              <label className="block font-medium text-[#171717] mb-1">Profile Notes (Optional)</label>
              <input
                type="text"
                placeholder="Shift timing, pharmacist licence..."
                value={profileNotes}
                onChange={(e) => setProfileNotes(e.target.value)}
                className="w-full p-2 border border-[#E5E5E5] rounded focus:outline-none focus:ring-1 focus:ring-black"
              />
            </div>
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
              <span>Create Employee Account</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

