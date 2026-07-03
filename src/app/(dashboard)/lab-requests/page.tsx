'use client';

import { useState } from 'react';

interface LabTemplate {
  id: string;
  name: string;
  tests: string[];
}

const DEFAULT_TEMPLATES: LabTemplate[] = [
  { id: '1', name: 'Bilan sanguin complet', tests: ['NFS', 'VS', 'CRP', 'Glycemie', 'Creatinine', 'Uree', 'Acide urique'] },
  { id: '2', name: 'Bilan renal', tests: ['Creatinine', 'Uree', 'Ionogramme', 'ECBU', 'Proteinurie 24h'] },
  { id: '3', name: 'Bilan prostatique', tests: ['PSA total', 'PSA libre', 'Testosterone', 'ECBU'] },
  { id: '4', name: 'Bilan pre-operatoire', tests: ['NFS', 'TP', 'TCA', 'Groupe sanguin', 'ECG', 'Radio thorax'] },
  { id: '5', name: 'ECBU simple', tests: ['ECBU'] },
  { id: '6', name: 'Imagerie urologique', tests: ['Echographie renale et vesicale', 'UIV'] },
];

/**
 * Lab Requests page — manage lab test templates for quick prescription.
 * Templates can be used in the workspace workflow to quickly generate lab request PDFs.
 */
export default function LabRequestsPage() {
  const [templates] = useState<LabTemplate[]>(DEFAULT_TEMPLATES);
  const [selectedTemplate, setSelectedTemplate] = useState<LabTemplate | null>(null);
  const [customTests, setCustomTests] = useState('');

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Lab Requests</h1>
          <p className="mt-1 text-sm text-gray-600">
            Pre-configured lab test templates. Select a template to preview or create custom requests.
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
                onClick={() => setSelectedTemplate(template)}
                className={`w-full rounded-lg border p-3 text-left transition-colors ${
                  selectedTemplate?.id === template.id
                    ? 'border-blue-500 bg-blue-50 text-blue-900'
                    : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                <p className="text-sm font-medium">{template.name}</p>
                <p className="text-xs text-gray-500 mt-0.5">{template.tests.length} tests</p>
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
                <h3 className="text-sm font-medium text-gray-700 mb-2">Tests included:</h3>
                <ul className="space-y-1">
                  {selectedTemplate.tests.map((test, idx) => (
                    <li key={idx} className="flex items-center gap-2 text-sm text-gray-700">
                      <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-medium">
                        {idx + 1}
                      </span>
                      {test}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Custom tests */}
              <div className="mt-6">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Additional tests (one per line):
                </label>
                <textarea
                  value={customTests}
                  onChange={(e) => setCustomTests(e.target.value)}
                  rows={3}
                  placeholder="Add custom tests here..."
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <p className="mt-4 text-xs text-gray-500">
                These templates are used in the Workspace workflow to quickly generate lab request PDFs with the clinic header and signature area.
              </p>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-12 text-center">
              <p className="text-sm text-gray-500">Select a template to preview</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
