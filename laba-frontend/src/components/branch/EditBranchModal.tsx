'use client';

import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { apiClient } from '@/lib/api';
import {
  X,
  Loader2,
  Building2,
  AlertCircle,
  MapPin,
  Navigation,
  Check,
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
  const [latitude, setLatitude] = useState<number>(15.8281);
  const [longitude, setLongitude] = useState<number>(78.0373);
  const [geofenceRadiusMetres, setGeofenceRadiusMetres] = useState(100);
  const [isActive, setIsActive] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [locating, setLocating] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (branch) {
      setName(branch.name || '');
      setAddress(branch.address || '');
      setDistrict(branch.district || '');
      setState(branch.state || 'Andhra Pradesh');
      setLatitude(typeof branch.latitude === 'number' ? branch.latitude : parseFloat(branch.latitude) || 15.8281);
      setLongitude(typeof branch.longitude === 'number' ? branch.longitude : parseFloat(branch.longitude) || 78.0373);
      setGeofenceRadiusMetres(branch.geofenceRadiusMetres || 100);
      setIsActive(branch.isActive !== undefined ? branch.isActive : true);
      setErrorMsg(null);
    }
  }, [branch]);

  if (!isOpen || !branch) return null;

  const handleDistrictChange = (val: string) => {
    setDistrict(val);
    const coords = findAndhraCoordinates(val);
    if (coords) {
      setLatitude(coords.latitude);
      setLongitude(coords.longitude);
    }
  };

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
        alert(`Location detection failed: ${err.message}`);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !address.trim() || !district.trim()) {
      setErrorMsg('Name, Address, and District are required');
      return;
    }

    if (Number.isNaN(latitude) || Number.isNaN(longitude)) {
      setErrorMsg('Valid decimal latitude and longitude are required');
      return;
    }

    try {
      setSubmitting(true);
      setErrorMsg(null);

      await apiClient.patch(`/branches/${branch.id}`, {
        name: name.trim(),
        address: address.trim(),
        district: district.trim(),
        state: state.trim(),
        latitude: Number(latitude),
        longitude: Number(longitude),
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150 overflow-y-auto">
      <div className="w-full max-w-2xl bg-white border border-[#E5E5E5] rounded-xl shadow-2xl overflow-hidden my-auto max-h-[94vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#E5E5E5] bg-[#F7F6F2]">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#171717] text-white flex items-center justify-center font-bold text-xs shadow-xs">
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
                list="ap-edit-districts"
                required
                value={district}
                onChange={(e) => handleDistrictChange(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white border border-[#E5E5E5] rounded-lg focus:outline-none focus:border-[#171717] text-[#171717]"
              />
              <datalist id="ap-edit-districts">
                {AP_DISTRICTS.map((d) => (
                  <option key={d.name} value={d.name}>
                    {d.name}
                  </option>
                ))}
              </datalist>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#171717] mb-1">
                Branch Operating Status
              </label>
              <select
                value={isActive ? 'true' : 'false'}
                onChange={(e) => setIsActive(e.target.value === 'true')}
                className="w-full px-3 py-2 text-xs bg-white border border-[#E5E5E5] rounded-lg focus:outline-none focus:border-[#171717] text-[#171717]"
              >
                <option value="true">Active Branch</option>
                <option value="false">Inactive / Suspended</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#171717] mb-1 flex items-center justify-between">
              <span>Geofence Boundary Radius</span>
              <strong className="text-blue-700 font-bold">{geofenceRadiusMetres} metres</strong>
            </label>
            <input
              type="range"
              min={50}
              max={500}
              step={25}
              value={geofenceRadiusMetres}
              onChange={(e) => setGeofenceRadiusMetres(parseInt(e.target.value, 10))}
              className="w-full accent-blue-600 cursor-pointer mt-1"
            />
          </div>

          {/* Interactive Map Picker */}
          <div className="space-y-1.5 pt-1">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="font-semibold text-xs text-[#171717] flex items-center space-x-1.5">
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
              radiusMetres={geofenceRadiusMetres}
              onChange={(coords) => {
                setLatitude(coords.latitude);
                setLongitude(coords.longitude);
              }}
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
              className="px-4 py-2 bg-[#171717] hover:bg-black text-white rounded-lg text-xs font-medium transition-colors flex items-center space-x-1.5 disabled:opacity-50 shadow-xs"
            >
              {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              <span>{submitting ? 'Updating...' : 'Update Branch'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
