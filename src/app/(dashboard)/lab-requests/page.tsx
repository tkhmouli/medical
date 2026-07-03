'use client';

import { useState, useEffect } from 'react';
import { PdfPreviewModal } from '@/components/PdfPreviewModal';

interface LabTemplate {
  id: string;
  name: string;
  tests: string[];
  isCustom?: boolean;
}

interface LabHistoryItem {
  appointmentId: string;
  patientId: string;
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

  // Edit template
  const [editingTemplate, setEditingTemplate] = useState<LabTemplate | null>(null);
  const [editName, setEditName] = useState('');
  const [editTests, setEditTests] = useState('');

  // PDF preview
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

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
        const patientIds = Array.from(new Set(appts.map((a: any) => a.patientId)));
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
          patientId: a.patientId,
          patientName: patientMap[a.patientId] || 'Unknown',
          date: a.date,
          tests: (() => { try { return JSON.parse(a.labTests); } catch { return []; } })(),
        }));
        setHistory(items.sort((a: LabHistoryItem, b: LabHistoryItem) => b.date.localeCompare(a.date)));
      }
    } catch {}
    setLoadingHistory(false);
  };

  const saveCustomTemplates = (updatedTemplates: LabTemplate[]) => {
    const customOnly = updatedTemplates.filter(t => t.isCustom);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(customOnly));
  };

  const handleCreateTemplate = () => {
    if (!newName.trim() || !newTests.trim()) return;
    const tests = newTests.split('\n').map(t => t.trim()).filter(t => t);
    const custom: LabTemplate = { id: `custom-${Date.now()}`, name: newName.trim(), tests, isCustom: true };
    const updated = [...templates, custom];
    setTemplates(updated);
    saveCustomTemplates(updated);
    setNewName('');
    setNewTests('');
    setShowNewForm(false);
  };

  const handleDeleteTemplate = (templateId: string) => {
    const updated = templates.filter(t => t.id !== templateId);
    setTemplates(updated);
    saveCustomTemplates(updated);
  };

  const handleStartEdit = (template: LabTemplate) => {
    setEditingTemplate(template);
    setEditName(template.name);
    setEditTests(template.tests.join('\n'));
  };

  const handleSaveEdit = () => {
    if (!editingTemplate || !editName.trim() || !editTests.trim()) return;
    const tests = editTests.split('\n').map(t => t.trim()).filter(t => t);
    const updated = templates.map(t =>
      t.id === editingTemplate.id ? { ...t, name: editName.trim(), tests } : t
    );
    setTemplates(updated);
    saveCustomTemplates(updated);
    setEditingTemplate(null);
    setEditName('');
    setEditTests('');
  };

  const handleViewLab = async (item: LabHistoryItem) => {
    try {
      const response = await fetch('/api/lab-request/pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientName: item.patientName,
          doctorName: '',
          date: item.date,
          tests: item.tests,
        }),
      });
      if (response.ok) {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        setPreviewUrl(url);
        setPreviewOpen(true);
      }
    } catch {}
  };

  const handlePrintLab = async (item: LabHistoryItem) => {
    try {
      const response = await fetch('/api/lab-request/pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientName: item.patientName,
          doctorName: '',
          date: item.date,
          tests: item.tests,
        }),
      });
      if (response.ok) {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const printWindow = window.open(url, '_blank');
        if (printWindow) {
          printWindow.addEventListener('load', () => printWindow.print());
        }
      }
    } catch {}
  };

  const handleClosePreview = () => {
    setPreviewOpen(false);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
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

          {/* Edit Template Form */}
          {editingTemplate && (
            <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4">
              <p className="text-sm font-semibold text-amber-800 mb-2">Editing: {editingTemplate.name}</p>
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Template name..."
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm mb-2"
              />
              <textarea
                value={editTests}
                onChange={(e) => setEditTests(e.target.value)}
                placeholder="Tests (one per line)..."
                rows={4}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm mb-2"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleSaveEdit}
                  disabled={!editName.trim() || !editTests.trim()}
                  className="rounded-md bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
                >
                  Save Changes
                </button>
                <button
                  onClick={() => setEditingTemplate(null)}
                  className="rounded-md bg-gray-200 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-300"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {templates.map(template => (
              <div key={template.id} className={`rounded-lg border p-4 ${template.isCustom ? 'border-purple-200 bg-purple-50' : 'border-gray-200 bg-white'}`}>
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-gray-900">{template.name}</p>
                  {template.isCustom && (
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-purple-600 font-medium bg-purple-100 px-1.5 py-0.5 rounded mr-1">Custom</span>
                      <button
                        type="button"
                        onClick={() => handleStartEdit(template)}
                        className="p-1 text-gray-400 hover:text-blue-600 rounded hover:bg-blue-50"
                        title="Edit template"
                        aria-label={`Edit ${template.name}`}
                      >
                        ✏️
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteTemplate(template.id)}
                        className="p-1 text-gray-400 hover:text-red-600 rounded hover:bg-red-50"
                        title="Delete template"
                        aria-label={`Delete ${template.name}`}
                      >
                        🗑️
                      </button>
                    </div>
                  )}
                </div>
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
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500">{item.date}</span>
                      <button
                        type="button"
                        onClick={() => handleViewLab(item)}
                        className="p-1 text-gray-500 hover:text-blue-600 rounded hover:bg-white"
                        title="View"
                        aria-label={`View lab request for ${item.patientName}`}
                      >
                        👁️
                      </button>
                      <button
                        type="button"
                        onClick={() => handlePrintLab(item)}
                        className="p-1 text-gray-500 hover:text-green-600 rounded hover:bg-white"
                        title="Print"
                        aria-label={`Print lab request for ${item.patientName}`}
                      >
                        🖨️
                      </button>
                    </div>
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

      {/* PDF Preview Modal */}
      <PdfPreviewModal
        open={previewOpen}
        onClose={handleClosePreview}
        pdfUrl={previewUrl}
        title="Lab Request Preview"
      />
    </div>
  );
}
