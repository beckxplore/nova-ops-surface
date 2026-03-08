import React, { useState, useEffect, useRef } from 'react';

const API_BASE = import.meta.env.DEV ? 'http://localhost:3001' : '';

interface Message {
  id: string; role: string; content: string;
  timestamp: string; source: string;
}
interface Session {
  id: string; topic: string; hashtag: string;
  description: string; source: string;
  lastMessage: { content: string; timestamp: string; source: string } | null;
  createdAt: string;
}

const sourceIcon: Record<string, string> = {
  dashboard: '🖥️', telegram: '📱', system: '⚙️', nova: '🤖', user: '👤',
};

const ChatPage: React.FC = () => {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSession, setActiveSession] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [showNewSession, setShowNewSession] = useState(false);
  const [newTopic, setNewTopic] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [creating, setCreating] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<number | null>(null);

  // Load sessions
  useEffect(() => {
    loadSessions();
  }, []);

  // Poll messages every 5 seconds
  useEffect(() => {
    if (!activeSession) return;
    loadMessages(activeSession);
    pollRef.current = window.setInterval(() => loadMessages(activeSession), 5000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [activeSession]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadSessions = async () => {
    try {
      const r = await fetch(`${API_BASE}/api/chat?list=true`);
      const data = await r.json();
      setSessions(data.sessions || []);
      if (!activeSession && data.sessions?.length > 0) {
        setActiveSession(data.sessions[0].id);
      }
    } catch (err) { console.error('Failed to load sessions:', err); }
  };

  const loadMessages = async (sessionId: string) => {
    try {
      const r = await fetch(`${API_BASE}/api/chat?session=${sessionId}`);
      const data = await r.json();
      setMessages(data.messages || []);
    } catch (err) { console.error('Failed to load messages:', err); }
  };

  const sendMessage = async () => {
    if (!input.trim() || !activeSession || sending) return;
    setSending(true);
    try {
      await fetch(`${API_BASE}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session: activeSession, content: input.trim(), source: 'dashboard' }),
      });
      setInput('');
      await loadMessages(activeSession);
      await loadSessions();
    } catch (err) { console.error('Failed to send:', err); }
    setSending(false);
  };

  const createSession = async () => {
    if (!newTopic.trim() || creating) return;
    setCreating(true);
    try {
      const r = await fetch(`${API_BASE}/api/chat?action=create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: newTopic.trim(), description: newDesc.trim() }),
      });
      if (r.ok) {
        const data = await r.json();
        setNewTopic(''); setNewDesc(''); setShowNewSession(false);
        await loadSessions();
        setActiveSession(data.session.id);
      }
    } catch (err) { console.error('Failed to create session:', err); }
    setCreating(false);
  };

  const formatTime = (ts: string) => {
    try { return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); }
    catch { return ''; }
  };

  const formatDate = (ts: string) => {
    try { return new Date(ts).toLocaleDateString([], { month: 'short', day: 'numeric' }); }
    catch { return ''; }
  };

  return (
    <div className="flex h-screen">
      {/* Session List */}
      <div className="w-72 bg-slate-900 border-r border-slate-800 flex flex-col shrink-0">
        <div className="p-4 border-b border-slate-800">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-white">Sessions</h2>
            <button
              onClick={() => setShowNewSession(!showNewSession)}
              className="h-7 w-7 flex items-center justify-center rounded-lg bg-blue-500/10 text-blue-400 text-sm hover:bg-blue-500/20 transition-colors"
            >+</button>
          </div>

          {/* New Session Form */}
          {showNewSession && (
            <div className="space-y-2 mb-3">
              <input
                value={newTopic} onChange={e => setNewTopic(e.target.value)}
                placeholder="Topic name..."
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500/50"
              />
              <input
                value={newDesc} onChange={e => setNewDesc(e.target.value)}
                placeholder="Description (optional)..."
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500/50"
              />
              <button onClick={createSession} disabled={creating}
                className="w-full px-3 py-1.5 bg-blue-500/10 text-blue-400 ring-1 ring-blue-500/20 rounded-lg text-xs font-medium hover:bg-blue-500/20 transition-colors disabled:opacity-50">
                {creating ? 'Creating...' : 'Create Session'}
              </button>
            </div>
          )}
        </div>

        {/* Session List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {sessions.map(session => (
            <button
              key={session.id}
              onClick={() => setActiveSession(session.id)}
              className={`w-full text-left rounded-lg p-3 transition-all ${
                activeSession === session.id
                  ? 'bg-blue-500/10 border border-blue-500/20'
                  : 'hover:bg-slate-800/50 border border-transparent'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-white truncate">{session.topic}</span>
                <span className="text-[10px] text-slate-600">{session.hashtag}</span>
              </div>
              {session.lastMessage ? (
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px]">{sourceIcon[session.lastMessage.source] || '💬'}</span>
                  <p className="text-[11px] text-slate-500 truncate">{session.lastMessage.content}</p>
                </div>
              ) : (
                <p className="text-[11px] text-slate-600 italic">No messages yet</p>
              )}
            </button>
          ))}
        </div>

        {/* Telegram Sync Info */}
        <div className="p-3 border-t border-slate-800">
          <div className="flex items-center gap-2 text-[10px] text-slate-600">
            <span>📱</span>
            <span>Telegram messages sync here in real-time</span>
          </div>
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col">
        {activeSession ? (
          <>
            {/* Chat Header */}
            <div className="px-6 py-4 border-b border-slate-800 bg-slate-900/50">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-white">
                    {sessions.find(s => s.id === activeSession)?.topic || activeSession}
                  </h2>
                  <p className="text-xs text-slate-500">
                    {sessions.find(s => s.id === activeSession)?.description || 'Chat with Nova'}
                    <span className="ml-2 text-slate-600">{sessions.find(s => s.id === activeSession)?.hashtag}</span>
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    Nova Online
                  </span>
                </div>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
              {messages.map((msg, i) => {
                const isUser = msg.role === 'user';
                const isSystem = msg.role === 'system';
                const isNova = msg.role === 'assistant' || msg.source === 'nova';
                const showDate = i === 0 || formatDate(msg.timestamp) !== formatDate(messages[i-1].timestamp);

                return (
                  <React.Fragment key={msg.id}>
                    {showDate && (
                      <div className="flex justify-center">
                        <span className="text-[10px] text-slate-600 bg-slate-800/50 px-3 py-1 rounded-full">{formatDate(msg.timestamp)}</span>
                      </div>
                    )}
                    {isSystem ? (
                      <div className="flex justify-center">
                        <span className="text-xs text-slate-600 italic">⚙️ {msg.content}</span>
                      </div>
                    ) : (
                      <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[70%] ${isUser
                          ? 'bg-blue-500/10 border border-blue-500/20 rounded-2xl rounded-br-sm'
                          : 'bg-slate-800/50 border border-slate-700/50 rounded-2xl rounded-bl-sm'
                        } px-4 py-3`}>
                          {/* Source badge */}
                          <div className="flex items-center gap-1.5 mb-1">
                            <span className="text-[10px]">{sourceIcon[msg.source] || '💬'}</span>
                            <span className="text-[10px] text-slate-500 font-medium">
                              {isUser ? 'You' : 'Nova'}
                              {msg.source === 'telegram' && ' (via Telegram)'}
                              {msg.source === 'dashboard' && isUser && ' (Dashboard)'}
                            </span>
                            <span className="text-[10px] text-slate-600">{formatTime(msg.timestamp)}</span>
                          </div>
                          <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                        </div>
                      </div>
                    )}
                  </React.Fragment>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="px-6 py-4 border-t border-slate-800 bg-slate-900/50">
              <div className="flex gap-3">
                <input
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                  placeholder="Message Nova..."
                  className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500/50 placeholder:text-slate-600"
                />
                <button
                  onClick={sendMessage}
                  disabled={sending || !input.trim()}
                  className="px-5 py-3 bg-blue-500 text-white rounded-xl text-sm font-medium hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {sending ? '...' : 'Send'}
                </button>
              </div>
              <p className="text-[10px] text-slate-600 mt-2">Messages sync across Dashboard & Telegram in real-time</p>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <span className="text-4xl mb-4 block">💬</span>
              <h3 className="text-lg font-medium text-white mb-2">Start a Conversation</h3>
              <p className="text-sm text-slate-500">Create a session or select one to chat with Nova</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatPage;
