# Implementation Plan: Doctor Dashboard Redesign

## Overview

Redesign the clinic dashboard into a real-time operational view split across two phases. Phase 1 delivers the appointment status field, schedule display (today/tomorrow/date-picker), and real-time counters. Phase 2 adds financial statistics (role-gated), weather widget, and local time display. Implementation follows the existing Next.js + Drizzle + Vitest patterns established in the codebase.

## Tasks

- [x] 1. Database schema and service layer foundation (Phase 1)
  - [x] 1.1 Add appointment_status enum and status column to appointments table
    - Add `appointmentStatusEnum` pgEnum to `src/lib/db/schema.ts` with values: scheduled, waiting, in_progress, completed
    - Add `status` column to `appointments` table with `.notNull().default('scheduled')`
    - Create the Drizzle migration via `drizzle-kit generate`
    - _Requirements: 1.1, 1.2_

  - [x] 1.2 Create dashboard service with pure utility functions
    - Create `src/lib/services/dashboard-service.ts`
    - Implement `countByStatus(appointments, targetStatus)` pure function returning count of appointments matching the target status
    - Implement `filterAndSortAppointments(appointments)` pure function that filters out cancelled appointments and sorts by startTime ascending
    - Implement `getDashboardStats(tenantId, doctorId, today)` querying today's and tomorrow's non-cancelled appointments for the doctor, returning sorted lists plus waitingCount and seenCount
    - Implement `getScheduleForDate(tenantId, doctorId, date)` for date-picker queries
    - Implement `updateAppointmentStatus(tenantId, appointmentId, status)` with Zod validation
    - Export types: `DashboardStats`, `DashboardAppointment`, `AppointmentStatus`
    - _Requirements: 1.1, 1.2, 2.1, 2.2, 3.1, 3.2, 4.2, 5.1, 6.1_

  - [ ]* 1.3 Write property tests for countByStatus
    - **Property 5: Status counter accuracy**
    - **Validates: Requirements 5.1, 6.1**

  - [ ]* 1.4 Write property tests for filterAndSortAppointments
    - **Property 3: Schedule filtering and sorting**
    - **Validates: Requirements 2.1, 3.1, 4.2**

- [x] 2. API routes for Phase 1
  - [x] 2.1 Create GET /api/dashboard/stats route
    - Create `src/app/api/dashboard/stats/route.ts`
    - Protect with `withAuth` (both Doctor and Medical_Assistant can access)
    - Extract logged-in user's doctorId and tenantId from session
    - Call `getDashboardStats` and return `{ success: true, data: DashboardStats }`
    - _Requirements: 2.1, 2.2, 3.1, 3.2, 5.1, 6.1_

  - [x] 2.2 Create PATCH /api/appointments/[id]/status route
    - Create `src/app/api/appointments/[id]/status/route.ts`
    - Protect with `withAuth`
    - Validate request body with Zod schema `{ status: appointmentStatusSchema }`
    - Call `updateAppointmentStatus` and return `{ success: true, data: { id, status } }`
    - Return 400 for invalid status, 404 for appointment not found
    - _Requirements: 1.1, 1.3_

  - [ ]* 2.3 Write property test for appointment status enum validation
    - **Property 1: Appointment status enum validation**
    - **Validates: Requirements 1.1**

  - [ ]* 2.4 Write property test for default status on creation
    - **Property 2: Default status on appointment creation**
    - **Validates: Requirements 1.2**

  - [ ]* 2.5 Write property test for appointment display data completeness
    - **Property 4: Appointment display data completeness**
    - **Validates: Requirements 2.2, 3.2**

- [x] 3. Checkpoint - Phase 1 backend complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Dashboard UI components (Phase 1)
  - [x] 4.1 Create StatusCounters component
    - Create `src/app/(dashboard)/components/StatusCounters.tsx`
    - Accept `waitingCount` and `seenCount` as props
    - Render two card-style counters with labels "Waiting Room" and "Patients Seen"
    - Use Tailwind styling consistent with existing dashboard layout
    - _Requirements: 5.1, 6.1_

  - [x] 4.2 Create AppointmentList component
    - Create `src/app/(dashboard)/components/AppointmentList.tsx`
    - Accept `appointments: DashboardAppointment[]`, `showStatus?: boolean`, and `emptyMessage: string`
    - Render sorted appointment list with patient name, start time, duration, visit type
    - Show status badge when `showStatus` is true (for today's view)
    - Show empty state message when no appointments exist
    - _Requirements: 2.2, 2.3, 3.2, 3.3_

  - [x] 4.3 Create DashboardClient component with polling and date picker
    - Create `src/app/(dashboard)/components/DashboardClient.tsx`
    - Accept `user` (userId, role, name) and `initialStats` props
    - Implement polling with `setInterval` at 30s calling `GET /api/dashboard/stats`
    - Implement date picker state: when a date is selected, fetch schedule via `GET /api/appointments/calendar?date=YYYY-MM-DD`
    - When date picker is cleared, revert to today/tomorrow view
    - Render `StatusCounters` and `AppointmentList` components (today section, tomorrow section, and optional date-picked section)
    - Handle polling errors silently (retry on next interval)
    - _Requirements: 1.3, 4.1, 4.2, 4.3, 5.2, 5.3, 6.2, 6.3_

  - [x] 4.4 Update DashboardPage server component
    - Modify `src/app/(dashboard)/page.tsx` to be a server component that fetches session
    - Pass user context and initial stats to `DashboardClient`
    - Call `getDashboardStats` server-side for initial data (avoids loading spinner on first render)
    - _Requirements: 2.1, 3.1, 11.3_

- [x] 5. Checkpoint - Phase 1 complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Financial service and API (Phase 2)
  - [x] 6.1 Implement getDashboardFinancials in dashboard service
    - Add `getDashboardFinancials(tenantId)` to `src/lib/services/dashboard-service.ts`
    - Query `financialEntries` table for YTD revenue (Jan 1 to today), monthly revenue (current month), weekly revenue (Monday to Sunday of current week)
    - Query completed appointments YTD for patients-seen count
    - Add `computeRevenue(entries, startDate, endDate)` pure function
    - Export `DashboardFinancials` interface
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

  - [x] 6.2 Create GET /api/dashboard/financial route
    - Create `src/app/api/dashboard/financial/route.ts`
    - Protect with `withAuthAndPermission('financial')` — only Doctor and Admin can access
    - Call `getDashboardFinancials` and return financial summary
    - _Requirements: 7.5, 8.1, 8.2, 8.3_

  - [ ]* 6.3 Write property tests for financial computations
    - **Property 6: Financial revenue computation**
    - **Validates: Requirements 7.1, 7.2, 7.3**

  - [ ]* 6.4 Write property test for YTD patients seen
    - **Property 7: YTD patients seen count**
    - **Validates: Requirements 7.4**

  - [ ]* 6.5 Write property test for role-gating logic
    - **Property 8: Financial widget role-gating**
    - **Validates: Requirements 8.1, 8.2, 8.3**

- [x] 7. Weather and time API/components (Phase 2)
  - [x] 7.1 Create GET /api/dashboard/weather route
    - Create `src/app/api/dashboard/weather/route.ts`
    - Protect with `withAuth`
    - Proxy request to OpenWeatherMap free tier API using env var `OPENWEATHERMAP_API_KEY`
    - Implement server-side in-memory cache with 30-minute TTL
    - Return `{ success: true, data: { temperature, condition, icon } }` on success
    - Return `{ success: true, data: null, message: "Weather data unavailable" }` on failure
    - _Requirements: 9.1, 9.2, 9.3, 9.4_

  - [x] 7.2 Create WeatherWidget component
    - Create `src/app/(dashboard)/components/WeatherWidget.tsx`
    - Fetch weather data on mount from `/api/dashboard/weather`
    - Display temperature, condition description, and weather icon
    - Show fallback message when data is null
    - Refresh every 30 minutes
    - _Requirements: 9.1, 9.3, 9.4_

  - [x] 7.3 Create TimeWidget component
    - Create `src/app/(dashboard)/components/TimeWidget.tsx`
    - Export `formatTime(date: Date): string` — returns HH:MM format
    - Export `formatDate(date: Date): string` — returns "Day of week, Month Day" format
    - Render current time updating every minute via `setInterval`
    - Display date in human-readable format
    - _Requirements: 10.1, 10.2_

  - [ ]* 7.4 Write property tests for weather data completeness
    - **Property 9: Weather widget data completeness**
    - **Validates: Requirements 9.1**

  - [ ]* 7.5 Write property tests for time/date formatting
    - **Property 10: Time and date formatting**
    - **Validates: Requirements 10.1, 10.2**

- [x] 8. Phase 2 UI integration
  - [x] 8.1 Create FinancialWidget component
    - Create `src/app/(dashboard)/components/FinancialWidget.tsx`
    - Fetch financial data on mount from `/api/dashboard/financial`
    - Display YTD revenue, monthly revenue, weekly revenue, and YTD patients seen as stat cards
    - Handle loading and error states gracefully
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

  - [x] 8.2 Integrate Phase 2 widgets into DashboardClient
    - Add `WeatherWidget` and `TimeWidget` to the dashboard header area
    - Add `FinancialWidget` wrapped in `RoleGate` with `feature="financial"` and `role={user.role}`
    - Ensure Phase 1 components still render correctly with Phase 2 additions
    - _Requirements: 8.1, 8.2, 8.3, 11.3_

- [x] 9. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- The existing `withAuth` / `withAuthAndPermission` middleware and `RoleGate` component are reused — no new auth infrastructure needed
- The `PATCH /api/appointments/[id]/status` endpoint is used by the Medical_Assistant (secretary) from the calendar/appointments page to manage the waiting room queue
- Polling interval is set to 30 seconds (within the 30-60s requirement range)
- The `financial` permission already exists in the permissions matrix (Doctor: allowed, Medical_Assistant: blocked)

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2"] },
    { "id": 2, "tasks": ["1.3", "1.4", "2.1", "2.2"] },
    { "id": 3, "tasks": ["2.3", "2.4", "2.5", "4.1", "4.2"] },
    { "id": 4, "tasks": ["4.3"] },
    { "id": 5, "tasks": ["4.4"] },
    { "id": 6, "tasks": ["6.1", "7.1", "7.3"] },
    { "id": 7, "tasks": ["6.2", "6.3", "6.4", "6.5", "7.2", "7.4", "7.5"] },
    { "id": 8, "tasks": ["8.1"] },
    { "id": 9, "tasks": ["8.2"] }
  ]
}
```
