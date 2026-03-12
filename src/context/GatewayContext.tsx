import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { getOrCreateDeviceIdentity, type DeviceIdentityParams } from '../utils/cryptoUtils';

const GATEWAY_URL = 'wss://98-93-181-83.sslip.io';
const AUTH_TOKEN = '7dd8ac893a339cb334fb2e5e644a22db16ceeed9baf0ab7a';

type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

interface GatewayContextType {
  status: ConnectionStatus;
  events: any[];
  eco: any | null;
  ws: WebSocket | null;
  sendMessage: (method: string, params: any) => void;
}

const GatewayContext = createContext<GatewayContextType | undefined>(undefined);

export const GatewayProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [events, setEvents] = useState<any[]>([]);
  const [eco, setEco] = useState<any | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  
  let reqCounter = 0;
  const nextReqId = () => `gw-${Date.now()}-${++reqCounter}`;

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;
    
    console.log('[Gateway] Connecting...');
    setStatus('connecting');
    const ws = new WebSocket(GATEWAY_URL);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        // Handle Handshake
        if (data.method === 'connect.challenge') {
          const nonce = data.params.nonce;
          (async () => {
             const params: DeviceIdentityParams = {
               clientId: 'openclaw-control-ui',
               clientMode: 'webchat',
               platform: 'web',
               role: 'operator',
               scopes: ['operator.read', 'operator.write'],
               token: AUTH_TOKEN
             };
             const device = await getOrCreateDeviceIdentity(nonce, params);
             ws.send(JSON.stringify({
               type: 'req',
               id: nextReqId(),
               method: 'connect',
               params: { ...params, minProtocol: 3, maxProtocol: 3, device, auth: { token: AUTH_TOKEN } }
             }));
          })();
          return;
        }

        if (data.type === 'res' && data.payload?.type === 'hello-ok') {
          console.log('[Gateway] Connected!');
          setStatus('connected');
          return;
        }

        // Handle Events
        if (data.type === 'event') {
          if (data.event === 'chat' || data.event === 'agent') {
            setEvents(prev => [...prev, data.payload].slice(-50));
          }
          // Placeholder for ecosystem updates if emitted
          if (data.event === 'ecosystem' || data.event === 'state') {
            setEco(data.payload);
          }
        }
      } catch (e) {
        console.error('[Gateway] Error:', e);
      }
    };

    ws.onclose = () => {
      if (wsRef.current !== ws) return;
      setStatus('disconnected');
      wsRef.current = null;
      reconnectTimeoutRef.current = setTimeout(() => connect(), 3000);
    };

    ws.onerror = () => {
      if (wsRef.current !== ws) return;
      setStatus('error');
    };
  }, []);

  useEffect(() => {
    connect();
    return () => {
      wsRef.current?.close();
      clearTimeout(reconnectTimeoutRef.current);
    };
  }, [connect]);

  const sendMessage = (method: string, params: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'req',
        id: nextReqId(),
        method,
        params
      }));
    }
  };

  return (
    <GatewayContext.Provider value={{ status, events, eco, ws: wsRef.current, sendMessage }}>
      {children}
    </GatewayContext.Provider>
  );
};

export const useGateway = () => {
  const context = useContext(GatewayContext);
  if (!context) throw new Error('useGateway must be used within GatewayProvider');
  return context;
};
