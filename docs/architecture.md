# LABA Attendance Management System — Architecture & Engineering Specification

## 1. System Overview

LABA operates 5–6 pharmacy branches across Andhra Pradesh, India. This platform is a centralized, multi-branch, web-based employee attendance platform utilizing GPS geofencing, strict time-window scheduling, and auditable management oversight for two distinct workforce categories:
1. **Office Staff:** Assigned to a single physical pharmacy branch; check-in and check-out are restricted to that branch's configured geofence radius.
2. **Field Staff:** Dynamic daily location assignments managed via single-day or 7-day recurring schedules, with support for explicit unrestricted attendance when unassigned, and hard blocks on weekly offs.

## 2. Layered Architecture

The system implements a **Modular Monolith** pattern:

```
[ Client: Modern Mobile & Desktop Web Browsers ]
                      │
           HTTPS Requests with HTTP-only Cookies
                      ▼
[ Frontend: Next.js 14+ (App Router) on Vercel Edge ]
  - AuthContext & Route Guards
  - Browser Geolocation API Hook (useGPS)
  - OpenStreetMap & Leaflet Geofence Visualizer
  - TanStack Query v5 Data Cache
                      │
           REST API Calls (/api/v1/*)
                      ▼
[ Backend: Node.js 20 LTS + Express.js 5 on Railway ]
  - Helmet security headers & CORS policy
  - express-rate-limit protection
  - authenticate (JWT) & authorize (RBAC) middleware
  - Layered controllers & services
  - Haversine distance & geofence validation engine
  - Winston structured logging
                      │
           Connection Pool (PgBouncer)
                      ▼
[ Cloud Database: Neon Serverless PostgreSQL ]
  - Prisma ORM 5 with strict relation integrity
  - Sub-metre precision coordinates (DECIMAL(10, 7))
  - Unique composite constraints preventing duplicate attendance
  - Policy snapshotting & immutable audit trail
```

## 3. Core Business Logic & State Machines

### 3.1 Field Schedule States
1. `LOCATION_ASSIGNED`: The employee must mark attendance within the configured GPS coordinate and radius.
2. `UNASSIGNED`: Explicitly permits attendance from any location under policy while recording the actual GPS coordinates.
3. `WEEKLY_OFF`: Attendance is blocked; the system alerts the employee that today is their scheduled rest day.
4. `ATTENDANCE_DISABLED`: Attendance is administratively disabled.

### 3.2 Authoritative Time Standard
All attendance windows, day determinations, and timestamps are evaluated against the backend server time converted to **`Asia/Kolkata` (Indian Standard Time)**. Client timestamps are never trusted.

### 3.3 Dual Location Snapshots
Both check-in and check-out preserve independent location references, coordinates, reported accuracy, calculated distance, and geofence validity to guarantee a forensic audit trail.

