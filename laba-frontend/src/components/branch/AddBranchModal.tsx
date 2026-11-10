'use client';

import React, { useState } from 'react';
import dynamic from 'next/dynamic';
import { apiClient } from '@/lib/api';
import { X, Building2, MapPin, Loader2, Check } from 'lucide-react';

const BranchMapPicker = dynamic(() => import('./BranchMapPicker'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-64 bg-[#F0EFEB] rounded flex items-center justify-center text-xs text-[#737373]">
      Loading Leaflet Map...
    </div>
  ),
});

interface AddBranchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const AddBranchModal: React.FC<AddBranchModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [name, setName] = useState('');
  const [branchCode, setBranchCode] = useState('');
  const [address, setAddress] = useState('');
  const [district, setDistrict] = useState('Kadapa');
  const [latitude, setLatitude] = useState(14.4673);
  const [longitude, setLongitude] = useState(78.8242);
  const [radiusMetres, setRadiusMetres] = useState(100);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !branchCode || !address) {
      setError('All branch fields are required.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await apiClient.post('/branches', {
        name,
        branchCode: branchCode.toUpperCase(),
        address,
        district,
        state: 'Andhra Pradesh',
        latitude,
        longitude,
        geofenceRadiusMetres: radiusMetres,
      });

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || 'Failed to create branch');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 overflow-y-auto">
      <div className="bg-white rounded-lg shadow-xl max-w-xl w-full p-5 border border-[#E5E5E5] space-y-4 my-8">
        <div className="flex items-center justify-between border-b border-[#E5E5E5] pb-3">
          <div className="flex items-center space-x-2">
            <Building2 className="w-4 h-4 text-[#171717]" />
            <h3 className="text-sm font-bold text-[#171717]">Add Pharmacy Branch</h3>
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

        <form onSubmit={handleSubmit} className="space-y-3 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-[#171717] mb-1">Branch Name</label>
              <input
                type="text"
                placeholder="e.g. Tirupati Branch"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full p-2 border border-[#E5E5E5] rounded focus:outline-none focus:ring-1 focus:ring-black"
              />
            </div>
            <div>
              <label className="block font-medium text-[#171717] mb-1">Branch Code</label>
              <input
                type="text"
                placeholder="LABA-B-007"
                value={branchCode}
                onChange={(e) => setBranchCode(e.target.value)}
                required
                className="w-full p-2 border border-[#E5E5E5] rounded focus:outline-none focus:ring-1 focus:ring-black uppercase font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-[#171717] mb-1">District (Andhra Pradesh)</label>
              <input
                type="text"
                placeholder="e.g. Tirupati"
                value={district}
                onChange={(e) => setDistrict(e.target.value)}
                required
                className="w-full p-2 border border-[#E5E5E5] rounded focus:outline-none focus:ring-1 focus:ring-black"
              />
            </div>
            <div>
              <label className="block font-medium text-[#171717] mb-1">
                Geofence Radius: <strong className="text-blue-700">{radiusMetres}m</strong>
              </label>
              <input
                type="range"
                min={50}
                max={500}
                step={25}
                value={radiusMetres}
                onChange={(e) => setRadiusMetres(Number(e.target.value))}
                className="w-full accent-blue-600 mt-2"
              />
            </div>
          </div>

          <div>
            <label className="block font-medium text-[#171717] mb-1">Physical Address</label>
            <input
              type="text"
              placeholder="e.g. Door No. 4/128, Main Bazaar, Tirupati, Andhra Pradesh"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              required
              className="w-full p-2 border border-[#E5E5E5] rounded focus:outline-none focus:ring-1 focus:ring-black"
            />
          </div>

          {/* Interactive Map Picker */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="font-medium text-[#171717] flex items-center space-x-1.5">
                <MapPin className="w-3.5 h-3.5 text-blue-600" />
                <span>Geofence Pin & Circular Boundary</span>
              </label>
              <span className="text-[10px] text-[#737373] font-mono">
                {latitude.toFixed(4)}°, {longitude.toFixed(4)}°
              </span>
            </div>
            <BranchMapPicker
              latitude={latitude}
              longitude={longitude}
              radiusMetres={radiusMetres}
              onChange={(coords) => {
                setLatitude(coords.latitude);
                setLongitude(coords.longitude);
              }}
            />
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
              <span>Save Pharmacy Branch</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

