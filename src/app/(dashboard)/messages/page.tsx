'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

interface Conversation {
  id: string;
  name: string;
  role: string;
  lastMessage: string | null;
  lastMessageTime: string | null;
  unread: number;
}

interface ChatMessage {
  id: string;
  senderId: string;
  recipientId: string;
  content: string;
  isRead: boolean;
  createdAt: string;
}

export default function MessagesPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvo, setActiveConvo] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Fetch conversations list
  const fetchConversations = useCallback(async () => {
    try {
      const res = await fetch('/api/messages');
      if (res.ok) {
        const json = await res.json();
        setConversations(json.data || []);
        if (json.currentUserId) setCurrentUserId(json.currentUserId);
      }
    } catch {}
    setLoading(false);
  }, []);

  // Fetch messages for active conversation
  const fetchMessages = useCallback(async (partnerId: string) => {
    try {
      const res = await fetch(`/api/messages?partnerId=${partnerId}`);
      if (res.ok) {
        const json = await res.json();
        setMessages(json.data || []);
      }
    } catch {}
  }, []);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  // Poll for new messages every 5s when a conversation is active
  useEffect(() => {
    if (!activeConvo) return;
    fetchMessages(activeConvo);
    pollRef.current = setInterval(() => {
      fetchMessages(activeConvo);
      fetchConversations();
    }, 5000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [activeConvo, fetchMessages, fetchConversations]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const handleSend = async () => {
    if (!input.trim() || !activeConvo) return;
    setSending(true);
    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipientId: activeConvo, content: input.trim() }),
      });
      if (res.ok) {
        setInput('');
        await fetchMessages(activeConvo);
        await fetchConversations();
      }
    } catch {}
    setSending(false);
  };

  const currentConvo = conversations.find(c => c.id === activeConvo);

  const formatTime = (dateStr: string | null) => {
    if (!dateStr) return '';
    try {
      return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch { return ''; }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><p className="text-sm text-gray-500">Loading messages...</p></div>;
  }

  return (
    <div className="h-[calc(100vh-8rem)]">
      <h1 className="text-xl font-bold text-gray-900 mb-4">Messages</h1>
      <div className="flex h-full rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        {/* Conversations list */}
        <div className="w-80 border-r border-gray-200 flex flex-col shrink-0">
          <div className="p-4 border-b border-gray-100">
            <p className="text-xs text-gray-500">Team Members</p>
          </div>
          <div className="flex-1 overflow-y-auto">
            {conversations.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-8">No team members found</p>
            ) : (
              conversations.map((convo) => (
                <button
                  key={convo.id}
                  type="button"
                  onClick={() => setActiveConvo(convo.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                    activeConvo === convo.id ? 'bg-blue-50 border-r-2 border-blue-600' : 'hover:bg-gray-50'
                  }`}
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-sm font-medium text-blue-700 shrink-0">
                    {convo.name[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-gray-900 truncate">{convo.name}</p>
                      {convo.lastMessageTime && (
                        <span className="text-[10px] text-gray-400">{formatTime(convo.lastMessageTime)}</span>
                      )}
                    </div>
                    <div className="flex items-center justify-between mt-0.5">
                      <p className="text-xs text-gray-500 truncate">{convo.lastMessage || `${convo.role.replace('_', ' ')} — No messages yet`}</p>
                      {convo.unread > 0 && (
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-[10px] font-bold text-white shrink-0 ml-2">
                          {convo.unread}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Chat area */}
        <div className="flex-1 flex flex-col">
          {!activeConvo ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <span className="text-4xl">💬</span>
                <p className="mt-3 text-sm text-gray-500">Select a conversation to start messaging</p>
              </div>
            </div>
          ) : (
            <>
              {/* Chat header */}
              <div className="flex items-center gap-3 border-b border-gray-100 px-5 py-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-100 text-sm font-medium text-blue-700">
                  {currentConvo?.name[0]}
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">{currentConvo?.name}</p>
                  <p className="text-[10px] text-gray-500">{currentConvo?.role.replace('_', ' ')}</p>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-5 space-y-3 bg-gray-50/50">
                {messages.length === 0 ? (
                  <p className="text-center text-xs text-gray-400 py-8">No messages yet. Say hello!</p>
                ) : (
                  messages.map((msg) => {
                    const isMine = msg.senderId === currentUserId;
                    return (
                      <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[70%] rounded-2xl px-4 py-2.5 ${
                          isMine ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-800'
                        }`}>
                          <p className="text-sm">{msg.content}</p>
                          <p className={`text-[10px] mt-1 ${isMine ? 'text-blue-200' : 'text-gray-400'}`}>
                            {formatTime(msg.createdAt)}
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div className="border-t border-gray-200 p-4 bg-white">
                <div className="flex items-center gap-3">
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && !sending && handleSend()}
                    placeholder="Type a message..."
                    className="flex-1 rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    disabled={sending}
                  />
                  <button
                    type="button"
                    onClick={handleSend}
                    disabled={!input.trim() || sending}
                    className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-30 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                    </svg>
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
