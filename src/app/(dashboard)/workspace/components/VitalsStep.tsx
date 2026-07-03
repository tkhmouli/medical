'use client';

import { useState, useEffect, useRef } from 'react';
import type { Role } from '@/lib/auth/permissions';
import type { VisitContextState, VisitContextAction } from './visit-context';

interface VitalsStepProps {
  state: VisitContextState;
  dispatch: React.Dispatch<VisitContextAction>;
  user: { id: string; role: Role };
}

/**
 * Vitals step — capture blood pressure, temperature, weight, height.
 * All fields optional. Auto-saves when navigating away.
 * Shows previous vitals for comparison.
 */
export function VitalsStep({ state, dispatch, user }: VitalsStepProps) {
  const [bloodPressure, setBloodPressure] = useState(state.vitals?.bloodPressure || '');
  const [temperatureC, setTemperatureC] = useState(state.vitals?.temperatureC || '');
  const [weightKg, setWeightKg] = useState(state.vitals?.weightKg?.toString() || '');
  const [heightCm, setHeightCm] = useState(state.vitals?.heightCm?.toString() || '');
  const [previousVitals, setPreviousVitals] = useState<{
    bloodPressure?: string; temperatureC?: string; weightKg?: number; heightCm?: number; date?: string;
  } | null>(null);

  // Refs for auto-save on unmount
  const bpRef = useRef(bloodPressure);
  const tempRef = useRef(temperatureC);
  const weightRef = useRef(weightKg);
  const heightRef = useRef(heightCm);
  bpRef.current = bloodPressure;
  tempRef.current = temperatureC;
  weightRef.current = weightKg;
  heightRef.current = heightCm;

  // Fetch previous vitals
  useEffect(() => {
    if (!state.patient) return;
    const today = new Date().toISOString().split('T')[0];
    fetch(`/api/appointments/calendar?startDate=2020-01-01&endDate=${today}`)
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (!data?.data) return;
        const currentApptId = state.appointment?.id;
        const prev = data.data
          .filter((a: any) => a.patientId === state.patient!.id && a.id !== currentApptId && (a.bloodPressure || a.weightKg || a.heightCm || a.temperatureC))
          .sort((a: any, b: any) => b.date.localeCompare(a.date));
        if (prev.length > 0) {
          setPreviousVitals({
            bloodPressure: prev[0].bloodPressure,
            temperatureC: prev[0].temperatureC,
            weightKg: prev[0].weightKg,
            heightCm: prev[0].heightCm,
            date: prev[0].date,
          });
        }
      })
      .catch(() => {});
  }, [state.patient, state.appointment]);

  // Auto-save on unmount (navigate away)
  useEffect(() => {
    return () => {
      const vitalsData: any = {};
      if (bpRef.current.trim()) vitalsData.bloodPressure = bpRef.current.trim();
      if (tempRef.current.trim()) vitalsData.temperatureC = tempRef.current.trim();
      if (weightRef.current.trim()) vitalsData.weightKg = parseInt(weightRef.current);
      if (heightRef.current.trim()) vitalsData.heightCm = parseInt(heightRef.current);

      const hasData = Object.keys(vitalsData).length > 0;

      if (hasData) {
        dispatch({ type: 'SET_VITALS', payload: vitalsData });
        if (state.appointment) {
          fetch(`/api/appointments/${state.appointment.id}/vitals`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(vitalsData),
          }).catch(() => {});
        }
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-gray-900">Vital Signs</h2>
      <p className="mt-1 text-sm text-gray-500">
        All fields optional — auto-saved when you move to the next step.
      </p>

      {/* Previous vitals comparison */}
      {previousVitals && (
        <div className="mt-4 rounded-md border border-amber-100 bg-amber-50 p-4">
          <p className="text-xs font-semibold text-amber-700 mb-2">Previous Visit ({previousVitals.date})</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="flex items-center gap-2">
              <span>❤️</span>
              <span className="text-sm text-amber-900">{previousVitals.bloodPressure || '—'}</span>
            </div>
            <div className="flex items-center gap-2">
              <span>🌡️</span>
              <span className="text-sm text-amber-900">{previousVitals.temperatureC ? `${previousVitals.temperatureC}°C` : '—'}</span>
            </div>
            <div className="flex items-center gap-2">
              <span>⚖️</span>
              <span className="text-sm text-amber-900">{previousVitals.weightKg ? `${previousVitals.weightKg}kg` : '—'}</span>
            </div>
            <div className="flex items-center gap-2">
              <span>📏</span>
              <span className="text-sm text-amber-900">{previousVitals.heightCm ? `${previousVitals.heightCm}cm` : '—'}</span>
            </div>
          </div>
        </div>
      )}

      {/* Input fields */}
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-gray-700">❤️ Blood Pressure</label>
          <input
            type="text"
            value={bloodPressure}
            onChange={(e) => setBloodPressure(e.target.value)}
            placeholder="120/80"
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">🌡️ Temperature (°C)</label>
          <input
            type="text"
            value={temperatureC}
            onChange={(e) => setTemperatureC(e.target.value)}
            placeholder="37.0"
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">⚖️ Weight (kg)</label>
          <input
            type="number"
            value={weightKg}
            onChange={(e) => setWeightKg(e.target.value)}
            placeholder="70"
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">📏 Height (cm)</label>
          <input
            type="number"
            value={heightCm}
            onChange={(e) => setHeightCm(e.target.value)}
            placeholder="175"
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
      </div>
    </div>
  );
}
