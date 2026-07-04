'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

interface Conversation {
  id: string;
  name: string;
  role: string;
  lastMessage: string | null;
  unread: number;
}

interface ChatMessage {
  id: string;
  senderId: string;
  recipientId: string;
  content: string;
  createdAt: string;
}

/**
 * Floating chat widget — bottom-right bubble that expands to a chat panel.
 * Connects to real /api/messages endpoints.
 */
export function ChatWidget({ userName }: { userName: string }) {
  const [open, setOpen] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeChat, setActiveChat] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [currentUserId, setCurrentUserId] = useState('');
  const [input, setInput] = useState('');
  const [totalUnread, setTotalUnread] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Fetch conversations
  const fetchConversations = useCallback(async () => {
    try {
      const res = await fetch('/api/messages');
      if (res.ok) {
        const json = await res.json();
        const convos: Conversation[] = json.data || [];
        setConversations(convos);
        if (json.currentUserId) setCurrentUserId(json.currentUserId);
        setTotalUnread(convos.reduce((sum: number, c: Conversation) => sum + c.unread, 0));
      }
    } catch {}
  }, []);

  // Fetch messages for active chat
  const fetchMessages = useCallback(async (partnerId: string) => {
    try {
      const res = await fetch(`/api/messages?partnerId=${partnerId}`);
      if (res.ok) {
        const json = await res.json();
        setMessages(json.data || []);
      }
    } catch {}
  }, []);

  // Initial load + polling
  useEffect(() => {
    fetchConversations();
    const interval = setInterval(fetchConversations, 10000);
    return () => clearInterval(interval);
  }, [fetchConversations]);

  // Poll active chat
  useEffect(() => {
    if (!activeChat) return;
    fetchMessages(activeChat);
    pollRef.current = setInterval(() => fetchMessages(activeChat), 5000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [activeChat, fetchMessages]);

  useEffect(() => {
    if (open && activeChat) messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [open, messages.length, activeChat]);

  const handleSend = async () => {
    if (!input.trim() || !activeChat) return;
    try {
      await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipientId: activeChat, content: input.trim() }),
      });
      setInput('');
      await fetchMessages(activeChat);
      await fetchConversations();
    } catch {}
  };

  const activeConvo = conversations.find(c => c.id === activeChat);

  const formatTime = (dateStr: string) => {
    try { return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); }
    catch { return ''; }
  };

  return (
    <>
      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-20 right-6 z-50 w-80 rounded-2xl border border-gray-200 bg-white shadow-2xl flex flex-col overflow-hidden" style={{ height: '440px' }}>
          {/* Header */}
          <div className="flex items-center justify-between bg-blue-600 px-4 py-3 shrink-0">
            <div className="flex items-center gap-2">
              {activeChat && (
                <button type="button" onClick={() => setActiveChat(null)} className="p-0.5 rounded text-white/80 hover:text-white">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg>
                </button>
              )}
              <div>
                <p className="text-sm font-semibold text-white">{activeChat ? activeConvo?.name : 'Messages'}</p>
                <p className="text-[10px] text-blue-100">{activeChat ? activeConvo?.role.replace('_', ' ') : 'Select a conversation'}</p>
              </div>
            </div>
            <button type="button" onClick={() => setOpen(false)} className="p-1 rounded text-white/80 hover:text-white hover:bg-white/10">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>

          {!activeChat ? (
            /* Conversation list */
            <div className="flex-1 overflow-y-auto">
              {conversations.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-8">No team members</p>
              ) : (
                conversations.map((convo) => (
                  <button
                    key={convo.id}
                    type="button"
                    onClick={() => setActiveChat(convo.id)}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 border-b border-gray-50 transition-colors"
                  >
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-100 text-xs font-medium text-blue-700 shrink-0">
                      {convo.name[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-gray-900 truncate">{convo.name}</p>
                      <p className="text-[10px] text-gray-500 truncate">{convo.lastMessage || 'No messages'}</p>
                    </div>
                    {convo.unread > 0 && (
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-[9px] font-bold text-white">{convo.unread}</span>
                    )}
                  </button>
                ))
              )}
            </div>
          ) : (
            <>
              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-gray-50">
                {messages.length === 0 ? (
                  <p className="text-center text-[10px] text-gray-400 py-6">No messages yet</p>
                ) : (
                  messages.map((msg) => {
                    const isMine = msg.senderId === currentUserId;
                    return (
                      <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[75%] rounded-xl px-3 py-2 ${isMine ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-800'}`}>
                          <p className="text-xs">{msg.content}</p>
                          <p className={`text-[9px] mt-0.5 ${isMine ? 'text-blue-200' : 'text-gray-400'}`}>{formatTime(msg.createdAt)}</p>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div className="border-t border-gray-200 p-3 bg-white shrink-0">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                    placeholder="Type a message..."
                    className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-xs focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <button
                    type="button"
                    onClick={handleSend}
                    disabled={!input.trim()}
                    className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-30 transition-colors"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                    </svg>
                  </button>
                </div>
              </div>
            </>
          )}
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
            {totalUnread > 0 && (
              <span className="absolute -top-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white ring-2 ring-white">
                {totalUnread}
              </span>
            )}
          </>
        )}
      </button>
    </>
  );
}
