'use client';

import React, { useEffect, useState } from 'react';
import { X, Loader2, Building2, AlertCircle, Check, Map as MapIcon } from 'lucide-react';
import { apiClient, apiErrorMessage } from '@/lib/api';
import { AP_DISTRICTS, findAndhraCoordinates } from '@/lib/districts';
import { FenceValue, isBoundary } from '@/lib/geo';
import { LOCATION_TYPES, LocationType } from '@/lib/staff';
import { GeofenceEditor } from '@/components/map/dynamic';

interface Props {
  isOpen: boolean;
  mode: 'add' | 'edit';
  branch?: any | null;
  onClose: () => void;
  onSuccess: () => void;
}

const DISTRICT_NAMES = Array.from(new Set(AP_DISTRICTS.map((d) => d.name)));
const emptyFence = (): FenceValue => ({ latitude: 16.3067, longitude: 80.4365, radiusMetres: 100, shape: 'CIRCLE', boundary: null, boundaryLabel: null });
const emptyTerritory = (): FenceValue => ({ ...emptyFence(), shape: 'POLYGON' });

const input = 'w-full px-3 py-2 border border-[#E2E8F0] rounded-lg focus:outline-none focus:border-brand-700 text-ink bg-white';

/** Add / edit a work location: head office, regional office, distribution centre, pharmacy, laboratory. */
export function LocationModal({ isOpen, mode, branch, onClose, onSuccess }: Props) {
  const [name, setName] = useState('');
  const [branchCode, setBranchCode] = useState('');
  const [locationType, setLocationType] = useState<LocationType>('PHARMACY_SHOP');
  const [district, setDistrict] = useState('Guntur');
  const [address, setAddress] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [fence, setFence] = useState<FenceValue>(emptyFence());
  const [territoryOn, setTerritoryOn] = useState(false);
  const [territory, setTerritory] = useState<FenceValue>(emptyTerritory());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    if (mode === 'add' || !branch) {
      setName('');
      setBranchCode('');
      setLocationType('PHARMACY_SHOP');
      setDistrict('Guntur');
      setAddress('');
      setIsActive(true);
      setFence(emptyFence());
      setTerritoryOn(false);
      setTerritory(emptyTerritory());
      return;
    }
    // The list only flags boundaries; load the full GeoJSON for editing
    setLoading(true);
    apiClient
      .get(`/branches/${branch.id}`)
      .then((res) => {
        const b = res.data.data;
        setName(b.name);
        setBranchCode(b.branchCode);
        setLocationType(b.locationType || 'PHARMACY_SHOP');
        setDistrict(b.district);
        setAddress(b.address);
        setIsActive(b.isActive);
        setFence({
          latitude: Number(b.latitude),
          longitude: Number(b.longitude),
          radiusMetres: b.geofenceRadiusMetres,
          shape: b.geofenceShape === 'POLYGON' && isBoundary(b.boundary) ? 'POLYGON' : 'CIRCLE',
          boundary: isBoundary(b.boundary) ? b.boundary : null,
          boundaryLabel: b.boundaryLabel,
        });
        const hasTerritory = isBoundary(b.territory);
        setTerritoryOn(hasTerritory);
        setTerritory({
          ...emptyTerritory(),
          latitude: Number(b.latitude),
          longitude: Number(b.longitude),
          boundary: hasTerritory ? b.territory : null,
          boundaryLabel: b.territoryLabel,
        });
      })
      .catch((err) => setError(apiErrorMessage(err, 'Could not load this location.')))
      .finally(() => setLoading(false));
  }, [isOpen, mode, branch]);

  if (!isOpen) return null;

  const isDC = locationType === 'DISTRIBUTION_CENTER';

  const onDistrict = (d: string) => {
    setDistrict(d);
    const c = findAndhraCoordinates(d);
    if (c && fence.shape === 'CIRCLE' && mode === 'add') setFence((f) => ({ ...f, latitude: c.latitude, longitude: c.longitude }));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (fence.shape === 'POLYGON' && !fence.boundary) return setError('Pick, draw or import the exact boundary, or switch the geofence to Radius.');
    if (isDC && territoryOn && !territory.boundary) return setError('Pick, draw or import the sales territory, or turn the territory off.');
    setSaving(true);
    const body: any = {
      name: name.trim(),
      address: address.trim(),
      district: district.trim(),
      latitude: fence.latitude,
      longitude: fence.longitude,
      geofenceRadiusMetres: fence.radiusMetres,
      locationType,
      geofenceShape: fence.shape,
      boundary: fence.shape === 'POLYGON' ? fence.boundary : null,
      boundaryLabel: fence.shape === 'POLYGON' ? fence.boundaryLabel : null,
      territory: isDC && territoryOn ? territory.boundary : null,
      territoryLabel: isDC && territoryOn ? territory.boundaryLabel : null,
    };
    try {
      if (mode === 'add') {
        await apiClient.post('/branches', { ...body, branchCode: branchCode.trim() || undefined, state: 'Andhra Pradesh' });
      } else {
        await apiClient.patch(`/branches/${branch.id}`, { ...body, isActive });
      }
      onSuccess();
      onClose();
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not save the location.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-black/60 p-2 sm:p-5 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full border border-[#E2E8F0] my-2 sm:my-auto flex flex-col max-h-[96vh]">
        <div className="flex items-center justify-between border-b border-[#E2E8F0] p-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-brand-700 text-white flex items-center justify-center">
              <Building2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-ink">{mode === 'add' ? 'Add work location' : `Edit ${name || 'location'}`}</h3>
              <p className="text-[11px] text-[#64748B]">Office, distribution centre, pharmacy or lab, with its attendance geofence</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-[#64748B] hover:bg-[#EEF2F7]" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>

        {loading ? (
          <div className="p-16 flex justify-center">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        ) : (
          <form onSubmit={submit} className="flex-1 overflow-y-auto p-4 space-y-3 text-xs">
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 flex gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="block">
                <span className="block font-semibold mb-1">Location type *</span>
                <select value={locationType} onChange={(e) => setLocationType(e.target.value as LocationType)} className={input}>
                  {LOCATION_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="block font-semibold mb-1">Name *</span>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  minLength={2}
                  placeholder={isDC ? 'e.g. Kadapa Distribution Center' : 'e.g. Head Office Guntur'}
                  className={input}
                />
              </label>
              {mode === 'add' ? (
                <label className="block">
                  <span className="block font-semibold mb-1">Code (optional)</span>
                  <input value={branchCode} onChange={(e) => setBranchCode(e.target.value)} placeholder="Auto-generated if empty" className={input} />
                </label>
              ) : (
                <div>
                  <span className="block font-semibold mb-1">Code</span>
                  <div className="px-3 py-2 rounded-lg bg-[#F4F6FB] font-mono">{branchCode}</div>
                </div>
              )}
              <label className="block">
                <span className="block font-semibold mb-1">District *</span>
                <input list="ap-districts" value={district} onChange={(e) => onDistrict(e.target.value)} required className={input} />
                <datalist id="ap-districts">
                  {DISTRICT_NAMES.map((d) => (
                    <option key={d} value={d} />
                  ))}
                </datalist>
              </label>
              <label className="block sm:col-span-2">
                <span className="block font-semibold mb-1">Address *</span>
                <input value={address} onChange={(e) => setAddress(e.target.value)} required minLength={5} placeholder="Street, area, town" className={input} />
              </label>
              {mode === 'edit' && (
                <label className="flex items-center gap-2 sm:col-span-2">
                  <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
                  <span>Active (inactive locations cannot be used for attendance)</span>
                </label>
              )}
            </div>

            <div>
              <div className="font-semibold mb-1">Attendance geofence</div>
              <p className="text-[11px] text-[#64748B] mb-2">
                Staff of this location must be inside this area to check in. Use a radius around the building, or the exact outline of the premises / town.
              </p>
              <GeofenceEditor value={fence} onChange={setFence} maxRadius={5000} />
            </div>

            {isDC && (
              <div className="rounded-xl border border-violet-200 bg-violet-50/50 p-3 space-y-2">
                <label className="flex items-start gap-2">
                  <input type="checkbox" checked={territoryOn} onChange={(e) => setTerritoryOn(e.target.checked)} className="mt-0.5" />
                  <span>
                    <span className="font-semibold flex items-center gap-1">
                      <MapIcon className="w-3.5 h-3.5 text-violet-700" /> Sales territory (D.C fencing map)
                    </span>
                    <span className="text-[11px] text-[#64748B]">
                      Sales executives of this DC can mark attendance anywhere inside this area (for example the whole Kadapa town boundary). Without it they
                      must be inside the DC geofence above.
                    </span>
                  </span>
                </label>
                {territoryOn && (
                  <GeofenceEditor
                    value={territory}
                    onChange={setTerritory}
                    allowCircle={false}
                    polygonHint="Sales executives of this DC can mark attendance anywhere inside this territory."
                  />
                )}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-3 border-t border-[#E2E8F0] sticky bottom-0 bg-white">
              <button type="button" onClick={onClose} className="px-3 py-2 border border-[#E2E8F0] rounded-lg">
                Cancel
              </button>
              <button type="submit" disabled={saving} className="px-4 py-2 bg-brand-700 text-white rounded-lg font-semibold flex items-center gap-1.5 disabled:opacity-50">
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                {mode === 'add' ? 'Create location' : 'Save changes'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
