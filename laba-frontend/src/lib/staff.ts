/** Staff classification shared by the admin portal and the staff app. */

export type StaffCategory =
  | 'HEAD_OFFICE'
  | 'REGIONAL_OFFICE'
  | 'DISTRIBUTION_CENTER'
  | 'MARKETING_EXECUTIVE'
  | 'SALES_EXECUTIVE'
  | 'PHARMACY'
  | 'LABORATORY'
  | 'LEADERSHIP';

export type LocationType =
  | 'HEAD_OFFICE'
  | 'REGIONAL_OFFICE'
  | 'DISTRIBUTION_CENTER'
  | 'PHARMACY_HUB'
  | 'PHARMACY_SHOP'
  | 'LABORATORY'
  | 'OTHER';

export interface CategoryInfo {
  value: StaffCategory;
  short: string;
  label: string;
  group: 'Office staff' | 'Field staff' | 'Pharmacy & lab' | 'Leadership';
  how: string;
  /** Location types offered when picking this person's work location. */
  locationTypes: LocationType[] | null;
  locationRequired: boolean;
  field: boolean;
  usesShift: boolean;
}

export const CATEGORIES: CategoryInfo[] = [
  {
    value: 'HEAD_OFFICE', short: 'H.O.S', label: 'Head Office Staff', group: 'Office staff',
    how: 'Marks inside the head office geofence (Guntur).', locationTypes: ['HEAD_OFFICE'], locationRequired: true, field: false, usesShift: false,
  },
  {
    value: 'REGIONAL_OFFICE', short: 'R.O.S', label: 'Regional Office Staff', group: 'Office staff',
    how: 'Marks inside the regional office geofence (Tirupati).', locationTypes: ['REGIONAL_OFFICE'], locationRequired: true, field: false, usesShift: false,
  },
  {
    value: 'DISTRIBUTION_CENTER', short: 'D.C.S', label: 'Distribution Center Staff', group: 'Office staff',
    how: 'Marks inside their distribution centre geofence.', locationTypes: ['DISTRIBUTION_CENTER'], locationRequired: true, field: false, usesShift: false,
  },
  {
    value: 'MARKETING_EXECUTIVE', short: 'M.E', label: 'Marketing Executive', group: 'Field staff',
    how: 'Restricted route: checks in at each planned stop and records survey data.', locationTypes: ['DISTRIBUTION_CENTER'], locationRequired: false, field: true, usesShift: false,
  },
  {
    value: 'SALES_EXECUTIVE', short: 'S.E', label: 'Sales Executive', group: 'Field staff',
    how: 'Marks anywhere inside the allotted distribution centre territory map; sees DC customers.', locationTypes: ['DISTRIBUTION_CENTER'], locationRequired: true, field: true, usesShift: false,
  },
  {
    value: 'PHARMACY', short: 'PH', label: 'Pharmacy Hub & Shop Staff', group: 'Pharmacy & lab',
    how: 'Shift-wise attendance at their pharmacy location.', locationTypes: ['PHARMACY_HUB', 'PHARMACY_SHOP'], locationRequired: true, field: false, usesShift: true,
  },
  {
    value: 'LABORATORY', short: 'LAB', label: 'Laboratory Staff', group: 'Pharmacy & lab',
    how: 'Shift-wise attendance at their laboratory.', locationTypes: ['LABORATORY'], locationRequired: true, field: false, usesShift: true,
  },
  {
    value: 'LEADERSHIP', short: 'EXEC', label: 'CEO / Director / Chief Staff', group: 'Leadership',
    how: 'Can mark attendance at the office or anywhere (location is recorded).', locationTypes: null, locationRequired: false, field: false, usesShift: false,
  },
];

export const categoryInfo = (c?: string | null) => CATEGORIES.find((x) => x.value === c) ?? null;

export const categoryLabel = (c?: string | null, employeeType?: string) =>
  categoryInfo(c)?.label ?? (c === 'UNCLASSIFIED_FIELD' || employeeType === 'FIELD_STAFF' ? 'Field Staff (not classified)' : 'Office Staff (not classified)');

export const LOCATION_TYPES: { value: LocationType; label: string }[] = [
  { value: 'HEAD_OFFICE', label: 'Head Office' },
  { value: 'REGIONAL_OFFICE', label: 'Regional Office' },
  { value: 'DISTRIBUTION_CENTER', label: 'Distribution Center' },
  { value: 'PHARMACY_HUB', label: 'Pharmacy Hub' },
  { value: 'PHARMACY_SHOP', label: 'Pharmacy Shop' },
  { value: 'LABORATORY', label: 'Laboratory' },
  { value: 'OTHER', label: 'Other' },
];
export const locationTypeLabel = (t?: string | null) => LOCATION_TYPES.find((x) => x.value === t)?.label ?? 'Location';

/** Board statuses → label + colour classes. */
export const DAY_STATUS: Record<string, { label: string; cls: string }> = {
  PRESENT: { label: 'Present', cls: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
  COMPLETED: { label: 'Checked out', cls: 'bg-emerald-100 text-emerald-900 border-emerald-300' },
  CORRECTED: { label: 'Corrected', cls: 'bg-blue-50 text-blue-800 border-blue-200' },
  NOT_YET: { label: 'Not yet', cls: 'bg-slate-50 text-slate-700 border-slate-200' },
  ABSENT: { label: 'Absent', cls: 'bg-red-50 text-red-800 border-red-200' },
  HOLIDAY: { label: 'Holiday', cls: 'bg-violet-50 text-violet-800 border-violet-200' },
  NO_TASKS: { label: 'No route', cls: 'bg-amber-50 text-amber-800 border-amber-200' },
  UPCOMING: { label: 'Upcoming', cls: 'bg-slate-50 text-slate-500 border-slate-200' },
};

export const istToday = () => new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10);

export const fmtIST = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' }) : '';

export const fmtDate = (ymd?: string | null) =>
  ymd ? new Date(`${ymd}T00:00:00Z`).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }) : '';
