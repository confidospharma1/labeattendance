# LABE Multi-Branch GPS Geofencing Attendance Management System

Enterprise attendance management web application engineered for **LABE** pharmacy branches across Andhra Pradesh, India.

---

## Key Features

- **Multi-Branch Centralized Oversight:** Real-time visibility into all pharmacy branches from a unified administrative portal.
- **GPS Geofencing Verification:** Server-side Haversine distance validation against branch locations and field assignments.
- **Dual Workforce Support:**
  - *Office Staff:* Tied to permanent pharmacy branches with strict boundary enforcement.
  - *Field Staff:* Configurable daily and 7-day schedules with support for explicit unrestricted locations and weekly off protection.
- **Configurable Attendance Windows:** Enforced server-side using Indian Standard Time (`Asia/Kolkata`).
- **Mandatory Daily Work Reports:** Check-out is blocked until a validated summary of the day's tasks is submitted.
- **Auditable Correction Lifecycle:** Controlled request-and-approval workflow with before/after state snapshots.
- **Multi-Sheet ExcelJS Reports:** Comprehensive server-side Excel workbooks generated with proper organizational scoping.
- **Enterprise Design System:** Minimalist, high-performance interface built with a refined neutral palette (`#F7F6F2`, `#171717`, `#E5E5E5`).

### Staff categories and how each marks attendance

| Category | Login role | Attendance rule |
|---|---|---|
| Head Office Staff (H.O.S), Guntur | Office | Inside the head office geofence, org check-in/out windows |
| Regional Office Staff (R.O.S), Tirupati | Office | Inside the regional office geofence |
| Distribution Center Staff (D.C.S) | Office | Inside their DC geofence (grouped by DC name and location) |
| Marketing Executive (M.E) | Field | Restricted route: checks in at each planned stop (radius or village boundary) and records survey data |
| Sales Executive (S.E) | Field | Anywhere inside the allotted DC territory map; sees and adds DC customers |
| Pharmacy Hub & Shop Staff | Office | Shift-wise, inside their pharmacy location |
| Laboratory Staff | Office | Shift-wise, inside their lab |
| CEO / Director / Chief Staff | Office | Office or anywhere (location recorded, not enforced) |
| Camp attendance (any category) | — | Only assigned staff, only inside the camp geofence during camp hours |

Every employee has a name, employee code (auto `LABE-HO-001` style or your HR code), designation and date of joining.
The admin **All Staff Attendance** board lists every active employee for a date (present, late, not yet, absent, no route, holiday), grouped by category and location, on desktop and phone, in the website and the Android app.

### Geofencing like Google Maps (free)

A geofence is either a **radius** around a pin or an **exact boundary** polygon, checked on the server (point-in-polygon, distance to the edge).
Boundaries come from:
1. **OpenStreetMap administrative areas** via Nominatim (city / mandal / village / district outlines, the same kind of outline Google Maps draws as a red dotted line). Places mapped only as a point (e.g. some towns) offer the areas that contain them.
2. **Drawing** the outline on the satellite map.
3. **Importing KML / GeoJSON**, e.g. a boundary traced in Google My Maps or Google Earth (both free) over Google's own outline.

Map tiles: Esri World Imagery + labels (satellite) and OpenStreetMap (streets); no API keys.

### Face recognition (free, on-device)

`@vladmandic/human` runs in the browser / WebView: face descriptor + blink + liveness + anti-spoof. Models ship with the app (`public/models`), descriptors are matched on the server, and a selfie thumbnail is stored for admin review.

---

## Technology Stack

- **Frontend:** Next.js 14+ (App Router), React 18, TypeScript (strict), Tailwind CSS, TanStack Query v5, Leaflet.js
- **Backend:** Node.js 20 LTS, Express.js 5, TypeScript (strict), Prisma ORM 5, Zod, bcrypt, Winston
- **Database:** Neon PostgreSQL (Cloud Serverless)
- **Deployment:** Vercel (Frontend), Render (Backend), Capacitor Android app
- **Maps & geofencing:** Leaflet, OpenStreetMap / Nominatim boundaries, Esri imagery (all free, no API keys)
- **Face recognition:** @vladmandic/human (on-device, free)

---

## Project Structure

```
pharmattendance/
├── laba-backend/         # Express REST API & Prisma Database Layer
├── laba-frontend/        # Next.js 14+ Web Application
├── docs/                 # System architecture, schemas, business rules, progress
└── LABA_Implementation_Blueprint_Part[1-4].md # Full Engineering Blueprints
```

---

## Local Development Setup

### Prerequisites
- Node.js 20+ LTS
- PostgreSQL or Neon Cloud Account
- npm 10+

### Backend Setup
```bash
cd laba-backend
cp .env.example .env
# Configure DATABASE_URL and JWT_SECRET in .env
npm install
npx prisma generate
npx prisma migrate dev
npm run dev
```

### Frontend Setup
```bash
cd laba-frontend
cp .env.example .env.local
npm install
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) to view the application.

### Android app (Capacitor)

The APK wraps the same Next.js app as a static export, so staff and admin screens work in both.
```bash
cd laba-frontend
npm run build:apk -- --api=https://labeattendance.onrender.com/api/v1   # builds ./out and syncs android/
npx cap open android                                                   # then Build > Build APK in Android Studio
```

### Database changes on deploy

Render's build does not migrate the database. Before deploying a backend with schema changes, apply them once:
review `laba-backend/prisma/sql/upgrade-production-from-main.sql` (it lists the destructive steps at the top),
back up the Neon database, then run `npx prisma db execute --file prisma/sql/upgrade-production-from-main.sql`.

