import React, { useState, useEffect, useRef, useCallback } from 'react';
import { getOrCreateDeviceIdentity } from '../utils/cryptoUtils';

const GATEWAY_URL = 'wss://98-93-181-83.sslip.io';
const AUTH_TOKEN = '7dd8ac893a339cb334fb2e5e644a22db16ceeed9baf0ab7a';

interface Message {
  id: string; role: string; content: string;
  timestamp: string; source: string;
  streaming?: boolean;
}

type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

const sourceIcon: Record<string, string> = {
  dashboard: '🖥️', telegram: '📱', system: '⚙️', nova: '🤖', user: '👤',
};

let reqCounter = 0;
function nextReqId() {
  return `dashboard-${Date.now()}-${++reqCounter}`;
}

/** Extract text from a gateway chat message object */
function extractMessageText(msg: any): string {
  if (!msg) return '';
  // String content
  if (typeof msg.content === 'string') return msg.content;
  // Array content: [{ type: "text", text: "..." }, ...]
  if (Array.isArray(msg.content)) {
    return msg.content
      .filter((c: any) => c.type === 'text' && typeof c.text === 'string')
      .map((c: any) => c.text)
      .join('');
  }
  // Direct text field
  if (typeof msg.text === 'string') return msg.text;
  // message field
  if (typeof msg.message === 'string') return msg.message;
  return '';
}

const ChatPage: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const currentStreamRef = useRef<string | null>(null); // tracks current streaming message id
  const currentRunIdRef = useRef<string | null>(null);

  // OpenClaw Gateway WebSocket Protocol Handler
  const handleGatewayMessage = useCallback((event: MessageEvent) => {
    try {
      const data = JSON.parse(event.data);

      // --- Handshake: connect.challenge ---
      if (data.type === 'event' && data.event === 'connect.challenge') {
        const nonce = data.payload?.nonce;
        if (!nonce) return;
        console.log('[WS] Got connect.challenge, signing nonce...');

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
                type: 'req',
                id: nextReqId(),
                method: 'connect',
                params: {
                  minProtocol: 3, maxProtocol: 3,
                  client: { id: 'openclaw-control-ui', version: '1.0.0', platform: 'web', mode: 'webchat' },
                  device,
                  role: 'operator',
                  scopes: ['operator.read', 'operator.write'],
                  caps: [], commands: [], permissions: {},
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

      // --- hello-ok ---
      if (data.type === 'res' && data.payload?.type === 'hello-ok') {
        console.log('[WS] Connected! Protocol:', data.payload.protocol);
        setStatus('connected');
        return;
      }

      // --- chat.send ack ---
      if (data.type === 'res' && data.ok === true && data.payload?.runId) {
        console.log('[WS] chat.send ack, runId:', data.payload.runId);
        currentRunIdRef.current = data.payload.runId;
        return;
      }

      // --- Request errors ---
      if (data.type === 'res' && data.ok === false) {
        const code = data.error?.code || '';
        const msg = data.error?.message || '';
        console.error('[WS] Request failed:', code, msg);
        // Don't set error status for non-critical failures (like missing scope)
        if (code === 'NOT_PAIRED' || msg.includes('auth')) {
          setStatus('error');
        }
        return;
      }

      // --- Chat events (the actual response streaming) ---
      if (data.type === 'event' && data.event === 'chat') {
        const p = data.payload;
        if (!p) return;

        const state = p.state; // "delta" | "final" | "aborted" | "error"
        const text = extractMessageText(p.message);

        if (state === 'delta') {
          // Streaming update — replace full text (gateway sends cumulative deltas)
          setMessages(prev => {
            const streamId = currentStreamRef.current;
            if (streamId) {
              return prev.map(m =>
                m.id === streamId ? { ...m, content: text || m.content, streaming: true } : m
              );
            } else {
              const newId = `assistant-${Date.now()}`;
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
          const finalText = text;
          if (currentStreamRef.current) {
            // Finalize the streaming message
            setMessages(prev => prev.map(m =>
              m.id === currentStreamRef.current
                ? { ...m, content: finalText || m.content, streaming: false }
                : m
            ));
          } else if (finalText) {
            // No streaming happened, just show the full message
            setMessages(prev => [...prev, {
              id: `assistant-${Date.now()}`, role: 'assistant', content: finalText,
              timestamp: new Date().toISOString(), source: 'nova',
            }]);
          }
          currentStreamRef.current = null;
          currentRunIdRef.current = null;
          setSending(false);
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

      // --- Agent events (tool calls, thinking — cosmetic) ---
      if (data.type === 'event' && data.event === 'agent') {
        // Agent events include tool call progress. We can show a thinking indicator.
        // For now, just log them — text comes via chat events.
        return;
      }

      // Ignore tick/presence/health silently
      if (data.type === 'event' && ['tick', 'presence', 'system-presence', 'health'].includes(data.event)) {
        return;
      }

    } catch (e) {
      console.error('[WS] Parse error:', e);
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

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || sending) return;

    const text = input.trim();
    setSending(true);

    const userMsg: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date().toISOString(),
      source: 'dashboard',
    };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    currentStreamRef.current = null;
    currentRunIdRef.current = null;

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
        timestamp: new Date().toISOString(), source: 'system',
      }]);
      setSending(false);
    }
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

  const canChat = status === 'connected';

  return (
    <div className="flex h-screen">
      {/* Session List */}
      <div className="w-72 bg-slate-900 border-r border-slate-800 flex flex-col shrink-0">
        <div className="p-4 border-b border-slate-800">
          <h2 className="text-sm font-semibold text-white">Sessions</h2>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          <button className="w-full text-left rounded-lg p-3 bg-blue-500/10 border border-blue-500/20">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium text-white">💬 Nova Chat</span>
              <span className={`h-2 w-2 rounded-full ${statusColor}`}></span>
            </div>
            <p className="text-[11px] text-slate-500">Direct gateway session</p>
          </button>
        </div>
        <div className="p-3 border-t border-slate-800">
          <div className="flex items-center gap-2 text-[10px] text-slate-600">
            <span>📱</span>
            <span>Messages sync across Dashboard & Telegram</span>
          </div>
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 bg-slate-900/50">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">Nova Chat</h2>
              <p className="text-xs text-slate-500">Direct gateway session</p>
            </div>
            <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium ${
              status === 'connected' ? 'bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20' : 'bg-slate-500/10 text-slate-400 ring-1 ring-slate-500/20'
            }`}>
              <span className={`h-1.5 w-1.5 rounded-full ${statusColor}`}></span>
              {status === 'connected' ? 'Nova Online' : status === 'connecting' ? 'Connecting...' : status === 'error' ? 'Error' : 'Offline'}
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
            const showDate = i === 0 || formatDate(msg.timestamp) !== formatDate(messages[i - 1].timestamp);

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

        {/* Input */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-900/50">
          <div className="flex gap-3">
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
              placeholder={canChat ? 'Message Nova...' : 'Connecting to gateway...'}
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
          <p className="text-[10px] text-slate-600 mt-2">Connected to OpenClaw gateway · Messages sync across all channels</p>
        </div>
      </div>
    </div>
  );
};

export default ChatPage;
