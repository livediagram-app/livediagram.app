// How the index refuses (liveworkspace/docs/specs/004-index/one-explorer-contracts.md): an IndexError with the
// refusal's code and its `Retry-After`, read from a response, and the query string every call builds. Shared by
// the account's client (client.ts) and the app's (app-client.ts); client.ts re-exports the public ones.

import { type IndexErrorCode } from './constants';

export class IndexError extends Error {
  readonly status: number;
  readonly code: IndexErrorCode | string;
  // How long the answer's `Retry-After` asked the caller to wait (ms), or null when it sent none that parses. Raw:
  // the outbox caps it (@liveworkspace/index-app outbox.ts `failureDelayMs`).
  readonly retryAfterMs: number | null;
  // The share code a `password_required` refusal names, or null: a person reopening an item with no code, whose
  // editor asks for the link's password (one-explorer-contracts.md "Reopened without the code").
  readonly link: string | null;
  // The domains a `sign_in_required` or `domain_not_allowed` refusal names (a share's sign-in rule), or null: what the
  // visitor's restricted page says the item is restricted to.
  readonly domains: string[] | null;
  constructor(
    status: number,
    code: string,
    retryAfterMs: number | null = null,
    link: string | null = null,
    domains: string[] | null = null,
  ) {
    super(`index: ${status} ${code}`);
    this.name = 'IndexError';
    this.status = status;
    this.code = code;
    this.retryAfterMs = retryAfterMs;
    this.link = link;
    this.domains = domains;
  }
}

// The longest share code a refusal's `link` is read as: codes are 14 characters, so anything longer is not one.
const REFUSAL_LINK_MAX = 64;

// The most domains a refusal's `domains` is read as (SHARE_DOMAINS_MAX), and the longest one (SHARE_DOMAIN_MAX).
const REFUSAL_DOMAINS_MAX = 20;
const REFUSAL_DOMAIN_MAX = 253;

/** A refusal's `domains`, kept only as a short list of short strings; null otherwise. */
export function refusalDomainsOf(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.length > REFUSAL_DOMAINS_MAX) return null;
  return value.every((d) => typeof d === 'string' && d !== '' && d.length <= REFUSAL_DOMAIN_MAX)
    ? (value as string[])
    : null;
}

// The longest `Retry-After` text read: ten digits of seconds is three centuries, and an HTTP date is 29 characters.
const RETRY_AFTER_TEXT_MAX = 40;

// A `Retry-After` header as a wait in ms from `now`: delta-seconds (digits only) or an HTTP date, which ends in
// `GMT` (one in the past waits 0). Null when absent, too long, or neither. Read character by character, never with a
// repeating regex.
export function retryAfterMsOf(header: string | null | undefined, now = Date.now()): number | null {
  const text = header?.trim() ?? '';
  if (text === '' || text.length > RETRY_AFTER_TEXT_MAX) return null;
  let digits = true;
  for (let i = 0; i < text.length && digits; i++) {
    const c = text.charCodeAt(i);
    digits = c >= 48 && c <= 57;
  }
  if (digits) return Number(text) * 1000;
  if (!text.endsWith('GMT')) return null;
  const at = Date.parse(text);
  return Number.isFinite(at) ? Math.max(0, at - now) : null;
}

export type Query = Record<string, string | number | boolean | null | undefined>;

// A refusal's `{ error }` as an IndexError; `unknown` when the body names none. `res` gives its Retry-After.
export function refusal(res: Response, parsed: unknown): IndexError {
  const { error, link, domains } =
    (parsed as { error?: unknown; link?: unknown; domains?: unknown } | null) ?? {};
  return new IndexError(
    res.status,
    typeof error === 'string' ? error : 'unknown',
    // A stand-in response without headers (a test's, a polyfill's) has no Retry-After.
    retryAfterMsOf(res.headers?.get('Retry-After')),
    typeof link === 'string' && link !== '' && link.length <= REFUSAL_LINK_MAX ? link : null,
    refusalDomainsOf(domains),
  );
}

// `?a=1&b=2` from the set values, or '' when none is set.
export function queryString(query: Query = {}): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') continue;
    params.set(key, String(value));
  }
  const text = params.toString();
  return text ? `?${text}` : '';
}

export const enc = encodeURIComponent;
