# Requirements Document

## Introduction

This feature introduces a Unified Patient Workflow — a single-page workspace that consolidates the entire patient encounter into one view. Currently, clinic staff must navigate between separate pages (patient registration, appointment booking, visit notes, prescription creation, PDF export, and visit history) to complete a patient encounter. The Unified Patient Workflow eliminates context switching by providing an integrated, step-based workspace where all clinical actions flow sequentially without page navigation. The workspace supports the full lifecycle: registering or selecting a patient, booking an appointment, documenting visit notes, writing prescriptions, generating prescription PDFs, and reviewing visit history — all within one persistent context.

## Glossary

- **Workspace**: The unified single-page view that hosts all patient encounter steps (route: `/workspace`)
- **Encounter**: A complete patient session comprising patient selection/registration, appointment booking, visit notes, prescription creation, and PDF generation
- **Workflow_Step**: A discrete phase within the Workspace (Patient, Appointment, Visit Notes, Prescription, PDF, History)
- **Step_Panel**: The UI panel that displays the content and form for the active Workflow_Step
- **Step_Indicator**: A visual navigation element showing all Workflow_Steps with their completion status
- **Patient_Step**: The first Workflow_Step where a patient is selected from existing records or registered as new
- **Appointment_Step**: The Workflow_Step where an appointment is booked for the selected patient
- **Visit_Notes_Step**: The Workflow_Step where clinical notes are attached to the current appointment
- **Prescription_Step**: The Workflow_Step where medications are prescribed for the current visit
- **PDF_Step**: The Workflow_Step where the prescription PDF is generated and downloaded
- **History_Step**: The Workflow_Step where past visits, notes, and prescriptions are displayed for the selected patient
- **Platform**: The complete SaaS clinic management application
- **Tenant**: A single clinic organization registered on the Platform, isolated by subdomain
- **Admin**: A user role with full access to all Platform features
- **Doctor**: A user role with access to patient records, appointments, financial data, and prescriptions
- **Medical_Assistant**: A user role with access to patient management, appointments, and reminders, but restricted from prescriptions and financial data
- **Patient_Selector**: A searchable dropdown component for finding existing patients by name or phone
- **Doctor_Selector**: A dropdown listing active doctors within the current Tenant
- **Visit_Context**: The in-memory state object that tracks the selected patient, appointment, visit notes, and prescription data across all Workflow_Steps within a single Encounter

## Requirements

### Requirement 1: Workspace Layout and Navigation

**User Story:** As a clinic staff member, I want a single-page workspace with a step-based layout, so that I can complete an entire patient encounter without navigating between separate pages.

#### Acceptance Criteria

1. THE Workspace SHALL display a Step_Indicator showing all available Workflow_Steps (Patient, Appointment, Visit Notes, Prescription, PDF, History) with visually distinct indicators for current, completed, and upcoming steps such that each state is distinguishable from the other two without relying on color alone.
2. THE Workspace SHALL render one Step_Panel at a time corresponding to the active Workflow_Step.
3. WHEN a user submits the active Workflow_Step's form and the submission is validated and saved without errors, THE Workspace SHALL automatically advance to the next sequential visible Workflow_Step and update the Step_Indicator to mark the completed step.
4. WHEN a user clicks a completed step in the Step_Indicator, THE Workspace SHALL navigate back to that step and display its previously entered data in read-only mode.
5. IF a user clicks an upcoming (not yet completed) step in the Step_Indicator, THEN THE Workspace SHALL remain on the current active Workflow_Step and not navigate to the clicked step.
6. THE Workspace SHALL maintain a Visit_Context object that persists all entered data (patient, appointment, notes, prescription) across Workflow_Steps within the same Encounter session, where the session begins when the Workspace route is loaded and ends when the user navigates away from the Workspace route or closes the browser tab.
7. WHEN a user navigates to the Workspace route, THE Workspace SHALL initialize with the Patient_Step as the active Workflow_Step and an empty Visit_Context.
8. WHEN a user with the Medical_Assistant role accesses the Workspace, THE Step_Indicator SHALL hide the Prescription and PDF Workflow_Steps from the navigation, and automatic step advancement SHALL skip directly from Visit Notes to History.
9. IF the user attempts to navigate away from the Workspace route while the Visit_Context contains unsaved data from at least one completed step, THEN THE Workspace SHALL display a confirmation prompt warning that in-progress encounter data will be lost.

### Requirement 2: Patient Step — Selection and Registration

**User Story:** As a clinic staff member, I want to either search for an existing patient or register a new one directly within the workspace, so that I can begin the encounter without leaving the page.

#### Acceptance Criteria

1. THE Patient_Step SHALL display two modes selectable via a toggle control: a "Search Existing" mode with a Patient_Selector and a "Register New" mode with a patient registration form, with "Search Existing" as the default active mode.
2. WHEN a user types at least 2 characters into the Patient_Selector in "Search Existing" mode, THE Platform SHALL display a filtered list of up to 20 matching patients from the current Tenant within 500 milliseconds, matching on first name, last name, or phone number (case-insensitive, partial match).
3. WHEN a user selects a patient from the Patient_Selector, THE Patient_Step SHALL populate the Visit_Context with the selected patient's identifier and display the patient's full name, phone number, and date of birth as confirmation.
4. WHEN a user switches to "Register New" mode, THE Patient_Step SHALL display a registration form with required fields (first name, last name, date of birth in YYYY-MM-DD format, phone number, gender as male/female/other) and optional fields (secondary phone, CIN number, email, address, notes).
5. WHEN a user submits the registration form with valid data, THE Platform SHALL create the patient record in the database, populate the Visit_Context with the new patient's identifier, and display a confirmation with the patient's full name.
6. IF a user submits the registration form with invalid or missing required fields, THEN THE Platform SHALL display field-level validation errors indicating which fields failed validation and prevent submission.
7. WHEN a user completes patient selection or registration, THE Patient_Step SHALL enable the "Continue" action to advance to the Appointment_Step.
8. IF no patients match the search query in the Patient_Selector, THEN THE Platform SHALL display a "No patients found" message within the dropdown.
9. IF the patient search API call fails, THEN THE Platform SHALL display an error message indicating search is unavailable within the Patient_Selector dropdown and allow the user to retry.
10. IF the registration form submission fails due to a server error, THEN THE Platform SHALL display an error message indicating the registration could not be completed, preserve all entered form data, and allow the user to retry submission.

### Requirement 3: Appointment Step — Booking

**User Story:** As a clinic staff member, I want to book an appointment for the selected patient without leaving the workspace, so that I can immediately schedule the visit in context.

#### Acceptance Criteria

1. WHEN the Appointment_Step becomes active, THE Workspace SHALL display the selected patient's name from Visit_Context in a read-only header and pre-populate the patient field so that the patient cannot be changed within this step.
2. THE Appointment_Step SHALL display a Doctor_Selector listing all active doctors in the current Tenant, sorted alphabetically by full name.
3. WHEN only one active doctor exists in the current Tenant, THE Appointment_Step SHALL auto-select that doctor in the Doctor_Selector.
4. THE Appointment_Step SHALL display date (YYYY-MM-DD format, required), start time (HH:MM format, required), duration (integer between 5 and 480 minutes, required), and visit type (required, one of: new_visit, control_visit, follow_up) fields.
5. WHEN a user submits the appointment form with valid data, THE Platform SHALL create the appointment record in the database, store the appointment identifier in the Visit_Context, and advance to the Visit_Notes_Step.
6. IF the created appointment's time range (start time through start time plus duration) overlaps with an existing non-cancelled appointment for the same doctor on the same date, THEN THE Platform SHALL display a visible conflict warning indicating the overlap details and still create the appointment without blocking submission.
7. IF a user submits the appointment form with invalid or missing required fields, THEN THE Platform SHALL display field-level validation errors adjacent to the respective fields and prevent submission.
8. THE Appointment_Step SHALL display an optional "Skip" action that allows advancing to the Visit_Notes_Step without creating an appointment, storing a null appointment identifier in the Visit_Context.
9. IF the Doctor_Selector fails to load the list of doctors, THEN THE Appointment_Step SHALL display an error message indicating that doctors could not be loaded and SHALL disable appointment submission until the list is successfully retrieved.
10. IF no active doctors exist in the current Tenant, THEN THE Doctor_Selector SHALL display a message indicating that no doctors are available and SHALL disable appointment submission.

### Requirement 4: Visit Notes Step

**User Story:** As a Doctor, I want to add clinical notes during the visit directly in the workspace, so that my observations are attached to the appointment record without opening a separate form.

#### Acceptance Criteria

1. WHEN the Visit_Notes_Step becomes active and the Visit_Context contains a non-null appointment identifier, THE Workspace SHALL display the patient name and appointment details (date, time, visit type) from Visit_Context in a read-only header.
2. IF the Visit_Notes_Step becomes active and the Visit_Context contains a null appointment identifier, THEN THE Workspace SHALL display the patient name in a read-only header and indicate that no appointment is associated with this encounter.
3. THE Visit_Notes_Step SHALL display a multi-line text input for entering visit notes with a minimum height of 4 rows and a maximum length of 5000 characters.
4. WHEN a user enters text into the notes input and clicks "Save & Continue", THE Platform SHALL update the appointment record's notes field in the database with the entered text and advance to the Prescription_Step.
5. IF the user clicks "Save & Continue" and the notes text input is empty, THEN THE Platform SHALL advance to the Prescription_Step without updating the appointment record's notes field.
6. IF the Visit_Context contains a null appointment identifier (appointment was skipped), THEN THE Visit_Notes_Step SHALL store the notes in the Visit_Context without making a database update and advance to the Prescription_Step.
7. IF the database update for saving visit notes fails, THEN THE Platform SHALL display an error message indicating that the notes could not be saved and SHALL retain the entered text in the input, allowing the user to retry.
8. THE Visit_Notes_Step SHALL display a "Skip" action that advances to the Prescription_Step without storing the entered notes in the Visit_Context or the database.
9. WHEN a user with the Medical_Assistant role reaches the Visit_Notes_Step, THE Workspace SHALL advance directly to the History_Step after saving or skipping notes, bypassing the Prescription and PDF steps.

### Requirement 5: Prescription Step

**User Story:** As a Doctor or Admin, I want to create a prescription for the current visit within the workspace, so that I can prescribe medications without navigating to a separate page.

#### Acceptance Criteria

1. WHEN the Prescription_Step becomes active for a user with the Doctor role, THE Workspace SHALL auto-select the logged-in doctor as the prescribing physician in the Doctor_Selector while allowing the selection to be changed.
2. WHEN the Prescription_Step becomes active for a user with the Admin role, THE Workspace SHALL leave the Doctor_Selector empty and require manual selection before submission.
3. THE Prescription_Step SHALL display the medication catalog (active medications from the current Tenant) and allow adding between 1 and 20 medication items, each with medication selection, dosage (maximum 100 characters), frequency (maximum 100 characters), duration (maximum 100 characters), and optional instructions fields.
4. WHEN a user selects a medication that has default instructions configured, THE Prescription_Step SHALL auto-fill the instructions field with the medication's default instructions, allowing the user to edit or clear the auto-filled value.
5. WHEN a user submits the prescription form with valid data and the Visit_Context contains a non-null appointment identifier, THE Platform SHALL create the prescription record linked to the patient and appointment from Visit_Context, store the prescription identifier in the Visit_Context, and advance to the PDF_Step.
6. IF a user submits the prescription form with valid data and the Visit_Context contains a null appointment identifier (appointment was skipped), THEN THE Platform SHALL create the prescription record linked to the patient from Visit_Context without an appointment association, store the prescription identifier in the Visit_Context, and advance to the PDF_Step.
7. IF a user submits the prescription form with missing required fields (no doctor selected, no medication items added, or medication items with empty medication selection, dosage, frequency, or duration), THEN THE Platform SHALL display field-level validation errors adjacent to each invalid field and prevent submission.
8. THE Prescription_Step SHALL display a "Skip" action that advances to the PDF_Step without creating a prescription, storing a null prescription identifier in the Visit_Context.
9. IF the medication catalog fails to load or returns an empty list, THEN THE Prescription_Step SHALL display an error message indicating medications could not be loaded and SHALL disable prescription submission until the catalog is successfully retrieved.
10. WHEN a user with the Medical_Assistant role accesses the Workspace, THE Platform SHALL not render the Prescription_Step and skip it in the workflow sequence.

### Requirement 6: PDF Generation Step

**User Story:** As a Doctor or Admin, I want to generate and download the prescription PDF directly from the workspace, so that I can hand the prescription to the patient without navigating away.

#### Acceptance Criteria

1. WHEN the PDF_Step becomes active and the Visit_Context contains a non-null prescription identifier, THE Workspace SHALL display a "Generate PDF" button in an enabled state and a "Download PDF" button in a disabled state.
2. WHEN a user clicks "Generate PDF", THE Platform SHALL call the PDF generation API endpoint for the prescription identifier stored in Visit_Context, and upon successful response, SHALL enable the "Download PDF" button and disable the "Generate PDF" button.
3. WHEN a user clicks "Download PDF" after successful PDF generation, THE Platform SHALL fetch the prescription PDF from the API endpoint and trigger a browser file download with the filename format `prescription-{prescriptionId}.pdf`.
4. IF the Visit_Context contains a null prescription identifier (prescription was skipped), THEN THE PDF_Step SHALL display a message indicating no prescription was created and provide a "Continue to History" action that advances directly to the History_Step.
5. THE PDF_Step SHALL display a "Continue" action that advances to the History_Step; this action SHALL remain disabled until the user has either successfully downloaded the PDF or the prescription was skipped.
6. IF the PDF generation API call fails, THEN THE Platform SHALL display an error message indicating the PDF could not be generated, keep the "Generate PDF" button enabled, and allow the user to retry up to 3 attempts before disabling the button and displaying a message to contact support.
7. WHILE the PDF generation or download API call is in progress, THE PDF_Step SHALL display a loading indicator and disable the "Generate PDF" and "Download PDF" buttons until the call completes or fails.
8. WHEN a user with the Medical_Assistant role accesses the Workspace, THE Platform SHALL not render the PDF_Step and skip it in the workflow sequence.

### Requirement 7: Visit History Step

**User Story:** As a clinic staff member, I want to see all past visits, notes, and prescriptions for the selected patient within the same workspace, so that I have full clinical context without opening another page.

#### Acceptance Criteria

1. WHEN the History_Step becomes active, THE Workspace SHALL fetch and display the visit history for the patient identified in Visit_Context, showing each visit's date, visit type, doctor name, and notes, limited to the most recent 50 visits.
2. THE History_Step SHALL display visits sorted by date in descending order (most recent first).
3. WHEN a user with the Admin or Doctor role views the History_Step, THE Workspace SHALL display prescription records associated with each visit, including medication names, dosages, and creation dates.
4. WHEN a user with the Medical_Assistant role views the History_Step, THE Workspace SHALL hide prescription details from the visit history display.
5. THE History_Step SHALL display a "New Encounter" action visible to all roles.
6. WHEN a user clicks the "New Encounter" action, THE Workspace SHALL clear all Visit_Context data and return to the Patient_Step with all Workflow_Steps reset to their initial empty state.
7. THE History_Step SHALL display a patient classification badge showing "first-time visitor" when the visit history count for the patient is exactly 1, and "returning patient" when the visit history count is 2 or more.
8. IF the visit history fetch fails, THEN THE Workspace SHALL display an error message indicating that visit history could not be loaded and provide a retry action.
9. IF the patient identified in Visit_Context has no prior visits, THEN THE History_Step SHALL display an empty state message indicating no visit history exists for this patient.

### Requirement 8: Access Control and Role Enforcement

**User Story:** As a clinic administrator, I want the workspace to enforce role-based access rules, so that Medical Assistants cannot access prescriptions or financial data through the unified view.

#### Acceptance Criteria

1. THE Workspace SHALL be accessible to users with Admin, Doctor, or Medical_Assistant roles within their authenticated Tenant.
2. IF a user with the Medical_Assistant role accesses the Workspace, THEN THE Platform SHALL restrict the workflow sequence to Patient_Step, Appointment_Step, Visit_Notes_Step, and History_Step only, and SHALL not render the Prescription_Step or PDF_Step in the Step_Indicator.
3. IF a user with the Medical_Assistant role accesses the Workspace, THEN THE Platform SHALL not render any prescription-related UI elements including medication forms, prescription history details within the History_Step, and PDF generation controls.
4. THE Workspace SHALL scope all data queries (patients, appointments, prescriptions, medications) to the authenticated user's Tenant, preventing cross-tenant data access.
5. IF an unauthenticated user attempts to access the Workspace route, THEN THE Platform SHALL redirect the user to the login page without displaying Workspace content.
6. IF an authenticated user whose role is not Admin, Doctor, or Medical_Assistant attempts to access the Workspace route, THEN THE Platform SHALL redirect the user to the main dashboard page.

### Requirement 9: State Persistence Within Session

**User Story:** As a Doctor, I want the workspace to preserve my entered data if I navigate between completed steps, so that I do not lose work when reviewing previous entries.

#### Acceptance Criteria

1. THE Visit_Context SHALL retain all entered data (patient selection, appointment details, visit notes, prescription items) in-memory for as long as the Workspace component remains mounted (i.e., until the user navigates away from the Workspace route or refreshes the browser).
2. WHEN a user navigates back to a completed step using the Step_Indicator, THE Workspace SHALL display the previously entered data in read-only mode with all form fields disabled, preventing modifications to previously submitted data.
3. WHEN a user clicks "New Encounter" on the History_Step, THE Workspace SHALL clear all Visit_Context data, reset all Workflow_Steps to their initial empty state, and set the Patient_Step as the active step.
4. IF a user refreshes the browser while on the Workspace, THEN THE Platform SHALL reset the Visit_Context and return to the Patient_Step with all fields empty, as the workflow state is maintained in-memory only.
5. IF a user navigates away from the Workspace route (e.g., via sidebar navigation) and later returns, THEN THE Workspace SHALL initialize a fresh Visit_Context starting at the Patient_Step, as prior in-memory state is not preserved across route changes.

### Requirement 10: Workspace Responsiveness and Internationalization

**User Story:** As a clinic staff member, I want the workspace to work on different screen sizes and in my language, so that I can use it on various devices and in the locale configured for my clinic.

#### Acceptance Criteria

1. THE Workspace SHALL render all Step_Panels in a responsive layout that adapts to viewport widths from 768px (tablet) to 1920px (desktop) using fluid scaling so that no horizontal scrollbar appears and all form fields remain fully visible and usable.
2. THE Workspace SHALL use translation keys from the next-intl message catalog for all user-visible static text including labels, button text, error messages, placeholder text, and step names, with no hardcoded display strings in component source.
3. THE Step_Indicator SHALL collapse into a compact horizontal format on viewport widths below 1024px while maintaining step navigation functionality such that all available steps remain tappable and the current step remains visually distinguished.
4. IF the viewport width is below 768px, THEN THE Workspace SHALL still render all content in a single-column stacked layout without loss of functionality.
