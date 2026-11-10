'use client';

import React from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';

interface ConfirmDeleteModalProps {
  isOpen: boolean;
  title: string;
  itemName: string;
  warningText?: string;
  loading?: boolean;
  onConfirm: () => Promise<void> | void;
  onClose: () => void;
}

export const ConfirmDeleteModal: React.FC<ConfirmDeleteModalProps> = ({
  isOpen,
  title,
  itemName,
  warningText = 'This action will permanently remove this record from the database. This action cannot be undone.',
  loading = false,
  onConfirm,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-md bg-white border border-[#E5E5E5] rounded-xl shadow-xl overflow-hidden">
        <div className="p-6">
          <div className="flex items-center space-x-3 text-red-600 mb-4">
            <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <h3 className="font-semibold text-base text-[#171717]">{title}</h3>
              <p className="text-xs text-[#737373]">Permanent Database Deletion</p>
            </div>
          </div>

          <div className="space-y-2 mb-6">
            <p className="text-sm text-[#171717]">
              Are you sure you want to delete <strong className="font-semibold">{itemName}</strong>?
            </p>
            <p className="text-xs text-red-700 bg-red-50 p-3 rounded-lg border border-red-200 leading-relaxed">
              {warningText}
            </p>
          </div>

          <div className="flex items-center justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 border border-[#E5E5E5] hover:bg-[#F9F9F8] rounded-lg text-xs font-medium text-[#171717] transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={loading}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-medium transition-colors flex items-center space-x-1.5 disabled:opacity-50"
            >
              {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>{loading ? 'Deleting...' : 'Delete Permanently'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
