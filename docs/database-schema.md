# LABA Database Schema Reference

**Engine:** PostgreSQL on Neon Serverless  
**ORM:** Prisma 5.22.0  
**Migration Strategy:** Declarative migrations via `prisma migrate dev` (dev) and `prisma migrate deploy` (production).

---

## 1. Entity Diagram Summary

- `organizations`: Root tenant entity (LABA).
- `users`: Authentication credentials, roles (`SUPER_ADMIN`, `ADMIN`, `OFFICE_STAFF`, `FIELD_STAFF`), and account lockout trackers.
- `employees`: 1:1 linked profile with unique `employee_code`, mobile, and category.
- `branches`: Pharmacy branch locations with WGS84 `DECIMAL(10, 7)` coordinates and configurable radius.
- `branch_assignments`: Effective-dated historical records of employee assignments to branches.
- `field_staff_schedules`: Date-specific schedule records for Field Staff with explicit `ScheduleType` (`LOCATION_ASSIGNED`, `UNASSIGNED`, `WEEKLY_OFF`, `ATTENDANCE_DISABLED`).
- `attendance_policies`: Versioned attendance parameters (morning/evening windows, geofence radius defaults, work report length bounds).
- `attendance_records`: Core attendance table with unique constraint on `(employee_id, work_date)` and dual check-in/check-out location snapshots.
- `attendance_corrections`: Workflow requests for missed or disputed attendance with before/after state JSON snapshots.
- `audit_logs`: Immutable, append-only record of all administrative and sensitive operations.
- `holidays`: Calendar of official company holidays.

---

## 2. Integrity & Concurrency Controls

1. **Duplicate Check-In Prevention:** `@@unique([employeeId, workDate])` on `attendance_records` creates an atomic database-level guarantee preventing duplicate records under race conditions.
2. **Single Active Branch Assignment:** Managed transactionally with `isCurrent` flags and effective date tracking.
3. **Audit Immutability:** No update or delete operations are exposed on the `audit_logs` service layer.

