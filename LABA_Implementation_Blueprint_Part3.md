# LABA Blueprint — Part 3
## Parts E and F: Frontend Implementation Plan & Security/Reliability

---

# PART E – FRONTEND IMPLEMENTATION PLAN

---

## Section 49 – Next.js Project Initialization

```bash
# Create Next.js project
npx create-next-app@latest laba-frontend --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"

# Additional dependencies
npm install axios @tanstack/react-query react-hook-form zod @hookform/resolvers
npm install leaflet react-leaflet @types/leaflet
npm install lucide-react
npm install date-fns date-fns-tz
npm install exceljs        # Only if any client-side processing needed (not recommended)
npm install clsx tailwind-merge   # Class utility helpers
```

**Key `next.config.ts` settings:**
```typescript
const nextConfig = {
  output: 'standalone',       // For Docker/non-Vercel deployments
  images: { domains: [] },
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
    NEXT_PUBLIC_MAP_TILE_URL: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
  },
  async headers() {
    return [{
      source: '/(.*)',
      headers: [
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      ],
    }];
  },
};
```

**Environment variables (`.env.local`):**
```
NEXT_PUBLIC_API_URL=http://localhost:5000/api/v1
NEXT_PUBLIC_APP_NAME=LABA Attendance
```

> [!IMPORTANT]
> Never prefix secrets with `NEXT_PUBLIC_`. Only the API base URL and non-sensitive configuration should be public. The JWT lives in an HTTP-only cookie set by the backend and is never accessible to JavaScript.

---

## Section 50 – Frontend Folder Structure

```
laba-frontend/
├── src/
│   ├── app/
│   │   ├── (auth)/
│   │   │   └── login/
│   │   │       └── page.tsx
│   │   ├── (dashboard)/
│   │   │   ├── layout.tsx                    # Shared dashboard shell
│   │   │   ├── employee/
│   │   │   │   └── page.tsx                  # Office/Field staff dashboard
│   │   │   ├── admin/
│   │   │   │   ├── layout.tsx                # Admin sidebar layout
│   │   │   │   ├── page.tsx                  # Admin dashboard home
│   │   │   │   ├── employees/
│   │   │   │   │   ├── page.tsx
│   │   │   │   │   ├── [id]/page.tsx
│   │   │   │   │   └── new/page.tsx
│   │   │   │   ├── branches/
│   │   │   │   │   ├── page.tsx
│   │   │   │   │   ├── [id]/page.tsx
│   │   │   │   │   └── new/page.tsx
│   │   │   │   ├── schedules/
│   │   │   │   │   ├── page.tsx
│   │   │   │   │   └── [employeeId]/page.tsx
│   │   │   │   ├── attendance/
│   │   │   │   │   ├── page.tsx
│   │   │   │   │   ├── present/page.tsx
│   │   │   │   │   └── absent/page.tsx
│   │   │   │   ├── corrections/
│   │   │   │   │   ├── page.tsx
│   │   │   │   │   └── [id]/page.tsx
│   │   │   │   ├── reports/
│   │   │   │   │   └── page.tsx
│   │   │   │   └── policies/
│   │   │   │       └── page.tsx
│   │   │   └── super-admin/
│   │   │       ├── layout.tsx
│   │   │       ├── page.tsx
│   │   │       ├── admins/
│   │   │       │   ├── page.tsx
│   │   │       │   └── new/page.tsx
│   │   │       └── audit/
│   │   │           └── page.tsx
│   │   ├── unauthorized/
│   │   │   └── page.tsx
│   │   ├── not-found.tsx
│   │   ├── layout.tsx                        # Root layout
│   │   └── page.tsx                          # Root → redirect
│   ├── components/
│   │   ├── ui/                               # Primitive design system components
│   │   │   ├── Button.tsx
│   │   │   ├── Input.tsx
│   │   │   ├── Label.tsx
│   │   │   ├── Badge.tsx
│   │   │   ├── Card.tsx
│   │   │   ├── Table.tsx
│   │   │   ├── Modal.tsx
│   │   │   ├── Spinner.tsx
│   │   │   ├── Alert.tsx
│   │   │   ├── Select.tsx
│   │   │   └── Textarea.tsx
│   │   ├── layout/
│   │   │   ├── Sidebar.tsx
│   │   │   ├── TopBar.tsx
│   │   │   ├── MobileNav.tsx
│   │   │   └── PageHeader.tsx
│   │   ├── attendance/
│   │   │   ├── CheckInCard.tsx
│   │   │   ├── CheckOutCard.tsx
│   │   │   ├── WorkReportForm.tsx
│   │   │   ├── AttendanceStatusBadge.tsx
│   │   │   ├── AttendanceHistoryTable.tsx
│   │   │   └── GPSStatusIndicator.tsx
│   │   ├── dashboard/
│   │   │   ├── AttendanceSummaryCards.tsx
│   │   │   ├── PresentEmployeesTable.tsx
│   │   │   ├── AbsentEmployeesTable.tsx
│   │   │   └── BranchSummaryTable.tsx
│   │   ├── employees/
│   │   │   ├── EmployeeForm.tsx
│   │   │   ├── EmployeeTable.tsx
│   │   │   └── EmployeeStatusBadge.tsx
│   │   ├── branches/
│   │   │   ├── BranchForm.tsx
│   │   │   ├── BranchTable.tsx
│   │   │   └── BranchMapPicker.tsx           # Leaflet map component
│   │   ├── schedules/
│   │   │   ├── WeeklyScheduleGrid.tsx
│   │   │   ├── DayScheduleForm.tsx
│   │   │   └── ScheduleCalendar.tsx
│   │   └── reports/
│   │       ├── ReportFilters.tsx
│   │       └── ExportButton.tsx
│   ├── hooks/
│   │   ├── useAuth.ts
│   │   ├── useGPS.ts
│   │   ├── useAttendance.ts
│   │   ├── useBranches.ts
│   │   ├── useEmployees.ts
│   │   └── useSchedules.ts
│   ├── lib/
│   │   ├── api.ts                            # Axios instance with interceptors
│   │   ├── queryClient.ts                    # TanStack Query client
│   │   └── utils.ts                          # clsx, formatters, date helpers
│   ├── providers/
│   │   ├── AuthProvider.tsx                  # React context for auth state
│   │   └── QueryProvider.tsx                 # TanStack Query provider
│   ├── types/
│   │   ├── auth.types.ts
│   │   ├── employee.types.ts
│   │   ├── attendance.types.ts
│   │   └── api.types.ts
│   └── middleware.ts                         # Next.js route guard middleware
├── public/
│   └── laba-logo.svg
├── tailwind.config.ts
├── .env.local
└── package.json
```

---

## Section 51 – Routing Strategy

### Next.js Middleware (`src/middleware.ts`)

The middleware runs at the edge before every request and implements route guards:

```
Middleware logic:
1. Read 'token' cookie from the request.
2. If no token and path is not /login → redirect to /login.
3. If token exists, decode it (without verifying signature — verification happens on the backend).
4. Extract role from token payload.
5. If path starts with /admin and role is not ADMIN or SUPER_ADMIN → redirect to /unauthorized.
6. If path starts with /super-admin and role is not SUPER_ADMIN → redirect to /unauthorized.
7. If path is /login and token is valid → redirect to appropriate dashboard based on role.
8. Allow request to proceed.

Role → Dashboard mapping:
  SUPER_ADMIN → /super-admin
  ADMIN       → /admin
  OFFICE_STAFF → /employee
  FIELD_STAFF  → /employee
```

> [!WARNING]
> The Next.js middleware provides UX-level route protection only. It is NOT a security boundary. All sensitive data and operations are protected by the backend's authentication and authorization middleware. Never rely solely on the frontend middleware to protect data.

### Role-based redirect on root `/`

The root page (`src/app/page.tsx`) renders a React component that calls `GET /api/v1/auth/me` on mount. Based on the returned role, it redirects to the appropriate dashboard using `router.replace()`.

---

## Section 52 – Authentication Pages

### Login Page (`src/app/(auth)/login/page.tsx`)

**Layout:** Centered card on a light background (`#F7F6F2`). Company name and logo at top. Email + Password fields. Login button. No registration link (accounts are admin-created).

**Form behavior:**
- React Hook Form + Zod resolver.
- Email validated as proper email format.
- Password minimum 8 characters client-side (actual validation is server-side).
- On submit: call `POST /api/v1/auth/login`.
- On success: query `GET /api/v1/auth/me`, store user in AuthContext, redirect.
- On error: display inline error message below form.
- Show spinner on button during request.
- Disable form during submission.
- Display lockout message with remaining time if `ACCOUNT_LOCKED` error received.

**Design specifications:**
```
Background: #F7F6F2
Card: white, 1px border #E5E5E5, no shadow or very subtle shadow
Width: max-w-md, centered
Typography: Inter or system font
Primary button: #171717 background, white text, hover: #333333
Input borders: #E5E5E5, focus: #171717 (1px)
Error text: #DC2626
```

---

## Section 53 – Role-Specific Layouts

### Dashboard Shell (`src/app/(dashboard)/layout.tsx`)

Wraps all dashboard pages. Contains:
- `AuthProvider` check: redirects to `/login` if not authenticated.
- Renders `<Sidebar>` on desktop (lg:block).
- Renders `<TopBar>` on mobile with hamburger menu.
- Main content area with appropriate padding.

### Admin Sidebar Navigation

```
LABA                          [Logo]
─────────────────────────────
Dashboard
Employees
  ├── All Employees
  ├── Office Staff
  └── Field Staff
Branches
Schedules
Attendance
  ├── Today's Attendance
  ├── Present
  └── Absent
Corrections
Reports
Policies
─────────────────────────────
[User name + role]
[Logout]
```

### Super Admin Sidebar (extends Admin)

```
(All Admin items)
─────────────────────────────
Administration
  ├── Admin Accounts
  └── Audit Log
```

### Employee Sidebar (minimal)

```
LABA
─────────────────
My Attendance
My History
─────────────────
[User name]
[Logout]
```

---

## Section 54 – Super Admin Dashboard

**Route:** `/super-admin`

**Page sections:**
1. **Summary Cards Row** (4 cards):
   - Total Branches | Total Employees | Today's Present | Pending Corrections
2. **Branch-wise Attendance Table**: Each branch with present/absent/total counts for today.
3. **Recent Audit Log** (last 10 entries): Actor, action, timestamp, entity.
4. **Admin Accounts Summary**: Count of active Admin accounts, last active.
5. **Attendance Policy Card**: Current policy version + effective date + "Edit Policy" button.

**Admin Account Management (`/super-admin/admins`):**
- Table of all Admin accounts with name, email, status, last login.
- Create Admin button.
- Suspend/Reactivate toggle per row.
- Reset password action.

**Audit Log Viewer (`/super-admin/audit`):**
- Filterable by: actor, action type, date range, entity type.
- Shows: timestamp, actor name, role, action, entity type, entity ID, IP address.
- Read-only. No delete or export in MVP (future enhancement).

---

## Section 55 – Admin Dashboard

**Route:** `/admin`

**Page sections:**

### Top Summary Row (5 stat cards)

```
┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ Total Staff  │ │   Present    │ │   Absent     │ │  Pending     │ │ Corrections  │
│     45       │ │     38       │ │      7       │ │  Checkout    │ │  Pending     │
│              │ │   84.4%      │ │   15.6%      │ │     18       │ │      2       │
└──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘
```

**Card design:** White background, `#E5E5E5` border, 1-line label in `#737373`, large number in `#171717`, small percentage or sub-label below. No decorative icons or gradients.

### Branch Summary Table

| Branch | Total | Present | Absent | Pending Checkout |
|--------|-------|---------|--------|-----------------|
| Kadapa | 10 | 9 | 1 | 4 |

### Quick Actions Row

- View Present Employees
- View Absent Employees
- Download Today's Report
- Review Corrections (badge with count)

### Recent Corrections Panel (if any pending)

Shows top 3 pending correction requests with employee name, type, submitted time, and "Review" link.

---

## Section 56 – Office Staff Dashboard

**Route:** `/employee` (for OFFICE_STAFF role)

**Purpose:** A clean, mobile-first interface. The employee should understand their attendance status at a glance and be able to perform their daily actions without confusion.

### Layout Structure

```
┌─────────────────────────────────────┐
│  LABA    Good morning, Priya ⚙ Logout│
├─────────────────────────────────────┤
│  Monday, 9 November 2026            │
│  LABA-OS-023 | Office Staff         │
│  Branch: LABA Pharmacy Kadapa       │
├─────────────────────────────────────┤
│  ┌────────────────────────────────┐ │
│  │  MORNING CHECK-IN              │ │
│  │  Window: 09:00 – 09:20 IST     │ │
│  │  Status: ● Available           │ │
│  │                                │ │
│  │  [CHECK IN]                    │ │
│  └────────────────────────────────┘ │
│  ┌────────────────────────────────┐ │
│  │  EVENING CHECK-OUT             │ │
│  │  Window: 16:30 – 17:00 IST     │ │
│  │  Status: ○ Requires check-in   │ │
│  └────────────────────────────────┘ │
├─────────────────────────────────────┤
│  ATTENDANCE HISTORY (last 7 days)   │
│  [table]                            │
└─────────────────────────────────────┘
```

### Status Display Logic (client-side computed from backend data)

| Condition | Status Label | Color |
|-----------|-------------|-------|
| Before morning window | "Opens at 09:00 IST" | Gray |
| Morning window open, no check-in | "Available" | Amber dot |
| Morning window closed, no check-in | "Window Closed" | Red |
| Checked in, before evening window | "Checked In – 09:08 IST" | Green |
| Evening window open, checked in | "Check-Out Available" | Amber |
| Fully checked out | "Complete – 16:45 IST" | Green |

### GPS Interaction Flow (client-side)

```typescript
// useGPS.ts hook
const useGPS = () => {
  const [status, setStatus] = useState<'idle'|'requesting'|'granted'|'denied'|'error'>('idle');
  const [coordinates, setCoordinates] = useState<GeolocationCoordinates | null>(null);

  const requestLocation = () => {
    setStatus('requesting');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCoordinates(position.coords);
        setStatus('granted');
      },
      (error) => {
        if (error.code === error.PERMISSION_DENIED) setStatus('denied');
        else setStatus('error');
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  };

  return { status, coordinates, requestLocation };
};
```

**GPS status messages shown to employee:**
- `requesting`: "Getting your location…" (spinner)
- `denied`: "Location access was denied. Please enable location permission in your browser settings and try again."
- `error` (POSITION_UNAVAILABLE): "Unable to determine your location. Please ensure you have GPS enabled and try again outdoors."
- `error` (TIMEOUT): "Location request timed out. Please try again."
- `granted` with poor accuracy: "Your GPS signal is weak (accuracy: Xm). For best results, please move to an open area and try again." [Retry button]

---

## Section 57 – Field Staff Dashboard

**Route:** `/employee` (for FIELD_STAFF role — same route, role determines rendered component)

**Differences from Office Staff Dashboard:**

1. **Today's Assignment Card** (above the check-in card):
   - If `NO_SCHEDULE`: Shows "No location assigned for today. You may check in from your current location."
   - If `LOCATION_ASSIGNED`: Shows location name, address, and a small static map snippet.
   - If `WEEKLY_OFF`: Shows "Today is a weekly off. No attendance required."
   - If `ATTENDANCE_DISABLED`: Shows "Attendance is not scheduled for today."

2. **Check-In Card** shows the enforced location name when a location is assigned.

3. **Schedule Preview** section showing the current week's assignments in a compact 7-column grid.

**Weekly Schedule Grid:**

```
Mon    Tue    Wed    Thu    Fri    Sat    Sun
Kadapa Nandyal Kurnool Guntur Vijay  Ongole  OFF
✓ Done ○ Today  –      –      –      –       –
```

---

## Section 58 – Branch Management Interface

### Branch List Page (`/admin/branches`)

- Table with columns: Branch Code, Name, District, Geofence Radius, Active Employees, Status, Actions.
- "Add Branch" button (top right).
- Status toggle (Active/Inactive) per row.
- "Edit" button opens edit form.

### Branch Form (`/admin/branches/new` and `/admin/branches/[id]`)

**Form fields:**
- Branch Name (text)
- Branch Code (text, auto-suggested, editable)
- Address (textarea)
- District (text)
- State (text, default: Andhra Pradesh)
- Geofence Radius (number, metres)
- Branch Manager (dropdown, optional, searches active employees)

**Map Picker Component (`BranchMapPicker.tsx`):**

```
Implementation using react-leaflet:
1. Render a Leaflet map centered on Andhra Pradesh (default center: 15.9129, 79.7400)
2. User clicks on the map to place a marker.
3. Clicking fires a `onClick` event returning latlng.
4. Latitude and longitude fields are auto-populated.
5. A circle overlay is drawn using the configured geofence radius.
6. As the radius field changes, the circle updates in real time.
7. User can also type coordinates manually; the map updates the marker.
8. "Use My Location" button uses browser geolocation to center the map.
```

> [!NOTE]
> Leaflet requires `typeof window !== 'undefined'` guard in Next.js due to SSR. Use dynamic import with `ssr: false` for the BranchMapPicker component.

```typescript
// In branch form page:
const BranchMapPicker = dynamic(
  () => import('@/components/branches/BranchMapPicker'),
  { ssr: false, loading: () => <div className="h-64 bg-gray-100 animate-pulse rounded" /> }
);
```

---

## Section 59 – Employee Management Interface

### Employee List Page (`/admin/employees`)

**Filters:** Employee Type (All / Office Staff / Field Staff), Status (Active / Suspended), Branch (dropdown), Search (name or code).

**Table columns:** Employee Code | Full Name | Type | Email | Mobile | Branch | Status | Actions

**Actions per row:** View Profile | Edit | Suspend/Activate

### Employee Form (`/admin/employees/new`)

**Fields:**
- Full Name *
- Email * (unique)
- Mobile * (10 digits)
- Employee Type * (Office Staff / Field Staff)
- Contact ID (optional)
- Assigned Branch (required for Office Staff, hidden for Field Staff)
- Temporary Password * (shown to Admin to share with employee; employee changes on first login — Phase 2 enhancement; MVP Admin sets the password)
- Profile Notes (textarea, Admin only)

**Validation:**
- Email format and uniqueness checked via API on blur.
- Mobile: exactly 10 digits, numeric only.
- Password: minimum 8 characters, at least one uppercase, one number.

### Employee Profile Page (`/admin/employees/[id]`)

**Sections:**
1. Profile details (editable)
2. Current branch assignment + assignment history timeline
3. Attendance summary (last 30 days, mini calendar)
4. Recent attendance records (last 10)
5. Pending correction requests
6. Account management (suspend, reset password)

---

## Section 60 – Field Schedule Management Interface

### Schedule List Page (`/admin/schedules`)

Shows all Field Staff employees with their current week's schedule status.

**Table:** Employee | Mon | Tue | Wed | Thu | Fri | Sat | Sun | Actions

Each day cell shows: Location name (truncated) or "OFF" or "—" (unassigned).

Clicking "Manage" for an employee opens their detailed schedule page.

### Individual Employee Schedule Page (`/admin/schedules/[employeeId]`)

**Two scheduling modes (tabs):**

**Tab 1: Weekly Schedule**

```
Week of: [Date Picker – selects start of week]  [< Prev Week] [Next Week >]

┌──────────┬──────────┬──────────┬──────────┬──────────┬──────────┬──────────┐
│ Monday   │ Tuesday  │Wednesday │ Thursday │ Friday   │ Saturday │ Sunday   │
│ Nov 10   │ Nov 11   │ Nov 12   │ Nov 13   │ Nov 14   │ Nov 15   │ Nov 16   │
├──────────┼──────────┼──────────┼──────────┼──────────┼──────────┼──────────┤
│ Kadapa   │ Nandyal  │ ——       │ ——       │ ——       │ ——       │ Weekly   │
│ [Edit]   │ [Edit]   │ [Add]    │ [Add]    │ [Add]    │ [Add]    │  Off     │
└──────────┴──────────┴──────────┴──────────┴──────────┴──────────┴──────────┘

[Save Full Week]
```

**Tab 2: Single Day Assignment**

```
Date: [Date Picker]
Type: [Location Assigned ▼ | Weekly Off | Disable Attendance]

— if Location Assigned —
Location Name: [text]
Address: [textarea]
[Map Picker]
Latitude: [auto-filled]
Longitude: [auto-filled]
Geofence Radius: [number] metres
Notes: [optional]

[Save]
```

**Day Schedule Form (`DayScheduleForm.tsx`):**
- Opens as a modal dialog when "Edit" or "Add" is clicked.
- Reuses the same map picker from Branch Management.
- Schedule type selector determines which fields are shown.
- Validates that latitude/longitude are filled when type is LOCATION_ASSIGNED.

---

## Section 61 – GPS Location Interface (Shared Component)

The GPS interaction is centralized in `CheckInCard.tsx` and `CheckOutCard.tsx`.

### Check-In Card States

```
State 1: Window not open
┌─────────────────────────────────┐
│ MORNING CHECK-IN                │
│ Opens at 09:00 IST              │
│ [CHECK IN] (disabled, gray)     │
└─────────────────────────────────┘

State 2: Window open, ready
┌─────────────────────────────────┐
│ MORNING CHECK-IN                │
│ 09:00 – 09:20 IST  ● Available  │
│ Assigned: LABA Pharmacy Kadapa  │
│ [CHECK IN] (black, active)      │
└─────────────────────────────────┘

State 3: GPS requesting
┌─────────────────────────────────┐
│ MORNING CHECK-IN                │
│ ⟳ Getting your location…        │
│ [CHECK IN] (loading spinner)    │
└─────────────────────────────────┘

State 4: GPS acquired, submitting
┌─────────────────────────────────┐
│ MORNING CHECK-IN                │
│ ✓ Location acquired             │
│   Accuracy: 12m                 │
│ ⟳ Submitting…                   │
└─────────────────────────────────┘

State 5: Successfully checked in
┌─────────────────────────────────┐
│ ✓ CHECKED IN                    │
│ 09:08 IST                       │
│ LABA Pharmacy Kadapa            │
└─────────────────────────────────┘

State 6: Error
┌─────────────────────────────────┐
│ MORNING CHECK-IN                │
│ ✗ Outside authorized location   │
│   You are 234m away (max 100m)  │
│ [TRY AGAIN]                     │
└─────────────────────────────────┘
```

**Anti-double-click protection:** The Check In button is disabled immediately on first click and remains disabled until the backend response is received. On error, it re-enables with the error message shown.

---

## Section 62 – Check-In Interface

**Component:** `CheckInCard.tsx`

**Detailed interaction:**

1. Component mounts → calls `GET /api/v1/attendance/today` to load current status.
2. If `status === CHECKED_IN` or `CHECKED_OUT`: show read-only confirmation state, skip to Section 63 for checkout.
3. If window is open and status is null: show active CHECK IN button.
4. On button click:
   - `setSubmitting(true)` → button disabled + spinner.
   - Call `useGPS().requestLocation()`.
   - Await coordinates.
   - On GPS error: `setSubmitting(false)`, show GPS error message.
   - On GPS success: call `POST /api/v1/attendance/check-in` with coordinates.
   - On API success: invalidate `attendance/today` query, show success state.
   - On API error: `setSubmitting(false)`, parse error code, display appropriate message.

**Error messages by API error code:**

| Error Code | Display Message |
|------------|----------------|
| ATTENDANCE_WINDOW_NOT_OPEN | "Check-in opens at [morningStart] IST." |
| ATTENDANCE_WINDOW_CLOSED | "The check-in window has closed. Contact your administrator." |
| OUTSIDE_GEOFENCE | "You are outside the authorized location. Distance: [X]m (max [Y]m)." |
| DUPLICATE_CHECKIN | "You have already checked in today at [time]." |
| WEEKLY_OFF | "Today is a configured weekly off. No attendance required." |
| GPS_ACCURACY_POOR | "GPS signal is weak (accuracy: Xm). Please try outdoors." |
| INVALID_COORDINATES | "Location data is invalid. Please refresh and try again." |

---

## Section 63 – Check-Out Interface

**Component:** `CheckOutCard.tsx`

**Layout (when evening window is active and employee is checked in):**

```
┌──────────────────────────────────────────┐
│ EVENING CHECK-OUT                        │
│ 16:30 – 17:00 IST  ● Available           │
│                                          │
│ Work Report *                            │
│ ┌──────────────────────────────────────┐ │
│ │ [textarea: min 5 chars, max 500]     │ │
│ │                                      │ │
│ └──────────────────────────────────────┘ │
│ 0 / 500 characters                       │
│                                          │
│ [CHECK OUT] (disabled until report valid)│
└──────────────────────────────────────────┘
```

**Check-out button enabling logic (client-side):**
- Watch the work report field value.
- Trim whitespace.
- If `trimmed.length >= policy.minReportLength`: enable button.
- Else: disable button, show character count.
- This is a UX aid only. The backend enforces the same rule.

---

## Section 64 – Work Report Form

**Component:** `WorkReportForm.tsx`

Used inside `CheckOutCard.tsx`. A standalone textarea with validation feedback.

**Validation rules (client-side, mirroring backend):**
- Cannot be empty.
- Cannot be whitespace-only.
- Minimum length: 5 characters (from cached policy).
- Maximum length: 500 characters (from cached policy).

**UX details:**
- Character counter always visible: "X / 500".
- Counter turns red when approaching max (> 480).
- Example placeholder text: "Describe your work for today (minimum 5 characters)."
- Report textarea: `rows={4}`, `resize: none`.

---

## Section 65 – Attendance Tables

### Present Employees Table (`/admin/attendance/present`)

**Columns:**
| Column | Type |
|--------|------|
| Employee Code | text |
| Name | text |
| Type | badge (Office/Field) |
| Branch / Location | text |
| Check-In Time (IST) | time |
| Check-Out Time (IST) | time or "Pending" |
| Duration | calculated |
| GPS Status | badge |
| Work Report | "View" link |

**GPS Status Badge logic:**
- `✓ Verified` (green): `check_in_geofence_valid === true`
- `! Unverified` (amber): unrestricted field check-in
- `✗ Failed` (red): geofence validation failed but admin-corrected

### Absent Employees Table (`/admin/attendance/absent`)

**Columns:** Employee Code | Name | Type | Expected Location | Expected Window | Status

**Status values:** Absent | No Schedule Configured | Weekly Off | On Leave (future)

> [!NOTE]
> The absent list must only appear after the morning attendance window has closed. If queried before `morningEnd`, the backend returns an empty absent list with a message: "Morning window has not yet closed. Absent employees will be listed after [morningEnd] IST."

---

## Section 66 – Present and Absent Sections

These are sub-pages under `/admin/attendance/`. They reuse the table components from Section 65 with pre-applied filters.

**Shared filter bar:**
- Date picker (default: today)
- Branch dropdown (default: all)
- Employee type filter
- Search box (name or code)
- "Download" button

---

## Section 67 – Excel Download Interface

**Component:** `ExportButton.tsx` (used on the Reports page and attendance pages)

**Reports Page (`/admin/reports`):**

```
┌───────────────────────────────────────────────┐
│ ATTENDANCE REPORTS                            │
├───────────────────────────────────────────────┤
│ Export Type:  [All Attendance ▼]              │
│ Date Range:   [Start Date] — [End Date]       │
│ Branch:       [All Branches ▼] (optional)     │
│ Employee Type: [All ▼]                        │
│                                               │
│ [DOWNLOAD EXCEL]                              │
│                                               │
│ Note: Maximum date range is 90 days.          │
└───────────────────────────────────────────────┘
```

**Export flow:**
1. Admin clicks "Download Excel".
2. Frontend calls `GET /api/v1/reports/attendance/export` with query parameters.
3. Backend generates the XLSX file server-side.
4. Response is a file stream with `Content-Disposition: attachment`.
5. Frontend handles this using:
   ```typescript
   const response = await axios.get('/reports/attendance/export', {
     params: { startDate, endDate, branchId, employeeType },
     responseType: 'blob',
   });
   const url = window.URL.createObjectURL(new Blob([response.data]));
   const link = document.createElement('a');
   link.href = url;
   link.download = `LABA_Attendance_${startDate}_${endDate}.xlsx`;
   link.click();
   ```
6. Download starts automatically.

**Loading state:** Button shows spinner and "Generating…" text. Disabled during generation.

---

## Section 68 – Responsive Behavior

### Breakpoints (Tailwind defaults)

| Breakpoint | Width | Usage |
|-----------|-------|-------|
| `sm` | 640px | Mobile landscape |
| `md` | 768px | Tablets |
| `lg` | 1024px | Desktop (sidebar appears) |
| `xl` | 1280px | Wide desktop |

### Mobile-first rules

- Sidebar is hidden on mobile (`hidden lg:block`). Mobile uses a bottom navigation bar or hamburger drawer.
- Tables become horizontally scrollable on mobile (`overflow-x-auto`).
- Cards stack vertically on mobile (1 column), 2 columns on `md`, 4 columns on `lg`.
- The employee check-in/check-out cards take full viewport width on mobile.
- Map picker is not shown on mobile for schedule management (admin task assumed on desktop). A fallback allows manual coordinate entry.
- Font size minimum: 16px for form inputs (prevents iOS zoom on focus).

### Touch targets

All interactive elements (buttons, links, table rows with actions) have a minimum touch target of 44×44px per WCAG guidelines.

---

## Section 69 – Error and Loading States

### Loading States

Every data-fetching component must show a loading skeleton, not a spinner alone:

```typescript
// Skeleton for stat cards
<div className="h-24 w-full bg-gray-100 animate-pulse rounded border border-gray-200" />

// Skeleton for table rows
{Array.from({ length: 5 }).map((_, i) => (
  <tr key={i}>
    <td><div className="h-4 bg-gray-100 animate-pulse rounded w-20" /></td>
    ...
  </tr>
))}
```

### Error States

Component-level errors (API failures) show an inline error panel:

```
┌──────────────────────────────────────────┐
│ ⚠ Failed to load attendance data         │
│ Please check your connection and retry.  │
│ [Retry]                                  │
└──────────────────────────────────────────┘
```

Page-level errors (404, 403) render dedicated pages:
- `/unauthorized` — "You do not have permission to view this page." + link to dashboard.
- `/not-found` — "Page not found." + link to dashboard.

### Empty States

When a table or list has no data:

```
─────────────────────────────────
     No attendance records found
     for the selected date range.
─────────────────────────────────
```

---

# PART F – SECURITY AND RELIABILITY

---

## Section 70 – Authentication Security

### Password Security

- **Algorithm:** bcrypt with cost factor 12 (minimum). Consider Argon2id for new deployments (superior memory hardness, recommended by OWASP).
- **Storage:** Only the hash is stored. The plaintext password never touches the database.
- **Length limits:** Maximum password length of 128 characters to prevent bcrypt DoS (bcrypt truncates at 72 bytes; validate at application layer, not at the 72-byte limit).
- **Policy:** Minimum 8 characters. Require at least one uppercase and one number. Enforce server-side.

### Session Security

- **Storage:** JWT stored in HTTP-only cookie. Inaccessible to JavaScript. Resistant to XSS token theft.
- **Cookie flags:** `HttpOnly`, `Secure` (production only), `SameSite=Strict`, `Path=/`, `Max-Age=28800` (8 hours).
- **SameSite=Strict:** Prevents CSRF for most browser navigation scenarios. Additionally, all state-modifying requests are `POST`/`PUT`/`PATCH`/`DELETE`, not `GET`.
- **Token expiry:** 8 hours for employees, 12 hours for admins. No refresh token in MVP. Users must re-login after expiry.
- **Token invalidation:** Standard JWTs cannot be invalidated server-side without a blocklist. For MVP, expiry is the primary revocation mechanism. When an employee is suspended, `is_active = false` is checked on every authenticated request via a lightweight database lookup in the `authenticate` middleware.

### Account Lockout

- After 5 consecutive failed login attempts: account locked for 15 minutes.
- `locked_until` stored in database.
- Lockout resets on successful login.
- Lockout error message tells the user the remaining minutes without revealing whether the email exists (use the same message for "email not found" and "wrong password" to prevent email enumeration).

> [!WARNING]
> Do NOT return different error messages for "email not found" vs "wrong password". Always return the same generic "Invalid email or password" message to prevent user enumeration attacks.

### Rate Limiting

- Global: 100 requests per 15 minutes per IP.
- Login endpoint: 5 requests per 15 minutes per IP (separate stricter limiter).
- Excel export: 10 requests per hour per authenticated user.

---

## Section 71 – Authorization Security

### Principle of Least Privilege

- Every API endpoint explicitly declares its `authorize([roles])` list.
- No "default allow" routes. Every route is explicitly secured.
- Admin cannot elevate to Super Admin. Each role's capabilities are enumerated, not inherited.

### Organization Scoping

- Every database query that accesses organizational data must include `WHERE organization_id = req.user.organizationId`.
- This is enforced by injecting `organizationId` from the JWT at the middleware level.
- No endpoint allows an Admin from Organization A to access data from Organization B.

### Employee Data Access

- An employee (OFFICE_STAFF or FIELD_STAFF) can only access their own attendance records, their own profile, and their own correction requests.
- The `requireOwnership` middleware compares `req.user.employeeId` with the resource's `employee_id` before allowing access.

### Admin Branch Scope (Phase 3 enhancement — schema-ready in MVP)

- In MVP: Admin has full access to all branches within their organization.
- The schema supports `admin_branch_access` configuration for future fine-grained branch restriction. The JWT claim `branchIds: ['uuid1', 'uuid2']` can be added in Phase 3 without schema changes.

---

## Section 72 – GPS Spoofing: Realistic Threat Model

This section provides an honest analysis of what can and cannot be defended against using browser-based GPS.

### Threats and Mitigations

| Threat | Risk Level | Mitigation Available | Notes |
|--------|-----------|---------------------|-------|
| **Mock GPS app** (fake GPS on Android/iOS) | High | None (browser-based) | A dishonest employee can install an app that feeds false coordinates to the browser. Only a native app with device integrity checks can mitigate this. |
| **Developer Tools coordinate injection** | Medium | None (browser-based) | A technically skilled employee can intercept the geolocation API call and return custom coordinates via browser developer tools. |
| **Modified API requests** | Medium | Partial | The backend validates coordinates, but cannot prove they came from the device. TLS prevents interception. The backend can apply heuristics (velocity check: were these coordinates physically possible since last check-in?). |
| **Location spoofing via browser extension** | High | None (browser-based) | Browser extensions can intercept `navigator.geolocation` calls. |
| **Replayed attendance requests** | Low | Mitigated | The unique constraint on `(employee_id, work_date)` prevents duplicate check-in replays. HTTPS + HTTP-only cookie prevents token theft for replay from another device. |
| **Device clock manipulation** | Low | Mitigated | The backend uses its own server clock (IST from `date-fns-tz`) for all time validations. The employee's submitted timestamp is logged but not trusted for validation. |
| **Multiple simultaneous submissions** | Low | Mitigated | Database unique constraint on `(employee_id, work_date)` guarantees only one succeeds. |
| **Shared credentials** | Medium | Partial | Logging `ip_address` and `user_agent` per attendance event provides forensic evidence. Admin can review suspicious patterns in audit logs. |
| **VPN or IP geolocation mismatch** | Low | Not mitigated | IP-based location is unreliable and not used for validation. |

### Honest Statement of Limitations

> GPS-only attendance verification using a browser-based web application **cannot guarantee physical presence**. It can verify that:
> 1. The user is authenticated (has valid credentials).
> 2. The GPS coordinates submitted fall within the configured geofence (but these coordinates may be fabricated).
> 3. The submission occurred within the configured time window (using server time, not device time).
>
> These controls raise the barrier to fraud significantly for most employees, but a technically sophisticated employee can bypass them. For higher assurance, a native Android/iOS application with:
> - Android SafetyNet / Play Integrity API attestation
> - iOS DeviceCheck
> - Root/jailbreak detection
> - Disabling mock location detection at the OS level
>
> would be required as a future enhancement.

### Velocity Heuristic (Phase 2 enhancement — noted here)

If an employee checks out from Kadapa at 17:00 and attempts to check in from Kurnool (200 km away) the next morning at 09:00 — this is physically plausible. But a check-in from Kadapa at 09:00 and a check-out from Delhi at 17:00 is not. The backend can log a suspicious flag on the attendance record for Admin review without blocking legitimate attendance.

---

## Section 73 – Attendance Integrity

### Duplicate Submission Prevention

- **Database layer:** `UNIQUE (employee_id, work_date)` on `attendance_records`.
- **Application layer:** Explicit check before INSERT returns a clear error rather than relying solely on constraint violation (better user experience).
- **Frontend layer:** Button disabled immediately on click, re-enabled only on response (error or success).

### Tamper-evident Records

- `created_at` and `updated_at` are set by the database, not by the application.
- `is_corrected` and `is_admin_created` flags make non-standard records immediately visible.
- Every correction has a full before/after JSON snapshot in `attendance_corrections`.
- Audit logs record every administrative modification with actor, timestamp, and IP.

### Time Integrity

The authoritative timestamp for all attendance records is the **backend server clock** at the moment the request is processed. The process:

```typescript
import { toZonedTime, fromZonedTime } from 'date-fns-tz';

const IST_TZ = 'Asia/Kolkata';

function getISTWorkDate(): Date {
  const nowUTC = new Date();
  const nowIST = toZonedTime(nowUTC, IST_TZ);
  // Extract date portion only: YYYY-MM-DD
  return new Date(nowIST.getFullYear(), nowIST.getMonth(), nowIST.getDate());
}

function isWithinWindow(policy: AttendancePolicy, windowType: 'morning' | 'evening'): boolean {
  const nowUTC = new Date();
  const nowIST = toZonedTime(nowUTC, IST_TZ);
  const hours = nowIST.getHours();
  const minutes = nowIST.getMinutes();
  const currentMinutes = hours * 60 + minutes;

  if (windowType === 'morning') {
    const start = timeToMinutes(policy.morningStart); // e.g. 9*60+0 = 540
    const end = timeToMinutes(policy.morningEnd);     // e.g. 9*60+20 = 560
    return currentMinutes >= start && currentMinutes <= end;
  }
  // similar for evening
}
```

---

## Section 74 – Duplicate Request Protection

### Scenario: Two simultaneous check-in requests

1. Request A and Request B arrive within milliseconds (e.g., user taps twice, or network retransmits).
2. Both pass application-layer validation (the attendance record does not yet exist at validation time).
3. Both attempt to INSERT into `attendance_records`.
4. The first INSERT succeeds.
5. The second INSERT fails with `UNIQUE constraint violation (P2002)`.
6. The backend catches P2002 and returns `409 DUPLICATE_CHECKIN`.
7. The frontend receives 409 and re-fetches today's attendance, showing the already-recorded check-in.

This guarantees exactly-once attendance even under concurrent requests without requiring distributed locks.

---

## Section 75 – Concurrency

### Database Connection Pooling

Neon PostgreSQL uses PgBouncer as a built-in connection pooler (available on the pooler endpoint). Configure Prisma to use the pooled connection URL for the application:

```
DATABASE_URL=postgresql://user:pass@endpoint-pooler.neon.tech/laba?sslmode=require&connection_limit=10
```

Connection limit per Prisma client instance: 10 (suitable for single-instance Express deployment). Adjust based on Neon tier limits.

### Transaction Isolation

For the check-in INSERT operation, use `READ COMMITTED` isolation (PostgreSQL default). The unique constraint provides the safety guarantee. `SERIALIZABLE` is not required and would reduce throughput.

---

## Section 76 – Database Transactions

**All multi-table writes use Prisma `$transaction`:**

```typescript
// Example: Check-in transaction
await prisma.$transaction(async (tx) => {
  const record = await tx.attendanceRecord.create({
    data: {
      employeeId,
      organizationId,
      workDate,
      policyVersionId,
      locationRefId,
      locationRefType,
      status: 'CHECKED_IN',
      checkInAt: new Date(),
      checkInLat: latitude,
      checkInLng: longitude,
      checkInAccuracyMetres: accuracy,
      checkInGeofenceValid: geofenceResult.insideGeofence,
      checkInDistanceMetres: geofenceResult.distanceMetres,
    },
  });

  await tx.auditLog.create({
    data: {
      organizationId,
      actorId: userId,
      actorRole: 'OFFICE_STAFF',
      action: 'CHECK_IN',
      entityType: 'attendance_records',
      entityId: record.id,
      afterState: record as unknown as JsonObject,
      ipAddress: req.ip,
    },
  });

  return record;
});
```

If the audit log insert fails, the entire transaction rolls back, preventing attendance records with no audit trail.

---

## Section 77 – Audit Logs

### What is Logged

| Action | Trigger | Actor |
|--------|---------|-------|
| USER_LOGIN | Successful login | Self |
| USER_LOGIN_FAILED | Failed login attempt | Self |
| EMPLOYEE_CREATED | Admin creates employee | Admin/Super Admin |
| EMPLOYEE_UPDATED | Profile change | Admin/Super Admin |
| EMPLOYEE_SUSPENDED | Status change | Admin/Super Admin |
| BRANCH_CREATED | New branch | Admin/Super Admin |
| BRANCH_GPS_UPDATED | Coordinates changed | Admin/Super Admin |
| EMPLOYEE_BRANCH_ASSIGNED | Assignment change | Admin/Super Admin |
| FIELD_SCHEDULE_CREATED | New schedule | Admin/Super Admin |
| FIELD_SCHEDULE_UPDATED | Schedule edit | Admin/Super Admin |
| POLICY_UPDATED | Attendance policy change | Super Admin |
| CHECK_IN | Employee checks in | Employee |
| CHECK_OUT | Employee checks out | Employee |
| CORRECTION_REQUESTED | Employee submits correction | Employee |
| CORRECTION_APPROVED | Admin approves | Admin/Super Admin |
| CORRECTION_REJECTED | Admin rejects | Admin/Super Admin |
| MANUAL_ATTENDANCE_CREATED | Admin creates attendance | Admin/Super Admin |

### Audit Log Immutability

- Application layer exposes only `auditService.log(...)` — no update or delete methods.
- In production, a PostgreSQL row-level security (RLS) policy can be added:
  ```sql
  CREATE POLICY audit_insert_only ON audit_logs
    FOR INSERT WITH CHECK (true);
  -- No UPDATE or DELETE policy = denied by default
  ```

---

## Section 78 – Privacy and Data Protection

### GPS Data Handling

GPS coordinates are sensitive personal data. The following practices apply:

1. **Purpose limitation:** GPS coordinates are collected only for attendance verification. They are not used for real-time employee tracking.
2. **Minimization:** Only the check-in and check-out coordinates are stored. No continuous location tracking occurs.
3. **Access control:** Employees cannot view other employees' GPS coordinates. Only Admin and Super Admin can view coordinate data in attendance records.
4. **Employee notice:** The login page and/or employee onboarding must inform employees that GPS coordinates are captured during check-in and check-out for attendance verification purposes.
5. **Retention:** GPS data should be retained for the duration of employment plus a reasonable period (e.g., 2 years) for legal and audit purposes. A data retention policy must be documented by LABA's HR/legal team.

### Applicable Indian Law

- **Information Technology Act, 2000** and **IT (Amendment) Act, 2008**: GPS data constitutes sensitive personal data. Informed consent and reasonable security practices are required.
- **Digital Personal Data Protection Act, 2023 (DPDPA)**: When enacted with rules, this will impose additional obligations on data fiduciaries. LABA should consult legal counsel to ensure compliance.
- **Employee consent:** Employee onboarding must include explicit consent to GPS location capture for attendance purposes.

---

## Section 79 – Backups

### Neon PostgreSQL Backup

Neon provides automatic continuous backups with point-in-time restore (PITR) on paid plans. This is the primary backup mechanism.

- **Free tier:** 7-day PITR.
- **Pro/Business tiers:** 30-day PITR.

**Recommendation:** Use at minimum the Neon Pro tier for production to ensure 30-day PITR.

### Application-level Backup

Additionally, schedule a weekly logical backup using `pg_dump` exported to a secure external storage (e.g., a private S3-compatible bucket):

```bash
pg_dump $DIRECT_URL --format=custom --file=laba_backup_$(date +%Y%m%d).dump
```

This can be automated as a cron job on the backend host or as a Neon-scheduled query export.

---

## Section 80 – Disaster Recovery

### Recovery Time Objective (RTO): 4 hours
### Recovery Point Objective (RPO): 24 hours (with daily backups) / near-zero (with Neon PITR)

### Recovery Procedure

1. **Database failure:** Use Neon PITR to restore to the last consistent point. Update `DATABASE_URL` if the endpoint changes.
2. **Backend failure:** Redeploy from GitHub. All state is in the database. No application-level state to restore.
3. **Frontend failure:** Redeploy from GitHub to Vercel (minutes). Vercel handles CDN recovery automatically.
4. **Full environment loss:** Restore database from logical backup to a new Neon project. Update all environment variables. Redeploy frontend and backend.

**Runbook:** A disaster recovery runbook document must be maintained separately with step-by-step procedures, environment variable locations, and contact information. This is noted as a production requirement.

---
