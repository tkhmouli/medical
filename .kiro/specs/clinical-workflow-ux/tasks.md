# Implementation Plan: Clinical Workflow UX

## Overview

This plan implements clinical workflow UX improvements by creating reusable selector components (patient typeahead, doctor dropdown, appointment dropdown), new API endpoints to support them, and updating the Patient Detail Page, Appointment Form, and Prescription Form to use these components with seamless cross-page navigation via URL parameters.

## Tasks

- [x] 1. Create service layer functions for patient search, doctor list, and appointment filtering
  - [x] 1.1 Implement `quickSearch` in patient-service.ts
    - Add a new `quickSearch(tenantId, query, limit)` function to `src/lib/services/patient-service.ts`
    - Use OR-based ILIKE matching across `firstName`, `lastName`, `phoneNumber`
    - Scope results by `tenantId`, order by `lastName ASC, firstName ASC`
    - Enforce max limit of 50, default 20
    - Return `{ id, firstName, lastName, phoneNumber }` array
    - _Requirements: 2.1, 2.2, 4.1, 4.2_

  - [x] 1.2 Implement `listDoctors` in user-service.ts
    - Add a new `listDoctors(tenantId)` function to `src/lib/services/user-service.ts`
    - Filter users where `role = 'Doctor'` AND `isActive = true` AND `tenantId` matches
    - Sort results alphabetically by name (case-insensitive)
    - Return `{ id, name }` array
    - _Requirements: 3.1, 3.2, 5.1_

  - [x] 1.3 Implement `getByPatient` in appointment-service.ts
    - Add a new `getByPatient(tenantId, patientId)` function to `src/lib/services/appointment-service.ts`
    - Filter appointments where `patientId` matches AND `isCancelled = false`
    - Sort by `date DESC`
    - Return appointment records with `id`, `date`, `startTime`, `visitType`
    - _Requirements: 6.1, 6.2_

- [x] 2. Create API route endpoints
  - [x] 2.1 Create GET /api/patients/search route
    - Create `src/app/api/patients/search/route.ts`
    - Accept query params `q` (min 2 chars) and `limit` (default 20, max 50)
    - Require `patient_management` permission
    - Call `quickSearch` from patient-service and return JSON response
    - Return 400 if `q` is missing or fewer than 2 characters
    - _Requirements: 2.2, 4.2_

  - [x] 2.2 Create GET /api/doctors route
    - Create `src/app/api/doctors/route.ts`
    - Require `appointments` permission (accessible to Admin, Doctor, Medical_Assistant)
    - Call `listDoctors` from user-service and return JSON response
    - _Requirements: 3.1, 3.2, 5.1_

  - [x] 2.3 Update GET /api/appointments to support patientId and excludeCancelled filters
    - Modify `src/app/api/appointments/route.ts` to accept optional `patientId` and `excludeCancelled=true` query params
    - When `patientId` is provided, filter results to that patient
    - When `excludeCancelled=true`, exclude cancelled appointments
    - Call `getByPatient` when both filters are active
    - _Requirements: 6.1, 6.2_

- [x] 3. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Build reusable selector components
  - [x] 4.1 Create PatientSelectorDropdown component
    - Create `src/components/PatientSelectorDropdown.tsx`
    - Implement typeahead with 300ms debounce, minimum 2-character threshold
    - Fetch from `GET /api/patients/search?q={query}&limit={limit}`
    - Show dropdown with patient name and phone number
    - Show "No patients found" message when results are empty
    - Support `disabled` prop for read-only pre-filled state
    - Support `error` prop for inline error display
    - Support `displayName` prop for locked state display
    - Keyboard accessible (arrow keys, Enter, Escape)
    - _Requirements: 2.1, 2.2, 2.3, 2.5, 4.1, 4.2, 4.5_

  - [x] 4.2 Create DoctorSelectorDropdown component
    - Create `src/components/DoctorSelectorDropdown.tsx`
    - Fetch doctor list from `GET /api/doctors` on mount
    - Display doctors sorted alphabetically by name
    - Auto-select when only one doctor exists in tenant
    - Support `autoSelectId` prop to pre-select logged-in doctor
    - Show error state if fetch fails or list is empty
    - Disable form submission when no doctors available
    - _Requirements: 3.1, 3.2, 3.3, 3.5, 3.6, 5.1, 5.2, 5.6_

  - [x] 4.3 Create AppointmentSelector component
    - Create `src/components/AppointmentSelector.tsx`
    - Disabled state with "Select a patient first" when no patient selected
    - Fetch from `GET /api/appointments?patientId={id}&excludeCancelled=true` when patient changes
    - Display date, time, and visit type for each appointment, sorted by date DESC
    - Show "No appointments found for this patient" when empty
    - Support `preSelectId` prop for URL param pre-selection
    - Clear selection when `patientId` changes
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_

- [x] 5. Update Patient Detail Page with action buttons
  - [x] 5.1 Add action buttons to Patient Detail Page header
    - Modify `src/app/(dashboard)/patients/[id]/page.tsx`
    - Add "Book Appointment" button visible to all roles (Admin, Doctor, Medical_Assistant)
    - Add "New Prescription" button visible only to Admin and Doctor roles
    - "Book Appointment" navigates to `/appointments/new?patientId={id}`
    - "New Prescription" navigates to `/prescriptions/new?patientId={id}`
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

- [x] 6. Update Appointment Form with selectors and success view
  - [x] 6.1 Replace raw inputs with selectors on Appointment Form
    - Modify `src/app/(dashboard)/appointments/new/page.tsx`
    - Replace Patient ID text input with `PatientSelectorDropdown` (limit: 20)
    - Replace Doctor ID text input with `DoctorSelectorDropdown`
    - Read `patientId` from URL params to pre-fill and lock patient selector
    - Validate patient exists in tenant when URL param provided; show error if not found
    - Auto-select single doctor when only one exists
    - Show error and disable submission if doctor list fails to load or is empty
    - _Requirements: 1.4, 1.6, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

  - [x] 6.2 Add post-appointment success view with "Create Prescription" link
    - Modify `src/app/(dashboard)/appointments/new/page.tsx`
    - After successful appointment creation, show a confirmation view instead of redirecting
    - Display "Create Prescription" link for Admin and Doctor roles
    - Hide "Create Prescription" link for Medical_Assistant role
    - Link navigates to `/prescriptions/new?patientId={patientId}&appointmentId={appointmentId}`
    - Also show a "View All Appointments" link to go back
    - _Requirements: 7.1, 7.2, 7.3_

- [x] 7. Update Prescription Form with selectors and doctor logic
  - [x] 7.1 Replace plain selects with selector components on Prescription Form
    - Modify `src/app/(dashboard)/prescriptions/new/page.tsx`
    - Replace patient `<select>` with `PatientSelectorDropdown` (limit: 50)
    - Replace appointment `<select>` with `AppointmentSelector`
    - Add `DoctorSelectorDropdown` with auto-select for logged-in doctor
    - Read `patientId` and `appointmentId` from URL params to pre-fill and lock
    - Validate patient exists in tenant when URL param provided; show error if not found
    - When patient is selected, refresh AppointmentSelector with that patient's appointments
    - When patient is cleared, reset AppointmentSelector to default state
    - _Requirements: 1.5, 1.6, 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 5.2, 5.3, 5.4, 5.5, 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 7.4_

- [x] 8. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 9. Write property-based tests for service functions
  - [ ]* 9.1 Write property test for quickSearch filtering logic
    - **Property 1: Patient search returns only matching results**
    - Generate arbitrary patient records and search queries
    - Assert every result contains the query as a case-insensitive substring in firstName, lastName, or phoneNumber
    - Assert result count ≤ specified limit
    - **Validates: Requirements 2.2, 4.2**

  - [ ]* 9.2 Write property test for listDoctors filtering logic
    - **Property 2: Doctor list contains only active doctors**
    - Generate arbitrary user records with mixed roles and active/inactive status
    - Assert result contains exactly the users where `role = 'Doctor'` AND `isActive = true`
    - **Validates: Requirements 3.1, 5.1**

  - [ ]* 9.3 Write property test for listDoctors sorting
    - **Property 3: Doctor list is sorted alphabetically**
    - Generate arbitrary active doctor names
    - Assert returned list is sorted in ascending alphabetical order (case-insensitive)
    - **Validates: Requirements 3.2**

  - [ ]* 9.4 Write property test for single-doctor auto-selection
    - **Property 4: Single-doctor auto-selection**
    - Given exactly one active doctor in the tenant, assert the DoctorSelectorDropdown auto-selects that doctor's ID
    - **Validates: Requirements 3.3**

  - [ ]* 9.5 Write property test for logged-in doctor auto-selection
    - **Property 5: Logged-in doctor auto-selection on prescription form**
    - Given a user with Doctor role, assert DoctorSelectorDropdown initializes with that user's ID
    - **Validates: Requirements 5.2**

  - [ ]* 9.6 Write property test for appointment filtering by patient
    - **Property 6: Appointment filtering by patient excludes cancelled**
    - Generate arbitrary appointments with mixed patientIds and cancellation status
    - Assert results contain only non-cancelled appointments for the specified patient, sorted by date DESC
    - **Validates: Requirements 6.1, 6.2**

  - [ ]* 9.7 Write property test for URL parameter correctness
    - **Property 7: Navigation URL parameter correctness**
    - Generate arbitrary patient IDs and appointment IDs
    - Construct navigation URL and parse it back
    - Assert parsed values exactly match original IDs
    - **Validates: Requirements 1.4, 1.5, 7.2**

- [ ] 10. Write unit tests for components and pages
  - [ ]* 10.1 Write unit tests for PatientSelectorDropdown
    - Test rendering with placeholder
    - Test search triggers after 2+ characters with debounce
    - Test "No patients found" display
    - Test disabled/locked state rendering
    - Test error message display
    - _Requirements: 2.1, 2.2, 2.3, 2.5_

  - [ ]* 10.2 Write unit tests for DoctorSelectorDropdown
    - Test auto-select when single doctor
    - Test auto-select with `autoSelectId` prop
    - Test error state rendering when fetch fails
    - Test empty state rendering when no doctors
    - _Requirements: 3.3, 3.5, 3.6, 5.2, 5.6_

  - [ ]* 10.3 Write unit tests for AppointmentSelector
    - Test disabled state when no patient selected
    - Test appointments displayed in correct order
    - Test pre-selection via `preSelectId` prop
    - Test clearing when patient changes
    - Test empty state message
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

  - [ ]* 10.4 Write unit tests for Patient Detail Page action buttons
    - Test "Book Appointment" button visible for all roles
    - Test "New Prescription" button visible for Admin and Doctor
    - Test "New Prescription" button hidden for Medical_Assistant
    - Test correct navigation URLs generated
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

  - [ ]* 10.5 Write unit tests for post-appointment success view
    - Test "Create Prescription" link shown for Admin and Doctor
    - Test "Create Prescription" link hidden for Medical_Assistant
    - Test correct URL with patientId and appointmentId params
    - _Requirements: 7.1, 7.2, 7.3_

- [x] 11. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- The project uses vitest + fast-check for property-based testing, @testing-library/react for component tests
- All components use TypeScript, Tailwind CSS, and follow existing project patterns

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2", "1.3"] },
    { "id": 1, "tasks": ["2.1", "2.2", "2.3"] },
    { "id": 2, "tasks": ["4.1", "4.2", "4.3"] },
    { "id": 3, "tasks": ["5.1", "6.1", "7.1"] },
    { "id": 4, "tasks": ["6.2"] },
    { "id": 5, "tasks": ["9.1", "9.2", "9.3", "9.4", "9.5", "9.6", "9.7"] },
    { "id": 6, "tasks": ["10.1", "10.2", "10.3", "10.4", "10.5"] }
  ]
}
```
