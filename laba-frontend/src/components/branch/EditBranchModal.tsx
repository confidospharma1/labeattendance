'use client';

import React, { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api';
import { X, Loader2, Building2, AlertCircle } from 'lucide-react';

interface EditBranchModalProps {
  isOpen: boolean;
  branch: any | null;
  onClose: () => void;
  onSuccess: () => void;
}

export const EditBranchModal: React.FC<EditBranchModalProps> = ({
  isOpen,
  branch,
  onClose,
  onSuccess,
}) => {
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [district, setDistrict] = useState('');
  const [state, setState] = useState('Andhra Pradesh');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [geofenceRadiusMetres, setGeofenceRadiusMetres] = useState(100);
  const [isActive, setIsActive] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (branch) {
      setName(branch.name || '');
      setAddress(branch.address || '');
      setDistrict(branch.district || '');
      setState(branch.state || 'Andhra Pradesh');
      setLatitude(branch.latitude !== undefined ? branch.latitude.toString() : '');
      setLongitude(branch.longitude !== undefined ? branch.longitude.toString() : '');
      setGeofenceRadiusMetres(branch.geofenceRadiusMetres || 100);
      setIsActive(branch.isActive !== undefined ? branch.isActive : true);
      setErrorMsg(null);
    }
  }, [branch]);

  if (!isOpen || !branch) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      setErrorMsg(null);

      const lat = parseFloat(latitude);
      const lng = parseFloat(longitude);

      if (Number.isNaN(lat) || Number.isNaN(lng)) {
        throw new Error('Valid decimal latitude and longitude are required');
      }

      await apiClient.patch(`/branches/${branch.id}`, {
        name: name.trim(),
        address: address.trim(),
        district: district.trim(),
        state: state.trim(),
        latitude: lat,
        longitude: lng,
        geofenceRadiusMetres: Number(geofenceRadiusMetres),
        isActive,
      });

      onSuccess();
      onClose();
    } catch (err: any) {
      const msg = err.response?.data?.error?.message || err.message || 'Failed to update branch';
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
              <Building2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-semibold text-sm text-[#171717]">Edit Pharmacy Branch</h3>
              <p className="text-[11px] text-[#737373]">
                {branch.branchCode} • {branch.name}
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
              Branch Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-white border border-[#E5E5E5] rounded-lg focus:outline-none focus:border-[#171717] text-[#171717]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#171717] mb-1">
              Full Physical Address <span className="text-red-500">*</span>
            </label>
            <textarea
              rows={2}
              required
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-white border border-[#E5E5E5] rounded-lg focus:outline-none focus:border-[#171717] text-[#171717]"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#171717] mb-1">
                District <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={district}
                onChange={(e) => setDistrict(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white border border-[#E5E5E5] rounded-lg focus:outline-none focus:border-[#171717] text-[#171717]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#171717] mb-1">
                State
              </label>
              <input
                type="text"
                value={state}
                onChange={(e) => setState(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white border border-[#E5E5E5] rounded-lg focus:outline-none focus:border-[#171717] text-[#171717]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#171717] mb-1">
                Latitude (e.g. 14.4674) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                step="any"
                required
                value={latitude}
                onChange={(e) => setLatitude(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white border border-[#E5E5E5] rounded-lg focus:outline-none focus:border-[#171717] text-[#171717] font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#171717] mb-1">
                Longitude (e.g. 78.8241) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                step="any"
                required
                value={longitude}
                onChange={(e) => setLongitude(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white border border-[#E5E5E5] rounded-lg focus:outline-none focus:border-[#171717] text-[#171717] font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#171717] mb-1">
                Geofence Radius (Metres)
              </label>
              <input
                type="number"
                min="50"
                max="500"
                value={geofenceRadiusMetres}
                onChange={(e) => setGeofenceRadiusMetres(parseInt(e.target.value, 10))}
                className="w-full px-3 py-2 text-xs bg-white border border-[#E5E5E5] rounded-lg focus:outline-none focus:border-[#171717] text-[#171717]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#171717] mb-1">
                Branch Status
              </label>
              <select
                value={isActive ? 'true' : 'false'}
                onChange={(e) => setIsActive(e.target.value === 'true')}
                className="w-full px-3 py-2 text-xs bg-white border border-[#E5E5E5] rounded-lg focus:outline-none focus:border-[#171717] text-[#171717]"
              >
                <option value="true">Active Branch</option>
                <option value="false">Inactive / Closed</option>
              </select>
            </div>
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
              <span>{submitting ? 'Updating...' : 'Update Branch'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
