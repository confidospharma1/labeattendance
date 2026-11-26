'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { X, UserPlus, UserCog, Loader2, Check, AlertCircle } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { CATEGORIES, categoryInfo, locationTypeLabel, StaffCategory } from '@/lib/staff';

interface Props {
  isOpen: boolean;
  mode: 'add' | 'edit';
  employee?: any | null;
  branches: any[];
  onClose: () => void;
  onSuccess: () => void;
}

type Kind = StaffCategory | 'ADMIN' | 'LEGACY_OFFICE' | 'LEGACY_FIELD';

const input = 'w-full px-2.5 py-2 border border-[#E5E5E5] rounded-lg focus:outline-none focus:ring-1 focus:ring-black bg-white';

const errorText = (err: any, fallback: string) => {
  const e = err?.response?.data?.error;
  if (Array.isArray(e?.details) && e.details.length) {
    return e.details.map((d: any) => `${d.field ? String(d.field).replace('body.', '') + ': ' : ''}${d.message}`).join(' · ');
  }
  return e?.message || err?.message || fallback;
};

export function EmployeeFormModal({ isOpen, mode, employee, branches, onClose, onSuccess }: Props) {
  const [kind, setKind] = useState<Kind>('HEAD_OFFICE');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [mobile, setMobile] = useState('');
  const [designation, setDesignation] = useState('');
  const [dateOfJoining, setDateOfJoining] = useState('');
  const [employeeCode, setEmployeeCode] = useState('');
  const [branchId, setBranchId] = useState('');
  const [shiftId, setShiftId] = useState('');
  const [password, setPassword] = useState('Password@123');
  const [status, setStatus] = useState('ACTIVE');
  const [profileNotes, setProfileNotes] = useState('');
  const [showAllLocations, setShowAllLocations] = useState(false);
  const [shifts, setShifts] = useState<any[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    setShowAllLocations(false);
    apiClient
      .get('/shifts')
      .then((r) => setShifts((r.data.data || []).filter((s: any) => s.isActive)))
      .catch(() => setShifts([]));

    if (mode === 'edit' && employee) {
      setKind(
        employee.employeeType === 'ADMIN' || employee.employeeType === 'SUPER_ADMIN'
          ? 'ADMIN'
          : employee.staffCategory || (employee.employeeType === 'FIELD_STAFF' ? 'LEGACY_FIELD' : 'LEGACY_OFFICE')
      );
      setFullName(employee.fullName || '');
      setEmail(employee.email || '');
      setMobile(employee.mobile || '');
      setDesignation(employee.designation || '');
      setDateOfJoining(employee.dateOfJoining || '');
      setEmployeeCode(employee.employeeCode || '');
      setBranchId(employee.assignedBranch?.id || '');
      setShiftId(employee.shift?.id || '');
      setStatus(employee.status === 'SUSPENDED' || employee.status === 'DEACTIVATED' ? employee.status : 'ACTIVE');
      setProfileNotes(employee.profileNotes || '');
    } else {
      setKind('HEAD_OFFICE');
      setFullName('');
      setEmail('');
      setMobile('');
      setDesignation('');
      setDateOfJoining('');
      setEmployeeCode('');
      setBranchId('');
      setShiftId('');
      setPassword('Password@123');
      setStatus('ACTIVE');
      setProfileNotes('');
    }
  }, [isOpen, mode, employee]);

  const info = categoryInfo(kind);
  const locationOptions = useMemo(() => {
    const active = branches.filter((b) => b.isActive !== false);
    if (showAllLocations || !info?.locationTypes) return active;
    return active.filter((b) => info.locationTypes!.includes(b.locationType));
  }, [branches, info, showAllLocations]);

  if (!isOpen) return null;

  const needsLocation = kind === 'LEGACY_OFFICE' || !!info?.locationRequired;
  const showLocation = kind !== 'ADMIN';

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const cleanMobile = mobile.replace(/\D/g, '').slice(-10);
    if (!/^[6-9]\d{9}$/.test(cleanMobile)) return setError('Mobile must be a valid 10-digit Indian number (starts with 6-9).');
    if (needsLocation && !branchId) {
      return setError(
        locationOptions.length === 0
          ? `No ${info?.locationTypes?.map(locationTypeLabel).join(' / ') || 'work location'} exists yet. Create it under "Locations & Geofences" first.`
          : 'Select the work location for this staff member.'
      );
    }

    const category = kind === 'ADMIN' || kind.startsWith('LEGACY') ? null : (kind as StaffCategory);
    const employeeType = kind === 'ADMIN' ? 'ADMIN' : kind === 'LEGACY_FIELD' ? 'FIELD_STAFF' : kind === 'LEGACY_OFFICE' ? 'OFFICE_STAFF' : undefined;
    const common = {
      fullName: fullName.trim(),
      email: email.trim().toLowerCase(),
      mobile: cleanMobile,
      ...(employeeType && { employeeType }),
      ...(category !== null || mode === 'edit' ? { staffCategory: category } : {}),
      designation: designation.trim() || null,
      dateOfJoining: dateOfJoining || null,
      shiftId: kind === 'ADMIN' ? null : shiftId || null,
      profileNotes: profileNotes.trim() || undefined,
    };

    setSubmitting(true);
    try {
      if (mode === 'add') {
        await apiClient.post('/employees', {
          ...common,
          password,
          employeeCode: employeeCode.trim() || undefined,
          branchId: showLocation && branchId ? branchId : undefined,
        });
      } else {
        await apiClient.patch(`/employees/${employee.id}`, {
          ...common,
          ...(employeeCode.trim() && employeeCode.trim() !== employee.employeeCode && { employeeCode: employeeCode.trim() }),
          branchId: showLocation ? branchId || null : null,
          status,
        });
      }
      onSuccess();
      onClose();
    } catch (err) {
      setError(errorText(err, 'Could not save the employee.'));
    } finally {
      setSubmitting(false);
    }
  };

  const groups = Array.from(new Set(CATEGORIES.map((c) => c.group)));

  return (
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-black/40 p-2 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full border border-[#E5E5E5] my-2 sm:my-8">
        <div className="flex items-center justify-between border-b border-[#E5E5E5] p-4">
          <div className="flex items-center gap-2">
            {mode === 'add' ? <UserPlus className="w-4 h-4" /> : <UserCog className="w-4 h-4" />}
            <h3 className="text-sm font-bold text-[#171717]">{mode === 'add' ? 'Register new employee' : `Edit ${employee?.fullName}`}</h3>
          </div>
          <button onClick={onClose} className="text-[#737373] hover:text-[#171717]" aria-label="Close">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={submit} className="p-4 space-y-3 text-xs">
          {error && (
            <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg text-red-800 flex gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <label className="block">
            <span className="block font-semibold mb-1">Staff category *</span>
            <select
              value={kind}
              onChange={(e) => {
                setKind(e.target.value as Kind);
                setBranchId('');
              }}
              className={input}
            >
              {groups.map((g) => (
                <optgroup key={g} label={g}>
                  {CATEGORIES.filter((c) => c.group === g).map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label} ({c.short})
                    </option>
                  ))}
                </optgroup>
              ))}
              <optgroup label="Other">
                <option value="ADMIN">Administrator (portal access, no attendance)</option>
                {mode === 'edit' && kind === 'LEGACY_OFFICE' && <option value="LEGACY_OFFICE">Office staff (not classified)</option>}
                {mode === 'edit' && kind === 'LEGACY_FIELD' && <option value="LEGACY_FIELD">Field staff (not classified)</option>}
              </optgroup>
            </select>
            {info && <span className="block mt-1 text-[11px] text-[#737373]">{info.how}</span>}
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block">
              <span className="block font-semibold mb-1">Employee name *</span>
              <input value={fullName} onChange={(e) => setFullName(e.target.value)} required minLength={2} placeholder="e.g. Ramesh Kumar" className={input} />
            </label>
            <label className="block">
              <span className="block font-semibold mb-1">Employee code</span>
              <input
                value={employeeCode}
                onChange={(e) => setEmployeeCode(e.target.value.toUpperCase())}
                placeholder={mode === 'add' ? 'Auto (e.g. LABE-HO-001) or your HR code' : ''}
                className={`${input} font-mono`}
              />
            </label>
            <label className="block">
              <span className="block font-semibold mb-1">Designation</span>
              <input value={designation} onChange={(e) => setDesignation(e.target.value)} maxLength={120} placeholder="e.g. Accountant, Pharmacist, Lab Technician" className={input} />
            </label>
            <label className="block">
              <span className="block font-semibold mb-1">Date of joining (DOJ)</span>
              <input type="date" value={dateOfJoining} onChange={(e) => setDateOfJoining(e.target.value)} className={input} />
            </label>
            <label className="block">
              <span className="block font-semibold mb-1">Email (login) *</span>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="ramesh@labe.in" className={input} />
            </label>
            <label className="block">
              <span className="block font-semibold mb-1">Mobile *</span>
              <input type="tel" value={mobile} maxLength={10} onChange={(e) => setMobile(e.target.value)} required placeholder="9876543210" className={`${input} font-mono`} />
            </label>
          </div>

          {showLocation && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="block">
                <span className="block font-semibold mb-1">
                  {kind === 'SALES_EXECUTIVE' || kind === 'MARKETING_EXECUTIVE' ? 'Distribution centre (D.C)' : 'Work location'}
                  {needsLocation ? ' *' : ' (optional)'}
                </span>
                <select value={branchId} onChange={(e) => setBranchId(e.target.value)} className={input}>
                  <option value="">{needsLocation ? 'Select…' : 'None'}</option>
                  {locationOptions.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} · {locationTypeLabel(b.locationType)} · {b.district}
                    </option>
                  ))}
                </select>
                {info?.locationTypes && (
                  <label className="mt-1 flex items-center gap-1.5 text-[11px] text-[#737373]">
                    <input type="checkbox" checked={showAllLocations} onChange={(e) => setShowAllLocations(e.target.checked)} />
                    Show all location types
                  </label>
                )}
              </label>
              <label className="block">
                <span className="block font-semibold mb-1">Shift {info?.usesShift ? '(recommended)' : '(optional)'}</span>
                <select value={shiftId} onChange={(e) => setShiftId(e.target.value)} className={input}>
                  <option value="">No shift – use organisation check-in/out windows</option>
                  {shifts.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.startTime}–{s.endTime}){s.branch ? ` · ${s.branch.name}` : ''}
                    </option>
                  ))}
                </select>
                {info?.usesShift && shifts.length === 0 && (
                  <span className="block mt-1 text-[11px] text-amber-700">No shifts yet – create them in the Shifts tab.</span>
                )}
              </label>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {mode === 'add' ? (
              <label className="block">
                <span className="block font-semibold mb-1">Initial password *</span>
                <input value={password} onChange={(e) => setPassword(e.target.value)} required className={`${input} font-mono`} />
              </label>
            ) : (
              <label className="block">
                <span className="block font-semibold mb-1">Account status</span>
                <select value={status} onChange={(e) => setStatus(e.target.value)} className={input}>
                  <option value="ACTIVE">Active</option>
                  <option value="SUSPENDED">Suspended</option>
                  <option value="DEACTIVATED">Deactivated</option>
                </select>
              </label>
            )}
            <label className="block">
              <span className="block font-semibold mb-1">Notes</span>
              <input value={profileNotes} onChange={(e) => setProfileNotes(e.target.value)} placeholder="Licence no., remarks…" className={input} />
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-[#E5E5E5]">
            <button type="button" onClick={onClose} className="px-3 py-2 border border-[#E5E5E5] rounded-lg">
              Cancel
            </button>
            <button type="submit" disabled={submitting} className="px-4 py-2 bg-[#171717] text-white rounded-lg font-semibold flex items-center gap-1.5 disabled:opacity-50">
              {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              {mode === 'add' ? 'Create employee' : 'Save changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
