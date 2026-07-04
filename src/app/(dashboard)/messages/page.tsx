'use client';

import { useState } from 'react';

interface Conversation {
  id: string;
  name: string;
  role: string;
  lastMessage: string;
  time: string;
  unread: number;
  online: boolean;
}

interface ChatMessage {
  id: string;
  from: string;
  text: string;
  time: string;
  isMine: boolean;
}

const CONVERSATIONS: Conversation[] = [
  { id: '1', name: 'Fatima (Receptionist)', role: 'Medical_Assistant', lastMessage: 'Patient is ready in room 2', time: '10:05 AM', unread: 2, online: true },
  { id: '2', name: 'Dr. Benali', role: 'Doctor', lastMessage: 'Can you review the lab results?', time: '9:30 AM', unread: 0, online: true },
  { id: '3', name: 'Admin', role: 'Admin', lastMessage: 'Schedule updated for next week', time: 'Yesterday', unread: 0, online: false },
  { id: '4', name: 'Nurse Khadija', role: 'Medical_Assistant', lastMessage: 'Vitals recorded for patient #42', time: 'Yesterday', unread: 1, online: false },
];

const MOCK_MESSAGES: Record<string, ChatMessage[]> = {
  '1': [
    { id: 'm1', from: 'Fatima', text: 'Good morning Dr.! Patient Ahmed is here.', time: '09:55 AM', isMine: false },
    { id: 'm2', from: 'You', text: 'Thanks Fatima, send him to room 2.', time: '09:56 AM', isMine: true },
    { id: 'm3', from: 'Fatima', text: 'Done! He is on his way.', time: '09:56 AM', isMine: false },
    { id: 'm4', from: 'Fatima', text: 'Also, the next patient called to reschedule.', time: '10:02 AM', isMine: false },
    { id: 'm5', from: 'Fatima', text: 'Patient is ready in room 2', time: '10:05 AM', isMine: false },
  ],
  '2': [
    { id: 'm6', from: 'Dr. Benali', text: 'Hi, I have a patient with elevated PSA. Want to discuss?', time: '09:15 AM', isMine: false },
    { id: 'm7', from: 'You', text: 'Sure, what are the values?', time: '09:20 AM', isMine: true },
    { id: 'm8', from: 'Dr. Benali', text: 'Can you review the lab results?', time: '09:30 AM', isMine: false },
  ],
  '3': [
    { id: 'm9', from: 'Admin', text: 'Schedule updated for next week', time: 'Yesterday', isMine: false },
  ],
  '4': [
    { id: 'm10', from: 'Nurse Khadija', text: 'Vitals recorded for patient #42', time: 'Yesterday', isMine: false },
  ],
};

export default function MessagesPage() {
  const [activeConvo, setActiveConvo] = useState<string>('1');
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState(MOCK_MESSAGES);

  const currentMessages = messages[activeConvo] || [];
  const currentConvo = CONVERSATIONS.find(c => c.id === activeConvo);

  const handleSend = () => {
    if (!input.trim()) return;
    const newMsg: ChatMessage = {
      id: Date.now().toString(),
      from: 'You',
      text: input.trim(),
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isMine: true,
    };
    setMessages(prev => ({ ...prev, [activeConvo]: [...(prev[activeConvo] || []), newMsg] }));
    setInput('');
  };

  return (
    <div className="h-[calc(100vh-8rem)]">
      <h1 className="text-xl font-bold text-gray-900 mb-4">Messages</h1>
      <div className="flex h-full rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        {/* Conversations list */}
        <div className="w-80 border-r border-gray-200 flex flex-col">
          <div className="p-4 border-b border-gray-100">
            <input
              type="text"
              placeholder="Search conversations..."
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div className="flex-1 overflow-y-auto">
            {CONVERSATIONS.map((convo) => (
              <button
                key={convo.id}
                type="button"
                onClick={() => setActiveConvo(convo.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                  activeConvo === convo.id ? 'bg-blue-50 border-r-2 border-blue-600' : 'hover:bg-gray-50'
                }`}
              >
                <div className="relative">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-sm font-medium text-gray-700">
                    {convo.name[0]}
                  </div>
                  {convo.online && (
                    <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-green-500 ring-2 ring-white" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-gray-900 truncate">{convo.name}</p>
                    <span className="text-[10px] text-gray-400">{convo.time}</span>
                  </div>
                  <p className="text-xs text-gray-500 truncate mt-0.5">{convo.lastMessage}</p>
                </div>
                {convo.unread > 0 && (
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-[10px] font-bold text-white">
                    {convo.unread}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Chat area */}
        <div className="flex-1 flex flex-col">
          {/* Chat header */}
          <div className="flex items-center gap-3 border-b border-gray-100 px-5 py-3">
            <div className="relative">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-100 text-sm font-medium text-blue-700">
                {currentConvo?.name[0]}
              </div>
              {currentConvo?.online && (
                <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-green-500 ring-2 ring-white" />
              )}
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">{currentConvo?.name}</p>
              <p className="text-[10px] text-gray-500">{currentConvo?.online ? 'Online' : 'Offline'}</p>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-gray-50/50">
            {currentMessages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.isMine ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[70%] rounded-2xl px-4 py-2.5 ${
                  msg.isMine
                    ? 'bg-blue-600 text-white'
                    : 'bg-white border border-gray-200 text-gray-800'
                }`}>
                  <p className="text-sm">{msg.text}</p>
                  <p className={`text-[10px] mt-1 ${msg.isMine ? 'text-blue-200' : 'text-gray-400'}`}>{msg.time}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Input */}
          <div className="border-t border-gray-200 p-4 bg-white">
            <div className="flex items-center gap-3">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                placeholder="Type a message..."
                className="flex-1 rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={handleSend}
                disabled={!input.trim()}
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-30 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
