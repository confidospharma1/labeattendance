import { EmployeeType, StaffCategory } from '@prisma/client';

export const STAFF_CATEGORIES = [
  'HEAD_OFFICE',
  'REGIONAL_OFFICE',
  'DISTRIBUTION_CENTER',
  'MARKETING_EXECUTIVE',
  'SALES_EXECUTIVE',
  'PHARMACY',
  'LABORATORY',
  'LEADERSHIP',
] as const satisfies readonly StaffCategory[];

export const CATEGORY_LABEL: Record<StaffCategory, string> = {
  HEAD_OFFICE: 'Head Office Staff (H.O.S)',
  REGIONAL_OFFICE: 'Regional Office Staff (R.O.S)',
  DISTRIBUTION_CENTER: 'Distribution Center Staff (D.C.S)',
  MARKETING_EXECUTIVE: 'Marketing Executive (M.E)',
  SALES_EXECUTIVE: 'Sales Executive (S.E)',
  PHARMACY: 'Pharmacy Hub & Shop Staff',
  LABORATORY: 'Laboratory Staff',
  LEADERSHIP: 'CEO / Director / Chief Staff',
};

const CODE_PREFIX: Record<StaffCategory, string> = {
  HEAD_OFFICE: 'HO',
  REGIONAL_OFFICE: 'RO',
  DISTRIBUTION_CENTER: 'DC',
  MARKETING_EXECUTIVE: 'ME',
  SALES_EXECUTIVE: 'SE',
  PHARMACY: 'PH',
  LABORATORY: 'LB',
  LEADERSHIP: 'EX',
};

/** How a person proves attendance. */
export type AttendanceMode =
  | 'BRANCH' // inside their assigned location's geofence (office / DC / pharmacy / lab)
  | 'TERRITORY' // sales executive: anywhere inside the DC territory
  | 'ANYWHERE' // leadership: location recorded, not enforced
  | 'FIELD_TASKS'; // marketing executive: visit each route stop

/** Field categories log in with the FIELD_STAFF role, everyone else with OFFICE_STAFF. */
export function roleForCategory(category: StaffCategory): 'OFFICE_STAFF' | 'FIELD_STAFF' {
  return category === 'MARKETING_EXECUTIVE' || category === 'SALES_EXECUTIVE' ? 'FIELD_STAFF' : 'OFFICE_STAFF';
}

export function attendanceModeFor(employeeType: EmployeeType | string, category: StaffCategory | null | undefined): AttendanceMode {
  if (category === 'LEADERSHIP') return 'ANYWHERE';
  if (category === 'SALES_EXECUTIVE') return 'TERRITORY';
  if (category === 'MARKETING_EXECUTIVE' || employeeType === 'FIELD_STAFF') return 'FIELD_TASKS';
  return 'BRANCH';
}

/** Whether an assigned location (branch / DC) is mandatory for this mode. */
export const modeNeedsLocation = (mode: AttendanceMode) => mode === 'BRANCH' || mode === 'TERRITORY';

export function codePrefixFor(employeeType: EmployeeType | string, category?: StaffCategory | null): string {
  if (category) return `JT-${CODE_PREFIX[category]}`;
  if (employeeType === 'FIELD_STAFF') return 'JT-FS';
  if (employeeType === 'ADMIN' || employeeType === 'SUPER_ADMIN') return 'JT-AD';
  return 'JT-OS';
}
