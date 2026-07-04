'use client';

import { useState, useEffect } from 'react';
import { PdfPreviewModal } from '@/components/PdfPreviewModal';

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

  // Edit template
  const [editingTemplate, setEditingTemplate] = useState<CRTemplate | null>(null);
  const [editName, setEditName] = useState('');
  const [editContent, setEditContent] = useState('');

  // PDF preview
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

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

  const saveCustomTemplates = (updatedTemplates: CRTemplate[]) => {
    const customOnly = updatedTemplates.filter(t => t.isCustom);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(customOnly));
  };

  const handleCreateTemplate = () => {
    if (!newName.trim() || !newContent.trim()) return;
    const custom: CRTemplate = { id: `custom-${Date.now()}`, name: newName.trim(), content: newContent.trim(), isCustom: true };
    const updated = [...templates, custom];
    setTemplates(updated);
    saveCustomTemplates(updated);
    setNewName('');
    setNewContent('');
    setShowNewForm(false);
  };

  const handleDeleteTemplate = (templateId: string) => {
    const updated = templates.filter(t => t.id !== templateId);
    setTemplates(updated);
    saveCustomTemplates(updated);
    if (selectedTemplate?.id === templateId) setSelectedTemplate(null);
  };

  const handleStartEdit = (template: CRTemplate) => {
    setEditingTemplate(template);
    setEditName(template.name);
    setEditContent(template.content);
  };

  const handleSaveEdit = () => {
    if (!editingTemplate || !editName.trim() || !editContent.trim()) return;
    const updated = templates.map(t =>
      t.id === editingTemplate.id ? { ...t, name: editName.trim(), content: editContent.trim() } : t
    );
    setTemplates(updated);
    saveCustomTemplates(updated);
    setEditingTemplate(null);
    setEditName('');
    setEditContent('');
  };

  const handleViewCR = async (item: CRHistoryItem) => {
    try {
      const response = await fetch('/api/compte-rendu/pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientName: item.patientName,
          doctorName: '',
          date: item.date,
          compteRendu: item.compteRendu,
          visitNotes: '',
          prescriptionItems: [],
          vitals: null,
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

  const handlePrintCR = async (item: CRHistoryItem) => {
    try {
      const response = await fetch('/api/compte-rendu/pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientName: item.patientName,
          doctorName: '',
          date: item.date,
          compteRendu: item.compteRendu,
          visitNotes: '',
          prescriptionItems: [],
          vitals: null,
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
        h.date.includes(searchQuery) ||
        h.compteRendu.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : history;

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight text-gray-900">Compte Rendu</h1>

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
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                placeholder="Template content..."
                rows={8}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-mono mb-2"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleSaveEdit}
                  disabled={!editName.trim() || !editContent.trim()}
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

          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {templates.map(template => (
              <div
                key={template.id}
                className={`rounded-lg border p-4 transition-colors ${
                  selectedTemplate?.id === template.id
                    ? 'border-purple-500 bg-purple-50'
                    : template.isCustom ? 'border-purple-200 bg-purple-50/50' : 'border-gray-200 bg-white hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setSelectedTemplate(selectedTemplate?.id === template.id ? null : template)}
                    className="text-left flex-1"
                  >
                    <p className="text-sm font-semibold text-gray-900">{template.name}</p>
                  </button>
                  <div className="flex items-center gap-1">
                    {template.isCustom && (
                      <>
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
                      </>
                    )}
                  </div>
                </div>
                {selectedTemplate?.id === template.id && (
                  <pre className="mt-3 text-xs text-gray-700 whitespace-pre-wrap bg-white rounded-md p-3 border border-gray-100">{template.content}</pre>
                )}
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
                <div key={item.appointmentId} className="rounded-lg border border-green-200 bg-green-50 p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-gray-900">{item.patientName}</p>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500">{item.date}</span>
                      <button
                        type="button"
                        onClick={() => handleViewCR(item)}
                        className="p-1 text-gray-500 hover:text-blue-600 rounded hover:bg-white"
                        title="View"
                        aria-label={`View CR for ${item.patientName}`}
                      >
                        👁️
                      </button>
                      <button
                        type="button"
                        onClick={() => handlePrintCR(item)}
                        className="p-1 text-gray-500 hover:text-green-600 rounded hover:bg-white"
                        title="Print"
                        aria-label={`Print CR for ${item.patientName}`}
                      >
                        🖨️
                      </button>
                    </div>
                  </div>
                  <p className="mt-2 text-sm text-gray-700 whitespace-pre-wrap line-clamp-4">{item.compteRendu}</p>
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
        title="Compte Rendu Preview"
      />
    </div>
  );
}
