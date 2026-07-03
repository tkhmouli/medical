'use client';

import { useState, useEffect } from 'react';

interface LabTemplate {
  id: string;
  name: string;
  tests: string[];
  isCustom?: boolean;
}

interface LabHistoryItem {
  appointmentId: string;
  patientName: string;
  date: string;
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

const STORAGE_KEY = 'clinic-lab-templates';

export default function LabRequestsPage() {
  const [tab, setTab] = useState<'templates' | 'history'>('templates');
  const [templates, setTemplates] = useState<LabTemplate[]>(DEFAULT_TEMPLATES);
  const [history, setHistory] = useState<LabHistoryItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loadingHistory, setLoadingHistory] = useState(false);

  // New template form
  const [showNewForm, setShowNewForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newTests, setNewTests] = useState('');

  // Load custom templates from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const custom = JSON.parse(saved) as LabTemplate[];
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
        const appts = (data.data || []).filter((a: any) => a.labTests);
        // Need patient names - fetch them
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
        const items: LabHistoryItem[] = appts.map((a: any) => ({
          appointmentId: a.id,
          patientName: patientMap[a.patientId] || 'Unknown',
          date: a.date,
          tests: (() => { try { return JSON.parse(a.labTests); } catch { return []; } })(),
        }));
        setHistory(items.sort((a: LabHistoryItem, b: LabHistoryItem) => b.date.localeCompare(a.date)));
      }
    } catch {}
    setLoadingHistory(false);
  };

  const handleCreateTemplate = () => {
    if (!newName.trim() || !newTests.trim()) return;
    const tests = newTests.split('\n').map(t => t.trim()).filter(t => t);
    const custom: LabTemplate = { id: `custom-${Date.now()}`, name: newName.trim(), tests, isCustom: true };
    const updated = [...templates, custom];
    setTemplates(updated);
    // Save custom ones to localStorage
    const customOnly = updated.filter(t => t.isCustom);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(customOnly));
    setNewName('');
    setNewTests('');
    setShowNewForm(false);
  };

  const filteredHistory = searchQuery.trim()
    ? history.filter(h =>
        h.patientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        h.date.includes(searchQuery)
      )
    : history;

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight text-gray-900">🧪 Lab Requests</h1>

      {/* Tabs */}
      <div className="mt-4 flex gap-1 border-b border-gray-200">
        <button
          onClick={() => setTab('templates')}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${tab === 'templates' ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          Templates
        </button>
        <button
          onClick={() => setTab('history')}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${tab === 'history' ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          History
        </button>
      </div>

      {/* Templates Tab */}
      {tab === 'templates' && (
        <div className="mt-6">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-gray-600">Pre-configured lab test templates for the workspace.</p>
            <button
              onClick={() => setShowNewForm(!showNewForm)}
              className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
            >
              {showNewForm ? 'Cancel' : '+ New Template'}
            </button>
          </div>

          {showNewForm && (
            <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 p-4">
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Template name..."
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm mb-2"
              />
              <textarea
                value={newTests}
                onChange={(e) => setNewTests(e.target.value)}
                placeholder="Tests (one per line)..."
                rows={4}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm mb-2"
              />
              <button
                onClick={handleCreateTemplate}
                disabled={!newName.trim() || !newTests.trim()}
                className="rounded-md bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
              >
                Save Template
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {templates.map(template => (
              <div key={template.id} className={`rounded-lg border p-4 ${template.isCustom ? 'border-purple-200 bg-purple-50' : 'border-gray-200 bg-white'}`}>
                <p className="text-sm font-semibold text-gray-900">{template.name}</p>
                {template.isCustom && <span className="text-[10px] text-purple-600 font-medium">Custom</span>}
                <div className="mt-2 flex flex-wrap gap-1">
                  {template.tests.map((test, idx) => (
                    <span key={idx} className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] text-blue-700">{test}</span>
                  ))}
                </div>
              </div>
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
            placeholder="Search by patient name or date..."
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm mb-4"
          />

          {loadingHistory ? (
            <p className="text-sm text-gray-500">Loading...</p>
          ) : filteredHistory.length === 0 ? (
            <p className="text-sm text-gray-500">No lab requests found.</p>
          ) : (
            <div className="space-y-3">
              {filteredHistory.map(item => (
                <div key={item.appointmentId} className="rounded-lg border border-green-200 bg-green-50 p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-gray-900">{item.patientName}</p>
                    <span className="text-xs text-gray-500">{item.date}</span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {item.tests.map((test, idx) => (
                      <span key={idx} className="rounded-full bg-white border border-green-200 px-2 py-0.5 text-xs text-green-800">{test}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
