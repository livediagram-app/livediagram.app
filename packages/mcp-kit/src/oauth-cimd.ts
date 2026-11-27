// Client ID Metadata Documents (liveworkspace/docs/specs/021-mcp/mcp.md "Client ID Metadata Documents"; Work Tracker
// 1449; draft-ietf-oauth-client-id-metadata-document): a client whose `client_id` is an https URL is described by the
// JSON document at that URL, so it needs no registration per connection. Fetching a URL a client names is a server
// fetch of a stranger's address, so it is held tight: https to a host name only, no redirects, 5 KB, 3 seconds, a
// per-address limit on fetches, and a 24-hour cache (a refusal 5 minutes).
import { clientRateKey } from '@liveworkspace/api-kit/client-ip';
import { isAnthropicEgress } from './anthropic-egress';
import type { ClientReg, OauthEnv } from './oauth-clients';
import { reservedNameRefusal } from './oauth-names';
import { overWindowLimit, type RateWindow } from './rate-window';

export const CIMD_MAX_BYTES = 5 * 1024;
export const CIMD_TIMEOUT_MS = 3000;
export const CIMD_CACHE_S = 24 * 60 * 60;
export const CIMD_REFUSAL_CACHE_S = 5 * 60;
export const CIMD_URL_MAX = 255;
// A redirect URI the kept copy doesn't list fetches it again, once the copy is this old.
export const CIMD_REFETCH_AFTER_MS = 5 * 60 * 1000;
export const CIMD_FETCH_LIMIT: RateWindow = { max: 30, windowS: 60 * 60 };
export const ANTHROPIC_CIMD_FETCH_LIMIT: RateWindow = { max: 2000, windowS: 60 * 60 };

type Kept = { reg?: ClientReg; refused?: string; at: number };

export type CimdResult = { ok: true; reg: ClientReg } | { ok: false; reason: string };

/** Whether a client id is a metadata document's URL rather than a registered id. */
export function isCimdClientId(clientId: string): boolean {
  return clientId.startsWith('https://');
}

const IPV4 = /^\d{1,3}(\.\d{1,3}){3}$/;
const LOCAL_SUFFIXES = ['.localhost', '.local', '.internal', '.home.arpa'];

/** The document's URL when this server will fetch it, or null: https, a host name, a path, nothing else. */
export function cimdUrl(clientId: string): URL | null {
  if (clientId.length > CIMD_URL_MAX || clientId.includes('#')) return null;
  let url: URL;
  try {
    url = new URL(clientId);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' || url.username || url.password) return null;
  if (url.port && url.port !== '443') return null;
  const host = url.hostname;
  if (host.startsWith('[') || IPV4.test(host) || !host.includes('.')) return null;
  if (host === 'localhost' || LOCAL_SUFFIXES.some((s) => host.endsWith(s))) return null;
  if (url.pathname === '/' || url.pathname.length < 2) return null;
  // The URL as given must be the URL as parsed: no dot segments, case or encoding the parser would change.
  if (url.href !== clientId) return null;
  return url;
}

async function urlKey(url: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(url));
  return `cimd:${Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')}`;
}

// The body, read up to the cap; null when it is longer.
async function cappedText(response: Response): Promise<string | null> {
  const declared = Number(response.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > CIMD_MAX_BYTES) return null;
  if (!response.body) return '';
  const reader = (response.body as ReadableStream<Uint8Array>).getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const read: ReadableStreamReadResult<Uint8Array> = await reader.read();
    if (read.done) break;
    const value = read.value;
    size += value.byteLength;
    if (size > CIMD_MAX_BYTES) {
      await reader.cancel().catch(() => undefined);
      return null;
    }
    chunks.push(value);
  }
  const all = new Uint8Array(size);
  let at = 0;
  for (const chunk of chunks) {
    all.set(chunk, at);
    at += chunk.byteLength;
  }
  return new TextDecoder().decode(all);
}

/** The document's client, or why it is refused, from its parsed JSON. */
export function cimdRegistration(
  clientId: string,
  doc: unknown,
  allowedRedirect: (uri: string) => boolean,
  cleanName: (name: unknown) => string,
): CimdResult {
  if (!doc || typeof doc !== 'object' || Array.isArray(doc))
    return { ok: false, reason: 'The client metadata document is not a JSON object.' };
  const d = doc as Record<string, unknown>;
  if (d.client_id !== clientId)
    return {
      ok: false,
      reason: 'The client metadata document’s client_id is not the URL it was fetched from.',
    };
  const uris = Array.isArray(d.redirect_uris)
    ? d.redirect_uris.filter((u): u is string => typeof u === 'string')
    : [];
  if (uris.length === 0 || uris.length !== (d.redirect_uris as unknown[]).length)
    return { ok: false, reason: 'The client metadata document lists no redirect_uris.' };
  if (!uris.every(allowedRedirect))
    return {
      ok: false,
      reason:
        'The client metadata document lists a redirect_uri this server does not accept (https, http on loopback, or an app’s own scheme).',
    };
  const method = d.token_endpoint_auth_method;
  if (method !== undefined && method !== 'none')
    return {
      ok: false,
      reason: 'This server takes public clients only (token_endpoint_auth_method none).',
    };
  const clientName = cleanName(d.client_name);
  const reserved = reservedNameRefusal(clientName, uris);
  if (reserved) return { ok: false, reason: reserved };
  return { ok: true, reg: { clientName, redirectUris: uris } };
}

async function fetchDocument(
  url: URL,
  fetcher: typeof fetch,
  allowedRedirect: (uri: string) => boolean,
  cleanName: (name: unknown) => string,
): Promise<CimdResult> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | null = null;
  const timeout = new Promise<CimdResult>((resolve) => {
    timer = setTimeout(() => {
      controller.abort();
      resolve({ ok: false, reason: 'The client metadata document took too long to load.' });
    }, CIMD_TIMEOUT_MS);
  });
  const load = (async (): Promise<CimdResult> => {
    const response = await fetcher(url.href, {
      redirect: 'manual',
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    if (response.status !== 200) {
      await response.body?.cancel().catch(() => undefined);
      return {
        ok: false,
        reason:
          response.status >= 300 && response.status < 400
            ? 'The client metadata document redirects; it must be served at its own URL.'
            : `The client metadata document answered ${response.status}.`,
      };
    }
    const text = await cappedText(response);
    if (text === null)
      return { ok: false, reason: 'The client metadata document is larger than 5 KB.' };
    let doc: unknown;
    try {
      doc = JSON.parse(text);
    } catch {
      return { ok: false, reason: 'The client metadata document is not JSON.' };
    }
    return cimdRegistration(url.href, doc, allowedRedirect, cleanName);
  })().catch((): CimdResult => ({
    ok: false,
    reason: 'The client metadata document could not be loaded.',
  }));
  try {
    return await Promise.race([load, timeout]);
  } finally {
    if (timer !== null) clearTimeout(timer);
  }
}

export type CimdOptions = {
  request: Request;
  // The redirect URI this authorize asks for: one the kept copy lacks may fetch the document again.
  redirectUri: string;
  allowedRedirect: (uri: string) => boolean;
  cleanName: (name: unknown) => string;
  fetcher?: typeof fetch;
  now?: number;
};

/** The client a metadata-document client id names: from the 24-hour cache, else fetched under every limit. */
export async function cimdClient(
  env: OauthEnv,
  clientId: string,
  options: CimdOptions,
): Promise<CimdResult> {
  const url = cimdUrl(clientId);
  if (!url)
    return {
      ok: false,
      reason:
        'A client_id URL must be https on a public host name, with a path, at most 255 characters.',
    };
  const now = options.now ?? Date.now();
  const key = await urlKey(url.href);
  const kept = await env.OAUTH_KV.get<Kept>(key, 'json');
  if (kept?.refused) return { ok: false, reason: kept.refused };
  if (kept?.reg) {
    const stale = now - kept.at >= CIMD_REFETCH_AFTER_MS;
    if (kept.reg.redirectUris.includes(options.redirectUri) || !stale)
      return { ok: true, reg: kept.reg };
  }
  const ip = clientRateKey(options.request, 'unknown');
  const limit = isAnthropicEgress(ip) ? ANTHROPIC_CIMD_FETCH_LIMIT : CIMD_FETCH_LIMIT;
  if (await overWindowLimit(env.OAUTH_KV, 'cimd-rate', ip, limit, now))
    return kept?.reg
      ? { ok: true, reg: kept.reg }
      : {
          ok: false,
          reason: 'Too many client metadata documents loaded from this address. Try again later.',
        };
  const result = await fetchDocument(
    url,
    options.fetcher ?? fetch,
    options.allowedRedirect,
    options.cleanName,
  );
  // A failed fetch again keeps the good copy it meant to refresh: one bad moment never locks the client out.
  if (!result.ok && kept?.reg) return { ok: true, reg: kept.reg };
  const record: Kept = result.ok
    ? { reg: result.reg, at: now }
    : { refused: result.reason, at: now };
  await env.OAUTH_KV.put(key, JSON.stringify(record), {
    expirationTtl: result.ok ? CIMD_CACHE_S : CIMD_REFUSAL_CACHE_S,
  });
  if (!result.ok)
    console.warn('[oauth] client metadata document refused', { reason: result.reason });
  return result;
}
