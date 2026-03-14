import React, { useState, useEffect, useRef, useCallback } from 'react';
import { getOrCreateDeviceIdentity } from '../utils/cryptoUtils';

const GATEWAY_URL = 'wss://98-93-181-83.sslip.io';
const AUTH_TOKEN = '7dd8ac893a339cb334fb2e5e644a22db16ceeed9baf0ab7a';

/* ─── Types ────────────────────────────────────────────────────── */

interface Message {
  id: string; role: string; content: string;
  timestamp: string; source: string;
  streaming?: boolean;
}

interface Session {
  key: string;
  label: string;
  icon: string;
  source: string;
  lastActive: number;
  model?: string;
  kind?: string;
  agentId?: string;
}

type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

/* ─── Helpers ──────────────────────────────────────────────────── */

const sourceIcon: Record<string, string> = {
  dashboard: '🖥️', telegram: '📱', system: '⚙️', nova: '🤖',
  user: '👤', webchat: '🌐', signal: '📡', discord: '🎮',
};

let reqCounter = 0;
function nextReqId(prefix = 'dashboard') {
  return `${prefix}-${Date.now()}-${++reqCounter}`;
}

/** Derive a human-readable session label from a session key */
function sessionLabel(key: string): { label: string; icon: string; source: string } {
  if (key.includes(':main') && !key.includes('telegram') && !key.includes('discord') && !key.includes('signal')) {
    return { label: 'Nova Chat', icon: '💬', source: 'webchat' };
  }
  if (key.includes('telegram')) {
    // Extract topic/thread info
    const topicMatch = key.match(/thread:\d+:(\d+)$/);
    const topic = topicMatch ? `Topic ${topicMatch[1]}` : 'Direct';
    if (key.includes('slash')) return { label: `Telegram Commands`, icon: '⚡', source: 'telegram' };
    return { label: `Telegram · ${topic}`, icon: '📱', source: 'telegram' };
  }
  if (key.includes('discord')) return { label: 'Discord', icon: '🎮', source: 'discord' };
  if (key.includes('signal')) return { label: 'Signal', icon: '📡', source: 'signal' };
  // Fallback: shorten the key
  const short = key.split(':').slice(-2).join(':');
  return { label: short, icon: '💬', source: 'other' };
}

/** Extract text from gateway message content (string or array) */
function extractText(msg: any): string {
  if (!msg) return '';
  const c = msg.content ?? msg.text ?? msg.message;
  if (typeof c === 'string') return c;
  if (Array.isArray(c)) {
    return c
      .filter((p: any) => p.type === 'text' && typeof p.text === 'string')
      .map((p: any) => p.text)
      .join('');
  }
  return '';
}

/** Strip metadata wrappers from user messages (Sender info, Conversation info, etc.) */
function cleanUserText(raw: string): string {
  // Remove "Conversation info (untrusted metadata):\n```json\n{...}\n```\n\nSender (untrusted metadata):\n```json\n{...}\n```\n\n"
  let text = raw;
  // Remove conversation info blocks
  text = text.replace(/Conversation info \(untrusted metadata\):\s*```json\s*\{[^}]*\}\s*```\s*/gs, '');
  // Remove sender blocks
  text = text.replace(/Sender \(untrusted metadata\):\s*```json\s*\{[^}]*\}\s*```\s*/gs, '');
  // Remove [timestamp] prefix like "[Sat 2026-03-14 16:15 UTC] "
  text = text.replace(/^\[.*?\]\s*/s, '');
  return text.trim() || raw;
}

/** Detect source from user message metadata */
function detectSource(raw: string): string {
  if (raw.includes('openclaw-control-ui')) return 'dashboard';
  if (raw.includes('telegram')) return 'telegram';
  if (raw.includes('discord')) return 'discord';
  if (raw.includes('signal')) return 'signal';
  return 'user';
}

function relativeTime(ms: number): string {
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return 'just now';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const days = Math.floor(hr / 24);
  return `${days}d ago`;
}

/* ─── Component ────────────────────────────────────────────────── */

const ChatPage: React.FC = () => {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSessionKey, setActiveSessionKey] = useState<string>('main');
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [sessionsLoading, setSessionsLoading] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const currentStreamRef = useRef<string | null>(null);
  const currentRunIdRef = useRef<string | null>(null);
  const activeSessionKeyRef = useRef(activeSessionKey);
  const pendingRpcCallbacks = useRef<Map<string, (payload: any) => void>>(new Map());

  // Keep ref in sync
  useEffect(() => { activeSessionKeyRef.current = activeSessionKey; }, [activeSessionKey]);

  /* ─── Gateway RPC helper ─────────────────────────────────── */

  const sendRpc = useCallback((method: string, params: any): Promise<any> => {
    return new Promise((resolve, reject) => {
      const ws = wsRef.current;
      if (!ws || ws.readyState !== WebSocket.OPEN) {
        reject(new Error('Not connected'));
        return;
      }
      const id = nextReqId('rpc');
      pendingRpcCallbacks.current.set(id, resolve);
      ws.send(JSON.stringify({ type: 'req', id, method, params }));
      // Timeout after 15s
      setTimeout(() => {
        if (pendingRpcCallbacks.current.has(id)) {
          pendingRpcCallbacks.current.delete(id);
          reject(new Error('RPC timeout'));
        }
      }, 15000);
    });
  }, []);

  /* ─── Load sessions list ─────────────────────────────────── */

  const loadSessions = useCallback(async () => {
    try {
      setSessionsLoading(true);
      const result = await sendRpc('sessions.list', { activeMinutes: 10080, includeGlobal: true });
      const items: Session[] = (result?.sessions || []).map((s: any) => {
        const info = sessionLabel(s.key);
        return {
          key: s.key,
          label: info.label,
          icon: info.icon,
          source: info.source,
          lastActive: s.updatedAt || 0,
          model: s.model,
          kind: s.kind,
          agentId: s.agentId,
        };
      });
      // Sort by last active (most recent first)
      items.sort((a, b) => b.lastActive - a.lastActive);
      setSessions(items);
    } catch (err) {
      console.error('[Sessions] Failed to load:', err);
    } finally {
      setSessionsLoading(false);
    }
  }, [sendRpc]);

  /* ─── Load chat history for a session ────────────────────── */

  const loadHistory = useCallback(async (sessionKey: string) => {
    try {
      setLoadingHistory(true);
      setMessages([]);
      currentStreamRef.current = null;
      currentRunIdRef.current = null;

      const result = await sendRpc('chat.history', { sessionKey, limit: 200 });
      const msgs: Message[] = [];
      const rawMessages = result?.messages || [];

      for (const m of rawMessages) {
        const role = m.role;
        if (!role || role === 'system') continue; // Skip system prompts
        const raw = extractText(m);
        if (!raw) continue;

        const isUser = role === 'user';
        const content = isUser ? cleanUserText(raw) : raw;
        const source = isUser ? detectSource(raw) : 'nova';

        // Skip empty cleaned messages
        if (!content.trim()) continue;

        msgs.push({
          id: `hist-${msgs.length}-${Date.now()}`,
          role,
          content,
          timestamp: m.timestamp ? new Date(m.timestamp).toISOString() : new Date().toISOString(),
          source,
        });
      }

      setMessages(msgs);
    } catch (err) {
      console.error('[History] Failed to load:', err);
      setMessages([{
        id: `error-${Date.now()}`, role: 'system',
        content: `Failed to load history: ${(err as Error).message}`,
        timestamp: new Date().toISOString(), source: 'system',
      }]);
    } finally {
      setLoadingHistory(false);
    }
  }, [sendRpc]);

  /* ─── WebSocket Message Handler ──────────────────────────── */

  const handleGatewayMessage = useCallback((event: MessageEvent) => {
    try {
      const data = JSON.parse(event.data);

      // --- RPC Response routing ---
      if (data.type === 'res') {
        const cb = pendingRpcCallbacks.current.get(data.id);
        if (cb) {
          pendingRpcCallbacks.current.delete(data.id);
          if (data.ok !== false) {
            cb(data.payload);
          } else {
            console.error('[WS] RPC error:', data.id, data.error);
            cb(null);
          }
          return;
        }

        // hello-ok (not registered as RPC callback because connect is special)
        if (data.payload?.type === 'hello-ok') {
          console.log('[WS] Connected! Protocol:', data.payload.protocol);
          setStatus('connected');
          return;
        }

        // Non-critical errors
        if (data.ok === false) {
          const code = data.error?.code || '';
          if (code === 'NOT_PAIRED') setStatus('error');
          return;
        }
        return;
      }

      // --- Events ---
      if (data.type !== 'event') return;

      // Handshake
      if (data.event === 'connect.challenge') {
        const nonce = data.payload?.nonce;
        if (!nonce) return;
        const ws = wsRef.current;
        if (ws?.readyState === WebSocket.OPEN) {
          (async () => {
            try {
              const device = await getOrCreateDeviceIdentity(nonce, {
                clientId: 'openclaw-control-ui',
                clientMode: 'webchat',
                platform: 'web',
                role: 'operator',
                scopes: ['operator.read', 'operator.write'],
                token: AUTH_TOKEN,
              });
              ws.send(JSON.stringify({
                type: 'req', id: nextReqId(), method: 'connect',
                params: {
                  minProtocol: 3, maxProtocol: 3,
                  client: { id: 'openclaw-control-ui', version: '1.0.0', platform: 'web', mode: 'webchat' },
                  device, role: 'operator',
                  scopes: ['operator.read', 'operator.write'],
                  caps: ['events'], commands: [], permissions: {},
                  auth: { token: AUTH_TOKEN },
                  locale: navigator.language || 'en-US',
                  userAgent: 'nova-dashboard/1.0.0',
                },
              }));
            } catch (err) {
              console.error('[WS] Device identity error:', err);
              setStatus('error');
            }
          })();
        }
        return;
      }

      // Chat events — real-time streaming for active session
      if (data.event === 'chat') {
        const p = data.payload;
        if (!p) return;

        // Check if this event is for the active session
        const eventSession = p.sessionKey || '';
        const activeKey = activeSessionKeyRef.current;
        const isActiveSession = eventSession === activeKey ||
          (activeKey === 'main' && eventSession.includes(':main'));

        if (!isActiveSession) {
          // Update session list to show activity on other sessions
          setSessions(prev => prev.map(s =>
            s.key === eventSession ? { ...s, lastActive: Date.now() } : s
          ));
          return;
        }

        const state = p.state;
        const text = extractText(p.message);

        if (state === 'delta') {
          setMessages(prev => {
            const streamId = currentStreamRef.current;
            if (streamId) {
              return prev.map(m =>
                m.id === streamId ? { ...m, content: text || m.content, streaming: true } : m
              );
            } else {
              const newId = `stream-${Date.now()}`;
              currentStreamRef.current = newId;
              return [...prev, {
                id: newId, role: 'assistant', content: text,
                timestamp: new Date().toISOString(), source: 'nova', streaming: true,
              }];
            }
          });
          return;
        }

        if (state === 'final') {
          if (currentStreamRef.current) {
            setMessages(prev => prev.map(m =>
              m.id === currentStreamRef.current
                ? { ...m, content: text || m.content, streaming: false }
                : m
            ));
          } else if (text) {
            setMessages(prev => [...prev, {
              id: `msg-${Date.now()}`, role: 'assistant', content: text,
              timestamp: new Date().toISOString(), source: 'nova',
            }]);
          }
          currentStreamRef.current = null;
          currentRunIdRef.current = null;
          setSending(false);
          // Refresh session list for updated lastActive
          setSessions(prev => prev.map(s =>
            s.key === eventSession ? { ...s, lastActive: Date.now() } : s
          ));
          return;
        }

        if (state === 'aborted') {
          if (currentStreamRef.current) {
            setMessages(prev => prev.map(m =>
              m.id === currentStreamRef.current ? { ...m, streaming: false } : m
            ));
          }
          currentStreamRef.current = null;
          currentRunIdRef.current = null;
          setSending(false);
          return;
        }

        if (state === 'error') {
          setMessages(prev => [...prev, {
            id: `error-${Date.now()}`, role: 'system',
            content: `Error: ${p.error?.message || text || 'Unknown error'}`,
            timestamp: new Date().toISOString(), source: 'system',
          }]);
          currentStreamRef.current = null;
          currentRunIdRef.current = null;
          setSending(false);
          return;
        }
        return;
      }

      // Ignore other events silently
    } catch (e) {
      console.error('[WS] Parse error:', e);
    }
  }, []);

  /* ─── WebSocket Connection ───────────────────────────────── */

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;
    setStatus('connecting');
    const ws = new WebSocket(GATEWAY_URL);
    wsRef.current = ws;
    ws.onopen = () => console.log('[WS] Socket opened');
    ws.onmessage = handleGatewayMessage;
    ws.onclose = (ev) => {
      if (wsRef.current !== ws) return;
      setStatus('disconnected');
      wsRef.current = null;
      if (ev.code !== 1000) {
        reconnectTimeoutRef.current = setTimeout(connect, 3000);
      }
    };
    ws.onerror = () => { if (wsRef.current === ws) setStatus('error'); };
  }, [handleGatewayMessage]);

  useEffect(() => {
    connect();
    return () => { wsRef.current?.close(); clearTimeout(reconnectTimeoutRef.current); };
  }, [connect]);

  /* ─── On connect: load sessions + history ────────────────── */

  useEffect(() => {
    if (status === 'connected') {
      loadSessions().then(() => loadHistory(activeSessionKey));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  /* ─── Switch session ─────────────────────────────────────── */

  const switchSession = useCallback((key: string) => {
    if (key === activeSessionKey) return;
    setActiveSessionKey(key);
    setSending(false);
    currentStreamRef.current = null;
    currentRunIdRef.current = null;
    if (status === 'connected') loadHistory(key);
  }, [activeSessionKey, status, loadHistory]);

  /* ─── Auto-scroll ────────────────────────────────────────── */

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  /* ─── Send message ───────────────────────────────────────── */

  const sendMessage = async () => {
    if (!input.trim() || sending) return;
    const text = input.trim();
    setSending(true);

    setMessages(prev => [...prev, {
      id: `user-${Date.now()}`, role: 'user', content: text,
      timestamp: new Date().toISOString(), source: 'dashboard',
    }]);
    setInput('');
    currentStreamRef.current = null;
    currentRunIdRef.current = null;

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'req', id: nextReqId(), method: 'chat.send',
        params: {
          message: text,
          sessionKey: activeSessionKey,
          idempotencyKey: `msg-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        },
      }));
    } else {
      setMessages(prev => [...prev, {
        id: `error-${Date.now()}`, role: 'system',
        content: 'Not connected. Message not sent.',
        timestamp: new Date().toISOString(), source: 'system',
      }]);
      setSending(false);
    }
  };

  /* ─── Format helpers ─────────────────────────────────────── */

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

  const canChat = status === 'connected';
  const activeSession = sessions.find(s => s.key === activeSessionKey);

  /* ─── Render ─────────────────────────────────────────────── */

  return (
    <div className="flex h-screen">
      {/* ─── Session Sidebar ─────────────────────────────────── */}
      <div className="w-72 bg-slate-900 border-r border-slate-800 flex flex-col shrink-0">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white">Sessions</h2>
          {sessionsLoading ? (
            <span className="text-[10px] text-slate-500 animate-pulse">Loading...</span>
          ) : (
            <button
              onClick={loadSessions}
              className="text-[10px] text-slate-500 hover:text-slate-300 transition-colors"
              title="Refresh sessions"
            >🔄</button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {sessions.length === 0 && !sessionsLoading && (
            <p className="text-[11px] text-slate-600 text-center py-4">
              {status === 'connected' ? 'No sessions found' : 'Connect to see sessions'}
            </p>
          )}
          {sessions.map(session => {
            const isActive = session.key === activeSessionKey;
            return (
              <button
                key={session.key}
                onClick={() => switchSession(session.key)}
                className={`w-full text-left rounded-lg p-3 transition-colors ${isActive
                  ? 'bg-blue-500/10 border border-blue-500/20'
                  : 'hover:bg-slate-800/50 border border-transparent'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-white truncate">
                    {session.icon} {session.label}
                  </span>
                  {isActive && <span className={`h-2 w-2 rounded-full ${statusColor}`}></span>}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-slate-500 truncate">
                    {session.model?.split('/').pop() || 'unknown model'}
                  </span>
                  <span className="text-[10px] text-slate-600">
                    {session.lastActive ? relativeTime(Date.now() - session.lastActive) : ''}
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        <div className="p-3 border-t border-slate-800">
          <div className="flex items-center gap-2 text-[10px] text-slate-600">
            <span className={`h-1.5 w-1.5 rounded-full ${statusColor}`}></span>
            <span>{status === 'connected' ? 'Gateway connected' : status === 'connecting' ? 'Connecting...' : 'Disconnected'}</span>
          </div>
          <div className="flex items-center gap-2 text-[10px] text-slate-600 mt-1">
            <span>📱</span>
            <span>Messages sync across all channels</span>
          </div>
        </div>
      </div>

      {/* ─── Chat Area ───────────────────────────────────────── */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 bg-slate-900/50">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">
                {activeSession?.icon || '💬'} {activeSession?.label || 'Nova Chat'}
              </h2>
              <p className="text-xs text-slate-500">
                {activeSession?.model?.split('/').pop() || 'Direct session'} · {activeSession?.source || 'gateway'}
              </p>
            </div>
            <div className="flex items-center gap-3">
              {loadingHistory && (
                <span className="text-[10px] text-slate-500 animate-pulse">Loading history...</span>
              )}
              <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium ${
                status === 'connected' ? 'bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20' : 'bg-slate-500/10 text-slate-400 ring-1 ring-slate-500/20'
              }`}>
                <span className={`h-1.5 w-1.5 rounded-full ${statusColor}`}></span>
                {status === 'connected' ? 'Nova Online' : status === 'connecting' ? 'Connecting...' : status === 'error' ? 'Error' : 'Offline'}
              </span>
            </div>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {messages.length === 0 && !loadingHistory && canChat && (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <span className="text-4xl mb-4">🤖</span>
              <h3 className="text-lg font-medium text-white mb-2">Nova is ready</h3>
              <p className="text-sm text-slate-500">Type a message to start chatting · History loads automatically</p>
            </div>
          )}
          {messages.length === 0 && loadingHistory && (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <span className="text-4xl mb-4 animate-bounce">⏳</span>
              <h3 className="text-lg font-medium text-white mb-2">Loading conversation...</h3>
            </div>
          )}
          {messages.length === 0 && !canChat && !loadingHistory && (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <span className="text-4xl mb-4">🔌</span>
              <h3 className="text-lg font-medium text-white mb-2">
                {status === 'connecting' ? 'Connecting to Nova...' : 'Disconnected'}
              </h3>
              <p className="text-sm text-slate-500">Will reconnect automatically</p>
            </div>
          )}

          {messages.map((msg, i) => {
            const isUser = msg.role === 'user';
            const isSystem = msg.role === 'system';
            const showDate = i === 0 || formatDate(msg.timestamp) !== formatDate(messages[i - 1].timestamp);

            return (
              <React.Fragment key={msg.id}>
                {showDate && (
                  <div className="flex justify-center">
                    <span className="text-[10px] text-slate-600 bg-slate-800/50 px-3 py-1 rounded-full">
                      {formatDate(msg.timestamp)}
                    </span>
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
                        <span className="text-[10px]">
                          {sourceIcon[msg.source] || '💬'}
                        </span>
                        <span className="text-[10px] text-slate-500 font-medium">
                          {isUser ? (msg.source === 'telegram' ? 'Beck (Telegram)' : msg.source === 'dashboard' ? 'You (Dashboard)' : 'You') : 'Nova'}
                        </span>
                        <span className="text-[10px] text-slate-600">{formatTime(msg.timestamp)}</span>
                      </div>
                      <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">
                        {msg.content}
                      </p>
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

        {/* Input */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-900/50">
          <div className="flex gap-3">
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
              }}
              placeholder={canChat ? `Message in ${activeSession?.label || 'Nova Chat'}...` : 'Connecting to gateway...'}
              disabled={sending || !canChat}
              className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500/50 placeholder:text-slate-600 disabled:opacity-50"
            />
            <button
              onClick={sendMessage}
              disabled={sending || !input.trim() || !canChat}
              className="px-5 py-3 bg-blue-500 text-white rounded-xl text-sm font-medium hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {sending ? (
                <span className="flex items-center gap-2">
                  <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Thinking</span>
                </span>
              ) : 'Send'}
            </button>
          </div>
          <p className="text-[10px] text-slate-600 mt-2">
            Session: {activeSessionKey} · Real-time sync across all channels
          </p>
        </div>
      </div>
    </div>
  );
};

export default ChatPage;
