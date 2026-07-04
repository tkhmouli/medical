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
    name: 'Consultation standard',
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
    name: 'Post-operatoire',
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
    name: 'Bilan initial',
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
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      {/* Header with icon */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-50">
          <svg className="w-5 h-5 text-purple-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 9.776c.112-.017.227-.026.344-.026h15.812c.117 0 .232.009.344.026m-16.5 0a2.25 2.25 0 00-1.883 2.542l.857 6a2.25 2.25 0 002.227 1.932H19.05a2.25 2.25 0 002.227-1.932l.857-6a2.25 2.25 0 00-1.883-2.542m-16.5 0V6A2.25 2.25 0 016 3.75h3.879a1.5 1.5 0 011.06.44l2.122 2.12a1.5 1.5 0 001.06.44H18A2.25 2.25 0 0120.25 9v.776" /></svg>
        </div>
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
          <p className="text-xs font-semibold text-blue-700 mb-1">Notes</p>
          {state.visitNotes ? (
            <p className="text-xs text-blue-900 whitespace-pre-wrap line-clamp-6">{state.visitNotes}</p>
          ) : (
            <p className="text-xs text-blue-500 italic">No notes</p>
          )}
        </div>

        {/* Medications */}
        <div className="rounded-md border border-purple-100 bg-purple-50 p-3">
          <p className="text-xs font-semibold text-purple-700 mb-1">Medications</p>
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
          <p className="text-xs font-semibold text-indigo-700 mb-1">Vitals</p>
          {state.vitals ? (
            <div className="space-y-0.5 text-xs text-indigo-900">
              <p>BP: {state.vitals.bloodPressure || '—'}</p>
              <p>Temp: {state.vitals.temperatureC ? `${state.vitals.temperatureC}°C` : '—'}</p>
              <p>Wt: {state.vitals.weightKg ? `${state.vitals.weightKg}kg` : '—'}</p>
              <p>Ht: {state.vitals.heightCm ? `${state.vitals.heightCm}cm` : '—'}</p>
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
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          <svg className="w-4 h-4 inline-block mr-1" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0110.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0l.229 2.523a1.125 1.125 0 01-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0021 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 00-1.913-.247M6.34 18H5.25A2.25 2.25 0 013 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 011.913-.247m10.5 0a48.536 48.536 0 00-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008H18V10.5zm-3 0h.008v.008H15V10.5z" /></svg>
          {generatingPdf ? 'Generating...' : 'Print Compte Rendu'}
        </button>
      </div>
    </div>
  );
}
