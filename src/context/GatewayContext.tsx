import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { getOrCreateDeviceIdentity, type DeviceIdentityParams } from '../utils/cryptoUtils';
import { getGatewayConfig } from '../gatewayConfig';

type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

interface GatewayContextType {
  status: ConnectionStatus;
  events: any[];
  eco: any | null;
  ws: WebSocket | null;
  sendMessage: (method: string, params: any) => void;
  sendRpc: (method: string, params: any, timeoutMs?: number) => Promise<any>;
}

const GatewayContext = createContext<GatewayContextType | undefined>(undefined);

let reqCounter = 0;
function nextReqId() {
  return `gw-${Date.now()}-${++reqCounter}`;
}

export const GatewayProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [events, setEvents] = useState<any[]>([]);
  const [eco, setEco] = useState<any | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const wsConnectedRef = useRef(false);
  const pendingRpcRef = useRef<Map<string, { resolve: (v: any) => void; reject: (e: Error) => void }>>(new Map());

  const connect = useCallback(async () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;
    
    const cfg = await getGatewayConfig();
    console.log('[Gateway] Connecting to', cfg.gatewayUrl);
    setStatus('connecting');
    const ws = new WebSocket(cfg.gatewayUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('[Gateway] Socket opened, waiting for connect.challenge...');
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        // Handle RPC responses
        if (data.type === 'res') {
          const pendingCount = pendingRpcRef.current.size;
          const pending = pendingRpcRef.current.get(data.id);
          if (pending) {
            console.log('[Gateway] RPC response:', data.id, data.ok !== false ? 'ok' : 'error', `(${pendingCount} pending)`);
            pendingRpcRef.current.delete(data.id);
            if (data.ok === false) {
              pending.reject(new Error(data.error?.message || data.error?.code || 'RPC error'));
            } else {
              pending.resolve(data.payload);
            }
            return;
          }

          // Handle connect response (hello-ok)
          if (data.payload?.type === 'hello-ok') {
            console.log('[Gateway] Connected! Protocol:', data.payload.protocol, 'scopes:', data.payload.auth?.scopes);
            wsConnectedRef.current = true;
            setStatus('connected');
            return;
          }

          // Handle errors
          if (data.ok === false) {
            console.error('[Gateway] Error:', data.error?.code, data.error?.message);
            if (data.error?.code === 'NOT_PAIRED') {
              console.warn('[Gateway] Device not paired — needs approval');
              setStatus('error');
            }
            return;
          }
          // Unmatched res — log it
          console.warn('[Gateway] Unmatched res id:', data.id, 'pending IDs:', [...pendingRpcRef.current.keys()]);
          return;
        }

        // Handle connect.challenge event
        if (data.type === 'event' && data.event === 'connect.challenge') {
          const nonce = data.payload?.nonce;
          if (!nonce) return;
          
          console.log('[Gateway] Got challenge, signing nonce...');
          (async () => {
            try {
              const device = await getOrCreateDeviceIdentity(nonce, {
                clientId: 'openclaw-control-ui',
                clientMode: 'webchat',
                platform: 'web',
                role: 'operator',
                scopes: ['operator.read', 'operator.write'],
                token: cfg.authToken
              });
              
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
                  auth: { token: cfg.authToken },
                  locale: navigator.language || 'en-US',
                  userAgent: 'nova-dashboard/1.0.0',
                }
              }));
            } catch (err) {
              console.error('[Gateway] Device identity error:', err);
              setStatus('error');
            }
          })();
          return;
        }

        // Handle events once connected
        if (data.type === 'event') {
          if (data.event === 'chat' || data.event === 'agent') {
            setEvents(prev => [...prev, data.payload].slice(-50));
          }
          if (data.event === 'ecosystem' || data.event === 'state') {
            setEco(data.payload);
          }
        }
      } catch (e) {
        console.error('[Gateway] Parse error:', e);
      }
    };

    ws.onclose = (event) => {
      if (wsRef.current !== ws) return;
      console.log('[Gateway] Closed:', event.code, event.reason);
      wsConnectedRef.current = false;
      setStatus('disconnected');
      wsRef.current = null;
      // Reject all pending RPCs
      for (const [id, p] of pendingRpcRef.current) {
        p.reject(new Error('Connection closed'));
      }
      pendingRpcRef.current.clear();
      if (event.code !== 1000) {
        reconnectTimeoutRef.current = setTimeout(() => connect(), 3000);
      }
    };

    ws.onerror = () => {
      if (wsRef.current !== ws) return;
      console.error('[Gateway] WebSocket error');
      setStatus('error');
    };
  }, []);

  // Fetch ecosystem data from static files + API
  useEffect(() => {
    const loadData = async () => {
      let ecoData: any = null;
      try {
        const r = await fetch('/ecosystem.json');
        if (r.ok) ecoData = await r.json();
      } catch {}
      if (!ecoData) ecoData = { departments: [], individualAgents: [], projects: [] };
      
      try {
        const r = await fetch('/api/agents');
        if (r.ok) {
          const agents = await r.json();
          if (agents.departments) ecoData.departments = agents.departments;
          if (agents.individuals) ecoData.individualAgents = agents.individuals;
        }
      } catch {}
      
      try {
        const r = await fetch('/kanban.json');
        if (r.ok) {
          const ct = r.headers.get('content-type') || '';
          if (ct.includes('json')) ecoData.kanban = await r.json();
        }
      } catch {}
      
      setEco(ecoData);
    };
    loadData();
    const interval = setInterval(loadData, 120000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    connect();
    return () => {
      wsRef.current?.close();
      clearTimeout(reconnectTimeoutRef.current);
    };
  }, [connect]);

  const sendMessage = useCallback((method: string, params: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'req',
        id: nextReqId(),
        method,
        params
      }));
    }
  }, []);

  const sendRpc = useCallback((method: string, params: any, timeoutMs = 15000): Promise<any> => {
    return new Promise((resolve, reject) => {
      const ws = wsRef.current;
      if (!ws || ws.readyState !== WebSocket.OPEN || !wsConnectedRef.current) {
        reject(new Error('Not connected'));
        return;
      }
      const id = nextReqId();
      console.log('[Gateway] RPC send:', method, id, `(${pendingRpcRef.current.size} pending)`);
      pendingRpcRef.current.set(id, { resolve, reject });
      ws.send(JSON.stringify({ type: 'req', id, method, params }));
      setTimeout(() => {
        const p = pendingRpcRef.current.get(id);
        if (p) {
          console.warn('[Gateway] RPC timeout:', method, id, `(${pendingRpcRef.current.size} still pending)`);
          pendingRpcRef.current.delete(id);
          p.reject(new Error(`RPC timeout: ${method}`));
        }
      }, timeoutMs);
    });
  }, []);

  return (
    <GatewayContext.Provider value={{ status, events, eco, ws: wsRef.current, sendMessage, sendRpc }}>
      {children}
    </GatewayContext.Provider>
  );
};

export const useGateway = () => {
  const context = useContext(GatewayContext);
  if (!context) throw new Error('useGateway must be used within GatewayProvider');
  return context;
};
