'use client';

import { useState, useEffect } from 'react';

interface CRTemplate {
  id: string;
  name: string;
  content: string;
  isCustom?: boolean;
}

interface CRHistoryItem {
  appointmentId: string;
  patientName: string;
  date: string;
  compteRendu: string;
}

const DEFAULT_TEMPLATES: CRTemplate[] = [
  {
    id: '1',
    name: '📋 Consultation standard',
    content: `Motif de consultation: \n\nAntecedents: \n\nExamen clinique:\n- Toucher rectal: \n- Appareil urinaire: \n\nExamens complementaires:\n\nConclusion: \n\nConduite a tenir:\n- \n- Controle dans `,
  },
  {
    id: '2',
    name: '🏥 Post-operatoire',
    content: `Suites operatoires: \n\nExamen:\n- Cicatrice: \n- Sonde: \n- Douleur: EVA /10\n\nConsignes:\n- \n- Prochain RDV: `,
  },
  {
    id: '3',
    name: '🔬 Bilan initial',
    content: `Premier bilan urologique.\n\nMotif: \n\nBilan demande:\n- Biologie: \n- Imagerie: \n\nOrientation diagnostique: \n\nProchain RDV apres resultats.`,
  },
];

const STORAGE_KEY = 'clinic-cr-templates';

export default function CompteRenduPage() {
  const [tab, setTab] = useState<'templates' | 'history'>('templates');
  const [templates, setTemplates] = useState<CRTemplate[]>(DEFAULT_TEMPLATES);
  const [history, setHistory] = useState<CRHistoryItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<CRTemplate | null>(null);

  // New template form
  const [showNewForm, setShowNewForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newContent, setNewContent] = useState('');

  // Load custom templates
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const custom = JSON.parse(saved) as CRTemplate[];
        setTemplates([...DEFAULT_TEMPLATES, ...custom]);
      }
    } catch {}
  }, []);

  // Fetch history
  useEffect(() => {
    if (tab !== 'history') return;
    fetchHistory();
  }, [tab]);

  const fetchHistory = async () => {
    setLoadingHistory(true);
    try {
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - 12);
      const response = await fetch(
        `/api/appointments/calendar?startDate=${startDate.toISOString().split('T')[0]}&endDate=${new Date().toISOString().split('T')[0]}`
      );
      if (response.ok) {
        const data = await response.json();
        const appts = (data.data || []).filter((a: any) => a.compteRendu);
        const patientIds = [...new Set(appts.map((a: any) => a.patientId))];
        const patientMap: Record<string, string> = {};
        await Promise.all(
          patientIds.slice(0, 20).map(async (id: string) => {
            try {
              const res = await fetch(`/api/patients/${id}`);
              if (res.ok) {
                const d = await res.json();
                if (d.data) patientMap[id] = `${d.data.firstName} ${d.data.lastName}`;
              }
            } catch {}
          })
        );
        const items: CRHistoryItem[] = appts.map((a: any) => ({
          appointmentId: a.id,
          patientName: patientMap[a.patientId] || 'Unknown',
          date: a.date,
          compteRendu: a.compteRendu,
        }));
        setHistory(items.sort((a: CRHistoryItem, b: CRHistoryItem) => b.date.localeCompare(a.date)));
      }
    } catch {}
    setLoadingHistory(false);
  };

  const handleCreateTemplate = () => {
    if (!newName.trim() || !newContent.trim()) return;
    const custom: CRTemplate = { id: `custom-${Date.now()}`, name: newName.trim(), content: newContent.trim(), isCustom: true };
    const updated = [...templates, custom];
    setTemplates(updated);
    const customOnly = updated.filter(t => t.isCustom);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(customOnly));
    setNewName('');
    setNewContent('');
    setShowNewForm(false);
  };

  const filteredHistory = searchQuery.trim()
    ? history.filter(h =>
        h.patientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        h.date.includes(searchQuery) ||
        h.compteRendu.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : history;

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight text-gray-900">📋 Compte Rendu</h1>

      {/* Tabs */}
      <div className="mt-4 flex gap-1 border-b border-gray-200">
        <button
          onClick={() => setTab('templates')}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${tab === 'templates' ? 'border-purple-600 text-purple-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          Templates
        </button>
        <button
          onClick={() => setTab('history')}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${tab === 'history' ? 'border-purple-600 text-purple-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          History
        </button>
      </div>

      {/* Templates Tab */}
      {tab === 'templates' && (
        <div className="mt-6">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-gray-600">Visit summary templates for the workspace.</p>
            <button
              onClick={() => setShowNewForm(!showNewForm)}
              className="rounded-md bg-purple-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-purple-700"
            >
              {showNewForm ? 'Cancel' : '+ New Template'}
            </button>
          </div>

          {showNewForm && (
            <div className="mb-6 rounded-lg border border-purple-200 bg-purple-50 p-4">
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Template name..."
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm mb-2"
              />
              <textarea
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                placeholder="Template content with placeholders..."
                rows={8}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-mono mb-2"
              />
              <button
                onClick={handleCreateTemplate}
                disabled={!newName.trim() || !newContent.trim()}
                className="rounded-md bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
              >
                Save Template
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {templates.map(template => (
              <button
                key={template.id}
                type="button"
                onClick={() => setSelectedTemplate(selectedTemplate?.id === template.id ? null : template)}
                className={`rounded-lg border p-4 text-left transition-colors ${
                  selectedTemplate?.id === template.id
                    ? 'border-purple-500 bg-purple-50'
                    : template.isCustom ? 'border-purple-200 bg-purple-50/50' : 'border-gray-200 bg-white hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-gray-900">{template.name}</p>
                  {template.isCustom && <span className="text-[10px] text-purple-600 font-medium bg-purple-100 px-1.5 py-0.5 rounded">Custom</span>}
                </div>
                {selectedTemplate?.id === template.id && (
                  <pre className="mt-3 text-xs text-gray-700 whitespace-pre-wrap bg-white rounded-md p-3 border border-gray-100">{template.content}</pre>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* History Tab */}
      {tab === 'history' && (
        <div className="mt-6">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by patient name, date, or content..."
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm mb-4"
          />

          {loadingHistory ? (
            <p className="text-sm text-gray-500">Loading...</p>
          ) : filteredHistory.length === 0 ? (
            <p className="text-sm text-gray-500">No compte rendus found.</p>
          ) : (
            <div className="space-y-3">
              {filteredHistory.map(item => (
                <div key={item.appointmentId} className="rounded-lg border border-purple-200 bg-purple-50 p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-gray-900">{item.patientName}</p>
                    <span className="text-xs text-gray-500">{item.date}</span>
                  </div>
                  <p className="mt-2 text-sm text-gray-700 whitespace-pre-wrap line-clamp-4">{item.compteRendu}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
