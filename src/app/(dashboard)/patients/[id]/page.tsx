'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { useToast } from '@/components/NotificationToast';
import type { Role } from '@/lib/auth/permissions';

// ----- Types -----

interface PatientData {
  id: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  phoneNumber: string;
  secondaryPhone?: string;
  cinNumber?: string;
  gender: 'male' | 'female' | 'other';
  email?: string;
  address?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

type InsuranceProviderType = 'CNSS' | 'CNOPS' | 'AXA' | 'Atlanta' | 'SAHAM' | 'RMA' | 'other';

interface InsuranceRecord {
  id: string;
  providerType: InsuranceProviderType;
  providerName?: string;
  membershipNumber: string;
  createdAt: string;
}

type VisitType = 'new_visit' | 'control_visit' | 'follow_up';

interface VisitRecord {
  appointmentId: string;
  date: string;
  visitType: VisitType;
  doctorName: string;
  notes?: string;
}

interface VisitHistoryResult {
  visits: VisitRecord[];
  totalCount: number;
  classification: 'first_time' | 'returning';
  lastVisitDate: string | null;
}

interface PrescriptionRecord {
  id: string;
  appointmentId: string;
  doctorId: string;
  doctorName?: string;
  notes?: string;
  createdAt: string;
  items?: Array<{
    id: string;
    medicationName: string;
    dosage: string;
    frequency: string;
    duration: string;
    instructions?: string;
  }>;
}

// ----- Constants -----

const INSURANCE_PROVIDER_OPTIONS: InsuranceProviderType[] = [
  'CNSS', 'CNOPS', 'AXA', 'Atlanta', 'SAHAM', 'RMA', 'other',
];

const VISIT_TYPE_LABELS: Record<VisitType, string> = {
  new_visit: 'New Visit',
  control_visit: 'Control Visit',
  follow_up: 'Follow-up',
};

const VISIT_TYPE_COLORS: Record<VisitType, string> = {
  new_visit: 'bg-blue-100 text-blue-800',
  control_visit: 'bg-purple-100 text-purple-800',
  follow_up: 'bg-amber-100 text-amber-800',
};

// ----- Main Page Component -----

/**
 * Patient detail page displaying demographics, insurance, visit history, and prescriptions.
 *
 * Requirements: 5.1, 5.2, 8.3, 8.4, 8.5, 11.1, 11.2, 12.6
 */
export default function PatientDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { showToast } = useToast();
  const patientId = params.id as string;

  const [patient, setPatient] = useState<PatientData | null>(null);
  const [insurances, setInsurances] = useState<InsuranceRecord[]>([]);
  const [visitHistory, setVisitHistory] = useState<VisitHistoryResult | null>(null);
  const [prescriptions, setPrescriptions] = useState<PrescriptionRecord[]>([]);
  const [userRole, setUserRole] = useState<Role | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch user session to determine role
  const fetchSession = useCallback(async (): Promise<Role | null> => {
    try {
      const response = await fetch('/api/auth/session');
      if (response.ok) {
        const data = await response.json();
        return data.data?.role ?? null;
      }
    } catch {
      // Session fetch failure handled by layout redirect
    }
    return null;
  }, []);

  // Fetch patient data
  const fetchPatient = useCallback(async () => {
    const response = await fetch(`/api/patients/${patientId}`);
    if (!response.ok) {
      throw new Error('Failed to load patient data');
    }
    const data = await response.json();
    return data.data as PatientData;
  }, [patientId]);

  // Fetch insurance records
  const fetchInsurances = useCallback(async () => {
    const response = await fetch(`/api/patients/${patientId}/insurances`);
    if (!response.ok) return [];
    const data = await response.json();
    return (data.data || []) as InsuranceRecord[];
  }, [patientId]);

  // Fetch visit history
  const fetchVisitHistory = useCallback(async () => {
    const response = await fetch(`/api/patients/${patientId}/visits`);
    if (!response.ok) return null;
    const data = await response.json();
    return data.data as VisitHistoryResult;
  }, [patientId]);

  // Fetch prescriptions (only for Admin/Doctor)
  const fetchPrescriptions = useCallback(async () => {
    const response = await fetch(`/api/patients/${patientId}/prescriptions`);
    if (!response.ok) return [];
    const data = await response.json();
    return (data.data || []) as PrescriptionRecord[];
  }, [patientId]);

  // Load all data
  useEffect(() => {
    async function loadData() {
      setLoading(true);
      setError(null);
      try {
        const role = await fetchSession();
        setUserRole(role);

        const [patientData, insuranceData, visitData] = await Promise.all([
          fetchPatient(),
          fetchInsurances(),
          fetchVisitHistory(),
        ]);

        setPatient(patientData);
        setInsurances(insuranceData);
        setVisitHistory(visitData);

        // Only fetch prescriptions if role allows (Admin or Doctor)
        if (role === 'Admin' || role === 'Doctor') {
          const prescriptionData = await fetchPrescriptions();
          setPrescriptions(prescriptionData);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [fetchSession, fetchPatient, fetchInsurances, fetchVisitHistory, fetchPrescriptions]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <LoadingSpinner label="Loading patient details..." />
      </div>
    );
  }

  if (error || !patient) {
    return (
      <div className="rounded-md border border-red-200 bg-red-50 p-6 text-center">
        <p className="text-sm text-red-700">{error || 'Patient not found'}</p>
        <Link href="/patients" className="mt-3 inline-block text-sm text-blue-600 hover:underline">
          ← Back to patients
        </Link>
      </div>
    );
  }

  return (
    <div>
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <Link href="/patients" className="text-sm text-gray-600 hover:text-gray-700">
            ← Patients
          </Link>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-gray-900">
            {patient.firstName} {patient.lastName}
          </h1>
          <div className="mt-1 flex items-center gap-2">
            {visitHistory && (
              <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                visitHistory.classification === 'returning'
                  ? 'bg-green-100 text-green-800'
                  : 'bg-blue-100 text-blue-800'
              }`}>
                {visitHistory.classification === 'returning' ? 'Returning Patient' : 'First-time Visitor'}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href={`/appointments/new?patientId=${patientId}`}
            className="inline-flex items-center rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
          >
            Book Appointment
          </Link>
          {(userRole === 'Admin' || userRole === 'Doctor') && (
            <Link
              href={`/prescriptions/new?patientId=${patientId}`}
              className="inline-flex items-center rounded-md bg-purple-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2"
            >
              New Prescription
            </Link>
          )}
          <Link
            href={`/patients/${patientId}/edit`}
            className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            Edit Patient
          </Link>
        </div>
      </div>

      {/* Content grid */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Demographics card */}
        <DemographicsCard patient={patient} />

        {/* Insurance manager */}
        <InsuranceManager
          patientId={patientId}
          insurances={insurances}
          onInsurancesChange={setInsurances}
          showToast={showToast}
        />
      </div>

      {/* Vital Signs & Current Medications */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <VitalSignsCard patientId={patientId} />
        <CurrentMedicationsCard patientId={patientId} />
      </div>

      {/* Visit history panel */}
      <div className="mt-6">
        <VisitHistoryPanel visitHistory={visitHistory} />
      </div>

      {/* Prescriptions section - only visible to Admin/Doctor */}
      {(userRole === 'Admin' || userRole === 'Doctor') && (
        <div className="mt-6">
          <PrescriptionsPanel prescriptions={prescriptions} patientId={patientId} />
        </div>
      )}
    </div>
  );
}


// ----- Demographics Card -----

function DemographicsCard({ patient }: { patient: PatientData }) {
  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  const genderLabel = (g: string) => g.charAt(0).toUpperCase() + g.slice(1);

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6">
      <h2 className="text-lg font-semibold text-gray-900">Demographics</h2>
      <dl className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <DetailItem label="First Name" value={patient.firstName} />
        <DetailItem label="Last Name" value={patient.lastName} />
        <DetailItem label="Date of Birth" value={formatDate(patient.dateOfBirth)} />
        <DetailItem label="Gender" value={genderLabel(patient.gender)} />
        <DetailItem label="Primary Phone" value={patient.phoneNumber} />
        {patient.secondaryPhone && (
          <DetailItem label="Secondary Phone" value={patient.secondaryPhone} />
        )}
        {patient.cinNumber && (
          <DetailItem label="CIN" value={patient.cinNumber} />
        )}
        {patient.email && (
          <DetailItem label="Email" value={patient.email} />
        )}
        {patient.address && (
          <DetailItem label="Address" value={patient.address} />
        )}
        {patient.notes && (
          <div className="sm:col-span-2">
            <DetailItem label="Notes" value={patient.notes} />
          </div>
        )}
      </dl>
    </div>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-gray-600">{label}</dt>
      <dd className="mt-1 text-sm text-gray-900">{value}</dd>
    </div>
  );
}

// ----- Insurance Manager -----

function InsuranceManager({
  patientId,
  insurances,
  onInsurancesChange,
  showToast,
}: {
  patientId: string;
  insurances: InsuranceRecord[];
  onInsurancesChange: (insurances: InsuranceRecord[]) => void;
  showToast: (type: 'success' | 'error', message: string) => void;
}) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [adding, setAdding] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<{
    providerType: InsuranceProviderType;
    providerName: string;
    membershipNumber: string;
  }>({
    providerType: 'CNSS',
    providerName: '',
    membershipNumber: '',
  });

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.membershipNumber.trim()) return;
    if (formData.providerType === 'other' && !formData.providerName.trim()) return;

    setAdding(true);
    try {
      const body: Record<string, string> = {
        providerType: formData.providerType,
        membershipNumber: formData.membershipNumber.trim(),
      };
      if (formData.providerType === 'other') {
        body.providerName = formData.providerName.trim();
      }

      const response = await fetch(`/api/patients/${patientId}/insurances`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error?.message || 'Failed to add insurance');
      }

      const data = await response.json();
      onInsurancesChange([...insurances, data.data]);
      setFormData({ providerType: 'CNSS', providerName: '', membershipNumber: '' });
      setShowAddForm(false);
      showToast('success', 'Insurance record added');
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Failed to add insurance');
    } finally {
      setAdding(false);
    }
  };

  const handleRemove = async (insuranceId: string) => {
    setRemovingId(insuranceId);
    try {
      const response = await fetch(`/api/patients/${patientId}/insurances/${insuranceId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to remove insurance');
      }

      onInsurancesChange(insurances.filter((i) => i.id !== insuranceId));
      showToast('success', 'Insurance record removed');
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Failed to remove insurance');
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Insurance</h2>
        <button
          type="button"
          onClick={() => setShowAddForm(!showAddForm)}
          className="text-sm font-medium text-blue-600 hover:text-blue-800"
        >
          {showAddForm ? 'Cancel' : '+ Add'}
        </button>
      </div>

      {/* Add insurance form */}
      {showAddForm && (
        <form onSubmit={handleAdd} className="mt-4 space-y-3 rounded-md border border-gray-100 bg-gray-50 p-4">
          <div>
            <label htmlFor="providerType" className="block text-xs font-medium text-gray-700">
              Provider Type
            </label>
            <select
              id="providerType"
              value={formData.providerType}
              onChange={(e) => setFormData({ ...formData, providerType: e.target.value as InsuranceProviderType })}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              {INSURANCE_PROVIDER_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>{opt === 'other' ? 'Other' : opt}</option>
              ))}
            </select>
          </div>

          {formData.providerType === 'other' && (
            <div>
              <label htmlFor="providerName" className="block text-xs font-medium text-gray-700">
                Provider Name
              </label>
              <input
                id="providerName"
                type="text"
                value={formData.providerName}
                onChange={(e) => setFormData({ ...formData, providerName: e.target.value })}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="Insurance provider name"
                required
              />
            </div>
          )}

          <div>
            <label htmlFor="membershipNumber" className="block text-xs font-medium text-gray-700">
              Membership Number
            </label>
            <input
              id="membershipNumber"
              type="text"
              value={formData.membershipNumber}
              onChange={(e) => setFormData({ ...formData, membershipNumber: e.target.value })}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="Membership number"
              required
            />
          </div>

          <button
            type="submit"
            disabled={adding}
            className="inline-flex items-center rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {adding ? 'Adding...' : 'Add Insurance'}
          </button>
        </form>
      )}

      {/* Insurance list */}
      <div className="mt-4">
        {insurances.length === 0 ? (
          <p className="text-sm text-gray-600">No insurance records linked.</p>
        ) : (
          <ul className="space-y-2" role="list">
            {insurances.map((ins) => (
              <li
                key={ins.id}
                className="flex items-center justify-between rounded-md border border-gray-100 bg-gray-50 px-4 py-3"
              >
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {ins.providerType === 'other' ? ins.providerName : ins.providerType}
                  </p>
                  <p className="text-xs text-gray-600">Member: {ins.membershipNumber}</p>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemove(ins.id)}
                  disabled={removingId === ins.id}
                  className="text-xs font-medium text-red-600 hover:text-red-800 disabled:opacity-50"
                  aria-label={`Remove insurance ${ins.providerType === 'other' ? ins.providerName : ins.providerType}`}
                >
                  {removingId === ins.id ? 'Removing...' : 'Remove'}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// ----- Visit History Panel -----

function VisitHistoryPanel({ visitHistory }: { visitHistory: VisitHistoryResult | null }) {
  if (!visitHistory) {
    return null;
  }

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Visit History</h2>
        <div className="flex items-center gap-3 text-sm text-gray-600">
          <span>{visitHistory.totalCount} total visit{visitHistory.totalCount !== 1 ? 's' : ''}</span>
          {visitHistory.lastVisitDate && (
            <span>Last: {formatDate(visitHistory.lastVisitDate)}</span>
          )}
        </div>
      </div>

      <div className="mt-4">
        {visitHistory.visits.length === 0 ? (
          <p className="text-sm text-gray-600">No visit history recorded.</p>
        ) : (
          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-4 top-0 bottom-0 w-px bg-gray-200" aria-hidden="true" />

            <ul className="space-y-4" role="list">
              {visitHistory.visits.map((visit) => (
                <li key={visit.appointmentId} className="relative flex gap-4 pl-10">
                  {/* Timeline dot */}
                  <div className="absolute left-2.5 top-1.5 h-3 w-3 rounded-full border-2 border-white bg-gray-400 ring-2 ring-gray-200" aria-hidden="true" />

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${VISIT_TYPE_COLORS[visit.visitType]}`}>
                        {VISIT_TYPE_LABELS[visit.visitType]}
                      </span>
                      <span className="text-xs text-gray-600">{formatDate(visit.date)}</span>
                    </div>
                    <p className="mt-1 text-sm text-gray-700">Dr. {visit.doctorName}</p>
                    {visit.notes && (
                      <p className="mt-0.5 text-xs text-gray-600">{visit.notes}</p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

// ----- Prescriptions Panel -----

function PrescriptionsPanel({
  prescriptions,
  patientId,
}: {
  prescriptions: PrescriptionRecord[];
  patientId: string;
}) {
  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Prescriptions</h2>
        <Link
          href={`/prescriptions/new?patientId=${patientId}`}
          className="text-sm font-medium text-blue-600 hover:text-blue-800"
        >
          + New Prescription
        </Link>
      </div>

      <div className="mt-4">
        {prescriptions.length === 0 ? (
          <p className="text-sm text-gray-600">No prescriptions recorded.</p>
        ) : (
          <ul className="divide-y divide-gray-100" role="list">
            {prescriptions.map((rx) => (
              <li key={rx.id} className="py-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {formatDate(rx.createdAt)}
                    </p>
                    {rx.doctorName && (
                      <p className="text-xs text-gray-600">By Dr. {rx.doctorName}</p>
                    )}
                    {rx.notes && (
                      <p className="mt-0.5 text-xs text-gray-600">{rx.notes}</p>
                    )}
                    {rx.items && rx.items.length > 0 && (
                      <p className="mt-0.5 text-xs text-gray-600">
                        {rx.items.length} medication{rx.items.length !== 1 ? 's' : ''}
                      </p>
                    )}
                  </div>
                  <Link
                    href={`/prescriptions/${rx.id}`}
                    className="text-xs font-medium text-blue-600 hover:text-blue-800"
                  >
                    View
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// ----- Vital Signs Card -----

function VitalSignsCard({ patientId }: { patientId: string }) {
  const [vitals, setVitals] = useState<{
    bloodPressure?: string;
    weightKg?: number;
    heightCm?: number;
    temperatureC?: string;
    date?: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    bloodPressure: '',
    temperatureC: '',
    weightKg: '',
    heightCm: '',
  });
  const [todayAppointmentId, setTodayAppointmentId] = useState<string | null>(null);

  useEffect(() => {
    async function fetchVitals() {
      try {
        const today = new Date().toISOString().split('T')[0];
        const apptResponse = await fetch(
          `/api/appointments/calendar?startDate=2020-01-01&endDate=${today}`
        );
        if (apptResponse.ok) {
          const apptData = await apptResponse.json();
          const allAppts = apptData.data || [];
          
          // Find today's appointment for this patient
          const todayAppt = allAppts.find((a: any) => a.patientId === patientId && a.date === today);
          if (todayAppt) {
            setTodayAppointmentId(todayAppt.id);
          }

          // Find latest appointment with vitals
          const withVitals = allAppts
            .filter((a: any) => a.patientId === patientId && (a.bloodPressure || a.weightKg || a.heightCm || a.temperatureC))
            .sort((a: any, b: any) => b.date.localeCompare(a.date));

          if (withVitals.length > 0) {
            const latest = withVitals[0];
            setVitals({
              bloodPressure: latest.bloodPressure || undefined,
              weightKg: latest.weightKg || undefined,
              heightCm: latest.heightCm || undefined,
              temperatureC: latest.temperatureC || undefined,
              date: latest.date,
            });
          }
        }
      } catch {
        // Silently fail
      } finally {
        setLoading(false);
      }
    }
    fetchVitals();
  }, [patientId]);

  const handleSaveVitals = async () => {
    if (!todayAppointmentId) return;
    setSaving(true);
    try {
      const body: Record<string, any> = {};
      if (formData.bloodPressure.trim()) body.bloodPressure = formData.bloodPressure.trim();
      if (formData.temperatureC.trim()) body.temperatureC = formData.temperatureC.trim();
      if (formData.weightKg.trim()) body.weightKg = parseInt(formData.weightKg);
      if (formData.heightCm.trim()) body.heightCm = parseInt(formData.heightCm);

      const response = await fetch(`/api/appointments/${todayAppointmentId}/vitals`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        const today = new Date().toISOString().split('T')[0];
        setVitals({
          bloodPressure: body.bloodPressure || vitals?.bloodPressure,
          weightKg: body.weightKg || vitals?.weightKg,
          heightCm: body.heightCm || vitals?.heightCm,
          temperatureC: body.temperatureC || vitals?.temperatureC,
          date: today,
        });
        setShowForm(false);
        setFormData({ bloodPressure: '', temperatureC: '', weightKg: '', heightCm: '' });
      }
    } catch {
      // Silently fail
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Vital Signs</h2>
        {todayAppointmentId && (
          <button
            type="button"
            onClick={() => setShowForm(!showForm)}
            className="text-sm font-medium text-blue-600 hover:text-blue-800"
          >
            {showForm ? 'Cancel' : '+ Record Vitals'}
          </button>
        )}
      </div>

      {/* Record vitals form */}
      {showForm && (
        <div className="mt-4 rounded-md border border-gray-100 bg-gray-50 p-4 space-y-3">
          <p className="text-xs text-gray-500 mb-2">Recording for today&apos;s appointment</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700">Blood Pressure</label>
              <input
                type="text"
                value={formData.bloodPressure}
                onChange={(e) => setFormData({ ...formData, bloodPressure: e.target.value })}
                placeholder="120/80"
                className="mt-1 block w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700">Temperature (°C)</label>
              <input
                type="text"
                value={formData.temperatureC}
                onChange={(e) => setFormData({ ...formData, temperatureC: e.target.value })}
                placeholder="37.0"
                className="mt-1 block w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700">Weight (kg)</label>
              <input
                type="number"
                value={formData.weightKg}
                onChange={(e) => setFormData({ ...formData, weightKg: e.target.value })}
                placeholder="70"
                className="mt-1 block w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700">Height (cm)</label>
              <input
                type="number"
                value={formData.heightCm}
                onChange={(e) => setFormData({ ...formData, heightCm: e.target.value })}
                placeholder="175"
                className="mt-1 block w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
              />
            </div>
          </div>
          <button
            type="button"
            onClick={handleSaveVitals}
            disabled={saving}
            className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Vitals'}
          </button>
        </div>
      )}

      {/* Display vitals */}
      {loading ? (
        <p className="mt-4 text-sm text-gray-500">Loading...</p>
      ) : vitals ? (
        <div className="mt-4">
          <p className="text-xs text-gray-500 mb-3">Last recorded: {vitals.date}</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-md bg-red-50 border border-red-100 p-3 text-center">
              <p className="text-xs text-red-600 font-medium">BP</p>
              <p className="mt-1 text-sm font-bold text-red-800">{vitals.bloodPressure || '—'}</p>
            </div>
            <div className="rounded-md bg-orange-50 border border-orange-100 p-3 text-center">
              <p className="text-xs text-orange-600 font-medium">Temp</p>
              <p className="mt-1 text-sm font-bold text-orange-800">{vitals.temperatureC ? `${vitals.temperatureC}°C` : '—'}</p>
            </div>
            <div className="rounded-md bg-blue-50 border border-blue-100 p-3 text-center">
              <p className="text-xs text-blue-600 font-medium">Weight</p>
              <p className="mt-1 text-sm font-bold text-blue-800">{vitals.weightKg ? `${vitals.weightKg} kg` : '—'}</p>
            </div>
            <div className="rounded-md bg-green-50 border border-green-100 p-3 text-center">
              <p className="text-xs text-green-600 font-medium">Height</p>
              <p className="mt-1 text-sm font-bold text-green-800">{vitals.heightCm ? `${vitals.heightCm} cm` : '—'}</p>
            </div>
          </div>
        </div>
      ) : (
        <p className="mt-4 text-sm text-gray-500">
          No vital signs recorded yet.
          {!todayAppointmentId && ' (No appointment today to record vitals against)'}
        </p>
      )}
    </div>
  );
}

// ----- Current Medications Card -----

function CurrentMedicationsCard({ patientId }: { patientId: string }) {
  const [medications, setMedications] = useState<Array<{
    name: string;
    dosage: string;
    frequency: string;
  }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchMeds() {
      try {
        const response = await fetch(`/api/patients/${patientId}/prescriptions`);
        if (response.ok) {
          const data = await response.json();
          const prescriptions = data.data || [];
          // Get medications from the most recent prescription
          if (prescriptions.length > 0) {
            const latest = prescriptions[0]; // Already sorted by most recent
            const items = latest.items || [];
            setMedications(items.map((item: any) => ({
              name: item.medicationName,
              dosage: item.dosage,
              frequency: item.frequency,
            })));
          }
        }
      } catch {
        // Silently fail
      } finally {
        setLoading(false);
      }
    }
    fetchMeds();
  }, [patientId]);

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6">
      <h2 className="text-lg font-semibold text-gray-900">Current Medications</h2>
      {loading ? (
        <p className="mt-4 text-sm text-gray-500">Loading...</p>
      ) : medications.length > 0 ? (
        <ul className="mt-4 space-y-2" role="list">
          {medications.map((med, idx) => (
            <li key={idx} className="rounded-md border border-gray-100 bg-gray-50 px-4 py-3">
              <p className="text-sm font-medium text-gray-900">{med.name}</p>
              <p className="text-xs text-gray-600">{med.dosage} · {med.frequency}</p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-sm text-gray-500">No current medications recorded.</p>
      )}
    </div>
  );
}
