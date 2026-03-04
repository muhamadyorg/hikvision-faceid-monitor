# HikVision FaceID Monitor

## Overview

Professional Hikvision FaceID security monitoring system (Uzbek language). Tracks face recognition events (enter/exit) from Hikvision cameras in real time with role-based access control, attendance reporting, and group management.

## Demo Credentials

| Rol | Login | Parol |
|-----|-------|-------|
| Sudo | `sudo` | `sudo1234` |
| Admin (Ofis) | `admin_ofis` | `admin1234` |
| Admin (Ombor) | `admin_ombor` | `admin5678` |
| Ishchi | `ali_v` | `worker1234` |
| Ishchi | `zulfiya_r` | `worker1234` |
| Ishchi | `sardor_t` | `worker1234` |

## Architecture

### Frontend
- React + TypeScript + Vite
- Routing: wouter
- State: TanStack React Query v5
- UI: shadcn/ui + Tailwind CSS (dark mode forced via `<div className="dark">`)
- Real-time: Custom useWebSocket hook → `/ws`
- PWA: manifest.json + service worker in client/public/

### Backend
- Node.js + Express + TypeScript
- Session auth: express-session + connect-pg-simple (PostgreSQL session store)
- Password hashing: bcrypt
- Single session enforcement: userSessions table tracks active session per user
- WebSocket: ws package, broadcasts new events to all connected clients
- ORM: Drizzle ORM + PostgreSQL

## Database Schema

| Table | Purpose |
|-------|---------|
| `users` | System users (role: sudo/admin/worker), plainPassword stored for sudo visibility |
| `groups` | Named groups (no credentials), managed by sudo |
| `group_admins` | Which admins manage which groups |
| `group_workers` | Which workers belong to which groups |
| `shifts` | 2 shifts per group (day/night) with start/end times |
| `holidays` | Public holidays shown in reports |
| `devices` | Camera/reader devices |
| `events` | FaceID events with isFirstEnter/isFirstExit deduplication |
| `notification_configs` | Per-group enter/exit notification messages |
| `user_sessions` | Single session enforcement tracking |

## Role-Based Access

- **sudo**: Full access - manages admins, groups, devices, can view all credentials
- **admin**: Assigned groups only - manages workers, shifts, holidays, reports for their groups
- **worker**: Own data only - views own events and today's status

## Pages

| Route | Access | Purpose |
|-------|--------|---------|
| `/login` | Public | Authentication |
| `/` | All | Dashboard with today's stats (present/absent) + live events |
| `/realtime` | All | Full realtime event monitor |
| `/events` | All | Paginated event log + filters |
| `/report` | All | Attendance report with print/PDF (portrait format) |
| `/workers` | admin+ | Worker CRUD with faceUserId assignment |
| `/shifts` | admin+ | Shift management per group |
| `/holidays` | admin+ | Public holiday management |
| `/groups` | admin+ | Group CRUD, admin/worker assignment (sudo: full, admin: view) |
| `/devices` | admin+ | Camera/device CRUD |
| `/admins` | sudo | Admin management with visible plaintext passwords |
| `/camera-guide` | sudo | Step-by-step Hikvision camera setup guide |
| `/settings` | sudo | System settings |

## Event Ingestion (for Hikvision devices)

```
POST /api/events
Content-Type: application/json

{
  "device_id": "hikvision_1",
  "user_id": "1001",
  "event_type": "enter",
  "timestamp": "2026-03-04T08:21:10"
}
```

- `user_id` maps to `faceUserId` in the users table
- First enter per day: `isFirstEnter=true`, first exit: `isFirstExit=true`
- Subsequent same-day events stored but not counted in reports

## Key Features Implemented

1. Single session enforcement (new login kills old session)
2. Event deduplication (first enter/exit per day flagged)
3. 2-shift system per group
4. Holiday management
5. PDF/Print reports in portrait format (admin+ only)
6. PWA with service worker
7. WebSocket real-time notifications
8. Visible plaintext passwords in sudo admin panel
9. Role-based sidebar navigation
10. Kamera ulash qo'llanmasi (camera setup guide)
11. Full README.md with aPanel + Docker deployment guide

## User Preferences

Preferred language: Uzbek (all UI). Communication style: simple, everyday language.
