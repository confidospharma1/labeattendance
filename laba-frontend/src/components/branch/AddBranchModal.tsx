'use client';

import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { apiClient } from '@/lib/api';
import {
  X,
  Building2,
  MapPin,
  Loader2,
  Check,
  Navigation,
  Sparkles,
  AlertCircle,
} from 'lucide-react';
import { findAndhraCoordinates, AP_DISTRICTS } from '@/lib/geoData';

const BranchMapPicker = dynamic(() => import('./BranchMapPicker'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-72 bg-[#F0EFEB] rounded-xl flex items-center justify-center text-xs text-[#737373]">
      <Loader2 className="w-4 h-4 animate-spin mr-2" />
      <span>Loading Interactive Map...</span>
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
  const [district, setDistrict] = useState('Kurnool');
  const [latitude, setLatitude] = useState(15.8281);
  const [longitude, setLongitude] = useState(78.0373);
  const [radiusMetres, setRadiusMetres] = useState(100);
  const [submitting, setSubmitting] = useState(false);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-generate next branch code on open
  useEffect(() => {
    if (isOpen) {
      setError(null);
      apiClient
        .get('/branches?limit=100')
        .then((res) => {
          const list = res.data?.data?.branches || res.data?.data?.items || [];
          const count = list.length;
          const nextNum = (count + 1).toString().padStart(3, '0');
          setBranchCode(`LABE-B-${nextNum}`);
        })
        .catch(() => {
          setBranchCode('LABE-B-007');
        });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Auto-navigate map when user types or selects a district
  const handleDistrictChange = (val: string) => {
    setDistrict(val);
    const coords = findAndhraCoordinates(val);
    if (coords) {
      setLatitude(coords.latitude);
      setLongitude(coords.longitude);
    }
  };

  // Detect and set current location
  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser.');
      return;
    }

    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLatitude(pos.coords.latitude);
        setLongitude(pos.coords.longitude);
        setLocating(false);
      },
      (err) => {
        setLocating(false);
        alert(`Location detection failed: ${err.message}. Please allow GPS permissions in your browser.`);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !address.trim() || !district.trim()) {
      setError('Branch Name, Address, and District are required.');
      return;
    }

    if (Number.isNaN(latitude) || Number.isNaN(longitude)) {
      setError('Please select valid GPS coordinates on the map.');
      return;
    }

    setSubmitting(true);
    setError(null);

    const finalCode = branchCode.trim() ? branchCode.trim().toUpperCase() : undefined;

    try {
      await apiClient.post('/branches', {
        name: name.trim(),
        branchCode: finalCode,
        address: address.trim(),
        district: district.trim(),
        state: 'Andhra Pradesh',
        latitude: Number(latitude),
        longitude: Number(longitude),
        geofenceRadiusMetres: Number(radiusMetres),
      });

      setName('');
      setAddress('');
      setDistrict('Kurnool');
      setLatitude(15.8281);
      setLongitude(78.0373);
      setRadiusMetres(100);
      onSuccess();
      onClose();
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message || err.message || 'Failed to create branch';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-3 sm:p-5 overflow-y-auto animate-in fade-in duration-150">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full p-5 border border-[#E5E5E5] space-y-4 my-auto max-h-[94vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#E5E5E5] pb-3">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#171717] text-white flex items-center justify-center font-bold text-xs shadow-xs">
              <Building2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#171717]">Add New Pharmacy Branch</h3>
              <p className="text-[11px] text-[#737373]">
                Configure branch location, geofence radius boundary, and operating district
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-[#737373] hover:text-[#171717] hover:bg-[#F0EFEB] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-800 flex items-start space-x-2">
            <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto space-y-3.5 text-xs pr-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-[#171717] mb-1">
                Branch Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                placeholder="e.g. LABE Pharmacy - Kurnool East"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full px-3 py-2 border border-[#E5E5E5] rounded-lg focus:outline-none focus:border-[#171717] text-[#171717]"
              />
            </div>
            <div>
              <label className="block font-semibold text-[#171717] mb-1 flex items-center justify-between">
                <span>Branch Code <span className="text-red-500">*</span></span>
                <span className="text-[10px] text-[#737373] font-normal flex items-center">
                  <Sparkles className="w-3 h-3 mr-0.5 text-amber-600" /> Auto-suggested
                </span>
              </label>
              <input
                type="text"
                placeholder="LABE-B-007"
                value={branchCode}
                onChange={(e) => setBranchCode(e.target.value)}
                required
                className="w-full px-3 py-2 border border-[#E5E5E5] rounded-lg focus:outline-none focus:border-[#171717] uppercase font-mono text-[#171717]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-[#171717] mb-1">
                District (Andhra Pradesh) <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                list="ap-districts"
                placeholder="Type 'Kurnool', 'Kadapa', 'Guntur'..."
                value={district}
                onChange={(e) => handleDistrictChange(e.target.value)}
                required
                className="w-full px-3 py-2 border border-[#E5E5E5] rounded-lg focus:outline-none focus:border-[#171717] text-[#171717]"
              />
              <datalist id="ap-districts">
                {AP_DISTRICTS.map((d) => (
                  <option key={d.name} value={d.name}>
                    {d.name} (District HQ: {d.headquarters})
                  </option>
                ))}
              </datalist>
              <span className="text-[10px] text-[#737373] mt-1 block">
                ⚡ Typing a district auto-navigates the map to that location!
              </span>
            </div>

            <div>
              <label className="block font-semibold text-[#171717] mb-1 flex items-center justify-between">
                <span>Geofence Radius</span>
                <strong className="text-blue-700 font-bold">{radiusMetres} metres</strong>
              </label>
              <div className="pt-2">
                <input
                  type="range"
                  min={50}
                  max={500}
                  step={25}
                  value={radiusMetres}
                  onChange={(e) => setRadiusMetres(Number(e.target.value))}
                  className="w-full accent-blue-600 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-[#737373] mt-1">
                  <span>50m (Store only)</span>
                  <span>100m (Standard)</span>
                  <span>500m (Complex)</span>
                </div>
              </div>
            </div>
          </div>

          <div>
            <label className="block font-semibold text-[#171717] mb-1">
              Physical Street Address <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              placeholder="e.g. Shop No. 12, Gandhi Chowk Main Road, Kurnool, Andhra Pradesh"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              required
              className="w-full px-3 py-2 border border-[#E5E5E5] rounded-lg focus:outline-none focus:border-[#171717] text-[#171717]"
            />
          </div>

          {/* Interactive Map Picker Section */}
          <div className="space-y-1.5 pt-1">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="font-semibold text-[#171717] flex items-center space-x-1.5">
                <MapPin className="w-3.5 h-3.5 text-blue-600" />
                <span>Geofence Pin & Circular Boundary</span>
              </label>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={handleUseCurrentLocation}
                  disabled={locating}
                  className="inline-flex items-center space-x-1 px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[11px] font-medium transition-colors shadow-xs disabled:opacity-50"
                  title="Detect and mark my current GPS location"
                >
                  {locating ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Navigation className="w-3 h-3 fill-current" />
                  )}
                  <span>{locating ? 'Locating...' : 'Use Current Location'}</span>
                </button>

                <span className="text-[10px] text-[#737373] font-mono bg-[#F0EFEB] px-2 py-0.5 rounded">
                  {latitude.toFixed(4)}°, {longitude.toFixed(4)}°
                </span>
              </div>
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

          {/* Action buttons */}
          <div className="flex justify-end space-x-2 pt-3 border-t border-[#E5E5E5]">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 border border-[#E5E5E5] text-[#737373] hover:text-[#171717] hover:bg-[#F9F9F8] rounded-lg transition-colors font-medium text-xs"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 bg-[#171717] hover:bg-black text-white rounded-lg font-medium flex items-center space-x-1.5 disabled:opacity-50 transition-colors shadow-xs text-xs"
            >
              {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              <span>{submitting ? 'Creating Branch...' : 'Save Pharmacy Branch'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
