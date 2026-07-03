'use client';

import { useState } from 'react';

interface CRTemplate {
  id: string;
  name: string;
  content: string;
}

const DEFAULT_TEMPLATES: CRTemplate[] = [
  {
    id: '1',
    name: 'Consultation urologique standard',
    content: `Motif de consultation: [motif]

Antecedents: [antecedents]

Examen clinique:
- Toucher rectal: [normal/anormal]
- Appareil urinaire: [observations]

Examens complementaires:
- [resultats]

Conclusion: [diagnostic]

Conduite a tenir:
- [traitement]
- Controle dans [delai]`,
  },
  {
    id: '2',
    name: 'Post-operatoire',
    content: `Patient opere le [date] pour [intervention].

Suites operatoires: [simples/compliquees]

Examen a J[nombre]:
- Cicatrice: [etat]
- Sonde: [retiree/en place]
- Douleur: EVA [score]/10

Consignes:
- [instructions]
- Prochain RDV: [date]`,
  },
  {
    id: '3',
    name: 'Bilan initial',
    content: `Premier bilan urologique.

Motif: [symptomes]

Bilan demande:
- Biologie: [examens]
- Imagerie: [examens]

Orientation diagnostique: [hypotheses]

Prochain RDV apres resultats dans [delai].`,
  },
];

/**
 * Compte Rendu page — manage visit summary templates.
 * Templates help doctors quickly write standardized visit summaries.
 */
export default function CompteRenduPage() {
  const [templates] = useState<CRTemplate[]>(DEFAULT_TEMPLATES);
  const [selectedTemplate, setSelectedTemplate] = useState<CRTemplate | null>(null);
  const [editedContent, setEditedContent] = useState('');

  const handleSelectTemplate = (template: CRTemplate) => {
    setSelectedTemplate(template);
    setEditedContent(template.content);
  };

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Compte Rendu</h1>
          <p className="mt-1 text-sm text-gray-600">
            Visit summary templates. Use these in the workspace to speed up documentation.
          </p>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Template list */}
        <div className="lg:col-span-1">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Templates</h2>
          <div className="space-y-2">
            {templates.map((template) => (
              <button
                key={template.id}
                type="button"
                onClick={() => handleSelectTemplate(template)}
                className={`w-full rounded-lg border p-3 text-left transition-colors ${
                  selectedTemplate?.id === template.id
                    ? 'border-purple-500 bg-purple-50 text-purple-900'
                    : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                <p className="text-sm font-medium">{template.name}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Template preview / editor */}
        <div className="lg:col-span-2">
          {selectedTemplate ? (
            <div className="rounded-lg border border-gray-200 bg-white p-6">
              <h2 className="text-lg font-semibold text-gray-900">{selectedTemplate.name}</h2>
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Template content (edit placeholders in [brackets]):
                </label>
                <textarea
                  value={editedContent}
                  onChange={(e) => setEditedContent(e.target.value)}
                  rows={14}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-mono focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <p className="mt-3 text-xs text-gray-500">
                Fill in the [placeholders] during the workspace encounter. The completed text becomes the patient&apos;s compte rendu PDF.
              </p>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-12 text-center">
              <p className="text-sm text-gray-500">Select a template to preview and edit</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
