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

---

## Technology Stack

- **Frontend:** Next.js 14+ (App Router), React 18, TypeScript (strict), Tailwind CSS, TanStack Query v5, Leaflet.js
- **Backend:** Node.js 20 LTS, Express.js 5, TypeScript (strict), Prisma ORM 5, Zod, bcrypt, Winston
- **Database:** Neon PostgreSQL (Cloud Serverless)
- **Deployment:** Vercel (Frontend), Railway (Backend)

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

