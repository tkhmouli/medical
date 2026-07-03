'use client';

import { useState, useEffect, useRef } from 'react';
import type { Role } from '@/lib/auth/permissions';
import type { VisitContextState, VisitContextAction } from './visit-context';

interface CompteRenduStepProps {
  state: VisitContextState;
  dispatch: React.Dispatch<VisitContextAction>;
  user: { id: string; name: string; role: Role };
}

/**
 * Compte Rendu step — doctor writes a visit summary report.
 * Auto-saves when navigating away. Templates available for quick pre-fill.
 */

const CR_TEMPLATES = [
  {
    id: '1',
    name: '📋 Consultation standard',
    content: `Motif de consultation: 

Antecedents: 

Examen clinique:
- Toucher rectal: 
- Appareil urinaire: 

Examens complementaires:


Conclusion: 

Conduite a tenir:
- 
- Controle dans `,
  },
  {
    id: '2',
    name: '🏥 Post-operatoire',
    content: `Suites operatoires: 

Examen:
- Cicatrice: 
- Sonde: 
- Douleur: EVA /10

Consignes:
- 
- Prochain RDV: `,
  },
  {
    id: '3',
    name: '🔬 Bilan initial',
    content: `Premier bilan urologique.

Motif: 

Bilan demande:
- Biologie: 
- Imagerie: 

Orientation diagnostique: 

Prochain RDV apres resultats.`,
  },
];

export function CompteRenduStep({ state, dispatch, user }: CompteRenduStepProps) {
  const [text, setText] = useState(state.compteRendu || '');
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const textRef = useRef(text);
  const stateRef = useRef(state);
  textRef.current = text;
  stateRef.current = state;

  // Auto-save compte rendu when navigating away
  useEffect(() => {
    return () => {
      const currentText = textRef.current.trim();
      const currentState = stateRef.current;
      if (currentText && currentState.appointment) {
        fetch(`/api/appointments/${currentState.appointment.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ compteRendu: currentText }),
          keepalive: true,
        }).catch(() => {});
      }
      if (currentText) {
        dispatch({ type: 'SET_COMPTE_RENDU', payload: currentText });
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleGeneratePdf = async () => {
    if (!text.trim()) return;
    setGeneratingPdf(true);
    try {
      // Open the PDF in a new tab for printing (no file download)
      const response = await fetch('/api/compte-rendu/pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientName: state.patient ? `${state.patient.firstName} ${state.patient.lastName}` : 'Unknown',
          doctorName: user.name,
          date: state.appointment?.date || new Date().toISOString().split('T')[0],
          compteRendu: text.trim(),
          visitNotes: state.visitNotes || '',
          prescriptionItems: state.prescriptionItems,
          vitals: state.vitals,
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
    <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      {/* Header with icon */}
      <div className="flex items-center gap-3">
        <span className="text-2xl">📋</span>
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Compte Rendu</h2>
          <p className="text-sm text-gray-500">Visit summary — auto-saved. Use references below while writing.</p>
        </div>
      </div>

      {/* Templates */}
      <div className="mt-4">
        <p className="text-xs font-semibold text-gray-600 mb-2">Quick templates:</p>
        <div className="flex flex-wrap gap-2">
          {CR_TEMPLATES.map(template => (
            <button
              key={template.id}
              type="button"
              onClick={() => setText(prev => prev ? prev + '\n\n' + template.content : template.content)}
              className="rounded-full border border-purple-200 bg-purple-50 px-3 py-1 text-xs font-medium text-purple-700 hover:bg-purple-100 transition-colors"
            >
              {template.name}
            </button>
          ))}
        </div>
      </div>

      {/* Reference panels — notes, meds, vitals */}
      <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-3">
        {/* Visit notes */}
        <div className="rounded-md border border-blue-100 bg-blue-50 p-3">
          <p className="text-xs font-semibold text-blue-700 mb-1">📝 Notes</p>
          {state.visitNotes ? (
            <p className="text-xs text-blue-900 whitespace-pre-wrap line-clamp-6">{state.visitNotes}</p>
          ) : (
            <p className="text-xs text-blue-500 italic">No notes</p>
          )}
        </div>

        {/* Medications */}
        <div className="rounded-md border border-purple-100 bg-purple-50 p-3">
          <p className="text-xs font-semibold text-purple-700 mb-1">💊 Medications</p>
          {state.prescriptionItems.length > 0 ? (
            <ul className="space-y-0.5">
              {state.prescriptionItems.map((item, idx) => (
                <li key={idx} className="text-xs text-purple-900">
                  <span className="font-medium">{item.medicationName}</span>
                  <span className="text-purple-600"> · {item.dosage} · {item.frequency}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-purple-500 italic">No meds prescribed</p>
          )}
        </div>

        {/* Vitals */}
        <div className="rounded-md border border-indigo-100 bg-indigo-50 p-3">
          <p className="text-xs font-semibold text-indigo-700 mb-1">🏥 Vitals</p>
          {state.vitals ? (
            <div className="space-y-0.5 text-xs text-indigo-900">
              <p>❤️ {state.vitals.bloodPressure || '—'}</p>
              <p>🌡️ {state.vitals.temperatureC ? `${state.vitals.temperatureC}°C` : '—'}</p>
              <p>⚖️ {state.vitals.weightKg ? `${state.vitals.weightKg}kg` : '—'}</p>
              <p>📏 {state.vitals.heightCm ? `${state.vitals.heightCm}cm` : '—'}</p>
            </div>
          ) : (
            <p className="text-xs text-indigo-500 italic">No vitals</p>
          )}
        </div>
      </div>

      {/* Compte rendu text area */}
      <div className="mt-5">
        <textarea
          id="compte-rendu-input"
          className="w-full rounded-md border border-gray-300 p-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          rows={8}
          maxLength={10000}
          placeholder="Write the visit summary here...&#10;&#10;Motif, findings, diagnosis, treatment plan, follow-up..."
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <p className="mt-1 text-right text-xs text-gray-400">
          {text.length} / 10000
        </p>
      </div>

      {/* Print button */}
      <div className="mt-4">
        <button
          type="button"
          onClick={handleGeneratePdf}
          disabled={!text.trim() || generatingPdf}
          className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
        >
          {generatingPdf ? 'Generating...' : '🖨️ Print Compte Rendu'}
        </button>
      </div>
    </div>
  );
}
