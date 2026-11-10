export type UserRole = 'SUPER_ADMIN' | 'ADMIN' | 'OFFICE_STAFF' | 'FIELD_STAFF';

export interface AssignedBranch {
  id: string;
  name: string;
  branchCode: string;
  geofenceRadiusMetres: number;
}

export interface EmployeeProfile {
  id: string;
  employeeCode: string;
  fullName: string;
  mobile: string;
  employeeType: UserRole;
  status: 'ACTIVE' | 'SUSPENDED' | 'DEACTIVATED';
  assignedBranch: AssignedBranch | null;
}

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
  employee: EmployeeProfile | null;
}

