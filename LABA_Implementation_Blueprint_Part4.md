# LABA Blueprint — Part 4
## Parts G, H, I: Testing, Deployment & Phased Implementation Roadmap

---

# PART G – TESTING

---

## Section 81 – Unit Testing

**Framework:** Jest + ts-jest

**Files to unit test:**

### `src/utils/haversine.ts`

| Test Case | Input | Expected Output |
|-----------|-------|----------------|
| Zero distance (same point) | (14.4674, 78.8241, 14.4674, 78.8241) | 0 metres |
| Known distance: Kadapa to Nandyal | (14.4674, 78.8241, 15.4788, 78.4836) | ~115,000m (±500m) |
| Boundary point exactly on radius | Point exactly 100m from centre | ≤ 100m (inside) |
| Point 1m outside radius | Point 101m from centre | > 100m (outside) |
| Antipodal points | (0,0) to (0,180) | ~20,015km |
| Invalid latitude | lat = 91 | Should not be passed; validation upstream |

### `src/utils/timeWindows.ts`

| Test Case | Mock Server Time | Policy | Expected |
|-----------|-----------------|--------|----------|
| Exactly at morningStart | 09:00:00 IST | 09:00–09:20 | OPEN |
| Exactly at morningEnd | 09:20:00 IST | 09:00–09:20 | OPEN (inclusive) |
| 1 second before morningStart | 08:59:59 IST | 09:00–09:20 | CLOSED (too early) |
| 1 second after morningEnd | 09:20:01 IST | 09:00–09:20 | CLOSED (too late) |
| Mid-window | 09:10:00 IST | 09:00–09:20 | OPEN |
| Exactly at eveningStart | 16:30:00 IST | 16:30–17:00 | OPEN |
| Exactly at eveningEnd | 17:00:00 IST | 16:30–17:00 | OPEN (inclusive) |

> [!IMPORTANT]
> Use `jest.useFakeTimers()` and `jest.setSystemTime()` to mock server time in time window tests. Never let tests depend on the real clock.

### `src/services/geofence.service.ts`

| Test Case | Setup | Expected |
|-----------|-------|----------|
| Office staff with active branch | Mock branch at (14.46, 78.82), radius 100m | type=BRANCH, enforced=true |
| Office staff with no branch assignment | No active assignment | type=NO_BRANCH_ASSIGNED, enforced=false |
| Field staff: location assigned | Schedule row: LOCATION_ASSIGNED | type=FIELD_LOCATION, enforced=true |
| Field staff: weekly off | Schedule row: WEEKLY_OFF | type=WEEKLY_OFF, blocked=true |
| Field staff: no schedule row | No DB row | type=NO_SCHEDULE, unrestricted=true |
| Field staff: attendance disabled | Schedule row: ATTENDANCE_DISABLED | type=ATTENDANCE_DISABLED, blocked=true |

### `src/utils/idGenerator.ts`

- Generated codes match format `LABA-OS-XXX` / `LABA-FS-XXX`.
- Sequential generation does not produce duplicates within a test run.

---

## Section 82 – Integration Testing

**Framework:** Jest + Supertest + Test database (Neon development branch or Docker PostgreSQL)

**Setup:**
```typescript
// tests/setup.ts
beforeAll(async () => {
  await prisma.$connect();
  await seedTestData(); // Create org, policy, test employees
});

afterAll(async () => {
  await cleanupTestData();
  await prisma.$disconnect();
});
```

### Critical integration test scenarios:

**Check-In Flow Tests:**

| Test | Setup | Expected Result |
|------|-------|----------------|
| Successful Office Staff check-in | Employee inside branch geofence, morning window open | 201, record created |
| Office staff: outside geofence | Employee 500m from branch | 422 OUTSIDE_GEOFENCE |
| Office staff: before morning window | Server time 08:30 IST | 422 ATTENDANCE_WINDOW_NOT_OPEN |
| Office staff: after morning window | Server time 10:00 IST | 422 ATTENDANCE_WINDOW_CLOSED |
| Duplicate check-in | Second request same employee, same date | 409 DUPLICATE_CHECKIN |
| Field staff: with location, inside | Employee inside assigned location | 201 |
| Field staff: with location, outside | Employee outside assigned location | 422 |
| Field staff: no schedule | No schedule row exists | 201 (unrestricted) |
| Field staff: weekly off | Schedule row WEEKLY_OFF | 422 WEEKLY_OFF |
| Unauthenticated request | No cookie | 401 |
| Wrong role (Admin tries to check in) | Admin JWT | 403 |

**Check-Out Flow Tests:**

| Test | Setup | Expected |
|------|-------|----------|
| Successful check-out with valid report | Checked in, in geofence, evening window | 201 |
| Check-out without check-in | No morning record | 422 NO_MORNING_CHECKIN |
| Check-out with empty report | report = " " | 400 WORK_REPORT_EMPTY |
| Check-out with short report | report = "abc" (3 chars) | 400 WORK_REPORT_TOO_SHORT |
| Duplicate check-out | Second check-out attempt | 409 DUPLICATE_CHECKOUT |
| Check-out outside geofence | 500m from branch | 422 OUTSIDE_GEOFENCE |

**Correction Flow Tests:**

| Test | Expected |
|------|----------|
| Employee submits correction | 201, status=PENDING |
| Admin approves correction | Attendance record updated, correction=APPROVED, audit created |
| Admin rejects correction | Correction status=REJECTED, attendance unchanged |
| Employee views own correction | 200 |
| Employee views other employee's correction | 403 |

---

## Section 83 – API Testing

**Tool:** Use Jest/Supertest for automated API tests. Optionally, maintain a Postman/Bruno collection for manual exploratory testing.

**Test categories:**

1. **Authentication tests:** Login success/failure, lockout, JWT expiry, logout cookie clearing.
2. **Authorization tests:** Each role attempting forbidden operations (systematic test of the permission matrix from Section 6).
3. **Validation tests:** Send malformed request bodies to every endpoint and confirm 400 responses with correct field errors.
4. **Business logic tests:** All scenarios from Section 16 (edge cases).

**API test coverage target:** 90% of endpoints with at least happy-path + primary error paths.

---

## Section 84 – GPS Testing

Since browser GPS cannot be automated in server-side tests, GPS behavior is tested at two levels:

**Level 1: Unit test the geofence calculation**
(Covered in Section 81 — haversine tests)

**Level 2: Backend API test with known coordinates**
- Send coordinates known to be inside the branch geofence → expect acceptance.
- Send coordinates known to be outside → expect rejection.
- Send coordinates at exactly the geofence boundary → expect acceptance (boundary inclusive).
- Send coordinates at radius + 1m → expect rejection.

**Level 3: Manual device testing**
- Use an Android device with Chrome.
- Use the browser's real GPS.
- Test in a physical location that is known to be inside a configured test branch geofence.
- Confirm check-in succeeds.
- Drive/walk outside the geofence boundary and confirm rejection.

---

## Section 85 – Geofence Boundary Testing

Boundary testing is critical. The system must handle the edge cases:

| Test | Coordinates | Geofence | Expected |
|------|------------|---------|----------|
| Exactly on the boundary | distance = radius exactly | 100m | Accepted (≤ radius) |
| 1cm inside boundary | distance = radius - 0.01m | 100m | Accepted |
| 1cm outside boundary | distance = radius + 0.01m | 100m | Rejected |
| Very small geofence (10m) | 5m inside | 10m | Accepted |
| Very large geofence (5000m) | 4999m inside | 5000m | Accepted |
| GPS accuracy equal to margin | accuracy = 50m, 60m inside | 100m | Accepted (but warn) |

For boundary calculations, use the same `haversineDistance` function used by production code.

---

## Section 86 – Attendance Time-Window Testing

All time-window tests must mock the server clock. Use Jest's timer mocks.

| Scenario | Mock Time (IST) | Policy | Outcome |
|----------|----------------|--------|---------|
| Check-in at morningStart | 09:00:00 | 09:00–09:20 | Accept |
| Check-in at morningEnd | 09:20:00 | 09:00–09:20 | Accept |
| Check-in at morningEnd+1s | 09:20:01 | 09:00–09:20 | Reject |
| Check-in at morningStart-1s | 08:59:59 | 09:00–09:20 | Reject |
| Check-out at eveningStart | 16:30:00 | 16:30–17:00 | Accept |
| Check-out at eveningEnd | 17:00:00 | 16:30–17:00 | Accept |
| Check-out before evening | 15:00:00 | 16:30–17:00 | Reject |
| Check-out after evening | 17:01:00 | 16:30–17:00 | Reject |
| Check-in on day policy changes | Policy changes at effective_from | New policy | Use new policy |

---

## Section 87 – Role-Based Access Testing

Systematically test every combination:

For each endpoint, test with:
- No authentication → expect 401
- Wrong role → expect 403
- Correct role → expect 200/201 (or the legitimate business error)

**Priority test matrix:**

| Endpoint | SUPER_ADMIN | ADMIN | OFFICE_STAFF | FIELD_STAFF |
|---------|-------------|-------|--------------|-------------|
| POST /attendance/check-in | 403 | 403 | 201 | 201 |
| GET /admin/corrections | 200 | 200 | 403 | 403 |
| GET /reports/attendance/export | 200 | 200 | 403 | 403 |
| POST /employees | 201 | 201 | 403 | 403 |
| GET /super-admin/audit | 200 | 403 | 403 | 403 |
| PATCH /employees/:id/status | 200 | 200 | 403 | 403 |

---

## Section 88 – Multi-Branch Testing

| Test | Setup | Expected |
|------|-------|----------|
| Employee assigned to Branch A tries to check in at Branch B's coordinates | Office Staff for Branch A, check-in coords at Branch B location | 422 OUTSIDE_GEOFENCE |
| Transfer employee from Branch A to Branch B; check-in at new branch | New branch assignment effective today | 201 |
| Transfer employee; check-in at old branch | New assignment, old branch coords | 422 |
| Admin creates 6 branches | 6 POST /branches | All succeed; dashboard shows all 6 |
| Branch report shows only own branch employees | Admin views Branch A report | Only Branch A employees shown |

---

## Section 89 – Field Schedule Testing

| Test | Setup | Expected |
|------|-------|----------|
| Assign LOCATION_ASSIGNED; employee checks in from that location | Inside radius | 201 |
| Assign LOCATION_ASSIGNED; employee checks in from wrong location | Outside radius | 422 |
| Assign WEEKLY_OFF; employee tries to check in | Day is weekly off | 422 WEEKLY_OFF |
| No schedule assigned; employee checks in | No DB row for date | 201 (unrestricted) |
| Admin assigns 7-day weekly schedule | POST /schedules/weekly | 7 schedule rows created |
| Admin edits one day of weekly schedule | PUT /schedules/:scheduleId | Only that day updated, others unchanged |
| Admin deletes a schedule; employee checks in | No row after delete | 201 (unrestricted — no row = no restriction) |
| Check-in and then Admin changes location | Location changes after check-in | Attendance record retains original location reference; new assignment applies to future check-outs based on spec decision |

> [!NOTE]
> Edge case: Admin changes a field employee's assigned location after the morning check-in. Business decision: The check-out validation uses the **current** assigned location at the time of check-out, not the check-in location. This means if Admin changes the location after check-in, the employee must be in the new location to check out. Document this behavior clearly in admin-facing help text.

---

## Section 90 – Excel Export Testing

| Test | Expected |
|------|----------|
| Export 30-day range | Workbook with 6 sheets, all data correct |
| Export with branch filter | Only that branch's employees appear |
| Export employee type filter | Only that type appears in all relevant sheets |
| Export with no data in range | Empty sheets with headers, not an error |
| Export range > 90 days | 400 error with clear message |
| Admin exports for unauthorized branch | 403 |
| All IST timestamps correct in export | Check-in times shown in IST, not UTC |
| Absent employees include weekends correctly | Only expected working days shown as absent |

---

## Section 91 – Security Testing

**Manual security review checklist:**

| Test | Method | Pass Criteria |
|------|--------|--------------|
| SQL injection via input fields | Send `' OR '1'='1` in all string fields | No DB error; Zod/Prisma parameterized queries prevent injection |
| XSS in work report field | Submit `<script>alert(1)</script>` | Stored as literal text; not executed in Admin view (React escapes by default) |
| JWT token accessible via JS | Check `document.cookie` | Cookie not visible (HttpOnly) |
| Check-in without cookie | Remove cookie, POST check-in | 401 |
| Tampered JWT role claim | Modify JWT payload, re-sign with wrong secret | 401 (signature invalid) |
| Cross-organization data access | Use Org A's JWT to request Org B's data | 404 or 403 (organization scoping prevents access) |
| Employee accesses other employee's history | Use Employee A's JWT to GET Employee B's attendance | 403 |
| Rate limit: 6 login attempts | 6 rapid POST /auth/login | 6th attempt returns 401 ACCOUNT_LOCKED |
| HTTPS-only cookie on HTTP | Access via HTTP | Cookie not sent; login fails |
| Excel export without auth | GET /reports/export without cookie | 401 |

---

## Section 92 – Mobile Browser Testing

**Target browsers:**
- Chrome for Android (latest 2 versions)
- Safari for iOS (latest 2 versions)
- Samsung Internet (latest version)
- Firefox for Android (latest version)

**Test checklist for each browser:**

- [ ] Login page renders correctly
- [ ] GPS permission prompt appears
- [ ] GPS coordinates are captured (enableHighAccuracy: true)
- [ ] Check-in submits and succeeds
- [ ] Error messages display correctly
- [ ] Check-out form with report textarea works
- [ ] Work report character counter works
- [ ] All buttons have adequate touch target sizes (44px minimum)
- [ ] No horizontal scroll on mobile viewport
- [ ] No pinch-zoom required for form inputs (font-size ≥ 16px)
- [ ] Loading states visible
- [ ] Dashboard summary cards stack correctly on 375px viewport

---

## Section 93 – Production Readiness Testing

Before declaring the system production-ready, complete the following:

| Check | Criteria |
|-------|---------|
| All automated tests passing | 0 failing tests |
| Test coverage | ≥ 80% for backend services |
| Load test | 50 concurrent check-ins within morning window → all succeed or return correct error; no server crash |
| Database query performance | All dashboard queries < 2s with 500 employee dataset |
| Environment variable audit | No hardcoded secrets anywhere in codebase |
| HTTPS verified | All API calls go through HTTPS |
| Cookie security verified | HttpOnly, Secure, SameSite=Strict confirmed in browser dev tools |
| Error messages | No stack traces or internal errors exposed in production responses |
| Audit log verified | Every major action creates an audit log entry |
| Duplicate prevention verified | Concurrent check-in test: only one record created |
| GPS edge cases | Permission denied, timeout, poor accuracy all handled gracefully |
| Excel export | Download tested for 90-day range |
| Mobile usability | Tested on physical Android and iOS devices |
| Absent logic | Absent list is empty before morning window closes |

---

# PART H – DEPLOYMENT

---

## Section 94 – Environment Setup

### Development Environment

```bash
# Backend
cd laba-backend
cp .env.example .env
# Edit .env with Neon development branch connection string
npm run dev   # ts-node-dev --respawn src/app.ts

# Frontend
cd laba-frontend
cp .env.local.example .env.local
# Edit .env.local with backend URL
npm run dev   # Next.js dev server on port 3000
```

### Neon Development Branch

Create a separate Neon branch for development to isolate from production:

```bash
# In Neon console: create a branch named 'development'
# Use the development branch connection string in .env
```

---

## Section 95 – Neon PostgreSQL Configuration

### Project Setup

1. Create a Neon account at neon.com.
2. Create a new project: "laba-attendance".
3. Select region closest to Andhra Pradesh: **Asia Pacific (Singapore)** or **Asia Pacific (Mumbai)** when available.
4. Create a production branch (default `main`).
5. Create a development branch from `main`.
6. Note the two connection strings per branch:
   - **Pooled (application):** Use in `DATABASE_URL`.
   - **Direct (migrations):** Use in `DIRECT_URL`.

### Connection String Configuration

```prisma
// prisma/schema.prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}
```

### Neon Recommended Settings

- Enable **IP Allow** list to restrict database access to backend host IPs only.
- Enable **SSL** (required by default).
- Set **connection pooling mode** to `Transaction` for Express.js (stateless REST API).

---

## Section 96 – Prisma Migration Process

### Initial Migration

```bash
# In backend directory
npx prisma generate          # Generate Prisma client from schema
npx prisma migrate dev --name init   # Create initial migration + apply to dev DB
```

### Production Migration

```bash
# Run before deploying new backend version
npx prisma migrate deploy    # Applies pending migrations to production DB
                             # Uses DIRECT_URL (not pooled)
```

### Migration File Naming Convention

```
prisma/migrations/
├── 20261109000000_init/
│   └── migration.sql
├── 20261115000000_add_holidays_table/
│   └── migration.sql
└── 20261120000000_add_policy_version_index/
    └── migration.sql
```

### Seed Data

```bash
# Create prisma/seed.ts with:
# 1. Create LABA organization
# 2. Create Super Admin user
# 3. Create default attendance policy
# 4. Create sample branches (for development only)

npx prisma db seed
```

---

## Section 97 – Backend Deployment

### Recommended Host: Railway

**Deployment steps:**

1. Create a Railway account at railway.app.
2. Connect your GitHub repository.
3. Create a new service from the `laba-backend` directory.
4. Railway auto-detects Node.js.
5. Set the start command: `node dist/app.js`.
6. Set the build command: `npm run build` (which runs `tsc`).
7. Add all environment variables in Railway's environment panel.
8. Deploy.
9. Railway provides a public HTTPS URL automatically.

**`package.json` scripts:**

```json
{
  "scripts": {
    "build": "tsc",
    "start": "node dist/app.js",
    "dev": "ts-node-dev --respawn --transpile-only src/app.ts",
    "migrate:deploy": "prisma migrate deploy",
    "db:seed": "ts-node prisma/seed.ts"
  }
}
```

**Production process management:** Railway handles process restarts automatically. PM2 is not required on Railway. If using a VPS, PM2 is recommended:

```bash
pm2 start dist/app.js --name laba-backend
pm2 save
pm2 startup
```

---

## Section 98 – Frontend Deployment

### Vercel Deployment

1. Create a Vercel account.
2. Import the `laba-frontend` GitHub repository.
3. Set framework preset: Next.js (auto-detected).
4. Set environment variables in Vercel project settings:
   - `NEXT_PUBLIC_API_URL`: Your backend Railway URL (e.g., `https://laba-backend.railway.app/api/v1`)
5. Deploy. Vercel handles CDN, HTTPS, and edge caching.

**Custom domain:**
1. Purchase domain (e.g., `attendance.laba.in`).
2. Add custom domain in Vercel project settings.
3. Update DNS records as instructed by Vercel.
4. HTTPS is provisioned automatically by Vercel via Let's Encrypt.

---

## Section 99 – Environment Variables (Complete Reference)

### Backend Production Environment Variables

```bash
# Application
NODE_ENV=production
PORT=5000
FRONTEND_URL=https://attendance.laba.in

# Database (Neon Production Branch)
DATABASE_URL=postgresql://user:pass@endpoint-pooler.neon.tech/laba?sslmode=require
DIRECT_URL=postgresql://user:pass@endpoint.neon.tech/laba?sslmode=require

# Authentication
JWT_SECRET=<minimum 64 character random string from: openssl rand -base64 64>
JWT_EXPIRES_IN=8h
COOKIE_DOMAIN=attendance.laba.in
COOKIE_SECURE=true
COOKIE_SAME_SITE=Strict

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=100
LOGIN_RATE_LIMIT_MAX=5

# Logging
LOG_LEVEL=info
```

### Frontend Production Environment Variables

```bash
NEXT_PUBLIC_API_URL=https://api.laba.in/api/v1
NEXT_PUBLIC_APP_NAME=LABA Attendance
```

> [!CAUTION]
> Never commit any `.env` or `.env.local` file to Git. Confirm `.env*` is in `.gitignore`. Use your host's secret management UI (Railway, Vercel) for all production secrets. Rotate the JWT_SECRET immediately if ever exposed.

---

## Section 100 – Domain and HTTPS

### Recommended Domain Structure

| Subdomain | Purpose |
|-----------|---------|
| `attendance.laba.in` | Frontend (Vercel) |
| `api.laba.in` | Backend API (Railway custom domain) |

### HTTPS Enforcement

- **Frontend (Vercel):** HTTPS enforced by default. HTTP redirects to HTTPS automatically.
- **Backend (Railway):** Railway provides HTTPS termination automatically on custom domains.
- **Cookie Security:** `Secure` flag on the JWT cookie ensures it is only transmitted over HTTPS.
- **HSTS:** Vercel sets HSTS headers automatically. For the backend, add:
  ```typescript
  app.use(helmet({ hsts: { maxAge: 31536000, includeSubDomains: true } }));
  ```

---

## Section 101 – Production Monitoring

### Logging

- **Backend:** Winston logs to stdout in JSON format. Railway collects and displays these in its log viewer.
- **Log retention:** Railway retains 7 days of logs on free tier. For longer retention, pipe logs to an external service (Logtail, Datadog, etc.) — Phase 2 enhancement.

### Error Monitoring (Phase 2 Enhancement)

- Recommended: Sentry (free tier available). Captures unhandled exceptions with stack traces, user context, and request details.
- Install: `npm install @sentry/node` in backend, `npm install @sentry/nextjs` in frontend.

### Health Check Endpoint

```typescript
// GET /api/v1/health
router.get('/health', async (req, res) => {
  const dbOk = await prisma.$queryRaw`SELECT 1`.then(() => true).catch(() => false);
  res.status(dbOk ? 200 : 503).json({
    status: dbOk ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    database: dbOk ? 'connected' : 'disconnected',
  });
});
```

Configure Railway to use this health check URL for automatic restarts.

### Uptime Monitoring (Phase 2 Enhancement)

- Recommended: UptimeRobot (free tier) or Better Uptime.
- Monitor: `https://api.laba.in/api/v1/health` every 5 minutes.
- Alert: Email/SMS to admin when health check fails.

---

## Section 102 – Backup Strategy

| Backup Type | Frequency | Retention | Location |
|------------|-----------|-----------|----------|
| Neon PITR (continuous) | Real-time | 30 days (Pro) | Neon managed |
| Logical `pg_dump` | Weekly (Saturday midnight) | 90 days | Private S3-compatible bucket |
| Codebase | Continuous | Indefinite | GitHub repository |
| Environment variables | Manual | On change | Secure password manager |

**Automated weekly backup script (run as Railway cron or separate cron service):**

```bash
#!/bin/bash
DATE=$(date +%Y%m%d)
pg_dump "$DIRECT_URL" --format=custom --file="/tmp/laba_backup_$DATE.dump"
# Upload to S3-compatible storage using AWS CLI or rclone
rclone copy "/tmp/laba_backup_$DATE.dump" "s3:laba-backups/database/"
rm "/tmp/laba_backup_$DATE.dump"
```

---

## Section 103 – Maintenance Strategy

### Routine Maintenance

| Task | Frequency | Responsible |
|------|-----------|-------------|
| Review audit logs for anomalies | Weekly | Super Admin |
| Review failed login attempts | Weekly | Super Admin |
| Verify backup completion | Weekly | Developer |
| Prisma security updates | Monthly | Developer |
| npm dependency audit | Monthly | Developer |
| Review absent employees not flagged | Daily (business hours) | Admin |
| Archive old attendance records (> 2 years) | Annually | Developer + Admin |

### Database Maintenance

- Neon handles vacuuming and storage management automatically.
- Monitor Neon storage usage monthly.
- If approaching storage limits, archive old audit logs and attendance records to cold storage.

---

# PART I – PHASED IMPLEMENTATION ROADMAP

---

## Overview: Implementation Phases

```mermaid
flowchart LR
    P1[Phase 1\nFoundation] --> P2[Phase 2\nAuth & Employees]
    P2 --> P3[Phase 3\nBranches & GPS]
    P3 --> P4[Phase 4\nAttendance Core]
    P4 --> P5[Phase 5\nAdmin & Reports]
    P5 --> P6[Phase 6\nMVP Polish\n& Deployment]

    style P1 fill:#171717,color:#fff
    style P2 fill:#171717,color:#fff
    style P3 fill:#171717,color:#fff
    style P4 fill:#171717,color:#fff
    style P5 fill:#171717,color:#fff
    style P6 fill:#171717,color:#fff
```

---

## Phase 1 – Project Foundation and Infrastructure

### Objective

Establish both project repositories, configure the development environment, connect to Neon PostgreSQL, run the initial Prisma migration, and verify the full technology stack is working end-to-end before writing any business logic.

### Why This Phase Is Required

No business logic can be built on an unvalidated foundation. This phase eliminates environment-related blockers early.

### Tasks

| # | Task | Details |
|---|------|---------|
| 1.1 | Initialize backend repository | `mkdir laba-backend`, `npm init`, install all dependencies listed in Section 30 |
| 1.2 | Configure TypeScript strict mode | `tsconfig.json` as specified in Section 30 |
| 1.3 | Set up Prisma | `prisma init`, write `schema.prisma` from Section 23 |
| 1.4 | Create Neon project | Create development + production branches |
| 1.5 | Run initial migration | `prisma migrate dev --name init` against dev DB |
| 1.6 | Verify Prisma client | Write a simple `prisma.organization.findFirst()` test script |
| 1.7 | Configure Express application | `app.ts` with helmet, cors, body parser, cookie-parser, rate limiter |
| 1.8 | Implement `/api/v1/health` endpoint | Returns 200 with DB status |
| 1.9 | Configure Winston logger | JSON format for production, colorized for dev |
| 1.10 | Initialize frontend repository | `create-next-app` with TypeScript + Tailwind |
| 1.11 | Configure Tailwind design tokens | Custom colors from Section 13 of UI spec |
| 1.12 | Set up Axios instance | `src/lib/api.ts` with base URL and interceptors |
| 1.13 | Set up TanStack Query | `src/providers/QueryProvider.tsx` |
| 1.14 | Create `.env.example` files | Backend and frontend |
| 1.15 | Create GitHub repositories | Separate repos for frontend and backend, or monorepo |
| 1.16 | Create Prisma seed script | Seed organization, Super Admin, default policy |

### Files / Modules Expected After Phase 1

```
backend/
├── prisma/schema.prisma           ✓
├── prisma/migrations/             ✓
├── src/app.ts                     ✓
├── src/config/database.ts         ✓
├── src/config/env.ts              ✓
├── src/middleware/errorHandler.ts ✓
└── src/routes/health.routes.ts   ✓

frontend/
├── src/app/layout.tsx             ✓
├── src/lib/api.ts                 ✓
├── src/providers/QueryProvider.tsx ✓
└── tailwind.config.ts             ✓
```

### Acceptance Criteria

- [ ] `GET http://localhost:5000/api/v1/health` returns `{ status: 'ok' }`.
- [ ] `prisma migrate status` shows all migrations applied.
- [ ] `npx prisma studio` opens and shows all tables.
- [ ] Next.js dev server starts without errors.
- [ ] No TypeScript errors (`tsc --noEmit`).
- [ ] `.env` files are in `.gitignore`.

### Common Mistakes

- Forgetting to use the `directUrl` for migrations and the pooled URL for the application.
- Not running `prisma generate` after editing `schema.prisma`.
- Using the wrong Neon branch connection string in development.
- Forgetting `typeof window !== 'undefined'` guard for browser-only code in Next.js.

---

## Phase 2 – Authentication and Employee Management

### Objective

Implement the complete authentication system (login, logout, JWT cookies, role-based middleware) and the full employee management API with the ability to create, list, update, and manage employees.

### Why This Phase Is Required

All subsequent features require authenticated, role-authorized users and employee records. Building authentication first prevents rework.

### Tasks

| # | Task |
|---|------|
| 2.1 | Implement `POST /auth/login` with bcrypt, lockout, JWT cookie |
| 2.2 | Implement `POST /auth/logout` |
| 2.3 | Implement `GET /auth/me` |
| 2.4 | Implement `POST /auth/change-password` |
| 2.5 | Implement `authenticate` middleware (JWT cookie verification) |
| 2.6 | Implement `authorize(roles[])` middleware |
| 2.7 | Implement organization scoping middleware |
| 2.8 | Implement all employee CRUD APIs (Section 35) |
| 2.9 | Implement Employee ID auto-generation |
| 2.10 | Implement branch assignment API |
| 2.11 | Write Zod schemas for all auth and employee requests |
| 2.12 | Write global error handler (AppError class) |
| 2.13 | Implement login page (frontend) |
| 2.14 | Implement AuthProvider context |
| 2.15 | Implement Next.js route guard middleware |
| 2.16 | Implement employee list and form pages (admin) |
| 2.17 | Implement employee profile page |
| 2.18 | Write unit tests for auth and employee services |
| 2.19 | Write integration tests for auth flows |

### Files / Modules Expected After Phase 2

```
backend/src/
├── routes/auth.routes.ts          ✓
├── routes/employee.routes.ts      ✓
├── controllers/auth.controller.ts ✓
├── controllers/employee.controller.ts ✓
├── services/auth.service.ts       ✓
├── services/employee.service.ts   ✓
├── services/audit.service.ts      ✓
├── schemas/auth.schema.ts         ✓
├── schemas/employee.schema.ts     ✓
├── middleware/authenticate.ts     ✓
├── middleware/authorize.ts        ✓
└── utils/idGenerator.ts          ✓

frontend/src/
├── app/(auth)/login/page.tsx     ✓
├── middleware.ts                  ✓
├── providers/AuthProvider.tsx    ✓
├── hooks/useAuth.ts              ✓
├── components/ui/ (all primitives) ✓
├── components/layout/Sidebar.tsx ✓
└── app/(dashboard)/admin/employees/ ✓
```

### Acceptance Criteria

- [ ] Super Admin can log in with seeded credentials.
- [ ] Invalid credentials return 401 with generic message.
- [ ] After 5 failed attempts, account locks for 15 minutes.
- [ ] JWT cookie is HttpOnly (confirmed in browser dev tools).
- [ ] `GET /auth/me` returns user profile.
- [ ] Admin can create Office Staff and Field Staff employees.
- [ ] Employee codes are generated correctly (LABA-OS-001 format).
- [ ] Employee list page loads with pagination.
- [ ] Unauthorized role accessing admin page redirects to `/unauthorized`.
- [ ] All TypeScript strict mode checks pass.

### Testing Requirements

- Unit: bcrypt comparison logic, lockout timer logic, ID generation.
- Integration: Full login flow, role-based access for all employee endpoints.

### Common Mistakes

- Storing JWT in localStorage instead of HttpOnly cookie.
- Forgetting to call `prisma.user.findFirst({ where: { deletedAt: null } })` — accidentally returning soft-deleted users.
- Weak JWT secret (must be minimum 32 characters; use `openssl rand -base64 64`).
- Not including `organization_id` filter in every employee query.

---

## Phase 3 – Branch Management and GPS/Geofencing Services

### Objective

Implement full branch CRUD management, the interactive map-based location picker, and the core geofencing calculation service. Field Staff schedule management is also implemented here.

### Why This Phase Is Required

Branches and schedules are prerequisites for attendance validation. The geofence service must be built and tested before attendance APIs consume it.

### Tasks

| # | Task |
|---|------|
| 3.1 | Implement all branch CRUD APIs (Section 36) |
| 3.2 | Implement branch GPS coordinate update with audit log |
| 3.3 | Implement employee-to-branch assignment API |
| 3.4 | Implement `haversine.ts` utility |
| 3.5 | Implement `geofence.service.ts` with `resolveLocationEnforcement()` |
| 3.6 | Implement all field schedule APIs (Section 37) |
| 3.7 | Implement 7-day schedule bulk create/upsert |
| 3.8 | Write Zod schemas for branch and schedule requests |
| 3.9 | Implement coordinate validation (India bounding box) |
| 3.10 | Implement branch list and form pages (frontend) |
| 3.11 | Implement `BranchMapPicker.tsx` with Leaflet (dynamic import) |
| 3.12 | Implement field schedule management pages (frontend) |
| 3.13 | Implement `WeeklyScheduleGrid.tsx` |
| 3.14 | Implement `DayScheduleForm.tsx` modal |
| 3.15 | Write unit tests for haversine (all boundary cases) |
| 3.16 | Write unit tests for geofence resolution (all 6 paths) |
| 3.17 | Write integration tests for branch APIs |
| 3.18 | Write integration tests for schedule APIs |

### Acceptance Criteria

- [ ] Admin can create a branch with GPS coordinates.
- [ ] Map picker shows marker and geofence circle.
- [ ] Admin can update branch GPS; previous coordinates appear in audit log.
- [ ] Admin can assign employee to branch; history is preserved.
- [ ] Admin can assign 7-day field schedule.
- [ ] Admin can edit one day without affecting others.
- [ ] Haversine tests pass for all boundary cases.
- [ ] `resolveLocationEnforcement` returns correct type for all 6 cases.
- [ ] Invalid coordinates (outside India) return 400.

### Common Mistakes

- Leaflet map not loading due to missing SSR guard (`dynamic import { ssr: false }`).
- Treating no schedule row as a weekly off (must be `NO_SCHEDULE` = unrestricted).
- Using `latitude = 0, longitude = 0` as a default for unassigned schedules (catastrophic error — treat NULL as unassigned).
- Not preserving old branch assignment with `effective_to` date before creating new one.

---

## Phase 4 – Attendance Core: Check-In, Check-Out, and Business Rules

### Objective

Implement the complete attendance check-in and check-out workflows with all business rule enforcement, geofence validation, time-window validation, work report validation, and duplicate prevention.

### Why This Phase Is Required

This is the core business value of the system. All prior phases are prerequisites. This phase must be tested most rigorously.

### Tasks

| # | Task |
|---|------|
| 4.1 | Implement IST time window validation utility |
| 4.2 | Implement `attendance.service.ts` with full check-in processing logic |
| 4.3 | Implement `POST /attendance/check-in` API |
| 4.4 | Implement `POST /attendance/check-out` API |
| 4.5 | Implement `GET /attendance/today` API |
| 4.6 | Implement attendance policy loading and caching |
| 4.7 | Implement all 6 location enforcement resolution paths |
| 4.8 | Implement database transaction for check-in (record + audit) |
| 4.9 | Implement database transaction for check-out (update + audit) |
| 4.10 | Implement work report validation against policy min/max |
| 4.11 | Implement employee dashboard (frontend) |
| 4.12 | Implement `useGPS.ts` hook |
| 4.13 | Implement `CheckInCard.tsx` with all states |
| 4.14 | Implement `CheckOutCard.tsx` with work report form |
| 4.15 | Implement `WorkReportForm.tsx` |
| 4.16 | Implement `GPSStatusIndicator.tsx` |
| 4.17 | Implement `AttendanceStatusBadge.tsx` |
| 4.18 | Implement today's schedule display for Field Staff |
| 4.19 | Write all integration tests from Section 82 |
| 4.20 | Write all time-window unit tests from Section 86 |
| 4.21 | Test duplicate submission concurrency |
| 4.22 | Manual GPS testing on physical device |

### Acceptance Criteria

- [ ] Office Staff inside geofence, in morning window → Check-in succeeds (201).
- [ ] Office Staff outside geofence → 422 OUTSIDE_GEOFENCE with distance.
- [ ] Office Staff before morning window → 422 with opening time.
- [ ] Office Staff after morning window → 422 with admin contact message.
- [ ] Duplicate check-in → 409.
- [ ] Field Staff with LOCATION_ASSIGNED, inside → 201.
- [ ] Field Staff with LOCATION_ASSIGNED, outside → 422.
- [ ] Field Staff with no schedule → 201 (unrestricted).
- [ ] Field Staff with WEEKLY_OFF → 422 WEEKLY_OFF.
- [ ] Check-out without check-in → 422 NO_MORNING_CHECKIN.
- [ ] Check-out with empty report → 400.
- [ ] Check-out with 4-character report → 400 (min 5).
- [ ] Valid check-out → 201 with checkout time.
- [ ] Server time (not device time) used for all validations.
- [ ] All button states correct (disabled during submission, re-enabled on error).
- [ ] GPS error messages display correctly for each error type.

### Common Mistakes

- Trusting `req.body.timestamp` from the client for time validation instead of `new Date()` on the server.
- Off-by-one in geofence: using `<` instead of `<=` for radius comparison.
- Not handling the `P2002` Prisma error code for unique constraint violations.
- Using JavaScript `Date` without timezone conversion — always use `date-fns-tz` for IST comparisons.
- Forgetting to load the active policy (the one with `is_current = true` and `effective_from <= today`).
- Not wrapping check-in record + audit log in a single Prisma transaction.

---

## Phase 5 – Admin Dashboard, Reports, and Corrections

### Objective

Build the complete administrative interface: attendance dashboard, present/absent views, attendance correction workflow, attendance policy management, and Excel export functionality.

### Why This Phase Is Required

The system is not useful without admin visibility and reporting. The correction workflow makes the system practically usable in real-world scenarios where exceptions occur.

### Tasks

| # | Task |
|---|------|
| 5.1 | Implement `GET /attendance/dashboard` API |
| 5.2 | Implement `GET /attendance` list API with filters |
| 5.3 | Implement `GET /reports/attendance/present` API |
| 5.4 | Implement `GET /reports/attendance/absent` API (with absent-after-window logic) |
| 5.5 | Implement `GET /reports/attendance/summary` API |
| 5.6 | Implement `GET /reports/attendance/export` Excel API |
| 5.7 | Implement `excel.service.ts` with ExcelJS workbook generation |
| 5.8 | Implement all 6 Excel sheets |
| 5.9 | Implement attendance correction request API (employee) |
| 5.10 | Implement correction review APIs (admin: approve/reject) |
| 5.11 | Implement manual attendance creation API |
| 5.12 | Implement attendance policy update API |
| 5.13 | Implement policy versioning logic |
| 5.14 | Implement Admin dashboard page (frontend) |
| 5.15 | Implement `AttendanceSummaryCards.tsx` |
| 5.16 | Implement `PresentEmployeesTable.tsx` |
| 5.17 | Implement `AbsentEmployeesTable.tsx` |
| 5.18 | Implement attendance corrections page |
| 5.19 | Implement correction detail view with before/after state |
| 5.20 | Implement reports page with date range filter |
| 5.21 | Implement `ExportButton.tsx` with download handling |
| 5.22 | Implement attendance policy settings page |
| 5.23 | Write integration tests for all report APIs |
| 5.24 | Write Excel export tests |
| 5.25 | Write correction workflow tests |

### Acceptance Criteria

- [ ] Dashboard shows correct counts (present, absent, pending).
- [ ] Absent list is empty before morning window closes.
- [ ] Absent list correctly shows employees with no check-in after window closes.
- [ ] Excel download produces valid `.xlsx` file with 6 sheets.
- [ ] All IST timestamps correct in Excel.
- [ ] Employee can submit correction request.
- [ ] Admin can approve; attendance record updated with `is_corrected=true`.
- [ ] Original state preserved in `attendance_corrections.original_state`.
- [ ] Audit log entry created for every admin action.
- [ ] Policy update creates new version; existing attendance records unaffected.
- [ ] Excel export rejects date ranges > 90 days.
- [ ] Unauthorized branch data not included in Admin export.

### Common Mistakes

- Generating the Excel file synchronously for large date ranges, blocking the event loop. Use `async` generation and stream the response.
- Storing timestamps in UTC in the Excel sheet without converting to IST.
- Hardcoding "absent" = "not checked in" without checking if the morning window has closed.
- Not validating the Admin's branch authorization before including data in reports.
- Overwriting attendance records on correction approval without saving the original state first.

---

## Phase 6 – MVP Polish, Super Admin Features, and Production Deployment

### Objective

Complete the Super Admin interface (audit log viewer, Admin account management), polish the entire UI for consistency, perform end-to-end testing, deploy to production, and confirm the system is production-ready.

### Why This Phase Is Required

MVP is not complete without Super Admin controls, the full audit trail viewer, and successful production deployment.

### Tasks

| # | Task |
|---|------|
| 6.1 | Implement Super Admin dashboard |
| 6.2 | Implement Admin account management (create, suspend Admin users) |
| 6.3 | Implement audit log viewer API with filters |
| 6.4 | Implement audit log viewer frontend page |
| 6.5 | Implement Super Admin-only policy management (company-wide) |
| 6.6 | UI consistency review: apply design system uniformly |
| 6.7 | Implement all empty states and loading skeletons |
| 6.8 | Implement all error pages (403, 404, 500) |
| 6.9 | Mobile browser testing on Android and iOS |
| 6.10 | Security review: check all endpoints for auth/authz |
| 6.11 | Environment variable audit (no hardcoded secrets) |
| 6.12 | Production Neon branch setup |
| 6.13 | Deploy backend to Railway with production env vars |
| 6.14 | Run `prisma migrate deploy` against production DB |
| 6.15 | Seed production database (org, Super Admin, default policy) |
| 6.16 | Deploy frontend to Vercel with production env vars |
| 6.17 | Configure custom domain and verify HTTPS |
| 6.18 | Verify JWT cookie security in production (HttpOnly, Secure, SameSite) |
| 6.19 | Complete production readiness checklist (Section 93) |
| 6.20 | Load test with 50 concurrent check-ins |
| 6.21 | Create Super Admin account for LABA management |
| 6.22 | Train Admin users on the system |
| 6.23 | Document production runbook |

### Acceptance Criteria

- [ ] Super Admin can create and suspend Admin accounts.
- [ ] Audit log shows all major actions with actor, timestamp, before/after state.
- [ ] All UI components render consistently across pages.
- [ ] Mobile check-in works on Android Chrome and iOS Safari.
- [ ] Production deployment is live and accessible via custom domain.
- [ ] HTTPS confirmed (green padlock in browser).
- [ ] JWT cookie not visible in browser `document.cookie`.
- [ ] All automated tests passing against production schema.
- [ ] Load test: 50 concurrent check-ins → no duplicates, no crashes.
- [ ] Production backup verified (Neon PITR + weekly dump).

---

# FINAL DELIVERABLES

---

## Final Architecture Recommendation

**Use a Modular Monolith** with:
- Next.js App Router frontend on Vercel
- Express.js REST API backend on Railway
- Neon PostgreSQL with Prisma ORM
- JWT in HTTP-only cookies
- Leaflet.js for maps (no API key cost)
- ExcelJS for server-side Excel generation

This is the correct architecture for the stated scale (5–6 branches, ~50–200 employees). No microservices. No message queues. No real-time WebSocket connections in MVP. Keep it simple, secure, and maintainable.

---

## Final Technology Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Frontend Framework | Next.js (App Router) | 14+ |
| Frontend Language | TypeScript (strict) | 5+ |
| Frontend Styling | Tailwind CSS | 3+ |
| State Management | TanStack Query + React Context | v5 |
| Forms | React Hook Form + Zod | v7 |
| Maps | Leaflet + react-leaflet | v4 |
| HTTP Client | Axios | v1 |
| Backend Framework | Express.js | v5 |
| Backend Language | TypeScript (strict) | 5+ |
| ORM | Prisma | v5 |
| Database | Neon PostgreSQL | Latest |
| Auth | JWT + bcrypt | — |
| Validation | Zod | v3 |
| Excel Export | ExcelJS | v4 |
| Date/Time | date-fns + date-fns-tz | v3 |
| Logging | Winston | v3 |
| Testing | Jest + Supertest | — |
| Frontend Hosting | Vercel | — |
| Backend Hosting | Railway | — |

---

## Complete Project Folder Structure

```
laba/
├── laba-backend/
│   ├── prisma/
│   │   ├── schema.prisma
│   │   ├── seed.ts
│   │   └── migrations/
│   ├── src/
│   │   ├── app.ts
│   │   ├── config/
│   │   │   ├── database.ts
│   │   │   ├── env.ts
│   │   │   └── constants.ts
│   │   ├── middleware/
│   │   │   ├── authenticate.ts
│   │   │   ├── authorize.ts
│   │   │   ├── rateLimiter.ts
│   │   │   ├── validate.ts
│   │   │   └── errorHandler.ts
│   │   ├── routes/
│   │   │   ├── health.routes.ts
│   │   │   ├── auth.routes.ts
│   │   │   ├── employee.routes.ts
│   │   │   ├── branch.routes.ts
│   │   │   ├── schedule.routes.ts
│   │   │   ├── attendance.routes.ts
│   │   │   ├── report.routes.ts
│   │   │   └── admin.routes.ts
│   │   ├── controllers/
│   │   │   ├── auth.controller.ts
│   │   │   ├── employee.controller.ts
│   │   │   ├── branch.controller.ts
│   │   │   ├── schedule.controller.ts
│   │   │   ├── attendance.controller.ts
│   │   │   ├── report.controller.ts
│   │   │   └── admin.controller.ts
│   │   ├── services/
│   │   │   ├── auth.service.ts
│   │   │   ├── employee.service.ts
│   │   │   ├── branch.service.ts
│   │   │   ├── schedule.service.ts
│   │   │   ├── geofence.service.ts
│   │   │   ├── attendance.service.ts
│   │   │   ├── report.service.ts
│   │   │   ├── excel.service.ts
│   │   │   └── audit.service.ts
│   │   ├── schemas/
│   │   │   ├── auth.schema.ts
│   │   │   ├── employee.schema.ts
│   │   │   ├── branch.schema.ts
│   │   │   ├── schedule.schema.ts
│   │   │   └── attendance.schema.ts
│   │   ├── types/
│   │   │   ├── express.d.ts
│   │   │   ├── attendance.types.ts
│   │   │   └── common.types.ts
│   │   └── utils/
│   │       ├── haversine.ts
│   │       ├── timeWindows.ts
│   │       ├── idGenerator.ts
│   │       └── responseHelpers.ts
│   ├── tests/
│   │   ├── unit/
│   │   │   ├── haversine.test.ts
│   │   │   ├── timeWindows.test.ts
│   │   │   └── geofence.service.test.ts
│   │   ├── integration/
│   │   │   ├── auth.test.ts
│   │   │   ├── attendance.checkin.test.ts
│   │   │   ├── attendance.checkout.test.ts
│   │   │   └── corrections.test.ts
│   │   └── fixtures/
│   │       └── testData.ts
│   ├── .env.example
│   ├── .gitignore
│   ├── package.json
│   └── tsconfig.json
│
└── laba-frontend/
    ├── src/
    │   ├── app/
    │   │   ├── (auth)/login/page.tsx
    │   │   ├── (dashboard)/
    │   │   │   ├── layout.tsx
    │   │   │   ├── employee/page.tsx
    │   │   │   ├── admin/
    │   │   │   │   ├── layout.tsx
    │   │   │   │   ├── page.tsx
    │   │   │   │   ├── employees/
    │   │   │   │   ├── branches/
    │   │   │   │   ├── schedules/
    │   │   │   │   ├── attendance/
    │   │   │   │   ├── corrections/
    │   │   │   │   ├── reports/
    │   │   │   │   └── policies/
    │   │   │   └── super-admin/
    │   │   │       ├── layout.tsx
    │   │   │       ├── page.tsx
    │   │   │       ├── admins/
    │   │   │       └── audit/
    │   │   ├── unauthorized/page.tsx
    │   │   ├── not-found.tsx
    │   │   ├── layout.tsx
    │   │   └── page.tsx
    │   ├── components/
    │   │   ├── ui/
    │   │   ├── layout/
    │   │   ├── attendance/
    │   │   ├── dashboard/
    │   │   ├── employees/
    │   │   ├── branches/
    │   │   ├── schedules/
    │   │   └── reports/
    │   ├── hooks/
    │   ├── lib/
    │   ├── providers/
    │   ├── types/
    │   └── middleware.ts
    ├── public/
    ├── tailwind.config.ts
    ├── next.config.ts
    ├── .env.local.example
    ├── .gitignore
    └── package.json
```

---

## Complete Database Relationship Design

```
organizations (1) ──────── (N) users
                (1) ──────── (N) employees
                (1) ──────── (N) branches
                (1) ──────── (N) attendance_policies
                (1) ──────── (N) attendance_records
                (1) ──────── (N) holidays
                (1) ──────── (N) audit_logs

users (1) ───────────────── (1) employees          [1:1, unique]
employees (1) ──────────── (N) branch_assignments
branches (1) ───────────── (N) branch_assignments
employees (1) ──────────── (N) field_staff_schedules
employees (1) ──────────── (N) attendance_records
attendance_policies (1) ── (N) attendance_records  [policy snapshot]
attendance_records (1) ─── (N) attendance_corrections
users (1) ───────────────── (N) audit_logs         [actor]
```

**Key unique constraints:**
- `users.email`
- `employees.employee_code`
- `employees.user_id` (1:1)
- `branches.branch_code`
- `field_staff_schedules.(employee_id, schedule_date)`
- `attendance_records.(employee_id, work_date)` ← **most critical**
- `holidays.(organization_id, holiday_date)`

---

## Complete Role-Permission Matrix

(See Section 6 — the full permission matrix is defined there with ✓/◑/✗ for all 35 capability rows.)

---

## Attendance Business Rule Summary

| Rule ID | Rule |
|---------|------|
| BR-001 | Check-in only within configured morning window (server time, IST) |
| BR-002 | Check-out only within configured evening window (server time, IST) |
| BR-003 | Check-out requires successful check-in on same work date |
| BR-004 | Office Staff: check-in and check-out require branch geofence compliance |
| BR-005 | Field Staff with location assigned: must be in that geofence |
| BR-006 | Field Staff with no schedule row: unrestricted attendance (record coordinates) |
| BR-007 | WEEKLY_OFF blocks attendance entirely |
| BR-008 | ATTENDANCE_DISABLED blocks attendance |
| BR-009 | Missing schedule row ≠ WEEKLY_OFF (unrestricted, not blocked) |
| BR-010 | Server clock authoritative for all timestamps |
| BR-011 | Duplicate check-in on same work date → rejected |
| BR-012 | Work report mandatory for check-out (min 5 chars, no whitespace-only) |
| BR-013 | GPS accuracy checked against policy threshold |
| BR-014 | Backend performs all geofence calculations |
| BR-015 | Historical records never silently modified |
| BR-016 | All corrections audited with before/after snapshot |
| BR-017 | Policy changes versioned; old policy preserved |
| BR-018 | Absent determination only after morning window closes |
| BR-019 | No attendance window may cross midnight in MVP |
| BR-020 | Super Admin controls Admin account permissions |

---

## Implementation Dependency Map

```mermaid
flowchart TD
    DB[Database Schema + Migrations] --> AUTH[Authentication System]
    AUTH --> EMP[Employee Management]
    EMP --> BRN[Branch Management]
    BRN --> GEO[Geofence Service]
    EMP --> SCHED[Field Schedule Management]
    GEO --> ATT_CI[Attendance Check-In]
    SCHED --> ATT_CI
    ATT_CI --> ATT_CO[Attendance Check-Out]
    ATT_CO --> DASH[Admin Dashboard]
    DASH --> RPT[Reports & Excel Export]
    DASH --> CORR[Correction Workflow]
    RPT --> DEPLOY[Production Deployment]
    CORR --> DEPLOY
    AUTH --> SUPER[Super Admin Features]
    SUPER --> DEPLOY
```

---

## Phase-Wise Development Roadmap

| Phase | Duration Estimate | Deliverable |
|-------|-----------------|-------------|
| 1 – Foundation | 2–3 days | Running dev environment, DB connected, health endpoint |
| 2 – Auth & Employees | 5–7 days | Login, employee CRUD, role-based access |
| 3 – Branches & GPS | 4–6 days | Branch management, map picker, geofence service, field schedules |
| 4 – Attendance Core | 7–10 days | Check-in, check-out, all business rules, employee dashboard |
| 5 – Admin & Reports | 5–7 days | Admin dashboard, absent/present views, corrections, Excel export |
| 6 – Polish & Deploy | 3–5 days | Super Admin, UI polish, production deployment |
| **Total MVP** | **~26–38 days** | **Full MVP in production** |

> [!NOTE]
> Duration estimates assume a single experienced full-stack developer. With two developers (one frontend, one backend), Phases 2–5 can partially run in parallel, reducing total time to approximately 18–26 days.

---

## Production Readiness Checklist

- [ ] All 6 implementation phases complete
- [ ] All automated tests passing (0 failures)
- [ ] TypeScript strict mode: `tsc --noEmit` returns 0 errors
- [ ] No hardcoded secrets anywhere in codebase
- [ ] `.env` files in `.gitignore` and not in GitHub
- [ ] JWT stored in HTTP-only cookie (verified in browser)
- [ ] HTTPS live on custom domain
- [ ] `SameSite=Strict` and `Secure` on JWT cookie
- [ ] CORS configured to allow only frontend domain
- [ ] Rate limiting active (global + login endpoint)
- [ ] Input validation (Zod) on all endpoints
- [ ] Organization scoping on all data queries
- [ ] Audit log captures all major actions
- [ ] Duplicate check-in concurrency test: only one record created
- [ ] GPS error handling: permission denied, timeout, poor accuracy
- [ ] Absent logic: empty list before morning window closes
- [ ] Excel export: tested for 30, 60, 90 day ranges
- [ ] Mobile testing: Android Chrome + iOS Safari
- [ ] Neon PITR backup verified (restore test on dev branch)
- [ ] Weekly `pg_dump` backup configured
- [ ] Health check endpoint live
- [ ] Super Admin account created for LABA management
- [ ] Default attendance policy seeded
- [ ] All branches configured with correct GPS coordinates
- [ ] Admin training completed

---

## Unresolved Questions That Must Be Answered Before Coding Begins

| # | Question | Impact | Recommended Default |
|---|----------|--------|-------------------|
| Q1 | What is the exact GPS coordinates of each branch location? | Branch geofence configuration | Configure in admin dashboard during setup |
| Q2 | What geofence radius (metres) does each branch require? | Varies by branch physical size | 100m default; Admin configures per branch |
| Q3 | Are there any public holidays that should suppress absence marking in MVP? | Absent logic accuracy | Implement holiday table but suppress absence marking in Phase 2+ |
| Q4 | Should Field Staff check-out location be validated against the same day's location? Or is check-out unrestricted for Field Staff? | Check-out business rule | Same rule as check-in: enforce if location assigned; unrestricted if no schedule |
| Q5 | What happens when Admin changes a Field Staff location AFTER check-in but BEFORE check-out? | Check-out validation | Use the location active at check-out time (not check-in time). Document this. |
| Q6 | Are there Field Staff employees who check in at one location but check out at a different location on the same day? | Location enforcement | Current spec does not support this. If needed, is a Phase 2 enhancement. |
| Q7 | What is the exact policy for GPS accuracy rejection? Should 150m accuracy always be rejected or just warned? | GPS accuracy threshold | Warn at 100m, reject at 200m — but let Admin configure these values |
| Q8 | Should employees be able to self-register or are all accounts created by Admin only? | Registration workflow | Admin-only creation per spec. No self-registration. Confirm. |
| Q9 | Should check-in attempt just past the window be automatically escalated as a correction request? | Missed check-in UX | No automatic escalation. Employee must manually submit correction. Confirm. |
| Q10 | Is the Contact ID a mandatory field or entirely optional? | Employee form UX | Optional per analysis in Section 3.3 (A10). Confirm. |
| Q11 | Should attendance records for Saturday and Sunday be automatically excluded from the absent list, or does LABA operate 7 days per week? | Absent list accuracy | Need to know LABA's standard work week. Recommended: configure working days in attendance policy. |
| Q12 | What is the target go-live date? | Phase planning | Determines which optional features to include in MVP scope |
| Q13 | Is there a requirement for email notifications (e.g., admin notified when correction is submitted)? | Phase 2 scope | Explicitly excluded from MVP per spec. Email alerts = future enhancement. Confirm. |
| Q14 | Should the minimum 5-character work report requirement be configurable by Admin, or is it fixed? | Policy configuration | Per spec: configurable. `min_report_length` is in `attendance_policies`. Confirm. |
| Q15 | Who is the first Super Admin? What are their credentials? | Seed data | Provide email and initial password before production seed is run. |

---

> [!IMPORTANT]
> **Final Reminder:** This document is a planning and architecture specification only. No application code has been written, no packages have been installed, and no project files have been created in the LABA project directory. All implementation work must begin only after explicit approval from the project owner, starting from Phase 1 of the roadmap above.

---

*Document end. Total sections: 103. Parts: A through I.*
