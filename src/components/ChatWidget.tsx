'use client';

import { useState, useRef, useEffect } from 'react';

interface Message {
  id: string;
  from: string;
  text: string;
  time: string;
  isMine: boolean;
}

/**
 * Floating chat widget — bottom-right bubble that expands to a chat panel.
 * Placeholder UI for internal messaging between staff members.
 */
export function ChatWidget({ userName }: { userName: string }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { id: '1', from: 'Receptionist', text: 'Dr., patient Ahmed is here for his 10:00 AM appointment.', time: '09:55', isMine: false },
    { id: '2', from: userName, text: 'Thanks, send him to room 2 please.', time: '09:56', isMine: true },
    { id: '3', from: 'Receptionist', text: 'Done! He is on his way.', time: '09:56', isMine: false },
  ]);
  const [input, setInput] = useState('');
  const [unread, setUnread] = useState(1);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setUnread(0);
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [open, messages.length]);

  const handleSend = () => {
    if (!input.trim()) return;
    const newMsg: Message = {
      id: Date.now().toString(),
      from: userName,
      text: input.trim(),
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isMine: true,
    };
    setMessages(prev => [...prev, newMsg]);
    setInput('');
  };

  return (
    <>
      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-20 right-6 z-50 w-80 rounded-2xl border border-gray-200 bg-white shadow-2xl flex flex-col overflow-hidden" style={{ height: '420px' }}>
          {/* Header */}
          <div className="flex items-center justify-between bg-blue-600 px-4 py-3">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-white/20 flex items-center justify-center text-white text-sm font-bold">💬</div>
              <div>
                <p className="text-sm font-semibold text-white">Messages</p>
                <p className="text-[10px] text-blue-100">Team Chat</p>
              </div>
            </div>
            <button type="button" onClick={() => setOpen(false)} className="p-1 rounded text-white/80 hover:text-white hover:bg-white/10">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-gray-50">
            {messages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.isMine ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[75%] rounded-xl px-3 py-2 ${msg.isMine ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-800'}`}>
                  {!msg.isMine && <p className="text-[10px] font-medium text-blue-600 mb-0.5">{msg.from}</p>}
                  <p className="text-xs">{msg.text}</p>
                  <p className={`text-[9px] mt-1 ${msg.isMine ? 'text-blue-200' : 'text-gray-400'}`}>{msg.time}</p>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="border-t border-gray-200 p-3 bg-white">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                placeholder="Type a message..."
                className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={handleSend}
                disabled={!input.trim()}
                className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-30 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating bubble */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg shadow-blue-300/50 hover:bg-blue-700 hover:shadow-xl transition-all"
        aria-label="Open chat"
      >
        {open ? (
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
        ) : (
          <>
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM2.25 12.76c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.076-4.076a1.526 1.526 0 011.037-.443 48.282 48.282 0 005.68-.494c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
            </svg>
            {unread > 0 && (
              <span className="absolute -top-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white ring-2 ring-white">
                {unread}
              </span>
            )}
          </>
        )}
      </button>
    </>
  );
}
