# Requirements Document

## Introduction

Redesign of the doctor dashboard to provide an at-a-glance operational view of the clinic day. The dashboard displays today's and tomorrow's schedules, real-time waiting room and patients-seen counters, a date picker for historical schedule viewing, financial statistics (YTD, monthly, weekly) gated by role permissions, and contextual widgets for weather and local time. Implementation is split into two phases: Phase 1 covers schedule display, counters, date picker, and appointment status field; Phase 2 covers financial statistics, weather, and time widgets.

## Glossary

- **Dashboard**: The main landing page of the authenticated clinic application, rendered at the root route of the dashboard layout.
- **Appointment_Status**: An enum field on the appointments table with values: scheduled, waiting, in_progress, completed.
- **Waiting_Room_Counter**: A numeric display showing the count of today's appointments with Appointment_Status equal to "waiting" for the logged-in doctor.
- **Patients_Seen_Counter**: A numeric display showing the count of today's appointments with Appointment_Status equal to "completed" for the logged-in doctor.
- **Polling_Interval**: The time period between automatic data refresh requests, set between 30 and 60 seconds.
- **Financial_Widget**: A dashboard section displaying revenue summaries (YTD, monthly, weekly) derived from financial entries.
- **Weather_Widget**: A dashboard section displaying current weather conditions fetched from an external weather API (OpenWeatherMap free tier) via a server-side route.
- **RoleGate**: The existing permission component that conditionally renders UI based on the user role and feature access.
- **Doctor**: A user with role "Doctor" who has access to all dashboard features including financials.
- **Medical_Assistant**: A user with role "Medical_Assistant" who has access to all dashboard features except financials.

## Requirements

### Requirement 1: Appointment Status Field

**User Story:** As a clinic administrator, I want appointments to have a status field, so that the system can track appointment lifecycle stages for dashboard counters.

#### Acceptance Criteria

1. THE Appointment_Status field SHALL store one of the following values: scheduled, waiting, in_progress, completed.
2. WHEN a new appointment is created, THE Appointment_Status field SHALL default to "scheduled".
3. WHEN the Appointment_Status field is updated, THE Dashboard SHALL reflect the change on the next Polling_Interval cycle.

### Requirement 2: Today's Schedule Display

**User Story:** As a doctor, I want to see today's appointment schedule on the dashboard, so that I know how the current day is looking.

#### Acceptance Criteria

1. WHEN the Dashboard loads, THE Dashboard SHALL display a list of non-cancelled appointments for the current date, sorted by start time in ascending order.
2. THE Dashboard SHALL display for each appointment: patient name, start time, duration, visit type, and Appointment_Status.
3. WHILE no appointments exist for the current date, THE Dashboard SHALL display an empty state message indicating no appointments are scheduled for today.

### Requirement 3: Tomorrow's Schedule Display

**User Story:** As a doctor, I want to see tomorrow's appointment schedule on the dashboard, so that I can prepare for the next day.

#### Acceptance Criteria

1. WHEN the Dashboard loads, THE Dashboard SHALL display a list of non-cancelled appointments for the next calendar day, sorted by start time in ascending order.
2. THE Dashboard SHALL display for each appointment in the tomorrow section: patient name, start time, duration, and visit type.
3. WHILE no appointments exist for the next calendar day, THE Dashboard SHALL display an empty state message indicating no appointments are scheduled for tomorrow.

### Requirement 4: Date Picker for Schedule Viewing

**User Story:** As a doctor, I want to select any date and see the schedule for that date, so that I can review past or future appointments.

#### Acceptance Criteria

1. THE Dashboard SHALL provide a date picker control that allows selection of any calendar date.
2. WHEN a date is selected via the date picker, THE Dashboard SHALL display non-cancelled appointments for the selected date, sorted by start time in ascending order.
3. WHEN the date picker selection is cleared, THE Dashboard SHALL revert to displaying today's and tomorrow's schedules.

### Requirement 5: Waiting Room Counter

**User Story:** As a doctor, I want to see how many patients are currently in the waiting room, so that I can manage my workflow.

#### Acceptance Criteria

1. THE Dashboard SHALL display the Waiting_Room_Counter showing the count of today's appointments with Appointment_Status equal to "waiting" for the logged-in doctor.
2. THE Dashboard SHALL refresh the Waiting_Room_Counter value by polling the server at an interval between 30 and 60 seconds.
3. WHEN the Waiting_Room_Counter value changes between polls, THE Dashboard SHALL update the displayed count without requiring a full page reload.

### Requirement 6: Patients Seen Counter

**User Story:** As a doctor, I want to see how many patients I have seen so far today, so that I can track my daily progress.

#### Acceptance Criteria

1. THE Dashboard SHALL display the Patients_Seen_Counter showing the count of today's appointments with Appointment_Status equal to "completed" for the logged-in doctor.
2. THE Dashboard SHALL refresh the Patients_Seen_Counter value by polling the server at an interval between 30 and 60 seconds.
3. WHEN the Patients_Seen_Counter value changes between polls, THE Dashboard SHALL update the displayed count without requiring a full page reload.

### Requirement 7: Financial Statistics Display

**User Story:** As a doctor, I want to see revenue statistics on the dashboard, so that I can monitor the financial health of my practice.

#### Acceptance Criteria

1. THE Financial_Widget SHALL display total revenue for the year-to-date period (January 1 of the current year through the current date).
2. THE Financial_Widget SHALL display total revenue for the current calendar month.
3. THE Financial_Widget SHALL display total revenue for the current calendar week (Monday through Sunday).
4. THE Financial_Widget SHALL display the total number of patients seen year-to-date.
5. WHEN the Dashboard loads, THE Financial_Widget SHALL fetch and display current financial data from the financial service.

### Requirement 8: Role-Based Financial Visibility

**User Story:** As a clinic owner, I want financial data hidden from medical assistants, so that sensitive revenue information is only visible to authorized roles.

#### Acceptance Criteria

1. WHILE the logged-in user has the role "Doctor", THE Dashboard SHALL display the Financial_Widget.
2. WHILE the logged-in user has the role "Medical_Assistant", THE Dashboard SHALL hide the Financial_Widget entirely.
3. THE Dashboard SHALL use the existing RoleGate component and hasPermission function with the "financial" feature to enforce visibility rules.

### Requirement 9: Weather Widget

**User Story:** As a doctor, I want to see current weather conditions on the dashboard, so that I have contextual awareness without leaving the application.

#### Acceptance Criteria

1. THE Weather_Widget SHALL display the current temperature, weather condition description, and an appropriate weather icon.
2. THE Weather_Widget SHALL fetch weather data from a server-side API route that proxies requests to the OpenWeatherMap free tier API.
3. IF the weather API request fails, THEN THE Weather_Widget SHALL display a fallback message indicating weather data is unavailable.
4. THE Weather_Widget SHALL refresh weather data at a maximum frequency of once every 30 minutes to respect API rate limits.

### Requirement 10: Local Time Display

**User Story:** As a doctor, I want to see the current local time on the dashboard, so that I have a quick time reference while working.

#### Acceptance Criteria

1. THE Dashboard SHALL display the current local time in HH:MM format, updating every minute.
2. THE Dashboard SHALL display the current date alongside the time in a human-readable format (day of week, month, day number).

### Requirement 11: Phased Implementation Structure

**User Story:** As a development team member, I want the feature split into two phases, so that core functionality is delivered first with enhancements following.

#### Acceptance Criteria

1. THE Phase 1 implementation SHALL include: Appointment_Status field, today's schedule, tomorrow's schedule, date picker, Waiting_Room_Counter, and Patients_Seen_Counter.
2. THE Phase 2 implementation SHALL include: Financial_Widget, Weather_Widget, and local time display.
3. THE Phase 1 Dashboard SHALL render and function correctly without any Phase 2 components present.
