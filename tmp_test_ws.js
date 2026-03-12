
import WebSocket from 'ws';

const GATEWAY_URL = 'wss://98-93-181-83.sslip.io';
const AUTH_TOKEN = '7dd8ac893a339cb334fb2e5e644a22db16ceeed9baf0ab7a';

async function testConnection(method) {
    console.log(`\nTesting connection with method: ${method}`);
    return new Promise((resolve) => {
        let ws;
        let timeout = setTimeout(() => {
            console.log(`[${method}] Timed out after 5s`);
            if (ws) ws.terminate();
            resolve(false);
        }, 5000);

        try {
            if (method === 'subprotocol') {
                ws = new WebSocket(GATEWAY_URL, [AUTH_TOKEN]);
            } else if (method === 'message') {
                ws = new WebSocket(GATEWAY_URL);
            } else if (method === 'query') {
                ws = new WebSocket(`${GATEWAY_URL}?token=${AUTH_TOKEN}`);
            }

            ws.on('open', () => {
                console.log(`[${method}] Connection opened`);
                if (method === 'message') {
                    console.log(`[${method}] Sending auth message...`);
                    ws.send(JSON.stringify({ type: 'auth', token: AUTH_TOKEN }));
                }
            });

            ws.on('message', (data) => {
                console.log(`[${method}] Received: ${data}`);
                if (data.toString().includes('"ok":true') || data.toString().includes('auth:ok')) {
                    console.log(`[${method}] Authentication successful!`);
                    clearTimeout(timeout);
                    ws.close();
                    resolve(true);
                }
            });

            ws.on('close', (code, reason) => {
                console.log(`[${method}] Connection closed: ${code} ${reason}`);
                clearTimeout(timeout);
                resolve(false);
            });

            ws.onerror = (err) => {
                console.log(`[${method}] Error: ${err.message}`);
                clearTimeout(timeout);
                resolve(false);
            };
        } catch (err) {
            console.log(`[${method}] Construction error: ${err.message}`);
            clearTimeout(timeout);
            resolve(false);
        }
    });
}

async function run() {
    await testConnection('message');
    await testConnection('subprotocol');
    await testConnection('query');
}

run();
