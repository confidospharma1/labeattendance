# LABA Security Architecture & Threat Model

---

## 1. Authentication & Cookie Architecture

- **Credentials Storage:** Passwords hashed using `bcrypt` with cost factor 12.
- **Session Tokens:** Stateless JWT containing user ID, organization ID, and role.
- **Cookie Flags:**
  - `HttpOnly`: Prevents client-side script access (mitigating XSS session theft).
  - `Secure`: Transmitted strictly over HTTPS in production.
  - `SameSite=Lax` (or `Strict`): Defends against Cross-Site Request Forgery (CSRF).
  - Configurable `domain` parameter supporting shared root domain usage across `attendance.laba.in` and `api.laba.in`.
- **Brute-Force Lockout:** Accounts are locked for 15 minutes after 5 consecutive failed login attempts. Generic error responses prevent username enumeration.

---

## 2. GPS & Geofencing Security: Threat Model & Boundaries

Browser-based Geolocation relies on OS-reported coordinates. The security model explicitly defines what is protected and what requires native hardware controls:

| Vector | Risk Level | System Defense |
|---|---|---|
| **Client-side Time Manipulation** | High | **Defended:** Backend server clock in `Asia/Kolkata` is authoritative; client timestamps are ignored. |
| **API Request Replay** | High | **Defended:** Unique constraint on `(employee_id, work_date)` prevents duplicate check-ins. |
| **Tampered Geofence Distance** | High | **Defended:** Backend computes Haversine distance server-side; client cannot declare itself inside a boundary. |
| **Cross-Employee Spoofing** | High | **Defended:** `requireOwnership` and JWT identity enforcement prevent acting on behalf of another user. |
| **Device Mock Locations / DevTools** | Medium | **Documented Limitation:** Pure web browsers cannot cryptographically guarantee un-mocked hardware coordinates. Mitigated through audit logs (IP, User-Agent, reported accuracy analysis) and administrative correction workflows. Native OS attestation (Play Integrity / DeviceCheck) is reserved for future native mobile builds. |

