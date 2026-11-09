// Base URL of the local UPAF runner/proxy server (`npm run proxy`, see auth-proxy.js).
export const RUNNER_URL = (import.meta.env.VITE_RUNNER_URL || 'http://localhost:5175').replace(/\/+$/, '');

// In dev, Vite serves /proxy itself (vite.config.js); in production we go to the runner server.
export const PROXY_URL = import.meta.env.DEV ? '/proxy' : `${RUNNER_URL}/proxy`;

// Turns a network-level fetch failure into an actionable message.
export function describeRunnerError(err) {
  if (err instanceof TypeError) {
    return `Runner sunucusuna ulaşılamadı (${RUNNER_URL}). Lokal makinede "cd dashboard && npm run proxy" ile başlatın veya VITE_RUNNER_URL ayarını kontrol edin.`;
  }
  return err?.message || String(err);
}
