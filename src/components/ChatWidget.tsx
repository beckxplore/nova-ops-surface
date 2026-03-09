import React, { useState, useEffect, useRef, useCallback } from 'react';

const GATEWAY_URL = 'wss://98-93-181-83.sslip.io';
const AUTH_TOKEN = '7dd8ac893a339cb334fb2e5e644a22db16ceeed9baf0ab7a';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  streaming?: boolean;
}

type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export default function ChatWidget() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [isExpanded, setIsExpanded] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const currentAssistantMsgRef = useRef<string | null>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;
    
    setStatus('connecting');
    const ws = new WebSocket(GATEWAY_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      // Authenticate
      ws.send(JSON.stringify({
        type: 'auth',
        token: AUTH_TOKEN
      }));
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.type === 'auth' && data.ok) {
          setStatus('connected');
          return;
        }

        if (data.type === 'auth' && !data.ok) {
          setStatus('error');
          return;
        }

        // Handle chat responses
        if (data.type === 'chat:chunk' || data.type === 'agent:chunk') {
          const text = data.text || data.content || data.delta || '';
          if (!text) return;
          
          setMessages(prev => {
            const assistantId = currentAssistantMsgRef.current;
            if (assistantId) {
              return prev.map(m => 
                m.id === assistantId 
                  ? { ...m, content: m.content + text, streaming: true }
                  : m
              );
            } else {
              const newId = `assistant-${Date.now()}`;
              currentAssistantMsgRef.current = newId;
              return [...prev, {
                id: newId,
                role: 'assistant',
                content: text,
                timestamp: new Date(),
                streaming: true
              }];
            }
          });
        }

        if (data.type === 'chat:response' || data.type === 'agent:response') {
          const content = data.text || data.content || data.message || '';
          if (currentAssistantMsgRef.current) {
            // Finalize streaming message
            setMessages(prev => prev.map(m => 
              m.id === currentAssistantMsgRef.current
                ? { ...m, streaming: false, content: content || m.content }
                : m
            ));
          } else if (content) {
            setMessages(prev => [...prev, {
              id: `assistant-${Date.now()}`,
              role: 'assistant',
              content,
              timestamp: new Date(),
            }]);
          }
          currentAssistantMsgRef.current = null;
          setIsSending(false);
        }

        if (data.type === 'chat:end' || data.type === 'agent:end' || data.type === 'agent:done') {
          if (currentAssistantMsgRef.current) {
            setMessages(prev => prev.map(m =>
              m.id === currentAssistantMsgRef.current
                ? { ...m, streaming: false }
                : m
            ));
          }
          currentAssistantMsgRef.current = null;
          setIsSending(false);
        }

        if (data.type === 'error') {
          setMessages(prev => [...prev, {
            id: `error-${Date.now()}`,
            role: 'system',
            content: `Error: ${data.message || data.error || 'Unknown error'}`,
            timestamp: new Date(),
          }]);
          setIsSending(false);
          currentAssistantMsgRef.current = null;
        }

      } catch {
        // Non-JSON message, ignore
      }
    };

    ws.onclose = () => {
      setStatus('disconnected');
      wsRef.current = null;
      // Auto-reconnect after 3s
      reconnectTimeoutRef.current = setTimeout(() => {
        if (isExpanded) connect();
      }, 3000);
    };

    ws.onerror = () => {
      setStatus('error');
    };
  }, [isExpanded]);

  useEffect(() => {
    if (isExpanded) {
      connect();
      inputRef.current?.focus();
    }
    return () => {
      clearTimeout(reconnectTimeoutRef.current);
    };
  }, [isExpanded, connect]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      wsRef.current?.close();
      clearTimeout(reconnectTimeoutRef.current);
    };
  }, []);

  const sendMessage = () => {
    const text = input.trim();
    if (!text || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN || isSending) return;

    const userMsg: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsSending(true);
    currentAssistantMsgRef.current = null;

    wsRef.current.send(JSON.stringify({
      type: 'chat:message',
      message: text,
    }));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const statusColor = {
    disconnected: 'bg-gray-400',
    connecting: 'bg-yellow-400 animate-pulse',
    connected: 'bg-emerald-400',
    error: 'bg-red-500',
  }[status];

  const statusText = {
    disconnected: 'Offline',
    connecting: 'Connecting...',
    connected: 'Live',
    error: 'Error',
  }[status];

  // Floating chat button when collapsed
  if (!isExpanded) {
    return (
      <button
        onClick={() => setIsExpanded(true)}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-gradient-to-br from-violet-600 to-indigo-700 text-white shadow-lg shadow-violet-500/30 hover:shadow-xl hover:shadow-violet-500/40 hover:scale-105 transition-all duration-200 flex items-center justify-center group"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 group-hover:scale-110 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
        {messages.length > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-[10px] font-bold flex items-center justify-center">
            {messages.filter(m => m.role === 'assistant').length}
          </span>
        )}
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 w-[420px] h-[600px] bg-gray-950 rounded-2xl shadow-2xl shadow-black/50 border border-gray-800 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-violet-900/80 to-indigo-900/80 border-b border-gray-800">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-sm">
            🤖
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Nova</h3>
            <div className="flex items-center gap-1.5">
              <div className={`w-2 h-2 rounded-full ${statusColor}`} />
              <span className="text-[11px] text-gray-400">{statusText}</span>
            </div>
          </div>
        </div>
        <button
          onClick={() => setIsExpanded(false)}
          className="w-8 h-8 rounded-lg hover:bg-white/10 flex items-center justify-center text-gray-400 hover:text-white transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 scrollbar-thin">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center text-gray-500">
            <div className="w-16 h-16 rounded-full bg-gray-900 flex items-center justify-center mb-3 text-2xl">
              🤖
            </div>
            <p className="text-sm font-medium text-gray-400">Nova Command Center</p>
            <p className="text-xs mt-1">Connected to AWS Gateway</p>
          </div>
        )}
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-violet-600 text-white rounded-br-md'
                  : msg.role === 'system'
                  ? 'bg-red-900/50 text-red-300 border border-red-800/50 rounded-bl-md'
                  : 'bg-gray-800 text-gray-200 rounded-bl-md'
              }`}
            >
              <div className="whitespace-pre-wrap break-words">{msg.content}</div>
              {msg.streaming && (
                <span className="inline-block w-1.5 h-4 bg-violet-400 animate-pulse ml-0.5 rounded-sm" />
              )}
              <div className={`text-[10px] mt-1 ${msg.role === 'user' ? 'text-violet-300' : 'text-gray-500'}`}>
                {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="px-4 py-3 bg-gray-900/80 border-t border-gray-800">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={status === 'connected' ? 'Message Nova...' : 'Connecting...'}
            disabled={status !== 'connected'}
            rows={1}
            className="flex-1 resize-none bg-gray-800 text-white text-sm rounded-xl px-4 py-2.5 border border-gray-700 focus:border-violet-500 focus:ring-1 focus:ring-violet-500/50 outline-none placeholder-gray-500 disabled:opacity-50 max-h-32 transition-colors"
            style={{ minHeight: '42px' }}
            onInput={(e) => {
              const target = e.target as HTMLTextAreaElement;
              target.style.height = 'auto';
              target.style.height = Math.min(target.scrollHeight, 128) + 'px';
            }}
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || status !== 'connected' || isSending}
            className="w-10 h-10 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:bg-gray-700 disabled:text-gray-500 text-white flex items-center justify-center transition-colors flex-shrink-0"
          >
            {isSending ? (
              <svg className="w-4 h-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
