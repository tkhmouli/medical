import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  boolean,
  integer,
  date,
  time,
  pgEnum,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';

// ─── Enums ────────────────────────────────────────────────────────────────────

export const roleEnum = pgEnum('role', ['Admin', 'Doctor', 'Medical_Assistant']);
export const visitTypeEnum = pgEnum('visit_type', ['new_visit', 'control_visit', 'follow_up']);
export const genderEnum = pgEnum('gender', ['male', 'female', 'other']);
export const insuranceProviderEnum = pgEnum('insurance_provider', [
  'CNSS',
  'CNOPS',
  'AXA',
  'Atlanta',
  'SAHAM',
  'RMA',
  'other',
]);
export const appointmentStatusEnum = pgEnum('appointment_status', [
  'scheduled',
  'waiting',
  'in_progress',
  'completed',
]);
export const reminderTypeEnum = pgEnum('reminder_type', ['follow_up', 'check_up', 'custom']);
export const reminderStatusEnum = pgEnum('reminder_status', ['pending', 'sent', 'dismissed']);

// ─── Tables ───────────────────────────────────────────────────────────────────

export const tenants = pgTable(
  'tenants',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: varchar('name', { length: 255 }).notNull(),
    subdomain: varchar('subdomain', { length: 63 }).notNull().unique(),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    subdomainIdx: uniqueIndex('tenants_subdomain_idx').on(table.subdomain),
  })
);

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id),
    email: varchar('email', { length: 255 }).notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    passwordHash: text('password_hash').notNull(),
    role: roleEnum('role').notNull(),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    tenantEmailIdx: uniqueIndex('users_tenant_email_idx').on(table.tenantId, table.email),
  })
);


export const sessions = pgTable(
  'sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id),
    token: text('token').notNull().unique(),
    expiresAt: timestamp('expires_at').notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => ({
    tokenIdx: uniqueIndex('sessions_token_idx').on(table.token),
    userIdIdx: index('sessions_user_id_idx').on(table.userId),
  })
);

export const patients = pgTable(
  'patients',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id),
    firstName: varchar('first_name', { length: 128 }).notNull(),
    lastName: varchar('last_name', { length: 128 }).notNull(),
    dateOfBirth: date('date_of_birth').notNull(),
    phoneNumber: varchar('phone_number', { length: 50 }).notNull(),
    secondaryPhone: varchar('secondary_phone', { length: 50 }),
    cinNumber: varchar('cin_number', { length: 50 }),
    gender: genderEnum('gender').notNull(),
    email: varchar('email', { length: 255 }),
    address: text('address'),
    notes: text('notes'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    tenantFirstNameIdx: index('patients_tenant_first_name_idx').on(table.tenantId, table.firstName),
    tenantLastNameIdx: index('patients_tenant_last_name_idx').on(table.tenantId, table.lastName),
    tenantPhoneIdx: index('patients_tenant_phone_idx').on(table.tenantId, table.phoneNumber),
    tenantDobIdx: index('patients_tenant_dob_idx').on(table.tenantId, table.dateOfBirth),
  })
);

export const patientInsurances = pgTable(
  'patient_insurances',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id),
    patientId: uuid('patient_id')
      .notNull()
      .references(() => patients.id, { onDelete: 'cascade' }),
    providerType: insuranceProviderEnum('provider_type').notNull(),
    providerName: varchar('provider_name', { length: 255 }),
    membershipNumber: varchar('membership_number', { length: 100 }).notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => ({
    tenantPatientIdx: index('patient_insurances_tenant_patient_idx').on(
      table.tenantId,
      table.patientId
    ),
  })
);

export const appointments = pgTable(
  'appointments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id),
    patientId: uuid('patient_id')
      .notNull()
      .references(() => patients.id, { onDelete: 'cascade' }),
    doctorId: uuid('doctor_id')
      .notNull()
      .references(() => users.id),
    date: date('date').notNull(),
    startTime: time('start_time').notNull(),
    duration: integer('duration').notNull(),
    visitType: visitTypeEnum('visit_type').notNull(),
    status: appointmentStatusEnum('status').notNull().default('scheduled'),
    isCancelled: boolean('is_cancelled').notNull().default(false),
    notes: text('notes'),
    bloodPressure: varchar('blood_pressure', { length: 20 }),
    weightKg: integer('weight_kg'),
    heightCm: integer('height_cm'),
    temperatureC: varchar('temperature_c', { length: 10 }),
    compteRendu: text('compte_rendu'),
    labTests: text('lab_tests'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    tenantDateIdx: index('appointments_tenant_date_idx').on(table.tenantId, table.date),
    tenantDoctorDateIdx: index('appointments_tenant_doctor_date_idx').on(
      table.tenantId,
      table.doctorId,
      table.date
    ),
    tenantPatientIdx: index('appointments_tenant_patient_idx').on(table.tenantId, table.patientId),
  })
);


export const medications = pgTable(
  'medications',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id),
    name: varchar('name', { length: 255 }).notNull(),
    dosageForm: varchar('dosage_form', { length: 100 }).notNull(),
    defaultInstructions: text('default_instructions'),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    tenantActiveIdx: index('medications_tenant_active_idx').on(table.tenantId, table.isActive),
  })
);

export const prescriptions = pgTable(
  'prescriptions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id),
    appointmentId: uuid('appointment_id')
      .notNull()
      .references(() => appointments.id),
    patientId: uuid('patient_id')
      .notNull()
      .references(() => patients.id, { onDelete: 'cascade' }),
    doctorId: uuid('doctor_id')
      .notNull()
      .references(() => users.id),
    notes: text('notes'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => ({
    tenantPatientIdx: index('prescriptions_tenant_patient_idx').on(
      table.tenantId,
      table.patientId
    ),
    tenantAppointmentIdx: index('prescriptions_tenant_appointment_idx').on(
      table.tenantId,
      table.appointmentId
    ),
  })
);

export const prescriptionItems = pgTable(
  'prescription_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    prescriptionId: uuid('prescription_id')
      .notNull()
      .references(() => prescriptions.id, { onDelete: 'cascade' }),
    medicationId: uuid('medication_id')
      .notNull()
      .references(() => medications.id),
    dosage: varchar('dosage', { length: 100 }).notNull(),
    frequency: varchar('frequency', { length: 100 }).notNull(),
    duration: varchar('duration', { length: 100 }).notNull(),
    instructions: text('instructions'),
  },
  (table) => ({
    prescriptionIdx: index('prescription_items_prescription_idx').on(table.prescriptionId),
  })
);

export const reminders = pgTable(
  'reminders',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id),
    patientId: uuid('patient_id')
      .notNull()
      .references(() => patients.id, { onDelete: 'cascade' }),
    targetDate: date('target_date').notNull(),
    reminderType: reminderTypeEnum('reminder_type').notNull(),
    customMessage: text('custom_message'),
    status: reminderStatusEnum('status').notNull().default('pending'),
    intervalDays: integer('interval_days').notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    tenantPatientIdx: index('reminders_tenant_patient_idx').on(table.tenantId, table.patientId),
    tenantStatusDateIdx: index('reminders_tenant_status_date_idx').on(
      table.tenantId,
      table.status,
      table.targetDate
    ),
  })
);

export const financialEntries = pgTable(
  'financial_entries',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id),
    appointmentId: uuid('appointment_id')
      .notNull()
      .references(() => appointments.id, { onDelete: 'cascade' }),
    amount: integer('amount').notNull(),
    paymentDate: date('payment_date').notNull(),
    notes: text('notes'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    tenantAppointmentIdx: index('financial_entries_tenant_appointment_idx').on(
      table.tenantId,
      table.appointmentId
    ),
    tenantPaymentDateIdx: index('financial_entries_tenant_payment_date_idx').on(
      table.tenantId,
      table.paymentDate
    ),
  })
);

// ─── Messages ─────────────────────────────────────────────────────────────────

export const messages = pgTable(
  'messages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id),
    senderId: uuid('sender_id')
      .notNull()
      .references(() => users.id),
    recipientId: uuid('recipient_id')
      .notNull()
      .references(() => users.id),
    content: text('content').notNull(),
    isRead: boolean('is_read').notNull().default(false),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => ({
    tenantRecipientIdx: index('messages_tenant_recipient_idx').on(table.tenantId, table.recipientId, table.createdAt),
    tenantSenderIdx: index('messages_tenant_sender_idx').on(table.tenantId, table.senderId, table.createdAt),
  })
);
