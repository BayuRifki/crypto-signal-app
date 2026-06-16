const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

export const DEFAULT_TIMEOUT_MS = 8000;

/**
 * If your Node.js install is missing the CA cert chain for some exchange APIs
 * (common on stripped Windows installs / corporate proxies), set
 * `NODE_TLS_REJECT_UNAUTHORIZED=0` in your environment before starting the
 * dev server. This is a Node-native flag — no extra dependency needed.
 *
 *   Windows:    set NODE_TLS_REJECT_UNAUTHORIZED=0 && npm run dev
 *   Linux/Mac:  NODE_TLS_REJECT_UNAUTHORIZED=0 npm run dev
 */
export const fetchWithTimeout = async (url: string, init: RequestInit = {}, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<Response> => {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      ...init,
      signal: ctl.signal,
      headers: { 'User-Agent': BROWSER_UA, Accept: 'application/json', ...(init.headers ?? {}) },
    });
    return res;
  } catch (err) {
    const e = err as Error & { cause?: unknown; code?: string };
    const causeMsg = e.cause && typeof e.cause === 'object' && 'message' in (e.cause as object)
      ? (e.cause as { message?: string }).message
      : null;
    const detail = causeMsg || e.message || e.code || 'unknown';
    throw new Error(`${e.name || 'FetchError'}: ${detail} (${url})`);
  } finally {
    clearTimeout(timer);
  }
};

/**
 * Public CORS proxy fallback. Used only when direct + Next.js proxy both fail
 * (e.g. user in a region where exchange API is geo-blocked even at the server).
 */
const CORS_PROXIES: { name: string; transform: (url: string) => string }[] = [
  { name: 'corsproxy.io', transform: (u) => `https://corsproxy.io/?${encodeURIComponent(u)}` },
  { name: 'allorigins.win', transform: (u) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}` },
];

export const fetchViaCorsProxy = async (url: string, init: RequestInit = {}, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<Response> => {
  let lastErr: unknown;
  for (const p of CORS_PROXIES) {
    try {
      const res = await fetchWithTimeout(p.transform(url), init, timeoutMs);
      if (res.ok) return res;
      lastErr = new Error(`${p.name} HTTP ${res.status}`);
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr ?? new Error('all CORS proxies failed');
};
