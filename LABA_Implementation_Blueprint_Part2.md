# LABA Blueprint — Part 2
## Parts C and D: Database Design & Backend Implementation Plan

---

# PART C – DATABASE DESIGN

---

## Section 21 – Entity Relationship Diagram

```mermaid
erDiagram
    organizations ||--o{ branches : "has"
    organizations ||--o{ attendance_policies : "configures"
    organizations ||--o{ holidays : "defines"

    users ||--|| employees : "linked to"
    users {
        uuid id PK
        string email UK
        string password_hash
        enum role
        boolean is_active
        timestamp last_login_at
        timestamp created_at
        timestamp updated_at
        timestamp deleted_at
    }

    employees {
        uuid id PK
        uuid user_id FK
        uuid organization_id FK
        string employee_code UK
        string contact_id
        string full_name
        string mobile
        enum employee_type
        enum status
        timestamp created_at
        timestamp updated_at
        timestamp deleted_at
    }

    branches {
        uuid id PK
        uuid organization_id FK
        string branch_code UK
        string name
        string address
        string district
        string state
        decimal latitude
        decimal longitude
        integer geofence_radius_metres
        boolean is_active
        timestamp created_at
        timestamp updated_at
    }

    branch_assignments {
        uuid id PK
        uuid employee_id FK
        uuid branch_id FK
        date effective_from
        date effective_to
        boolean is_current
        uuid assigned_by FK
        timestamp created_at
    }

    field_staff_schedules {
        uuid id PK
        uuid employee_id FK
        date schedule_date
        enum schedule_type
        string location_name
        string address
        decimal latitude
        decimal longitude
        integer geofence_radius_metres
        boolean attendance_enabled
        uuid assigned_by FK
        timestamp created_at
        timestamp updated_at
    }

    attendance_policies {
        uuid id PK
        uuid organization_id FK
        integer version
        boolean is_current
        time morning_start
        time morning_end
        time evening_start
        time evening_end
        integer default_geofence_radius
        integer min_report_length
        integer max_report_length
        integer gps_accuracy_warn_threshold
        integer gps_accuracy_reject_threshold
        string timezone
        date effective_from
        uuid created_by FK
        timestamp created_at
    }

    attendance_records {
        uuid id PK
        uuid employee_id FK
        uuid organization_id FK
        date work_date
        uuid policy_version_id FK
        uuid location_ref_id
        enum location_ref_type
        enum status
        timestamp check_in_at
        decimal check_in_lat
        decimal check_in_lng
        decimal check_in_accuracy
        boolean check_in_geofence_valid
        decimal check_in_distance_metres
        timestamp check_out_at
        decimal check_out_lat
        decimal check_out_lng
        decimal check_out_accuracy
        boolean check_out_geofence_valid
        decimal check_out_distance_metres
        string work_report
        boolean is_corrected
        timestamp created_at
        timestamp updated_at
    }

    attendance_corrections {
        uuid id PK
        uuid attendance_record_id FK
        uuid requested_by FK
        uuid reviewed_by FK
        enum correction_type
        enum status
        string employee_reason
        string admin_reason
        jsonb original_state
        jsonb corrected_state
        timestamp requested_at
        timestamp reviewed_at
    }

    audit_logs {
        uuid id PK
        uuid actor_id FK
        string actor_role
        string action
        string entity_type
        uuid entity_id
        jsonb before_state
        jsonb after_state
        string ip_address
        timestamp created_at
    }

    holidays {
        uuid id PK
        uuid organization_id FK
        date holiday_date
        string name
        boolean is_active
        timestamp created_at
    }

    employees }o--o{ branches : "branch_assignments"
    employees ||--o{ field_staff_schedules : "has"
    employees ||--o{ attendance_records : "records"
    attendance_records ||--o{ attendance_corrections : "has"
    attendance_policies ||--o{ attendance_records : "governs"
```

---

## Section 22 – Table-by-Table Explanation

### 22.1 `organizations`

Represents the LABA company entity. All branches, employees, and policies are scoped to an organization. This future-proofs the system if LABA ever operates as a multi-tenant SaaS.

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | Generated using `gen_random_uuid()` |
| `name` | VARCHAR(255) | "LABA" |
| `slug` | VARCHAR(100) UNIQUE | URL-safe identifier |
| `timezone` | VARCHAR(50) | Default: `Asia/Kolkata` |
| `is_active` | BOOLEAN | Soft disable |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | |

### 22.2 `users`

Authentication entity. Contains credentials only. Profile data lives in `employees`. Every authenticated user (including Admins and Super Admins) has a user record.

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | |
| `organization_id` | UUID FK → organizations | |
| `email` | VARCHAR(255) UNIQUE | Lowercase normalized |
| `password_hash` | VARCHAR(255) | bcrypt hash |
| `role` | ENUM | SUPER_ADMIN, ADMIN, OFFICE_STAFF, FIELD_STAFF |
| `is_active` | BOOLEAN | False = suspended |
| `last_login_at` | TIMESTAMPTZ NULL | |
| `failed_login_attempts` | INTEGER DEFAULT 0 | Reset on success |
| `locked_until` | TIMESTAMPTZ NULL | Temporary lockout |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | |
| `deleted_at` | TIMESTAMPTZ NULL | Soft delete |

### 22.3 `employees`

Employee profile entity. All employee types (Office Staff, Field Staff, Admin, Super Admin) have an employee record for profile storage and identification.

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | |
| `user_id` | UUID FK → users UNIQUE | 1:1 |
| `organization_id` | UUID FK → organizations | |
| `employee_code` | VARCHAR(20) UNIQUE | Auto-generated e.g. LABA-OS-001 |
| `contact_id` | VARCHAR(50) NULL | External reference |
| `full_name` | VARCHAR(255) | |
| `mobile` | VARCHAR(15) | |
| `employee_type` | ENUM | OFFICE_STAFF, FIELD_STAFF, ADMIN, SUPER_ADMIN |
| `status` | ENUM | ACTIVE, SUSPENDED, DEACTIVATED |
| `profile_notes` | TEXT NULL | Admin notes |
| `created_by` | UUID FK → users | |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | |
| `deleted_at` | TIMESTAMPTZ NULL | Soft delete |

### 22.4 `branches`

Pharmacy branch locations. Each branch stores its GPS anchor point and geofence radius independently.

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | |
| `organization_id` | UUID FK → organizations | |
| `branch_code` | VARCHAR(20) UNIQUE | e.g. LABA-B-001 |
| `name` | VARCHAR(255) | Branch display name |
| `address` | TEXT | Full street address |
| `district` | VARCHAR(100) | |
| `state` | VARCHAR(100) | Default: Andhra Pradesh |
| `latitude` | DECIMAL(10,7) | WGS84 |
| `longitude` | DECIMAL(10,7) | WGS84 |
| `geofence_radius_metres` | INTEGER | Configurable per branch |
| `manager_employee_id` | UUID FK → employees NULL | Optional branch manager |
| `is_active` | BOOLEAN DEFAULT TRUE | |
| `created_by` | UUID FK → users | |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | |

### 22.5 `branch_assignments`

Historical record of which employee was assigned to which branch and when. Maintains full assignment history. Only one record should have `is_current = TRUE` per employee at any time.

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | |
| `employee_id` | UUID FK → employees | |
| `branch_id` | UUID FK → branches | |
| `effective_from` | DATE | First working day at branch |
| `effective_to` | DATE NULL | NULL if still current |
| `is_current` | BOOLEAN | True for active assignment |
| `assigned_by` | UUID FK → users | |
| `notes` | TEXT NULL | Reason for transfer |
| `created_at` | TIMESTAMPTZ | |

**Unique constraint:** `(employee_id, is_current)` where `is_current = TRUE` (partial unique index).

### 22.6 `field_staff_schedules`

Daily location assignments for Field Staff. Each record represents one day's assignment for one employee. The `schedule_type` column distinguishes between: LOCATION_ASSIGNED, WEEKLY_OFF, ATTENDANCE_DISABLED, NO_SCHEDULE.

> [!IMPORTANT]
> The absence of a row in this table for a given (employee_id, schedule_date) means NO_SCHEDULE (unrestricted attendance). This is fundamentally different from a row with schedule_type = WEEKLY_OFF. The application query must explicitly distinguish these two states.

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | |
| `employee_id` | UUID FK → employees | |
| `schedule_date` | DATE | The specific work date |
| `schedule_type` | ENUM | LOCATION_ASSIGNED, WEEKLY_OFF, ATTENDANCE_DISABLED |
| `location_name` | VARCHAR(255) NULL | e.g. "Kadapa Pharmacy" |
| `address` | TEXT NULL | |
| `latitude` | DECIMAL(10,7) NULL | Required if LOCATION_ASSIGNED |
| `longitude` | DECIMAL(10,7) NULL | Required if LOCATION_ASSIGNED |
| `geofence_radius_metres` | INTEGER NULL | Required if LOCATION_ASSIGNED |
| `attendance_enabled` | BOOLEAN DEFAULT TRUE | |
| `notes` | TEXT NULL | |
| `assigned_by` | UUID FK → users | |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | |

**Unique constraint:** `(employee_id, schedule_date)` – one schedule record per employee per date.

### 22.7 `attendance_policies`

Versioned attendance configuration. When a policy is updated, the existing record's `is_current` is set to FALSE and a new record is created with `is_current = TRUE` and a new `effective_from` date. Historical attendance records reference the policy version that was active when they were created.

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | |
| `organization_id` | UUID FK → organizations | |
| `version` | INTEGER | Auto-increment per org |
| `is_current` | BOOLEAN | Only one TRUE per org |
| `morning_start` | TIME | e.g. 09:00:00 |
| `morning_end` | TIME | e.g. 09:20:00 |
| `evening_start` | TIME | e.g. 16:30:00 |
| `evening_end` | TIME | e.g. 17:00:00 |
| `default_geofence_radius_metres` | INTEGER DEFAULT 100 | |
| `min_report_length` | INTEGER DEFAULT 5 | |
| `max_report_length` | INTEGER DEFAULT 500 | |
| `gps_accuracy_warn_metres` | INTEGER DEFAULT 100 | |
| `gps_accuracy_reject_metres` | INTEGER DEFAULT 200 | |
| `allow_unrestricted_field_checkin` | BOOLEAN DEFAULT TRUE | Master switch for BR-006 |
| `timezone` | VARCHAR(50) DEFAULT 'Asia/Kolkata' | |
| `effective_from` | DATE | Date this version applies from |
| `notes` | TEXT NULL | Reason for change |
| `created_by` | UUID FK → users | |
| `created_at` | TIMESTAMPTZ | |

### 22.8 `attendance_records`

The core attendance data table. Each row represents one employee's attendance session for one work date. The unique constraint `(employee_id, work_date)` prevents duplicate entries.

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | |
| `employee_id` | UUID FK → employees | |
| `organization_id` | UUID FK → organizations | |
| `work_date` | DATE | Calendar date in IST |
| `policy_version_id` | UUID FK → attendance_policies | Snapshot of policy at time of check-in |
| `location_ref_id` | UUID NULL | Branch ID or schedule ID |
| `location_ref_type` | ENUM NULL | BRANCH, FIELD_SCHEDULE, UNRESTRICTED |
| `status` | ENUM | CHECKED_IN, CHECKED_OUT, ABSENT, CORRECTED, PENDING_CORRECTION |
| `check_in_at` | TIMESTAMPTZ NULL | UTC |
| `check_in_lat` | DECIMAL(10,7) NULL | |
| `check_in_lng` | DECIMAL(10,7) NULL | |
| `check_in_accuracy_metres` | DECIMAL(8,2) NULL | |
| `check_in_geofence_valid` | BOOLEAN NULL | |
| `check_in_distance_metres` | DECIMAL(10,2) NULL | |
| `check_out_at` | TIMESTAMPTZ NULL | UTC |
| `check_out_lat` | DECIMAL(10,7) NULL | |
| `check_out_lng` | DECIMAL(10,7) NULL | |
| `check_out_accuracy_metres` | DECIMAL(8,2) NULL | |
| `check_out_geofence_valid` | BOOLEAN NULL | |
| `check_out_distance_metres` | DECIMAL(10,2) NULL | |
| `work_report` | TEXT NULL | Submitted at check-out |
| `is_corrected` | BOOLEAN DEFAULT FALSE | |
| `is_admin_created` | BOOLEAN DEFAULT FALSE | Manually created by admin |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | |

**Unique constraint:** `(employee_id, work_date)`.

### 22.9 `attendance_corrections`

Records the full history of correction requests and resolutions. Preserves the original attendance state in a JSON snapshot before any modifications.

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | |
| `attendance_record_id` | UUID FK → attendance_records NULL | NULL if requesting creation of new record |
| `employee_id` | UUID FK → employees | |
| `organization_id` | UUID FK → organizations | |
| `correction_type` | ENUM | MISSED_CHECKIN, MISSED_CHECKOUT, WRONG_LOCATION, OTHER |
| `status` | ENUM | PENDING, APPROVED, REJECTED, CANCELLED |
| `employee_reason` | TEXT | Min 20 characters |
| `admin_reason` | TEXT NULL | Populated on review |
| `original_state` | JSONB NULL | Snapshot before correction |
| `corrected_state` | JSONB NULL | What was applied |
| `requested_by` | UUID FK → users | |
| `reviewed_by` | UUID FK → users NULL | |
| `requested_at` | TIMESTAMPTZ | |
| `reviewed_at` | TIMESTAMPTZ NULL | |

### 22.10 `audit_logs`

Append-only audit trail. No UPDATE or DELETE operations are permitted on this table. Enforced at the application layer and recommended as a database-level trigger or row-level security rule.

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | |
| `organization_id` | UUID FK → organizations | |
| `actor_id` | UUID FK → users | Who performed the action |
| `actor_role` | VARCHAR(50) | Snapshot of role at time of action |
| `action` | VARCHAR(100) | e.g. EMPLOYEE_CREATED, CHECKIN_APPROVED |
| `entity_type` | VARCHAR(100) | e.g. employees, attendance_records |
| `entity_id` | UUID NULL | The affected record |
| `before_state` | JSONB NULL | Snapshot before change |
| `after_state` | JSONB NULL | Snapshot after change |
| `ip_address` | VARCHAR(45) NULL | IPv4 or IPv6 |
| `user_agent` | TEXT NULL | |
| `metadata` | JSONB NULL | Additional context |
| `created_at` | TIMESTAMPTZ | Indexed |

### 22.11 `holidays`

Company holiday calendar. Included for future-proofing. MVP stores holidays but does not automatically suppress absence marking on holidays.

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | |
| `organization_id` | UUID FK → organizations | |
| `holiday_date` | DATE | |
| `name` | VARCHAR(255) | Holiday name |
| `description` | TEXT NULL | |
| `is_active` | BOOLEAN DEFAULT TRUE | |
| `created_by` | UUID FK → users | |
| `created_at` | TIMESTAMPTZ | |

---

## Section 23 – Complete Prisma Schema

```prisma
// prisma/schema.prisma
// LABA Attendance Management System
// Database: Neon PostgreSQL

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ─── ENUMS ───────────────────────────────────────────────────────────────────

enum UserRole {
  SUPER_ADMIN
  ADMIN
  OFFICE_STAFF
  FIELD_STAFF
}

enum EmployeeType {
  OFFICE_STAFF
  FIELD_STAFF
  ADMIN
  SUPER_ADMIN
}

enum EmployeeStatus {
  ACTIVE
  SUSPENDED
  DEACTIVATED
}

enum ScheduleType {
  LOCATION_ASSIGNED
  WEEKLY_OFF
  ATTENDANCE_DISABLED
}

enum AttendanceStatus {
  CHECKED_IN
  CHECKED_OUT
  ABSENT
  CORRECTED
  PENDING_CORRECTION
}

enum LocationRefType {
  BRANCH
  FIELD_SCHEDULE
  UNRESTRICTED
}

enum CorrectionType {
  MISSED_CHECKIN
  MISSED_CHECKOUT
  WRONG_LOCATION
  OTHER
}

enum CorrectionStatus {
  PENDING
  APPROVED
  REJECTED
  CANCELLED
}

// ─── MODELS ───────────────────────────────────────────────────────────────────

model Organization {
  id        String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  name      String   @db.VarChar(255)
  slug      String   @unique @db.VarChar(100)
  timezone  String   @default("Asia/Kolkata") @db.VarChar(50)
  isActive  Boolean  @default(true) @map("is_active")
  createdAt DateTime @default(now()) @map("created_at") @db.Timestamptz
  updatedAt DateTime @updatedAt @map("updated_at") @db.Timestamptz

  users             User[]
  branches          Branch[]
  employees         Employee[]
  attendancePolicies AttendancePolicy[]
  attendanceRecords AttendanceRecord[]
  holidays          Holiday[]
  attendanceCorrections AttendanceCorrection[]
  auditLogs         AuditLog[]

  @@map("organizations")
}

model User {
  id                   String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  organizationId       String    @map("organization_id") @db.Uuid
  email                String    @unique @db.VarChar(255)
  passwordHash         String    @map("password_hash") @db.VarChar(255)
  role                 UserRole
  isActive             Boolean   @default(true) @map("is_active")
  lastLoginAt          DateTime? @map("last_login_at") @db.Timestamptz
  failedLoginAttempts  Int       @default(0) @map("failed_login_attempts")
  lockedUntil          DateTime? @map("locked_until") @db.Timestamptz
  createdAt            DateTime  @default(now()) @map("created_at") @db.Timestamptz
  updatedAt            DateTime  @updatedAt @map("updated_at") @db.Timestamptz
  deletedAt            DateTime? @map("deleted_at") @db.Timestamptz

  organization         Organization @relation(fields: [organizationId], references: [id])
  employee             Employee?
  createdBranchAssignments BranchAssignment[] @relation("AssignedBy")
  createdSchedules     FieldStaffSchedule[] @relation("ScheduleAssignedBy")
  createdPolicies      AttendancePolicy[] @relation("PolicyCreatedBy")
  reviewedCorrections  AttendanceCorrection[] @relation("ReviewedBy")
  requestedCorrections AttendanceCorrection[] @relation("RequestedBy")
  auditLogs            AuditLog[]
  createdEmployees     Employee[] @relation("CreatedBy")
  createdBranches      Branch[]

  @@index([email])
  @@index([organizationId])
  @@map("users")
}

model Employee {
  id              String         @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  userId          String         @unique @map("user_id") @db.Uuid
  organizationId  String         @map("organization_id") @db.Uuid
  employeeCode    String         @unique @map("employee_code") @db.VarChar(20)
  contactId       String?        @map("contact_id") @db.VarChar(50)
  fullName        String         @map("full_name") @db.VarChar(255)
  mobile          String         @db.VarChar(15)
  employeeType    EmployeeType   @map("employee_type")
  status          EmployeeStatus @default(ACTIVE)
  profileNotes    String?        @map("profile_notes") @db.Text
  createdById     String         @map("created_by") @db.Uuid
  createdAt       DateTime       @default(now()) @map("created_at") @db.Timestamptz
  updatedAt       DateTime       @updatedAt @map("updated_at") @db.Timestamptz
  deletedAt       DateTime?      @map("deleted_at") @db.Timestamptz

  user                User              @relation(fields: [userId], references: [id])
  organization        Organization      @relation(fields: [organizationId], references: [id])
  createdBy           User              @relation("CreatedBy", fields: [createdById], references: [id])
  branchAssignments   BranchAssignment[]
  fieldSchedules      FieldStaffSchedule[]
  attendanceRecords   AttendanceRecord[]
  attendanceCorrections AttendanceCorrection[]
  managedBranches     Branch[]          @relation("BranchManager")

  @@index([organizationId])
  @@index([employeeCode])
  @@index([employeeType])
  @@index([status])
  @@map("employees")
}

model Branch {
  id                     String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  organizationId         String   @map("organization_id") @db.Uuid
  branchCode             String   @unique @map("branch_code") @db.VarChar(20)
  name                   String   @db.VarChar(255)
  address                String   @db.Text
  district               String   @db.VarChar(100)
  state                  String   @default("Andhra Pradesh") @db.VarChar(100)
  latitude               Decimal  @db.Decimal(10, 7)
  longitude              Decimal  @db.Decimal(10, 7)
  geofenceRadiusMetres   Int      @default(100) @map("geofence_radius_metres")
  managerEmployeeId      String?  @map("manager_employee_id") @db.Uuid
  isActive               Boolean  @default(true) @map("is_active")
  createdById            String   @map("created_by") @db.Uuid
  createdAt              DateTime @default(now()) @map("created_at") @db.Timestamptz
  updatedAt              DateTime @updatedAt @map("updated_at") @db.Timestamptz

  organization      Organization      @relation(fields: [organizationId], references: [id])
  createdBy         User              @relation(fields: [createdById], references: [id])
  manager           Employee?         @relation("BranchManager", fields: [managerEmployeeId], references: [id])
  assignments       BranchAssignment[]

  @@index([organizationId])
  @@index([branchCode])
  @@map("branches")
}

model BranchAssignment {
  id           String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  employeeId   String   @map("employee_id") @db.Uuid
  branchId     String   @map("branch_id") @db.Uuid
  effectiveFrom Date     @map("effective_from")
  effectiveTo   Date?    @map("effective_to")
  isCurrent    Boolean  @default(true) @map("is_current")
  assignedById String   @map("assigned_by") @db.Uuid
  notes        String?  @db.Text
  createdAt    DateTime @default(now()) @map("created_at") @db.Timestamptz

  employee    Employee @relation(fields: [employeeId], references: [id])
  branch      Branch   @relation(fields: [branchId], references: [id])
  assignedBy  User     @relation("AssignedBy", fields: [assignedById], references: [id])

  @@index([employeeId, isCurrent])
  @@index([branchId])
  @@map("branch_assignments")
}

model FieldStaffSchedule {
  id                   String       @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  employeeId           String       @map("employee_id") @db.Uuid
  scheduleDate         DateTime     @map("schedule_date") @db.Date
  scheduleType         ScheduleType @map("schedule_type")
  locationName         String?      @map("location_name") @db.VarChar(255)
  address              String?      @db.Text
  latitude             Decimal?     @db.Decimal(10, 7)
  longitude            Decimal?     @db.Decimal(10, 7)
  geofenceRadiusMetres Int?         @map("geofence_radius_metres")
  attendanceEnabled    Boolean      @default(true) @map("attendance_enabled")
  notes                String?      @db.Text
  assignedById         String       @map("assigned_by") @db.Uuid
  createdAt            DateTime     @default(now()) @map("created_at") @db.Timestamptz
  updatedAt            DateTime     @updatedAt @map("updated_at") @db.Timestamptz

  employee    Employee @relation(fields: [employeeId], references: [id])
  assignedBy  User     @relation("ScheduleAssignedBy", fields: [assignedById], references: [id])

  @@unique([employeeId, scheduleDate])
  @@index([employeeId, scheduleDate])
  @@map("field_staff_schedules")
}

model AttendancePolicy {
  id                        String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  organizationId            String   @map("organization_id") @db.Uuid
  version                   Int
  isCurrent                 Boolean  @default(true) @map("is_current")
  morningStart              DateTime @map("morning_start") @db.Time
  morningEnd                DateTime @map("morning_end") @db.Time
  eveningStart              DateTime @map("evening_start") @db.Time
  eveningEnd                DateTime @map("evening_end") @db.Time
  defaultGeofenceRadiusMetres Int    @default(100) @map("default_geofence_radius_metres")
  minReportLength           Int      @default(5) @map("min_report_length")
  maxReportLength           Int      @default(500) @map("max_report_length")
  gpsAccuracyWarnMetres     Int      @default(100) @map("gps_accuracy_warn_metres")
  gpsAccuracyRejectMetres   Int      @default(200) @map("gps_accuracy_reject_metres")
  allowUnrestrictedFieldCheckin Boolean @default(true) @map("allow_unrestricted_field_checkin")
  timezone                  String   @default("Asia/Kolkata") @db.VarChar(50)
  effectiveFrom             DateTime @map("effective_from") @db.Date
  notes                     String?  @db.Text
  createdById               String   @map("created_by") @db.Uuid
  createdAt                 DateTime @default(now()) @map("created_at") @db.Timestamptz

  organization      Organization       @relation(fields: [organizationId], references: [id])
  createdBy         User               @relation("PolicyCreatedBy", fields: [createdById], references: [id])
  attendanceRecords AttendanceRecord[]

  @@unique([organizationId, version])
  @@index([organizationId, isCurrent])
  @@map("attendance_policies")
}

model AttendanceRecord {
  id                       String          @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  employeeId               String          @map("employee_id") @db.Uuid
  organizationId           String          @map("organization_id") @db.Uuid
  workDate                 DateTime        @map("work_date") @db.Date
  policyVersionId          String          @map("policy_version_id") @db.Uuid
  locationRefId            String?         @map("location_ref_id") @db.Uuid
  locationRefType          LocationRefType? @map("location_ref_type")
  status                   AttendanceStatus @default(CHECKED_IN)
  checkInAt                DateTime?       @map("check_in_at") @db.Timestamptz
  checkInLat               Decimal?        @map("check_in_lat") @db.Decimal(10, 7)
  checkInLng               Decimal?        @map("check_in_lng") @db.Decimal(10, 7)
  checkInAccuracyMetres    Decimal?        @map("check_in_accuracy_metres") @db.Decimal(8, 2)
  checkInGeofenceValid     Boolean?        @map("check_in_geofence_valid")
  checkInDistanceMetres    Decimal?        @map("check_in_distance_metres") @db.Decimal(10, 2)
  checkOutAt               DateTime?       @map("check_out_at") @db.Timestamptz
  checkOutLat              Decimal?        @map("check_out_lat") @db.Decimal(10, 7)
  checkOutLng              Decimal?        @map("check_out_lng") @db.Decimal(10, 7)
  checkOutAccuracyMetres   Decimal?        @map("check_out_accuracy_metres") @db.Decimal(8, 2)
  checkOutGeofenceValid    Boolean?        @map("check_out_geofence_valid")
  checkOutDistanceMetres   Decimal?        @map("check_out_distance_metres") @db.Decimal(10, 2)
  workReport               String?         @map("work_report") @db.Text
  isCorrected              Boolean         @default(false) @map("is_corrected")
  isAdminCreated           Boolean         @default(false) @map("is_admin_created")
  createdAt                DateTime        @default(now()) @map("created_at") @db.Timestamptz
  updatedAt                DateTime        @updatedAt @map("updated_at") @db.Timestamptz

  employee          Employee           @relation(fields: [employeeId], references: [id])
  organization      Organization       @relation(fields: [organizationId], references: [id])
  policyVersion     AttendancePolicy   @relation(fields: [policyVersionId], references: [id])
  corrections       AttendanceCorrection[]

  @@unique([employeeId, workDate])
  @@index([organizationId, workDate])
  @@index([employeeId, workDate])
  @@index([status])
  @@map("attendance_records")
}

model AttendanceCorrection {
  id                  String           @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  attendanceRecordId  String?          @map("attendance_record_id") @db.Uuid
  employeeId          String           @map("employee_id") @db.Uuid
  organizationId      String           @map("organization_id") @db.Uuid
  correctionType      CorrectionType   @map("correction_type")
  status              CorrectionStatus @default(PENDING)
  employeeReason      String           @map("employee_reason") @db.Text
  adminReason         String?          @map("admin_reason") @db.Text
  originalState       Json?            @map("original_state")
  correctedState      Json?            @map("corrected_state")
  requestedById       String           @map("requested_by") @db.Uuid
  reviewedById        String?          @map("reviewed_by") @db.Uuid
  requestedAt         DateTime         @default(now()) @map("requested_at") @db.Timestamptz
  reviewedAt          DateTime?        @map("reviewed_at") @db.Timestamptz

  attendanceRecord    AttendanceRecord? @relation(fields: [attendanceRecordId], references: [id])
  employee            Employee          @relation(fields: [employeeId], references: [id])
  organization        Organization      @relation(fields: [organizationId], references: [id])
  requestedBy         User              @relation("RequestedBy", fields: [requestedById], references: [id])
  reviewedBy          User?             @relation("ReviewedBy", fields: [reviewedById], references: [id])

  @@index([organizationId, status])
  @@index([employeeId])
  @@map("attendance_corrections")
}

model AuditLog {
  id             String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  organizationId String   @map("organization_id") @db.Uuid
  actorId        String   @map("actor_id") @db.Uuid
  actorRole      String   @map("actor_role") @db.VarChar(50)
  action         String   @db.VarChar(100)
  entityType     String   @map("entity_type") @db.VarChar(100)
  entityId       String?  @map("entity_id") @db.Uuid
  beforeState    Json?    @map("before_state")
  afterState     Json?    @map("after_state")
  ipAddress      String?  @map("ip_address") @db.VarChar(45)
  userAgent      String?  @map("user_agent") @db.Text
  metadata       Json?
  createdAt      DateTime @default(now()) @map("created_at") @db.Timestamptz

  organization Organization @relation(fields: [organizationId], references: [id])
  actor        User         @relation(fields: [actorId], references: [id])

  @@index([organizationId, createdAt])
  @@index([actorId])
  @@index([entityType, entityId])
  @@map("audit_logs")
}

model Holiday {
  id             String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  organizationId String   @map("organization_id") @db.Uuid
  holidayDate    DateTime @map("holiday_date") @db.Date
  name           String   @db.VarChar(255)
  description    String?  @db.Text
  isActive       Boolean  @default(true) @map("is_active")
  createdById    String   @map("created_by") @db.Uuid
  createdAt      DateTime @default(now()) @map("created_at") @db.Timestamptz

  organization Organization @relation(fields: [organizationId], references: [id])

  @@unique([organizationId, holidayDate])
  @@index([organizationId, holidayDate])
  @@map("holidays")
}
```

---

## Section 24 – Relationships

| Relationship | Type | Notes |
|-------------|------|-------|
| Organization → Users | 1:N | All users belong to one organization |
| User → Employee | 1:1 | Every user has one employee profile |
| Organization → Branches | 1:N | Branches belong to org |
| Employee → BranchAssignments | 1:N | Full assignment history |
| Branch → BranchAssignments | 1:N | Multiple employees per branch |
| Employee → FieldStaffSchedules | 1:N | One per date |
| Organization → AttendancePolicies | 1:N | Versioned policies |
| Employee → AttendanceRecords | 1:N | One per work_date |
| AttendancePolicy → AttendanceRecords | 1:N | Policy snapshot at check-in time |
| AttendanceRecord → AttendanceCorrections | 1:N | Multiple correction attempts |
| User → AuditLogs | 1:N | Actor trail |

---

## Section 25 – Constraints

| Table | Constraint | Type |
|-------|-----------|------|
| users | email | UNIQUE |
| employees | employee_code | UNIQUE |
| employees | user_id | UNIQUE (1:1) |
| branches | branch_code | UNIQUE |
| field_staff_schedules | (employee_id, schedule_date) | UNIQUE |
| attendance_policies | (organization_id, version) | UNIQUE |
| attendance_records | (employee_id, work_date) | UNIQUE |
| holidays | (organization_id, holiday_date) | UNIQUE |
| branch_assignments | Partial unique on (employee_id) where is_current=TRUE | Partial index |

---

## Section 26 – Indexing Strategy

| Table | Index Columns | Reason |
|-------|--------------|--------|
| users | email | Login lookup |
| users | organization_id | Org scoping |
| employees | organization_id | List queries |
| employees | employee_code | Search |
| employees | employee_type, status | Filtered lists |
| branches | organization_id | Org scoping |
| field_staff_schedules | (employee_id, schedule_date) | Daily lookup (hot path) |
| attendance_records | (employee_id, work_date) | Hot path: duplicate check |
| attendance_records | (organization_id, work_date) | Dashboard queries |
| attendance_records | status | Filtering |
| audit_logs | (organization_id, created_at) | Log browsing |
| audit_logs | (entity_type, entity_id) | Entity history |
| attendance_corrections | (organization_id, status) | Pending corrections list |

---

## Section 27 – Migration Strategy

1. Use `prisma migrate dev` for local development.
2. Use `prisma migrate deploy` for production (Neon).
3. Each migration is a SQL file in `prisma/migrations/` with a timestamp and descriptive name.
4. Never edit existing migration files. Always create a new migration.
5. The initial migration creates all tables and constraints.
6. Subsequent migrations handle additive changes (new columns, new tables).
7. Destructive migrations (drop column, rename) must be preceded by a data migration migration.
8. The Neon connection string uses the pooled connection for the application and the direct connection string for Prisma migrations.

**Environment variable separation:**
```
DATABASE_URL=postgresql://...@...-pooler.neon.tech/laba?sslmode=require    # App runtime
DIRECT_URL=postgresql://...@....neon.tech/laba?sslmode=require              # Migrations only
```

```prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}
```

---

## Section 28 – Data Integrity

- **Foreign key constraints** are enforced at the database level.
- **Soft deletes** use `deleted_at` timestamps. Queries must include `WHERE deleted_at IS NULL` or Prisma soft-delete middleware.
- **Transactions** are used for all multi-table writes (check-in creates attendance record + audit log atomically).
- **Idempotent check-in**: The unique constraint on `(employee_id, work_date)` guarantees that even if two simultaneous requests pass validation, only one INSERT will succeed. The second will throw a P2002 Prisma unique violation, caught and returned as 409.
- **Audit log immutability**: The application service layer for audit logs only exposes `create`. No update or delete method is exposed. A PostgreSQL trigger can be added in production to enforce this at the DB level.

---

## Section 29 – Historical Record Preservation

| Data Type | Preservation Mechanism |
|-----------|----------------------|
| Attendance records | Never deleted; `is_corrected` flag marks modifications |
| Attendance corrections | Full before/after JSON snapshots |
| Branch assignments | `effective_to` date closes old assignment; new record is created |
| Field staff schedules | Updates are allowed but `updated_at` is tracked; a schedule history table can be added in Phase 2 |
| Attendance policies | New version record created on every change; old version preserved |
| Audit logs | Append-only; no update or delete |
| Employee records | Soft-deleted via `deleted_at`; authentication blocked when `is_active = false` |

---

# PART D – BACKEND IMPLEMENTATION PLAN

---

## Section 30 – Project Initialization

```bash
# Initialize Node.js project
mkdir laba-backend && cd laba-backend
npm init -y

# TypeScript and development tools
npm install -D typescript @types/node ts-node-dev
npx tsc --init

# Core framework
npm install express cors helmet express-rate-limit
npm install -D @types/express @types/cors

# Authentication
npm install jsonwebtoken bcrypt cookie-parser
npm install -D @types/jsonwebtoken @types/bcrypt @types/cookie-parser

# Validation
npm install zod

# ORM
npm install @prisma/client
npm install -D prisma

# Date/time (IST-aware)
npm install date-fns date-fns-tz

# Excel generation
npm install exceljs

# Logging
npm install winston

# UUID
npm install uuid
npm install -D @types/uuid
```

**tsconfig.json key settings:**
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "CommonJS",
    "strict": true,
    "esModuleInterop": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "resolveJsonModule": true
  }
}
```

---

## Section 31 – Folder Structure

(See Section 13.2 for complete folder structure — not repeated here.)

---

## Section 32 – Express Application Configuration

### 32.1 `src/app.ts`

```
Application setup order:
1. Initialize Express app
2. Trust proxy (required for IP extraction behind reverse proxy)
3. Apply helmet() for security headers
4. Apply cors() with explicit allowed origin (FRONTEND_URL env var)
5. Apply express.json() body parser (limit: 1mb)
6. Apply cookie-parser()
7. Apply global rate limiter (100 requests / 15 minutes per IP)
8. Apply /api/v1 router prefix
9. Register all route modules
10. Apply global error handler (last middleware)
```

### 32.2 Environment Variables (`.env.example`)

```
# Application
NODE_ENV=development
PORT=5000
FRONTEND_URL=http://localhost:3000

# Database (Neon)
DATABASE_URL=postgresql://user:pass@endpoint-pooler.neon.tech/laba?sslmode=require
DIRECT_URL=postgresql://user:pass@endpoint.neon.tech/laba?sslmode=require

# Authentication
JWT_SECRET=minimum-32-character-random-secret-string
JWT_EXPIRES_IN=8h
COOKIE_DOMAIN=localhost

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=100
LOGIN_RATE_LIMIT_MAX=5

# GPS
GPS_ACCURACY_WARN_DEFAULT=100
GPS_ACCURACY_REJECT_DEFAULT=200
```

---

## Section 33 – Authentication APIs

### POST `/api/v1/auth/login`

**Purpose:** Authenticate user and issue JWT cookie.  
**Auth Required:** None (public endpoint).  
**Rate Limit:** 5 requests per 15 minutes per IP/email.

**Request Body:**
```json
{
  "email": "employee@laba.in",
  "password": "SecurePassword123"
}
```

**Zod Schema:**
```typescript
z.object({
  email: z.string().email().toLowerCase(),
  password: z.string().min(8).max(128)
})
```

**Processing:**
1. Query `users` by email (include `deleted_at IS NULL`, `is_active = true`).
2. Check `locked_until > now()` → 401 with `ACCOUNT_LOCKED` and unlock time.
3. `bcrypt.compare(password, user.passwordHash)`.
4. On failure: increment `failed_login_attempts`; if ≥ 5, set `locked_until = now() + 15 minutes`. Return 401.
5. On success: reset `failed_login_attempts = 0`, update `last_login_at`.
6. Generate JWT with `{sub, role, employeeId}`.
7. Set `Set-Cookie: token=JWT; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=28800`.
8. Return user summary.

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "employee@laba.in",
      "role": "OFFICE_STAFF",
      "employeeId": "uuid",
      "fullName": "John Doe",
      "employeeCode": "LABA-OS-001"
    }
  }
}
```

**Error Responses:**
| Code | HTTP | Scenario |
|------|------|---------|
| INVALID_CREDENTIALS | 401 | Email not found or password wrong |
| ACCOUNT_LOCKED | 401 | Too many failed attempts |
| ACCOUNT_SUSPENDED | 401 | is_active = false |
| VALIDATION_ERROR | 400 | Invalid email format |

---

### POST `/api/v1/auth/logout`

**Purpose:** Clear authentication cookie.  
**Auth Required:** Yes.

**Processing:** Clear the `token` cookie with `Max-Age=0`. Return 200.

---

### GET `/api/v1/auth/me`

**Purpose:** Return the authenticated user's profile.  
**Auth Required:** Yes (all roles).

**Response (200):** User profile including employee details.

---

### POST `/api/v1/auth/change-password`

**Purpose:** Allow user to change their own password.  
**Auth Required:** Yes (all roles).

**Request Body:**
```json
{
  "currentPassword": "...",
  "newPassword": "...",
  "confirmPassword": "..."
}
```

**Validation:** newPassword must match confirmPassword; newPassword minimum 8 characters; must not equal currentPassword; must not equal email.

---

## Section 34 – Authorization Middleware

### `authorize(roles: UserRole[])`

```typescript
// Usage: router.get('/employees', authenticate, authorize(['ADMIN', 'SUPER_ADMIN']), ...)
// Checks req.user.role against allowed roles array
// Returns 403 INSUFFICIENT_PERMISSIONS if not allowed
```

### `requireOwnership(entityOwnerField)`

For employees accessing their own records. Checks that the entity's `employeeId` matches `req.user.employeeId`. Returns 403 if not.

### `requireOrganizationScope`

Injects `organizationId` from the JWT into every database query to prevent cross-organization data access.

---

## Section 35 – Employee APIs

### GET `/api/v1/employees`
**Auth:** ADMIN, SUPER_ADMIN  
**Query Params:** `type` (OFFICE_STAFF|FIELD_STAFF), `status` (ACTIVE|SUSPENDED), `branchId`, `page`, `limit`, `search`  
**Response:** Paginated employee list with branch assignment.

### POST `/api/v1/employees`
**Auth:** ADMIN, SUPER_ADMIN  
**Purpose:** Create a new employee account.

**Request Body:**
```json
{
  "fullName": "Priya Sharma",
  "email": "priya@laba.in",
  "mobile": "9876543210",
  "employeeType": "OFFICE_STAFF",
  "contactId": "CRM-001",
  "password": "TempPassword@123",
  "branchId": "uuid"
}
```

**Processing:**
1. Validate request body with Zod.
2. Check email uniqueness.
3. Generate employee code (LABA-OS-XXX or LABA-FS-XXX).
4. Hash password with bcrypt.
5. Begin transaction:
   - Create `users` record.
   - Create `employees` record.
   - If OFFICE_STAFF and branchId provided: create `branch_assignments` record.
6. Create audit log.
7. Return created employee.

### GET `/api/v1/employees/:id`
**Auth:** ADMIN, SUPER_ADMIN, or employee accessing own record.  
**Response:** Full employee profile with current branch assignment.

### PUT `/api/v1/employees/:id`
**Auth:** ADMIN, SUPER_ADMIN  
**Purpose:** Update employee profile details.  
**Note:** Email changes require re-verification (Phase 2). For MVP, Admin can update email directly.

### PATCH `/api/v1/employees/:id/status`
**Auth:** SUPER_ADMIN (for ADMIN accounts); ADMIN (for OFFICE_STAFF, FIELD_STAFF)  
**Body:** `{ "status": "SUSPENDED", "reason": "..." }`

### GET `/api/v1/employees/:id/attendance-history`
**Auth:** ADMIN, SUPER_ADMIN, or own employee.  
**Query:** `startDate`, `endDate`, `page`, `limit`

---

## Section 36 – Branch APIs

### GET `/api/v1/branches`
**Auth:** ADMIN, SUPER_ADMIN  
**Response:** All active branches with employee counts.

### POST `/api/v1/branches`
**Auth:** ADMIN, SUPER_ADMIN  

**Request Body:**
```json
{
  "name": "LABA Pharmacy Kadapa",
  "branchCode": "LABA-B-001",
  "address": "Main Road, Kadapa",
  "district": "Kadapa",
  "state": "Andhra Pradesh",
  "latitude": 14.4674,
  "longitude": 78.8241,
  "geofenceRadiusMetres": 100
}
```

**Validation:** Latitude must be between -90 and 90. Longitude between -180 and 180. geofenceRadiusMetres between 10 and 5000. branchCode must be unique.

### GET `/api/v1/branches/:id`
**Auth:** ADMIN, SUPER_ADMIN  
**Response:** Branch details + assigned employees + GPS config.

### PUT `/api/v1/branches/:id`
**Auth:** ADMIN, SUPER_ADMIN  
**Note:** GPS coordinate changes log previous coordinates in audit.

### PATCH `/api/v1/branches/:id/assign-employee`
**Auth:** ADMIN, SUPER_ADMIN  
**Body:** `{ "employeeId": "uuid", "effectiveFrom": "2026-11-10" }`  
**Processing:** Close existing active branch assignment, create new one. Audit log.

---

## Section 37 – Field Scheduling APIs

### GET `/api/v1/schedules/field-staff/:employeeId`
**Auth:** ADMIN, SUPER_ADMIN  
**Query:** `startDate`, `endDate`  
**Response:** Array of schedule records for the date range.

### GET `/api/v1/schedules/my-schedule`
**Auth:** FIELD_STAFF  
**Query:** `date` (default: today)  
**Response:** Today's (or requested date's) schedule record.

**Critical Business Rule Enforcement:**
- If record exists with `schedule_type = LOCATION_ASSIGNED`: return location details.
- If record exists with `schedule_type = WEEKLY_OFF`: return weekly off status.
- If record exists with `schedule_type = ATTENDANCE_DISABLED`: return disabled status.
- If NO record exists: return `{ "scheduleType": "NO_SCHEDULE", "unrestricted": true }`.

### POST `/api/v1/schedules/field-staff/:employeeId/single`
**Auth:** ADMIN, SUPER_ADMIN  
**Purpose:** Assign a single day's schedule.

**Request Body:**
```json
{
  "scheduleDate": "2026-11-10",
  "scheduleType": "LOCATION_ASSIGNED",
  "locationName": "Kadapa Pharmacy",
  "address": "Main Road, Kadapa",
  "latitude": 14.4674,
  "longitude": 78.8241,
  "geofenceRadiusMetres": 100
}
```

**Validation:** If scheduleType = LOCATION_ASSIGNED, latitude, longitude, and geofenceRadiusMetres are required. ScheduleDate must not be in the past (warn but allow for correction scenarios).

### POST `/api/v1/schedules/field-staff/:employeeId/weekly`
**Auth:** ADMIN, SUPER_ADMIN  
**Purpose:** Assign an entire week's schedule at once.

**Request Body:**
```json
{
  "weekStartDate": "2026-11-10",
  "schedule": [
    { "dayOffset": 0, "scheduleType": "LOCATION_ASSIGNED", "locationName": "Kadapa", "latitude": 14.4674, "longitude": 78.8241, "geofenceRadiusMetres": 100 },
    { "dayOffset": 1, "scheduleType": "LOCATION_ASSIGNED", "locationName": "Nandyal", "latitude": 15.4788, "longitude": 78.4836, "geofenceRadiusMetres": 100 },
    { "dayOffset": 6, "scheduleType": "WEEKLY_OFF" }
  ]
}
```

**Processing:** Upsert each day's schedule record. Warn if any date already has a record (overwrite with audit trail).

### PUT `/api/v1/schedules/field-staff/:employeeId/:scheduleId`
**Auth:** ADMIN, SUPER_ADMIN  
**Purpose:** Edit a single day within an existing schedule.

### DELETE `/api/v1/schedules/field-staff/:employeeId/:scheduleId`
**Auth:** ADMIN, SUPER_ADMIN  
**Purpose:** Remove a schedule assignment (converts to NO_SCHEDULE state for that date).  
**Note:** Cannot delete if attendance has already been marked for that date.

---

## Section 38 – GPS Validation Service (`geofence.service.ts`)

```typescript
// Haversine distance calculation
function haversineDistance(
  lat1: number, lon1: number,
  lat2: number, lon2: number
): number {
  const R = 6371000; // Earth radius in metres
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) *
    Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

interface GeofenceResult {
  insideGeofence: boolean;
  distanceMetres: number;
  radiusMetres: number;
  marginMetres: number; // positive = inside, negative = outside
}

function validateGeofence(
  employeeLat: number, employeeLng: number,
  targetLat: number, targetLng: number,
  radiusMetres: number
): GeofenceResult {
  const distance = haversineDistance(employeeLat, employeeLng, targetLat, targetLng);
  return {
    insideGeofence: distance <= radiusMetres,
    distanceMetres: Math.round(distance * 100) / 100,
    radiusMetres,
    marginMetres: Math.round((radiusMetres - distance) * 100) / 100
  };
}
```

**Key principles:**
- Input validation: lat must be [-90, 90]; lng must be [-180, 180].
- Reject clearly invalid coordinates (0,0 is in the Gulf of Guinea – reject for Indian use case; configure a valid India bounding box check: lat [6–38], lng [68–98]).
- Log all validation results (inside/outside, distance, margin) to the attendance record.

---

## Section 39 – Geofence Validation Service (Business Logic)

```typescript
// Determines what location enforcement applies
async function resolveLocationEnforcement(
  employeeId: string,
  employeeType: EmployeeType,
  workDate: Date,
  organizationId: string
): Promise<LocationEnforcementResult> {
  
  if (employeeType === 'OFFICE_STAFF') {
    const assignment = await getCurrentBranchAssignment(employeeId, workDate);
    if (!assignment) return { type: 'NO_BRANCH_ASSIGNED', enforced: false };
    return {
      type: 'BRANCH',
      enforced: true,
      lat: assignment.branch.latitude,
      lng: assignment.branch.longitude,
      radiusMetres: assignment.branch.geofenceRadiusMetres,
      locationRefId: assignment.branch.id,
      locationRefType: 'BRANCH'
    };
  }

  if (employeeType === 'FIELD_STAFF') {
    const schedule = await getFieldScheduleForDate(employeeId, workDate);
    
    if (!schedule) {
      // NO ROW IN DATABASE = UNRESTRICTED (not weekly off!)
      return { type: 'NO_SCHEDULE', enforced: false, unrestricted: true };
    }
    if (schedule.scheduleType === 'WEEKLY_OFF') {
      return { type: 'WEEKLY_OFF', enforced: false, blocked: true };
    }
    if (schedule.scheduleType === 'ATTENDANCE_DISABLED') {
      return { type: 'ATTENDANCE_DISABLED', enforced: false, blocked: true };
    }
    if (schedule.scheduleType === 'LOCATION_ASSIGNED') {
      return {
        type: 'FIELD_LOCATION',
        enforced: true,
        lat: schedule.latitude,
        lng: schedule.longitude,
        radiusMetres: schedule.geofenceRadiusMetres,
        locationRefId: schedule.id,
        locationRefType: 'FIELD_SCHEDULE'
      };
    }
  }
}
```

---

## Section 40 – Attendance APIs

### POST `/api/v1/attendance/check-in`
**Auth:** OFFICE_STAFF, FIELD_STAFF  
**Purpose:** Record morning check-in.

**Request Body:**
```json
{
  "latitude": 14.4674,
  "longitude": 78.8241,
  "accuracy": 15.5
}
```

**Zod Validation:**
```typescript
z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracy: z.number().positive().max(10000)
})
```

**Processing (see Section 18.1 for full sequence):**

**Success Response (201):**
```json
{
  "success": true,
  "data": {
    "attendanceId": "uuid",
    "status": "CHECKED_IN",
    "checkInAt": "2026-11-09T03:35:00.000Z",
    "checkInAtIST": "2026-11-09T09:05:00+05:30",
    "locationName": "LABA Pharmacy Kadapa",
    "distanceFromTarget": 23.5,
    "geofenceValid": true
  }
}
```

**Error Responses:**
| Code | HTTP | Scenario |
|------|------|---------|
| ATTENDANCE_WINDOW_NOT_OPEN | 422 | Before morning start |
| ATTENDANCE_WINDOW_CLOSED | 422 | After morning end |
| OUTSIDE_GEOFENCE | 422 | Outside assigned radius |
| DUPLICATE_CHECKIN | 409 | Already checked in today |
| WEEKLY_OFF | 422 | Day configured as weekly off |
| ATTENDANCE_DISABLED | 422 | Attendance disabled for this date |
| GPS_ACCURACY_POOR | 422 | Accuracy exceeds rejection threshold |
| INVALID_COORDINATES | 400 | Coordinates outside India bounding box |
| NO_BRANCH_ASSIGNED | 422 | Office staff has no branch assignment |

---

### POST `/api/v1/attendance/check-out`
**Auth:** OFFICE_STAFF, FIELD_STAFF  
**Purpose:** Record evening check-out with mandatory work report.

**Request Body:**
```json
{
  "latitude": 14.4674,
  "longitude": 78.8241,
  "accuracy": 18.2,
  "workReport": "Completed daily inventory check and customer service duties."
}
```

**Zod Validation:** workReport must be string, trimmed, min 5 characters, max 500 (from policy), not all whitespace.

**Processing:**
1. Authenticate and authorize.
2. Get today's work date in IST.
3. Check evening window: policy.eveningStart ≤ serverTime ≤ policy.eveningEnd.
4. Find existing attendance record for (employee_id, work_date).
5. If no record: return 422 NO_MORNING_CHECKIN.
6. If record status is CHECKED_OUT: return 409 DUPLICATE_CHECKOUT.
7. Validate workReport against policy min/max length.
8. Resolve location enforcement (same as check-in).
9. If location enforced: validate geofence.
10. If outside: return 422 OUTSIDE_GEOFENCE.
11. Transaction: UPDATE attendance_records SET check_out_at, check_out_lat/lng, work_report, status=CHECKED_OUT.
12. Create audit log.
13. Return success.

**Error Responses:**
| Code | HTTP | Scenario |
|------|------|---------|
| CHECKOUT_WINDOW_NOT_OPEN | 422 | Before evening start |
| CHECKOUT_WINDOW_CLOSED | 422 | After evening end |
| NO_MORNING_CHECKIN | 422 | No check-in record for today |
| DUPLICATE_CHECKOUT | 409 | Already checked out |
| WORK_REPORT_TOO_SHORT | 400 | Report < min_report_length |
| WORK_REPORT_EMPTY | 400 | Whitespace-only report |
| OUTSIDE_GEOFENCE | 422 | Outside geofence at checkout |

---

### GET `/api/v1/attendance/today`
**Auth:** OFFICE_STAFF, FIELD_STAFF (own record)  
**Response:** Today's attendance record for the authenticated employee.

---

### GET `/api/v1/attendance`
**Auth:** ADMIN, SUPER_ADMIN  
**Query:** `date`, `branchId`, `employeeType`, `status`, `page`, `limit`  
**Response:** Paginated attendance records with employee and location details.

---

### GET `/api/v1/attendance/dashboard`
**Auth:** ADMIN, SUPER_ADMIN  
**Response:** Today's attendance summary.

```json
{
  "success": true,
  "data": {
    "date": "2026-11-09",
    "totalEmployees": 45,
    "present": 38,
    "absent": 5,
    "pendingCheckout": 20,
    "late": 3,
    "officeStaffPresent": 25,
    "fieldStaffPresent": 13,
    "correctionRequests": 2,
    "branchSummary": [
      { "branchId": "uuid", "branchName": "Kadapa", "present": 8, "absent": 2 }
    ]
  }
}
```

---

## Section 41 – Check-In Workflow (Detailed State Machine)

```mermaid
stateDiagram-v2
    [*] --> Validating: POST /check-in received
    Validating --> WindowCheck: JWT valid + role authorized
    WindowCheck --> TooEarly: Server time < morningStart
    WindowCheck --> WindowClosed: Server time > morningEnd
    WindowCheck --> DuplicateCheck: Time within window
    TooEarly --> [*]: 422 ATTENDANCE_WINDOW_NOT_OPEN
    WindowClosed --> [*]: 422 ATTENDANCE_WINDOW_CLOSED
    DuplicateCheck --> AlreadyCheckedIn: Record exists
    DuplicateCheck --> LocationResolution: No record
    AlreadyCheckedIn --> [*]: 409 DUPLICATE_CHECKIN
    LocationResolution --> WeeklyOff: schedule_type=WEEKLY_OFF
    LocationResolution --> Disabled: schedule_type=ATTENDANCE_DISABLED
    LocationResolution --> GeofenceValidation: Location assigned
    LocationResolution --> UnrestrictedCheckin: No schedule (Field Staff)
    LocationResolution --> BranchGeofence: Office Staff
    WeeklyOff --> [*]: 422 WEEKLY_OFF
    Disabled --> [*]: 422 ATTENDANCE_DISABLED
    BranchGeofence --> Outside: distance > radius
    BranchGeofence --> Inside: distance <= radius
    GeofenceValidation --> Outside: distance > radius
    GeofenceValidation --> Inside: distance <= radius
    Outside --> [*]: 422 OUTSIDE_GEOFENCE
    Inside --> RecordAttendance
    UnrestrictedCheckin --> RecordAttendance
    RecordAttendance --> [*]: 201 CHECKED_IN
```

---

## Section 42 – Check-Out Workflow

(See Section 40 `POST /api/v1/attendance/check-out` for full processing. The state machine mirrors Section 41 with the addition of work report validation between GeofenceValidation and RecordAttendance.)

---

## Section 43 – Administrative Override APIs

### GET `/api/v1/admin/corrections`
**Auth:** ADMIN, SUPER_ADMIN  
**Query:** `status` (PENDING|APPROVED|REJECTED), `date`, `page`  
**Response:** Paginated correction requests with employee details.

### GET `/api/v1/admin/corrections/:id`
**Auth:** ADMIN, SUPER_ADMIN  
**Response:** Full correction request including original state and employee history.

### PATCH `/api/v1/admin/corrections/:id/approve`
**Auth:** ADMIN, SUPER_ADMIN  
**Body:** `{ "adminReason": "Verified GPS issue on report date.", "correctedState": { ... } }`

**Processing:**
1. Validate the correction request is in PENDING status.
2. Capture `original_state` from the existing attendance record (or null if creating new).
3. Apply `corrected_state` to attendance_records in a transaction.
4. Update correction status to APPROVED, populate `reviewed_by`, `reviewed_at`, `admin_reason`.
5. Set `is_corrected = true` on the attendance record.
6. Create audit log with before/after state.

### PATCH `/api/v1/admin/corrections/:id/reject`
**Auth:** ADMIN, SUPER_ADMIN  
**Body:** `{ "adminReason": "GPS logs reviewed; request not supported by evidence." }`

### POST `/api/v1/admin/attendance/manual`
**Auth:** ADMIN, SUPER_ADMIN  
**Purpose:** Admin manually creates or patches an attendance record.  
**Body:** Full attendance payload with reason.  
**Note:** Always sets `is_admin_created = true`, creates audit log. Never overwrites without capturing original state.

---

## Section 44 – Attendance Reporting APIs

### GET `/api/v1/reports/attendance/summary`
**Auth:** ADMIN, SUPER_ADMIN  
**Query:** `startDate`, `endDate`, `branchId`  
**Response:** Aggregated attendance summary statistics.

### GET `/api/v1/reports/attendance/present`
**Auth:** ADMIN, SUPER_ADMIN  
**Query:** `date`, `branchId`, `employeeType`  
**Response:** List of present employees with check-in/out times.

### GET `/api/v1/reports/attendance/absent`
**Auth:** ADMIN, SUPER_ADMIN  
**Query:** `date`, `branchId`  
**Response:** List of employees who were expected to attend but have no CHECKED_IN or later record.

**Absent logic:**
```
Absent = All active employees whose attendance window has closed for the date
         AND who have no attendance_record for that work_date
         AND are not on approved leave (Phase 2)
         AND for whom the date is not a configured holiday
```

---

## Section 45 – Excel Export APIs

### GET `/api/v1/reports/attendance/export`
**Auth:** ADMIN, SUPER_ADMIN  
**Query:** `startDate`, `endDate`, `branchId` (optional), `employeeType` (optional), `format=xlsx`

**Processing:**
1. Validate date range (maximum 90 days).
2. Query all attendance records + employees + branches/schedules within range.
3. Apply authorization scope (Admin can only export their authorized branches).
4. Build ExcelJS workbook with 6 sheets:
   - **Sheet 1 – Attendance Summary**: Date | Total | Present | Absent | Late | Corrections
   - **Sheet 2 – Present Employees**: Date | Emp ID | Name | Type | Branch/Location | Check In (IST) | Check Out (IST) | Duration | Work Report | GPS Status
   - **Sheet 3 – Absent Employees**: Date | Emp ID | Name | Type | Expected Location | Status
   - **Sheet 4 – Office Staff**: Filtered Sheet 2 for OFFICE_STAFF
   - **Sheet 5 – Field Staff**: Filtered Sheet 2 for FIELD_STAFF
   - **Sheet 6 – Corrections**: Correction ID | Employee | Type | Status | Employee Reason | Admin Reason | Requested | Reviewed
5. Apply column auto-width and header formatting.
6. Set Content-Disposition: `attachment; filename="LABA_Attendance_YYYYMMDD_YYYYMMDD.xlsx"`.
7. Stream buffer to response.

---

## Section 46 – Error Handling

### Global Error Handler

```typescript
// All errors thrown in services should use a custom AppError class:
class AppError extends Error {
  constructor(
    public code: string,
    public message: string,
    public statusCode: number,
    public details?: unknown
  ) { super(message); }
}

// Global handler maps:
// - AppError → structured JSON response with correct HTTP status
// - Prisma P2002 (unique violation) → 409 with specific code
// - Prisma P2025 (record not found) → 404
// - ZodError → 400 with field-level error details
// - JWT errors → 401
// - Unknown errors → 500 with generic message (never expose stack in production)
```

---

## Section 47 – Logging

**Winston configuration:**
- Development: human-readable colorized console output.
- Production: JSON-structured logs written to stdout (collected by host platform).
- Log levels: `error`, `warn`, `info`, `debug`.
- Every HTTP request logged with: method, path, status code, response time, requestId.
- Every attendance check-in/out logged with: employeeId, workDate, coordinates, geofence result, outcome.
- Every administrative action logged with: actorId, action, entityId.
- Sensitive data (passwords, full GPS coordinates in non-attendance contexts) must not appear in logs.

---

## Section 48 – Testing

### Unit Tests
- `haversine.ts`: Test known coordinate pairs against expected distances.
- `timeWindows.ts`: Test IST time window boundary conditions (exactly on the boundary, 1 second before, 1 second after).
- `idGenerator.ts`: Test unique code generation.
- `geofence.service.ts`: Test all location enforcement resolution paths.

### Integration Tests
- Full check-in flow with mock database.
- Full check-out flow.
- Duplicate check-in prevention.
- Weekly off blocking.
- Unrestricted field staff check-in.
- Admin correction approval and audit trail creation.

**Test framework:** Jest + Supertest for API integration tests. Use test database (Neon branch or Docker PostgreSQL for local tests).

---
