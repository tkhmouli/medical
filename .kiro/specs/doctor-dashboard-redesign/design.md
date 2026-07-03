# Design Document: Doctor Dashboard Redesign

## Overview

A complete redesign of the clinic dashboard page (`src/app/(dashboard)/page.tsx`) providing an operational at-a-glance view. The dashboard surfaces today's and tomorrow's schedules, real-time waiting room and patients-seen counters, a date picker for historical schedule viewing, financial statistics (role-gated), weather, and a local time display. Implementation is split into Phase 1 (schedule, counters, status field) and Phase 2 (financials, weather, time).

## Architecture

### High-Level Component Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  DashboardPage (Server Component)                               │
│  ─ Fetches session, passes user context to client shell         │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  DashboardClient (Client Component)                       │  │
│  │  ─ Manages polling, state, date picker                    │  │
│  │                                                           │  │
│  │  ┌─────────────┐ ┌─────────────┐ ┌──────────────────┐   │  │
│  │  │ TimeWidget  │ │WeatherWidget│ │  StatusCounters   │   │  │
│  │  │ (Phase 2)   │ │ (Phase 2)   │ │  Waiting | Seen   │   │  │
│  │  └─────────────┘ └─────────────┘ └──────────────────┘   │  │
│  │                                                           │  │
│  │  ┌───────────────────────────────────────────────────┐   │  │
│  │  │  ScheduleSection                                   │   │  │
│  │  │  ─ Today / Tomorrow / Date-Picker selection        │   │  │
│  │  │  ┌────────────────────────────────────────────┐   │   │  │
│  │  │  │  AppointmentList                            │   │   │  │
│  │  │  │  ─ Renders sorted, filtered appointments    │   │   │  │
│  │  │  └────────────────────────────────────────────┘   │   │  │
│  │  └───────────────────────────────────────────────────┘   │  │
│  │                                                           │  │
│  │  ┌───────────────────────────────────────────────────┐   │  │
│  │  │  FinancialWidget (Phase 2, wrapped in RoleGate)    │   │  │
│  │  │  ─ YTD / Monthly / Weekly revenue + patients seen  │   │  │
│  │  └───────────────────────────────────────────────────┘   │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### Data Flow

```
Browser (DashboardClient)
  │
  ├─ setInterval (30-60s) ──► GET /api/dashboard/stats
  │                             └─► appointment-service.getByDate()
  │                             └─► Counts by status
  │
  ├─ Date picker change ────► GET /api/appointments/calendar?date=YYYY-MM-DD
  │                             └─► appointment-service.getByDate()
  │
  ├─ On load (Phase 2) ────► GET /api/dashboard/financial
  │                             └─► financial-service.getSummary()
  │
  └─ On load (Phase 2) ────► GET /api/dashboard/weather
                                └─► OpenWeatherMap proxy (cached 30 min)
```

## Components and Interfaces

### Database Layer

#### New Enum: `appointment_status`

Add to `src/lib/db/schema.ts`:

```typescript
export const appointmentStatusEnum = pgEnum('appointment_status', [
  'scheduled',
  'waiting',
  'in_progress',
  'completed',
]);
```

#### Schema Change: `appointments` table

Add `status` column to the existing `appointments` table:

```typescript
status: appointmentStatusEnum('status').notNull().default('scheduled'),
```

### Service Layer

#### Dashboard Service (`src/lib/services/dashboard-service.ts`)

New service encapsulating dashboard-specific queries.

```typescript
export interface DashboardStats {
  today: DashboardAppointment[];
  tomorrow: DashboardAppointment[];
  waitingCount: number;
  seenCount: number;
}

export interface DashboardAppointment {
  id: string;
  patientName: string;
  startTime: string;
  duration: number;
  visitType: string;
  status: AppointmentStatus;
}

export type AppointmentStatus = 'scheduled' | 'waiting' | 'in_progress' | 'completed';

/**
 * Get dashboard statistics for a specific doctor on a specific date.
 * Returns today's and tomorrow's appointments (non-cancelled, sorted by start time),
 * plus waiting and completed counts.
 */
export async function getDashboardStats(
  tenantId: string,
  doctorId: string,
  today: string
): Promise<DashboardStats>;

/**
 * Get appointments for a specific date for a doctor.
 * Used by the date picker to load arbitrary date schedules.
 */
export async function getScheduleForDate(
  tenantId: string,
  doctorId: string,
  date: string
): Promise<DashboardAppointment[]>;

/**
 * Update appointment status.
 * Validates the new status is a valid enum value.
 */
export async function updateAppointmentStatus(
  tenantId: string,
  appointmentId: string,
  status: AppointmentStatus
): Promise<void>;

/**
 * Compute dashboard financial summary.
 * Returns YTD revenue, monthly revenue, weekly revenue, and YTD patients seen.
 */
export interface DashboardFinancials {
  ytdRevenue: number;
  monthlyRevenue: number;
  weeklyRevenue: number;
  ytdPatientsSeen: number;
}

export async function getDashboardFinancials(
  tenantId: string
): Promise<DashboardFinancials>;
```

#### Counter Computation Logic (pure function)

```typescript
/**
 * Counts appointments by status from a list of appointments.
 * Pure function suitable for property-based testing.
 */
export function countByStatus(
  appointments: { status: AppointmentStatus }[],
  targetStatus: AppointmentStatus
): number;

/**
 * Filters non-cancelled appointments and sorts by start time ascending.
 * Pure function suitable for property-based testing.
 */
export function filterAndSortAppointments(
  appointments: { isCancelled: boolean; startTime: string }[]
): typeof appointments;

/**
 * Computes total revenue from a list of financial entries within a date range.
 * Pure function suitable for property-based testing.
 */
export function computeRevenue(
  entries: { amount: number; paymentDate: string }[],
  startDate: string,
  endDate: string
): number;
```

### API Layer

#### `GET /api/dashboard/stats` (`src/app/api/dashboard/stats/route.ts`)

Returns today/tomorrow appointments and counters for the logged-in doctor.

```typescript
// Protected with withAuth (both Doctor and Medical_Assistant can access)
// Response shape:
{
  success: true,
  data: {
    today: DashboardAppointment[],
    tomorrow: DashboardAppointment[],
    waitingCount: number,
    seenCount: number
  }
}
```

#### `PATCH /api/appointments/[id]/status` (`src/app/api/appointments/[id]/status/route.ts`)

Updates an appointment's status. Used by the secretary queue management.

```typescript
// Protected with withAuth
// Request body: { status: AppointmentStatus }
// Response: { success: true, data: { id, status } }
```

#### `GET /api/dashboard/financial` (`src/app/api/dashboard/financial/route.ts`)

Returns financial summary stats. Gated by `financial` permission.

```typescript
// Protected with withAuthAndPermission('financial')
// Response shape:
{
  success: true,
  data: {
    ytdRevenue: number,
    monthlyRevenue: number,
    weeklyRevenue: number,
    ytdPatientsSeen: number
  }
}
```

#### `GET /api/dashboard/weather` (`src/app/api/dashboard/weather/route.ts`)

Proxies weather data from OpenWeatherMap with server-side caching (30 min TTL).

```typescript
// Protected with withAuth
// Response shape:
{
  success: true,
  data: {
    temperature: number,
    condition: string,
    icon: string
  }
}
// On failure:
{
  success: true,
  data: null,
  message: "Weather data unavailable"
}
```

### Client Components

#### `DashboardClient` (`src/app/(dashboard)/components/DashboardClient.tsx`)

Main client component managing:
- Polling via `setInterval` (30s default) calling `/api/dashboard/stats`
- Date picker state (selected date or null)
- Conditional fetching of date-specific schedules
- Weather fetch on mount with 30-minute refresh

```typescript
interface DashboardClientProps {
  user: { userId: string; role: Role; name: string };
  initialStats: DashboardStats;
}
```

#### `StatusCounters` (`src/app/(dashboard)/components/StatusCounters.tsx`)

Displays waiting room and patients seen counters.

```typescript
interface StatusCountersProps {
  waitingCount: number;
  seenCount: number;
}
```

#### `AppointmentList` (`src/app/(dashboard)/components/AppointmentList.tsx`)

Renders a list of appointments with status badges.

```typescript
interface AppointmentListProps {
  appointments: DashboardAppointment[];
  showStatus?: boolean; // true for today, false for tomorrow
  emptyMessage: string;
}
```

#### `FinancialWidget` (`src/app/(dashboard)/components/FinancialWidget.tsx`)

Displays financial stats (YTD, monthly, weekly revenue + patients seen). Wrapped in `RoleGate` with `feature="financial"`.

#### `WeatherWidget` (`src/app/(dashboard)/components/WeatherWidget.tsx`)

Displays temperature, condition, and icon. Shows fallback on error.

#### `TimeWidget` (`src/app/(dashboard)/components/TimeWidget.tsx`)

Displays current time (HH:MM, updating every minute) and date (day of week, month, day).

```typescript
/**
 * Formats a Date into HH:MM string.
 */
export function formatTime(date: Date): string;

/**
 * Formats a Date into human-readable date string (e.g., "Monday, January 15").
 */
export function formatDate(date: Date): string;
```

## Data Models

### AppointmentStatus Enum

```typescript
export const APPOINTMENT_STATUSES = ['scheduled', 'waiting', 'in_progress', 'completed'] as const;
export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number];
```

### DashboardStats (API response)

```typescript
export interface DashboardStats {
  today: DashboardAppointment[];
  tomorrow: DashboardAppointment[];
  waitingCount: number;
  seenCount: number;
}

export interface DashboardAppointment {
  id: string;
  patientName: string;
  startTime: string;
  duration: number;
  visitType: string;
  status: AppointmentStatus;
}
```

### DashboardFinancials (API response)

```typescript
export interface DashboardFinancials {
  ytdRevenue: number;
  monthlyRevenue: number;
  weeklyRevenue: number;
  ytdPatientsSeen: number;
}
```

### WeatherData (API response)

```typescript
export interface WeatherData {
  temperature: number;
  condition: string;
  icon: string;
}
```

### API Endpoints Summary

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/dashboard/stats` | withAuth | Dashboard counters + schedules |
| PATCH | `/api/appointments/[id]/status` | withAuth | Update appointment status |
| GET | `/api/dashboard/financial` | withAuthAndPermission('financial') | Financial stats |
| GET | `/api/dashboard/weather` | withAuth | Weather proxy |

### Zod Validation Schemas

```typescript
import { z } from 'zod';

export const appointmentStatusSchema = z.enum([
  'scheduled',
  'waiting',
  'in_progress',
  'completed',
]);

export const updateStatusSchema = z.object({
  status: appointmentStatusSchema,
});
```

## Error Handling

| Scenario | Behavior |
|----------|----------|
| Invalid status value in PATCH | Return 400 with validation error from Zod |
| Appointment not found for status update | Return 404 via NotFoundError |
| Unauthorized access to financial endpoint | Return 403 via AuthorizationError |
| Unauthenticated request | Return 401 via AuthenticationError |
| Weather API failure (network, timeout, invalid key) | Return `{ data: null, message: "Weather data unavailable" }` |
| Polling fetch failure (network error) | Silently retry on next interval; do not crash UI |
| Empty appointment list for a date | Display empty state message; no error |

## Testing Strategy

### Unit Tests (Example-Based)
- Empty state messages for today/tomorrow when no appointments exist (Requirements 2.3, 3.3)
- Date picker clear reverts to today/tomorrow view (Requirement 4.3)
- Weather widget fallback message on API failure (Requirement 9.3)
- Financial widget fetches data on dashboard load (Requirement 7.5)
- Date picker control renders and accepts date selection (Requirement 4.1)

### Property-Based Tests (fast-check, 100+ iterations)
- Status enum validation (Property 1)
- Default status on creation (Property 2)
- Schedule filtering and sorting (Property 3)
- Appointment data completeness (Property 4)
- Counter accuracy (Property 5)
- Revenue computation (Property 6)
- YTD patients seen (Property 7)
- Role-gating logic (Property 8)
- Weather data completeness (Property 9)
- Time/date formatting (Property 10)

### Integration Tests
- Polling cycle reflects status updates in UI (Requirements 1.3, 5.3, 6.3)
- Weather API route proxies to OpenWeatherMap (Requirement 9.2)

### Smoke Tests
- Polling interval is configured between 30-60 seconds (Requirements 5.2, 6.2)
- Weather refresh capped at 30-minute intervals (Requirement 9.4)
- Phase 1 renders without Phase 2 components (Requirement 11.3)

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Appointment status enum validation

*For any* string value, the appointment status update endpoint SHALL accept the value if and only if it is one of: "scheduled", "waiting", "in_progress", "completed". All other values SHALL be rejected with a validation error.

**Validates: Requirements 1.1**

### Property 2: Default status on appointment creation

*For any* valid appointment creation input (with arbitrary patient, doctor, date, time, duration, and visit type), the resulting appointment SHALL have its status field set to "scheduled".

**Validates: Requirements 1.2**

### Property 3: Schedule filtering and sorting

*For any* set of appointments on a given date (with varying cancelled states and start times), the dashboard schedule query SHALL return only non-cancelled appointments, and the returned list SHALL be sorted by start time in ascending order (i.e., for all adjacent pairs, the earlier appointment's start time ≤ the later one's start time).

**Validates: Requirements 2.1, 3.1, 4.2**

### Property 4: Appointment display data completeness

*For any* non-cancelled appointment returned by the dashboard stats endpoint, the appointment object SHALL include non-null values for: patientName, startTime, duration, visitType, and status.

**Validates: Requirements 2.2, 3.2**

### Property 5: Status counter accuracy

*For any* set of today's non-cancelled appointments with arbitrary status values, the waiting count SHALL equal the number of appointments with status "waiting", and the seen count SHALL equal the number of appointments with status "completed".

**Validates: Requirements 5.1, 6.1**

### Property 6: Financial revenue computation

*For any* set of financial entries with arbitrary amounts and payment dates, and *for any* valid date range [start, end], the computed revenue SHALL equal the sum of amounts for entries whose paymentDate falls within that range (inclusive on both ends).

**Validates: Requirements 7.1, 7.2, 7.3**

### Property 7: YTD patients seen count

*For any* set of appointments with arbitrary statuses and dates, the YTD patients seen count SHALL equal the number of appointments with status "completed" whose date falls between January 1 of the current year and today (inclusive).

**Validates: Requirements 7.4**

### Property 8: Financial widget role-gating

*For any* user role, the financial widget SHALL be visible if and only if `hasPermission(role, 'financial')` returns true. Specifically, it SHALL be visible for "Doctor" and "Admin" roles, and hidden for "Medical_Assistant".

**Validates: Requirements 8.1, 8.2, 8.3**

### Property 9: Weather widget data completeness

*For any* successful weather API response, the weather widget render output SHALL include a temperature value, a condition description string, and a weather icon identifier.

**Validates: Requirements 9.1**

### Property 10: Time and date formatting

*For any* valid JavaScript Date object, the `formatTime` function SHALL produce a string matching the pattern HH:MM (two-digit hour, colon, two-digit minute), and the `formatDate` function SHALL produce a string containing the day of week name, month name, and day number.

**Validates: Requirements 10.1, 10.2**
