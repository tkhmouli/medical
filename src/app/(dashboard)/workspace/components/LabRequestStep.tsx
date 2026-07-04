'use client';

import { useState, useEffect, useRef } from 'react';
import type { Role } from '@/lib/auth/permissions';
import type { VisitContextState, VisitContextAction } from './visit-context';

interface LabRequestStepProps {
  state: VisitContextState;
  dispatch: React.Dispatch<VisitContextAction>;
  user: { id: string; name: string; role: Role };
}

const LAB_TEMPLATES = [
  { id: '1', name: 'Bilan sanguin complet', tests: ['NFS', 'VS', 'CRP', 'Glycemie', 'Creatinine', 'Uree', 'Acide urique'] },
  { id: '2', name: 'Bilan renal', tests: ['Creatinine', 'Uree', 'Ionogramme', 'ECBU', 'Proteinurie 24h'] },
  { id: '3', name: 'Bilan prostatique', tests: ['PSA total', 'PSA libre', 'Testosterone', 'ECBU'] },
  { id: '4', name: 'Bilan pre-operatoire', tests: ['NFS', 'TP', 'TCA', 'Groupe sanguin', 'ECG', 'Radio thorax'] },
  { id: '5', name: 'ECBU simple', tests: ['ECBU'] },
  { id: '6', name: 'Imagerie', tests: ['Echographie renale et vesicale'] },
];

/**
 * Lab Request step — select tests from templates or add custom ones.
 * Generate a printable lab request PDF.
 */
export function LabRequestStep({ state, dispatch, user }: LabRequestStepProps) {
  const [selectedTests, setSelectedTests] = useState<string[]>([]);
  const [customTest, setCustomTest] = useState('');
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const testsRef = useRef(selectedTests);
  const stateRef = useRef(state);
  testsRef.current = selectedTests;
  stateRef.current = state;

  // Auto-save lab tests when navigating away
  useEffect(() => {
    return () => {
      const tests = testsRef.current;
      const currentState = stateRef.current;
      if (tests.length > 0 && currentState.appointment) {
        fetch(`/api/appointments/${currentState.appointment.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ labTests: JSON.stringify(tests) }),
          keepalive: true,
        }).catch(() => {});
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Load existing lab tests from appointment
  useEffect(() => {
    if (!state.appointment) return;
    fetch(`/api/appointments/calendar?startDate=${state.appointment.date}&endDate=${state.appointment.date}`)
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (!data?.data) return;
        const appt = data.data.find((a: any) => a.id === state.appointment!.id);
        if (appt?.labTests) {
          try {
            const parsed = JSON.parse(appt.labTests);
            if (Array.isArray(parsed) && parsed.length > 0) {
              setSelectedTests(parsed);
            }
          } catch {}
        }
      })
      .catch(() => {});
  }, [state.appointment]);

  const addTemplate = (tests: string[]) => {
    setSelectedTests(prev => {
      const merged = new Set([...prev, ...tests]);
      return Array.from(merged);
    });
  };

  const removeTest = (test: string) => {
    setSelectedTests(prev => prev.filter(t => t !== test));
  };

  const addCustomTest = () => {
    if (customTest.trim() && !selectedTests.includes(customTest.trim())) {
      setSelectedTests(prev => [...prev, customTest.trim()]);
      setCustomTest('');
    }
  };

  const handlePrint = async () => {
    if (selectedTests.length === 0) return;
    setGeneratingPdf(true);
    try {
      const response = await fetch('/api/lab-request/pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientName: state.patient ? `${state.patient.firstName} ${state.patient.lastName}` : 'Unknown',
          doctorName: user.name,
          date: state.appointment?.date || new Date().toISOString().split('T')[0],
          tests: selectedTests,
        }),
      });
      if (response.ok) {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
      }
    } catch {
      // Silent fail
    } finally {
      setGeneratingPdf(false);
    }
  };

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-50 text-xl">🧪</div>
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Lab Request</h2>
          <p className="text-sm text-gray-500">Select tests from templates or add custom. Optional step.</p>
        </div>
      </div>

      {/* Templates */}
      <div className="mt-4">
        <p className="text-xs font-semibold text-gray-600 mb-2">Quick templates:</p>
        <div className="flex flex-wrap gap-2">
          {LAB_TEMPLATES.map(template => (
            <button
              key={template.id}
              type="button"
              onClick={() => addTemplate(template.tests)}
              className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100 transition-colors"
            >
              + {template.name}
            </button>
          ))}
        </div>
      </div>

      {/* Custom test input */}
      <div className="mt-4 flex gap-2">
        <input
          type="text"
          value={customTest}
          onChange={(e) => setCustomTest(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addCustomTest()}
          placeholder="Add custom test..."
          className="flex-1 rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        <button
          type="button"
          onClick={addCustomTest}
          disabled={!customTest.trim()}
          className="rounded-md bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-200 disabled:opacity-50"
        >
          Add
        </button>
      </div>

      {/* Selected tests */}
      {selectedTests.length > 0 && (
        <div className="mt-4 rounded-md border border-green-100 bg-green-50 p-4">
          <p className="text-xs font-semibold text-green-700 mb-2">Selected tests ({selectedTests.length}):</p>
          <div className="flex flex-wrap gap-2">
            {selectedTests.map((test, idx) => (
              <span
                key={idx}
                className="inline-flex items-center gap-1 rounded-full bg-white border border-green-200 px-2.5 py-1 text-xs text-green-800"
              >
                {test}
                <button
                  type="button"
                  onClick={() => removeTest(test)}
                  className="ml-0.5 text-green-500 hover:text-red-500"
                  aria-label={`Remove ${test}`}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Print button */}
      {selectedTests.length > 0 && (
        <div className="mt-4">
          <button
            type="button"
            onClick={handlePrint}
            disabled={generatingPdf}
            className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-emerald-500 to-emerald-600 px-5 py-2.5 text-sm font-medium text-white shadow-md shadow-emerald-200 hover:from-emerald-600 hover:to-emerald-700 disabled:opacity-50 disabled:shadow-none transition-all"
          >
            🖨️ {generatingPdf ? 'Generating...' : 'Print Lab Request'}
          </button>
        </div>
      )}
    </div>
  );
}
