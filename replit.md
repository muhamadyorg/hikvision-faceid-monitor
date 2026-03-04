# HikVision FaceID Monitor

## Overview

A professional Hikvision FaceID security monitoring system for Uzbek-speaking users. Tracks face recognition events (enter/exit) from Hikvision cameras in real time.

## Default Credentials (seeded on first run)

| Role | Username | Password |
|------|----------|----------|
| Sudo | sudo | sudo1234 |
| Admin | admin | admin1234 |
| User | operator1 | user1234 |

Group credentials:
- Ofis group: login=`ofis_group`, password=`ofis123`
- Ombor group: login=`ombor_group`, password=`ombor123`

## Architecture

### Frontend
- React + TypeScript + Vite
- Routing: wouter
- State: TanStack React Query
- UI: shadcn/ui + Tailwind CSS (dark mode forced)
- Real-time: Custom useWebSocket hook → `/ws`

### Backend
- Node.js + Express + TypeScript
- Session auth: express-session + connect-pg-simple
- Password hashing: bcrypt (cost 12)
- WebSocket: ws package, broadcasts to all connected clients
- ORM: Drizzle ORM + PostgreSQL

### Database Tables
| Table | Purpose |
|-------|---------|
| `users` | System users with role enum (sudo/admin/user) |
| `groups` | Named groups with own login credentials |
| `group_members` | users ↔ groups many-to-many |
| `devices` | Camera/reader devices |
| `events` | FaceID events (enter/exit) |
| `work_schedules` | Per-person work hours for reporting |

## Pages

| Route | Access | Purpose |
|-------|--------|---------|
| `/login` | Public | Authentication |
| `/` | All users | Dashboard with stats + live feed |
| `/realtime` | All users | Full realtime event monitor |
| `/events` | All users | Paginated event log + filters |
| `/report` | All users | Attendance report with date range |
| `/devices` | Admin+ | Camera/device CRUD |
| `/users` | Admin+ | User management |
| `/groups` | Admin+ | Group management + membership |
| `/settings` | Sudo only | Work schedule + API docs |

## API

### Event Ingestion (for Hikvision devices)
```
POST /api/events
Content-Type: application/json

{
  "device_id": "hikvision_1",
  "person_name": "Ali Valiyev",
  "event_type": "enter",
  "timestamp": "2026-03-04T08:21:10"
}
```

## User Preferences

Preferred communication style: Simple, everyday language.
