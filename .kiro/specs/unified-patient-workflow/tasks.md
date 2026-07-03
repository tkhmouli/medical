# Implementation Plan: Unified Patient Workflow

## Overview

Implement a single-page workspace at `/workspace` that consolidates the entire patient encounter into a step-based flow. The workspace uses a state machine pattern for step transitions, a `useReducer`-based Visit_Context for cross-step data persistence, and role-based step visibility. All data operations flow through existing API endpoints — no new database tables are required.

## Tasks

- [x] 1. Set up workspace route, context, and step machine logic
  - [x] 1.1 Create Visit_Context types, reducer, and step machine helpers
    - Create `src/app/(dashboard)/workspace/components/visit-context.ts`
    - Define `WorkflowStep`, `StepStatus`, `PatientInfo`, `AppointmentInfo`, `PrescriptionItemInfo`, `VisitContextState`, `VisitContextAction` types
    - Implement `visitContextReducer` handling all action types (SET_PATIENT, SET_APPOINTMENT, SKIP_APPOINTMENT, SET_VISIT_NOTES, SET_PRESCRIPTION, SKIP_PRESCRIPTION, SET_PDF_GENERATED, SET_PDF_DOWNLOADED, NAVIGATE_TO_STEP, ADVANCE_STEP, RESET)
    - Implement `getVisibleSteps(role)`, `getNextStep(currentStep, role)`, `getStepStatus(step, activeStep, completedSteps)` pure functions
    - Export `initialVisitContext` constant
    - _Requirements: 1.6, 1.7, 1.8, 8.2, 9.1, 9.3_

  - [ ]* 1.2 Write property tests for step machine and Visit_Context reducer
    - **Property 1: Step Advancement Produces Correct Next Visible Step**
    - **Property 2: Step Navigation Constraints**
    - **Property 3: Role-Based Step Visibility**
    - **Property 4: Visit_Context Data Integrity (Round-Trip)**
    - **Property 5: Visit_Context Reset**
    - **Validates: Requirements 1.3, 1.4, 1.5, 1.6, 1.8, 4.9, 5.10, 6.8, 7.6, 8.1, 8.2, 8.3, 9.1, 9.2, 9.3**

  - [x] 1.3 Create workspace page server component with auth check
    - Create `src/app/(dashboard)/workspace/page.tsx`
    - Implement server-side auth check: redirect unauthenticated users to login, redirect non-allowed roles to dashboard
    - Pass user object (id, name, email, role, tenantId) to WorkspaceClient
    - _Requirements: 8.4, 8.5, 8.6_

  - [x] 1.4 Create WorkspaceClient orchestrator component
    - Create `src/app/(dashboard)/workspace/components/WorkspaceClient.tsx`
    - Initialize `useReducer` with `visitContextReducer` and `initialVisitContext`
    - Compute `visibleSteps` from user role
    - Register `beforeunload` event listener when `completedSteps.size > 0`
    - Render StepIndicator and active Step Panel based on `state.activeStep`
    - _Requirements: 1.1, 1.2, 1.6, 1.7, 1.9, 9.1_

  - [x] 1.5 Create StepIndicator component
    - Create `src/app/(dashboard)/workspace/components/StepIndicator.tsx`
    - Render steps with visually distinct indicators: completed (checkmark icon, clickable), current (highlighted, ring border), upcoming (dimmed, numbered, not clickable)
    - Ensure states are distinguishable without color alone (icons, font weight, border patterns)
    - On click: navigate to completed steps only, ignore clicks on upcoming steps
    - Responsive: collapse to compact horizontal format below 1024px
    - Use translation keys from next-intl for all labels
    - _Requirements: 1.1, 1.4, 1.5, 10.3_

- [x] 2. Checkpoint - Ensure workspace foundation compiles
  - Ensure all tests pass, ask the user if questions arise.

- [x] 3. Implement Patient Step
  - [x] 3.1 Create PatientStep component with search and registration modes
    - Create `src/app/(dashboard)/workspace/components/PatientStep.tsx`
    - Implement toggle control between "Search Existing" (default) and "Register New" modes
    - In search mode: render PatientSelectorDropdown with 2-char minimum, debounced search, display up to 20 results within 500ms
    - On patient select: populate Visit_Context with patient info, display confirmation (name, phone, DOB)
    - Handle search API failure: show error in dropdown, allow retry
    - Handle "No patients found" state
    - In register mode: display form with required fields (firstName, lastName, dateOfBirth, phoneNumber, gender) and optional fields (secondaryPhone, cinNumber, email, address, notes)
    - On form submit: validate, call POST /api/patients, populate Visit_Context, show confirmation
    - Handle registration failure: preserve form data, show error, allow retry
    - Display "Continue" button enabled only after patient selected/registered
    - Use translation keys for all labels and messages
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9, 2.10_

  - [ ]* 3.2 Write property test for patient data validation
    - **Property 6: Patient Data Validation**
    - **Validates: Requirements 2.5, 2.6**

  - [x] 3.3 Create patient validation schema
    - Create Zod schema for patient registration validation in `src/app/(dashboard)/workspace/components/validation.ts`
    - Validate: firstName non-empty, lastName non-empty, dateOfBirth YYYY-MM-DD, phoneNumber non-empty, gender in [male, female, other]
    - Optional fields: secondaryPhone, cinNumber, email, address, notes
    - Return field-level error messages for each failing field
    - _Requirements: 2.5, 2.6_

- [x] 4. Implement Appointment Step
  - [x] 4.1 Create AppointmentStep component
    - Create `src/app/(dashboard)/workspace/components/AppointmentStep.tsx`
    - Display patient name from Visit_Context in read-only header
    - Render DoctorSelectorDropdown listing active doctors sorted alphabetically
    - Auto-select if only one doctor exists
    - Display form fields: date (YYYY-MM-DD), startTime (HH:MM), duration (5-480 integer), visitType (new_visit, control_visit, follow_up)
    - On submit: validate, call POST /api/appointments, check for overlap conflicts and display warning, store appointment in Visit_Context, advance
    - Handle doctor list load failure: disable submit, show error
    - Handle no active doctors: show message, disable submit
    - Display "Skip" action to advance without creating appointment (null appointment in context)
    - Use translation keys for all labels
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 3.10_

  - [ ]* 4.2 Write property tests for appointment validation and overlap detection
    - **Property 7: Appointment Data Validation**
    - **Property 8: Appointment Time Overlap Detection**
    - **Validates: Requirements 3.5, 3.6, 3.7**

  - [x] 4.3 Create appointment validation schema and overlap detection utility
    - Add appointment Zod schema to `src/app/(dashboard)/workspace/components/validation.ts`
    - Validate: date YYYY-MM-DD, startTime HH:MM, duration integer 5-480, visitType enum, doctorId non-empty
    - Implement `detectTimeOverlap(newAppt, existingAppts)` pure function
    - _Requirements: 3.5, 3.6, 3.7_

- [x] 5. Implement Visit Notes Step
  - [x] 5.1 Create VisitNotesStep component
    - Create `src/app/(dashboard)/workspace/components/VisitNotesStep.tsx`
    - Display patient name and appointment details (date, time, visit type) from Visit_Context in read-only header
    - If appointment was skipped: show patient name only with "no appointment" indicator
    - Render multi-line text input (min 4 rows, max 5000 chars)
    - "Save & Continue": if appointment exists, PATCH /api/appointments/{id} with notes; if skipped, store in Visit_Context only; advance to next step
    - Empty notes: advance without DB update
    - Role-based advancement: Medical_Assistant advances to History after notes
    - "Skip" action: advance without saving notes
    - Handle save failure: show error, preserve text, allow retry
    - Use translation keys for all labels
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 4.9_

- [x] 6. Implement Prescription Step
  - [x] 6.1 Create PrescriptionStep component
    - Create `src/app/(dashboard)/workspace/components/PrescriptionStep.tsx`
    - Auto-select logged-in doctor for Doctor role, leave empty for Admin
    - Fetch and display medication catalog (active medications from tenant)
    - Allow adding 1-20 medication items with fields: medication selection, dosage (≤100 chars), frequency (≤100 chars), duration (≤100 chars), optional instructions
    - Auto-fill instructions from medication's defaultInstructions when available
    - On submit: validate, call POST /api/prescriptions with patient and appointment from Visit_Context, store prescriptionId, advance
    - Handle null appointment: create prescription linked to patient only
    - Handle medication catalog load failure: disable submit, show error
    - "Skip" action: advance with null prescriptionId
    - Not rendered for Medical_Assistant role
    - Use translation keys for all labels
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8, 5.9, 5.10_

  - [ ]* 6.2 Write property test for prescription validation
    - **Property 9: Prescription Validation**
    - **Validates: Requirements 5.3, 5.7**

  - [x] 6.3 Create prescription validation schema
    - Add prescription Zod schema to `src/app/(dashboard)/workspace/components/validation.ts`
    - Validate: doctorId required, items array length 1-20, each item has medicationId non-empty, dosage non-empty ≤100, frequency non-empty ≤100, duration non-empty ≤100
    - Return field-level error messages
    - _Requirements: 5.3, 5.7_

- [x] 7. Checkpoint - Ensure core steps compile and pass tests
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Implement PDF Step
  - [x] 8.1 Create PdfStep component
    - Create `src/app/(dashboard)/workspace/components/PdfStep.tsx`
    - If prescriptionId is non-null: show "Generate PDF" (enabled) and "Download PDF" (disabled)
    - On "Generate PDF" click: call GET /api/prescriptions/{id}/pdf, on success enable Download and disable Generate
    - On "Download PDF" click: fetch PDF and trigger browser download with filename `prescription-{prescriptionId}.pdf`
    - If prescriptionId is null (skipped): show message and "Continue to History" action
    - "Continue" action disabled until PDF downloaded or prescription skipped
    - Retry logic: on generation failure, allow up to 3 retries then disable and show support message
    - Loading indicator during API calls
    - Not rendered for Medical_Assistant role
    - Use translation keys for all labels
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8_

  - [ ]* 8.2 Write property tests for PDF retry logic and filename format
    - **Property 10: PDF Retry Logic**
    - **Property 13: PDF Download Filename Format**
    - **Validates: Requirements 6.3, 6.6**

- [x] 9. Implement History Step
  - [x] 9.1 Create HistoryStep component
    - Create `src/app/(dashboard)/workspace/components/HistoryStep.tsx`
    - Fetch visit history for patient (GET /api/patients/{id}/visits), limit to 50 most recent
    - Display each visit: date, visit type, doctor name, notes
    - Sort by date descending (most recent first)
    - Admin/Doctor: show prescription records (medication names, dosages, creation dates) per visit
    - Medical_Assistant: hide prescription details
    - Display patient classification badge: "first-time visitor" (count = 1) or "returning patient" (count ≥ 2)
    - "New Encounter" action: dispatch RESET to clear Visit_Context, return to Patient_Step
    - Handle fetch failure: show error with retry button
    - Handle empty history: display "no visit history" message
    - Use translation keys for all labels
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8, 7.9_

  - [ ]* 9.2 Write property tests for visit history sort and patient classification
    - **Property 11: Visit History Sort Order**
    - **Property 12: Patient Classification Badge**
    - **Validates: Requirements 7.2, 7.7**

- [x] 10. Internationalization and responsive layout
  - [x] 10.1 Add translation keys for workspace
    - Add workspace-related translation keys to next-intl message catalogs (all supported locales)
    - Cover: step names, button labels, error messages, placeholder text, badges, tooltips
    - Ensure no hardcoded display strings remain in workspace components
    - _Requirements: 10.2_

  - [x] 10.2 Implement responsive layout adjustments
    - Ensure Step_Panels use fluid scaling from 768px to 1920px, no horizontal scrollbar
    - StepIndicator compact mode below 1024px
    - Single-column stacked layout below 768px
    - Verify all form fields remain visible and usable at all breakpoints
    - _Requirements: 10.1, 10.3, 10.4_

- [x] 11. Add sidebar navigation entry for workspace
  - [x] 11.1 Add workspace link to dashboard sidebar
    - Add `/workspace` link to the dashboard sidebar navigation
    - Ensure link is visible to Admin, Doctor, and Medical_Assistant roles
    - Use translation key for the link label
    - _Requirements: 8.1_

- [x] 12. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- All components reuse existing UI primitives (PatientSelectorDropdown, DoctorSelectorDropdown, LoadingSpinner, NotificationToast, RoleGate)
- No new database tables or API routes are required — all operations use existing endpoints
- The workspace uses in-memory state only (useReducer) — browser refresh resets the workflow

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.3", "3.3", "4.3", "6.3"] },
    { "id": 1, "tasks": ["1.2", "1.4", "1.5", "3.2", "4.2", "6.2"] },
    { "id": 2, "tasks": ["3.1", "4.1", "5.1", "6.1", "8.1"] },
    { "id": 3, "tasks": ["8.2", "9.1"] },
    { "id": 4, "tasks": ["9.2", "10.1", "10.2", "11.1"] }
  ]
}
```
