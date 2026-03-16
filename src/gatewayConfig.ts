// Runtime gateway config — loaded from /gateway-config.json (in public/)
// This avoids hardcoding the gateway URL in the JS bundle.

interface GatewayConfig {
  gatewayUrl: string;
  authToken: string;
}

let cached: GatewayConfig | null = null;
let loading: Promise<GatewayConfig> | null = null;

export async function getGatewayConfig(): Promise<GatewayConfig> {
  if (cached) return cached;
  if (loading) return loading;

  loading = (async () => {
    try {
      const r = await fetch('/gateway-config.json');
      if (r.ok) {
        const data = await r.json();
        cached = { gatewayUrl: data.gatewayUrl, authToken: data.authToken };
        return cached;
      }
    } catch {}
    // Fallback (should not happen in production)
    cached = { gatewayUrl: 'wss://3-227-84-30.sslip.io', authToken: '' };
    return cached;
  })();

  return loading;
}
