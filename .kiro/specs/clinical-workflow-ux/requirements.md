# Requirements Document

## Introduction

This feature improves the clinical workflow user experience in the clinic SaaS platform by replacing raw ID inputs with searchable selectors, adding contextual action buttons to the patient profile, enabling smart auto-selection of doctors, and providing seamless navigation between appointment creation and prescription generation. The goal is to reduce manual data entry, minimize user errors, and create a fluid clinical workflow from patient lookup through appointment booking to prescription writing.

## Glossary

- **Platform**: The complete SaaS clinic management application
- **Tenant**: A single clinic organization registered on the Platform, isolated by subdomain
- **Patient_Detail_Page**: The page displaying a specific patient's demographics, insurance, visit history, and prescriptions (route: `/patients/[id]`)
- **Appointment_Form**: The form used to create a new appointment (route: `/appointments/new`)
- **Prescription_Form**: The form used to create a new prescription (route: `/prescriptions/new`)
- **Patient_Selector**: A searchable dropdown component that allows users to find and select a patient by name or phone number
- **Doctor_Selector**: A dropdown component that lists users with the Doctor role within the current Tenant
- **Appointment_Selector**: A dropdown component listing appointments for a selected patient
- **Action_Button**: A prominent UI button placed on the Patient_Detail_Page to initiate a clinical workflow
- **Admin**: A user role with full access to all Platform features
- **Doctor**: A user role with access to patient records, appointments, financial data, and prescriptions
- **Medical_Assistant**: A user role with access to patient management, appointments, and reminders, but restricted from prescriptions and financial data
- **URL_Params**: Query string parameters passed in the browser URL to pre-fill form fields

## Requirements

### Requirement 1: Patient Profile Action Buttons

**User Story:** As a clinic staff member, I want quick-action buttons on the patient profile to book an appointment or create a prescription, so that I can start clinical workflows directly from the patient context without navigating away and re-selecting the patient.

#### Acceptance Criteria

1. WHEN a user with Admin, Doctor, or Medical_Assistant role views a Patient_Detail_Page, THE Platform SHALL display a "Book Appointment" Action_Button visible in the page header area.
2. WHEN a user with Admin or Doctor role views a Patient_Detail_Page, THE Platform SHALL display a "New Prescription" Action_Button visible in the page header area.
3. WHEN a user with the Medical_Assistant role views a Patient_Detail_Page, THE Platform SHALL hide the "New Prescription" Action_Button from the interface.
4. WHEN a user clicks the "Book Appointment" Action_Button, THE Platform SHALL navigate to the Appointment_Form URL with a `patientId` query parameter set to the current patient's identifier, and the Appointment_Form SHALL pre-fill the patient selection field with the corresponding patient name and prevent the user from changing the patient selection.
5. WHEN a user clicks the "New Prescription" Action_Button, THE Platform SHALL navigate to the Prescription_Form URL with a `patientId` query parameter set to the current patient's identifier, and the Prescription_Form SHALL pre-fill the patient selection field with the corresponding patient name and prevent the user from changing the patient selection.
6. IF the `patientId` query parameter on the Appointment_Form or Prescription_Form references a patient identifier that does not exist within the current Tenant, THEN THE Platform SHALL display an error message indicating the patient was not found and disable form submission.

### Requirement 2: Searchable Patient Selector on Appointment Form

**User Story:** As a clinic staff member, I want to search for patients by name or phone number when booking an appointment, so that I do not need to memorize or look up raw patient IDs.

#### Acceptance Criteria

1. THE Appointment_Form SHALL replace the raw text input for patient ID with a Patient_Selector component that supports searching by first name, last name, or phone number.
2. WHEN a user types at least 2 characters into the Patient_Selector on the Appointment_Form, THE Platform SHALL display a filtered list of up to 20 matching patients from the current Tenant within 500 milliseconds, where a patient matches if any of first name, last name, or phone number partially matches the query (case-insensitive).
3. WHEN a user selects a patient from the Patient_Selector dropdown, THE Appointment_Form SHALL populate the patient field with the selected patient's identifier and display the patient's full name.
4. WHEN the Appointment_Form loads with a `patientId` URL_Params value that corresponds to an existing patient in the current Tenant, THE Platform SHALL pre-select the corresponding patient in the Patient_Selector and display the patient's full name.
5. IF no patients match the search query in the Patient_Selector, THEN THE Platform SHALL display a "No patients found" message within the dropdown.
6. IF the Appointment_Form loads with a `patientId` URL_Params value that does not correspond to any patient in the current Tenant, THEN THE Platform SHALL leave the Patient_Selector empty and display an error message indicating the patient was not found.

### Requirement 3: Doctor Selector on Appointment Form

**User Story:** As a clinic staff member, I want to select a doctor from a dropdown list when booking an appointment, so that I do not need to know doctor IDs and can quickly assign the correct physician.

#### Acceptance Criteria

1. THE Appointment_Form SHALL replace the raw text input for doctor ID with a Doctor_Selector component that lists all users with the Doctor role and isActive status within the current Tenant.
2. WHEN a user opens the Doctor_Selector on the Appointment_Form, THE Platform SHALL display all active doctors in the current Tenant with their full name, sorted alphabetically by name.
3. WHEN only one active doctor exists in the current Tenant, THE Appointment_Form SHALL auto-select that doctor in the Doctor_Selector.
4. WHEN a user selects a doctor from the Doctor_Selector, THE Appointment_Form SHALL populate the doctor field with the selected doctor's user identifier.
5. IF the Doctor_Selector fails to load the list of doctors, THEN THE Appointment_Form SHALL display an error message indicating that doctors could not be loaded and SHALL disable appointment submission until the list is successfully retrieved.
6. IF no active doctors exist in the current Tenant, THEN THE Doctor_Selector SHALL display a message indicating that no doctors are available and SHALL disable appointment submission.

### Requirement 4: Searchable Patient Selector on Prescription Form

**User Story:** As a Doctor or Admin, I want to search for patients by name or phone number when writing a prescription, so that patient selection is fast and error-free.

#### Acceptance Criteria

1. THE Prescription_Form SHALL replace the plain select element for patient selection with a Patient_Selector component that supports searching by first name, last name, or phone number using partial (contains) matching.
2. WHEN a user types at least 2 characters into the Patient_Selector on the Prescription_Form, THE Platform SHALL display a filtered list of up to 50 matching patients from the current Tenant within 500 milliseconds.
3. WHEN a user selects a patient from the Patient_Selector on the Prescription_Form, THE Platform SHALL populate the patient field, clear any previously selected appointment, and refresh the Appointment_Selector to show only appointments belonging to the selected patient.
4. WHEN the Prescription_Form loads with a `patientId` URL_Params value that corresponds to an existing patient in the current Tenant, THE Platform SHALL pre-select the corresponding patient in the Patient_Selector and load that patient's appointments into the Appointment_Selector.
5. IF no patients match the search query in the Patient_Selector on the Prescription_Form, THEN THE Platform SHALL display a "No patients found" message within the dropdown.
6. IF the Prescription_Form loads with a `patientId` URL_Params value that does not correspond to any patient in the current Tenant, THEN THE Platform SHALL leave the Patient_Selector empty and display an error message indicating the patient was not found.
7. WHEN a user clears the Patient_Selector on the Prescription_Form, THE Platform SHALL reset the Appointment_Selector to its default empty state and clear any previously selected appointment.

### Requirement 5: Doctor Selector on Prescription Form

**User Story:** As a Doctor, I want the prescription form to automatically select me as the prescribing doctor, so that I can save time and avoid selecting myself manually on every prescription.

#### Acceptance Criteria

1. THE Prescription_Form SHALL include a Doctor_Selector component that lists all active users with the Doctor role within the current Tenant, displaying each doctor's full name.
2. WHEN the logged-in user has the Doctor role, THE Prescription_Form SHALL auto-select the logged-in user in the Doctor_Selector upon page load, while allowing the user to change the selection to a different doctor from the list.
3. WHEN the logged-in user has the Admin role, THE Prescription_Form SHALL leave the Doctor_Selector unselected and require manual selection before form submission.
4. WHEN a user selects a doctor from the Doctor_Selector on the Prescription_Form, THE Platform SHALL associate the selected doctor as the prescribing physician for the Prescription.
5. IF a user attempts to submit the Prescription_Form without selecting a doctor in the Doctor_Selector, THEN THE Platform SHALL prevent submission and display an error message indicating that a prescribing doctor is required.
6. IF no users with the Doctor role exist within the current Tenant, THEN THE Prescription_Form SHALL display the Doctor_Selector as empty and prevent form submission with an error message indicating no doctors are available.

### Requirement 6: Appointment Selector on Prescription Form

**User Story:** As a Doctor or Admin, I want to link a prescription to a specific appointment from a dropdown, so that prescriptions are properly associated with the clinical visit context.

#### Acceptance Criteria

1. THE Prescription_Form SHALL display an Appointment_Selector listing non-cancelled appointments for the currently selected patient, sorted by date in descending order (most recent first).
2. WHEN a patient is selected in the Patient_Selector on the Prescription_Form, THE Appointment_Selector SHALL update to display only non-cancelled appointments belonging to that patient, showing date, time, and visit type for each entry, and clear any previously selected appointment value.
3. WHEN no patient is selected on the Prescription_Form, THE Appointment_Selector SHALL be disabled and display a "Select a patient first" placeholder.
4. WHEN the Prescription_Form loads with an `appointmentId` URL_Params value that corresponds to a valid, non-cancelled appointment belonging to the selected patient, THE Platform SHALL pre-select that appointment in the Appointment_Selector.
5. IF the selected patient has no non-cancelled appointments, THEN THE Appointment_Selector SHALL display a "No appointments found for this patient" message.
6. IF the Prescription_Form loads with an `appointmentId` URL_Params value that does not correspond to a valid appointment for the selected patient, THEN THE Appointment_Selector SHALL remain unselected.

### Requirement 7: Clinical Flow Navigation

**User Story:** As a clinic staff member, I want to be offered a direct link to create a prescription after booking an appointment, so that I can continue the clinical workflow without navigating back and re-selecting the patient and appointment.

#### Acceptance Criteria

1. WHEN an appointment is created successfully by a user with the Admin or Doctor role, THE Platform SHALL display a "Create Prescription" link on the success confirmation view.
2. WHEN a user clicks the "Create Prescription" link after appointment creation, THE Platform SHALL navigate to the Prescription_Form with both `patientId` and `appointmentId` URL_Params pre-filled from the newly created appointment.
3. IF the user who created the appointment has the Medical_Assistant role, THEN THE Platform SHALL hide the "Create Prescription" link from the success confirmation view.
4. IF the Prescription_Form is loaded with a `patientId` or `appointmentId` URL_Param that does not correspond to an existing record in the current Tenant, THEN THE Platform SHALL display an error message indicating the referenced record was not found and prevent form submission.
