// Vercel Serverless Function — list available OpenClaw models
const GATEWAY_URL = 'https://3-227-84-30.sslip.io';
const AUTH_TOKEN = '7dd8ac893a339cb334fb2e5e644a22db16ceeed9baf0ab7a';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    // Try fetching models from the gateway config
    const r = await fetch(`${GATEWAY_URL}/nova-api/api/models`, {
      headers: { Authorization: `Bearer ${AUTH_TOKEN}` },
      signal: AbortSignal.timeout(5000),
    });

    if (r.ok) {
      const data = await r.json();
      return res.status(200).json(data);
    }
  } catch {}

  // Fallback: return known models from config
  const models = [
    { id: 'openrouter/minimax/minimax-m2.5:free', name: 'MiniMax M2.5 (Free)', alias: 'MiniMax M2.5 (Free)' },
    { id: 'openrouter/xiaomi/mimo-v2-pro', name: 'MiMo-V2-Pro', alias: 'MiMo-V2-Pro' },
    { id: 'openrouter/deepseek/deepseek-v3.2', name: 'DeepSeek V3.2', alias: 'DeepSeek V3.2' },
    { id: 'openrouter/deepseek/deepseek-r1', name: 'DeepSeek R1', alias: 'DeepSeek R1' },
    { id: 'openrouter/stepfun/step-3.5-flash', name: 'Step 3.5 Flash', alias: 'Step 3.5 Flash' },
    { id: 'openrouter/stepfun/step-3.5-flash:free', name: 'Step 3.5 Flash (Free)', alias: 'Step 3.5 Flash (Free)' },
    { id: 'openrouter/anthropic/claude-sonnet-4.6', name: 'Claude Sonnet 4.6', alias: 'Claude Sonnet 4.6' },
    { id: 'openrouter/google/gemini-3-flash-preview', name: 'Gemini 3 Flash', alias: 'Gemini 3 Flash' },
    { id: 'openrouter/openai/gpt-5.4', name: 'GPT-5.4', alias: 'GPT-5.4' },
    { id: 'openrouter/qwen/qwen3-32b', name: 'Qwen3 32B', alias: 'Qwen3 32B' },
    { id: 'auto', name: 'OpenRouter Auto', alias: 'Auto' },
  ];

  return res.status(200).json(models);
}