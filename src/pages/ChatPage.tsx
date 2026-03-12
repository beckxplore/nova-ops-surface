import React, { useState, useEffect, useRef, useCallback } from 'react';
import { getOrCreateDeviceIdentity } from '../utils/cryptoUtils';

const isDev = import.meta.env.DEV;
const API_BASE = isDev ? 'http://localhost:3000' : 'https://api.nova.example.com'; 
const GATEWAY_URL = 'wss://98-93-181-83.sslip.io'; // Force AWS LIVE gateway for local testing
const AUTH_TOKEN = '7dd8ac893a339cb334fb2e5e644a22db16ceeed9baf0ab7a';

interface Message {
  id: string; role: string; content: string;
  timestamp: string; source: string;
  streaming?: boolean;
}
interface Session {
  id: string; topic: string; hashtag: string;
  description: string; source: string;
  lastMessage: { content: string; timestamp: string; source: string } | null;
  createdAt: string;
}

type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

const sourceIcon: Record<string, string> = {
  dashboard: '🖥️', telegram: '📱', system: '⚙️', nova: '🤖', user: '👤',
};

let reqCounter = 0;
function nextReqId() {
  return `dashboard-${Date.now()}-${++reqCounter}`;
}

const ChatPage: React.FC = () => {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSession, setActiveSession] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [showNewSession, setShowNewSession] = useState(false);
  const [newTopic, setNewTopic] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [creating, setCreating] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<number | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const activeSessionRef = useRef<string | null>(activeSession);
  const currentAssistantMsgRef = useRef<string | null>(null);

  useEffect(() => {
    activeSessionRef.current = activeSession;
  }, [activeSession]);

  // OpenClaw Gateway WebSocket Protocol Handler
  const handleGatewayMessage = useCallback((event: MessageEvent) => {
    try {
      const data = JSON.parse(event.data);
      console.log('[WS] Received:', data.type, data.event || data.method || '');

      // Handle connect.challenge — respond with connect RPC
      if (data.type === 'event' && data.event === 'connect.challenge') {
        const nonce = data.payload?.nonce;
        console.log('[WS] Got connect.challenge, signing nonce:', nonce);
        
        const ws = wsRef.current;
        if (ws?.readyState === WebSocket.OPEN && nonce) {
          (async () => {
            try {
              const device = await getOrCreateDeviceIdentity(nonce, {
                clientId: 'openclaw-control-ui',
                clientMode: 'webchat',
                platform: 'web',
                role: 'operator',
                scopes: ['operator.read', 'operator.write'],
                token: AUTH_TOKEN
              });
              console.log('[WS] Device identity prepared, sending connect...');
              
              ws.send(JSON.stringify({
                type: 'req',
                id: nextReqId(),
                method: 'connect',
                params: {
                  minProtocol: 3,
                  maxProtocol: 3,
                  client: {
                    id: 'openclaw-control-ui',
                    version: '1.0.0',
                    platform: 'web',
                    mode: 'webchat',
                  },
                  device,
                  role: 'operator',
                  scopes: ['operator.read', 'operator.write'],
                  caps: [],
                  commands: [],
                  permissions: {},
                  auth: { token: AUTH_TOKEN },
                  locale: navigator.language || 'en-US',
                  userAgent: 'nova-dashboard/1.0.0',
                },
              }));
            } catch (err) {
              console.error('[WS] Failed to prepare device identity:', err);
              setStatus('error');
            }
          })();
        }
        return;
      }

      // Handle connect response (hello-ok)
      if (data.type === 'res' && data.payload?.type === 'hello-ok') {
        console.log('[WS] Connected! Protocol:', data.payload.protocol);
        setStatus('connected');
        return;
      }

      // Handle connect/request error
      if (data.type === 'res' && data.ok === false) {
        console.error('[WS] Request failed:', data.error);
        if (data.error?.message?.includes('connect') || data.error?.message?.includes('auth')) {
          setStatus('error');
        }
        return;
      }

      // Handle chat events (streaming responses)
      if (data.type === 'event' && data.event === 'chat') {
        const p = data.payload;
        if (!p) return;

        if (p.type === 'assistant.chunk' || p.type === 'chunk') {
          const text = p.text || p.content || p.delta || '';
          if (!text) return;
          setMessages(prev => {
            const assistantId = currentAssistantMsgRef.current;
            if (assistantId) {
              return prev.map(m => 
                m.id === assistantId ? { ...m, content: m.content + text, streaming: true } : m
              );
            } else {
              const newId = `assistant-${Date.now()}`;
              currentAssistantMsgRef.current = newId;
              return [...prev, {
                id: newId, role: 'assistant', content: text,
                timestamp: new Date().toISOString(), source: 'nova', streaming: true
              }];
            }
          });
          return;
        }

        if (p.type === 'assistant.end' || p.type === 'done' || p.type === 'end') {
          if (currentAssistantMsgRef.current) {
            setMessages(prev => prev.map(m =>
              m.id === currentAssistantMsgRef.current ? { ...m, streaming: false } : m
            ));
          }
          currentAssistantMsgRef.current = null;
          setSending(false);
          return;
        }

        if (p.type === 'assistant.message' || p.type === 'message') {
          const content = p.text || p.content || p.message || '';
          if (currentAssistantMsgRef.current) {
            setMessages(prev => prev.map(m => 
              m.id === currentAssistantMsgRef.current
                ? { ...m, streaming: false, content: content || m.content }
                : m
            ));
          } else if (content) {
            setMessages(prev => [...prev, {
              id: `assistant-${Date.now()}`, role: 'assistant', content,
              timestamp: new Date().toISOString(), source: 'nova'
            }]);
          }
          currentAssistantMsgRef.current = null;
          setSending(false);
          return;
        }

        if (p.type === 'error') {
          setMessages(prev => [...prev, {
            id: `error-${Date.now()}`, role: 'system',
            content: `Error: ${p.message || p.error || 'Unknown error'}`,
            timestamp: new Date().toISOString(), source: 'system'
          }]);
          setSending(false);
          currentAssistantMsgRef.current = null;
          return;
        }
      }

      // Handle agent events (tool calls, thinking, etc.)
      if (data.type === 'event' && data.event === 'agent') {
        const p = data.payload;
        if (!p) return;

        if (p.type === 'text' || p.type === 'chunk' || p.type === 'assistant.chunk') {
          const text = p.text || p.content || p.delta || '';
          if (!text) return;
          setMessages(prev => {
            const assistantId = currentAssistantMsgRef.current;
            if (assistantId) {
              return prev.map(m => 
                m.id === assistantId ? { ...m, content: m.content + text, streaming: true } : m
              );
            } else {
              const newId = `assistant-${Date.now()}`;
              currentAssistantMsgRef.current = newId;
              return [...prev, {
                id: newId, role: 'assistant', content: text,
                timestamp: new Date().toISOString(), source: 'nova', streaming: true
              }];
            }
          });
          return;
        }

        if (p.type === 'end' || p.type === 'done') {
          if (currentAssistantMsgRef.current) {
            setMessages(prev => prev.map(m =>
              m.id === currentAssistantMsgRef.current ? { ...m, streaming: false } : m
            ));
          }
          currentAssistantMsgRef.current = null;
          setSending(false);
          return;
        }
      }

      // Handle chat.send ack
      if (data.type === 'res' && data.ok === true && data.payload?.status) {
        console.log('[WS] chat.send ack:', data.payload.status);
        return;
      }

      // Handle generic error events
      if (data.type === 'event' && data.event === 'error') {
        console.error('[WS] Server error event:', data.payload);
        setMessages(prev => [...prev, {
          id: `error-${Date.now()}`, role: 'system',
          content: `Error: ${data.payload?.message || 'Unknown error'}`,
          timestamp: new Date().toISOString(), source: 'system'
        }]);
        setSending(false);
        currentAssistantMsgRef.current = null;
      }

      // Ignore tick/presence/health
      if (data.type === 'event' && ['tick', 'presence', 'system-presence', 'health'].includes(data.event)) {
        return;
      }

    } catch (e) { 
      console.error('[WS] Error parse/handle:', e);
    }
  }, []);

  // WebSocket Connection
  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;
    
    console.log('[WS] Connecting to:', GATEWAY_URL);
    setStatus('connecting');
    const ws = new WebSocket(GATEWAY_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('[WS] Socket opened, waiting for connect.challenge...');
    };

    ws.onmessage = handleGatewayMessage;

    ws.onclose = (event) => {
      if (wsRef.current !== ws) return;
      console.log('[WS] Closed:', event.code, event.reason);
      setStatus('disconnected');
      wsRef.current = null;
      if (event.code !== 1000) {
        reconnectTimeoutRef.current = setTimeout(() => connect(), 3000);
      }
    };

    ws.onerror = () => {
      if (wsRef.current !== ws) return;
      setStatus('error');
    };
  }, [handleGatewayMessage]);

  useEffect(() => {
    connect();
    return () => {
      wsRef.current?.close();
      clearTimeout(reconnectTimeoutRef.current);
    };
  }, [connect]);

  // Load sessions (best-effort — don't block chat)
  useEffect(() => {
    loadSessions();
  }, []);

  // Poll messages for active session (sync with GitHub persistence)
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
      if (!r.ok) return;
      const data = await r.json();
      setSessions(data.sessions || []);
      if (!activeSession && data.sessions?.length > 0) {
        setActiveSession(data.sessions[0].id);
      }
    } catch {
      // API unavailable — chat still works via gateway
      console.log('[Sessions] API unavailable, chat works via gateway');
    }
  };

  const loadMessages = async (sessionId: string) => {
    try {
      const r = await fetch(`${API_BASE}/api/chat?session=${sessionId}`);
      if (!r.ok) return;
      const data = await r.json();
      if (!sending && !currentAssistantMsgRef.current) {
        setMessages(data.messages || []);
      }
    } catch {
      // Non-critical — messages come from gateway
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || sending) return;
    
    const text = input.trim();
    setSending(true);

    const userMsg: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date().toISOString(),
      source: 'dashboard'
    };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    currentAssistantMsgRef.current = null;

    // Send via Gateway using chat.send RPC
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'req',
        id: nextReqId(),
        method: 'chat.send',
        params: {
          message: text,
          sessionKey: 'main',
          idempotencyKey: `msg-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        },
      }));
    } else {
      setMessages(prev => [...prev, {
        id: `error-${Date.now()}`, role: 'system',
        content: 'Not connected to gateway. Message not sent.',
        timestamp: new Date().toISOString(), source: 'system'
      }]);
      setSending(false);
    }

    // Also persist to GitHub (best-effort)
    if (activeSession) {
      try {
        await fetch(`${API_BASE}/api/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ session: activeSession, content: text, source: 'dashboard' }),
        });
      } catch { /* non-critical */ }
    }
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
    } catch { /* API not available */ }
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

  const statusColor = {
    disconnected: 'bg-slate-400',
    connecting: 'bg-amber-400 animate-pulse',
    connected: 'bg-emerald-400',
    error: 'bg-red-500',
  }[status];

  // Chat is always available when connected — no session required
  const canChat = status === 'connected';

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

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {/* Default gateway session — always present */}
          <button
            onClick={() => setActiveSession(null)}
            className={`w-full text-left rounded-lg p-3 transition-all ${
              activeSession === null
                ? 'bg-blue-500/10 border border-blue-500/20'
                : 'hover:bg-slate-800/50 border border-transparent'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium text-white">💬 Nova Chat</span>
              <span className={`h-2 w-2 rounded-full ${statusColor}`}></span>
            </div>
            <p className="text-[11px] text-slate-500">Direct gateway session</p>
          </button>

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

        <div className="p-3 border-t border-slate-800">
          <div className="flex items-center gap-2 text-[10px] text-slate-600">
            <span>📱</span>
            <span>Messages sync across Dashboard & Telegram</span>
          </div>
        </div>
      </div>

      {/* Chat Area — always visible when connected */}
      <div className="flex-1 flex flex-col">
        {/* Chat Header */}
        <div className="px-6 py-4 border-b border-slate-800 bg-slate-900/50">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">
                {activeSession 
                  ? sessions.find(s => s.id === activeSession)?.topic || activeSession
                  : 'Nova Chat'}
              </h2>
              <p className="text-xs text-slate-500">
                {activeSession
                  ? sessions.find(s => s.id === activeSession)?.description || 'Chat with Nova'
                  : 'Direct gateway session'}
              </p>
            </div>
            <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium ${
              status === 'connected' ? 'bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20' : 'bg-slate-500/10 text-slate-400 ring-1 ring-slate-500/20'
            }`}>
              <span className={`h-1.5 w-1.5 rounded-full ${statusColor}`}></span>
              {status === 'connected' ? 'Nova Online' : status === 'connecting' ? 'Connecting...' : 'Offline'}
            </span>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {messages.length === 0 && canChat && (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <span className="text-4xl mb-4">🤖</span>
              <h3 className="text-lg font-medium text-white mb-2">Nova is ready</h3>
              <p className="text-sm text-slate-500">Type a message to start chatting</p>
            </div>
          )}
          {messages.length === 0 && !canChat && (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <span className="text-4xl mb-4">🔌</span>
              <h3 className="text-lg font-medium text-white mb-2">
                {status === 'connecting' ? 'Connecting to Nova...' : 'Disconnected'}
              </h3>
              <p className="text-sm text-slate-500">
                {status === 'connecting' ? 'Establishing gateway connection' : 'Will reconnect automatically'}
              </p>
            </div>
          )}
          {messages.map((msg, i) => {
            const isUser = msg.role === 'user';
            const isSystem = msg.role === 'system';
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
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="text-[10px]">{sourceIcon[msg.source] || '💬'}</span>
                        <span className="text-[10px] text-slate-500 font-medium">
                          {isUser ? 'You' : 'Nova'}
                          {msg.source === 'telegram' && ' (via Telegram)'}
                        </span>
                        <span className="text-[10px] text-slate-600">{formatTime(msg.timestamp)}</span>
                      </div>
                      <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                      {msg.streaming && (
                        <span className="inline-block w-1.5 h-4 bg-blue-400 animate-pulse ml-1 rounded-sm align-middle" />
                      )}
                    </div>
                  </div>
                )}
              </React.Fragment>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* Input — enabled when gateway is connected */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-900/50">
          <div className="flex gap-3">
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
              placeholder={canChat ? "Message Nova..." : "Connecting to gateway..."}
              disabled={sending || !canChat}
              className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500/50 placeholder:text-slate-600 disabled:opacity-50"
            />
            <button
              onClick={sendMessage}
              disabled={sending || !input.trim() || !canChat}
              className="px-5 py-3 bg-blue-500 text-white rounded-xl text-sm font-medium hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {sending ? '...' : 'Send'}
            </button>
          </div>
          <p className="text-[10px] text-slate-600 mt-2">Connected to OpenClaw gateway • Messages sync across all channels</p>
        </div>
      </div>
    </div>
  );
};

export default ChatPage;
