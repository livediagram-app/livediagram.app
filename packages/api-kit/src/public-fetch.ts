// A server-side fetch of a URL someone else chose (an MCP caller's image URL), safe against SSRF
// (liveworkspace/docs/specs/006-media/media.md "Uploaded by a tool"): HTTPS on 443 only, to a host that resolves only to
// public addresses (public-address.ts), each redirect checked the same way and at most MAX_REDIRECTS of them, a
// deadline over the whole exchange body included, and the body read through a byte counter that stops at the cap, so
// a huge or endless answer is cut off there. Never trusts the answer's type: the caller sniffs the bytes.

import { readCappedBody } from './request-body';
import { dohResolve, isPrivateAddress, resolvesPublic, type Resolve } from './public-address';
import { isBlockedHost } from './unfurl';

export const PUBLIC_FETCH_TIMEOUT_MS = 10_000;
export const PUBLIC_FETCH_MAX_REDIRECTS = 3;
export const PUBLIC_URL_MAX = 2048;

export type PublicFetchRefusal =
  // Not an absolute URL, too long, or one carrying a user name or password.
  | 'invalid_url'
  // Not https, or a port other than 443.
  | 'not_https'
  // A literal private address, an internal name, or a name resolving to a private address.
  | 'private_address'
  // The name has no address, or the resolver failed.
  | 'unresolved'
  | 'too_many_redirects'
  // The final answer was not a 2xx (its status beside).
  | 'http_status'
  // Over the byte cap, by its Content-Length or as it streamed.
  | 'too_large'
  | 'timeout'
  // The connection failed.
  | 'unreachable';

export type PublicFetchResult =
  | { ok: true; bytes: Uint8Array; url: string }
  | { ok: false; reason: PublicFetchRefusal; url: string; status?: number };

export type PublicFetchOptions = {
  maxBytes: number;
  timeoutMs?: number;
  maxRedirects?: number;
  resolve?: Resolve;
  fetch?: (request: Request) => Promise<Response>;
  headers?: Record<string, string>;
};

const IPV4 = /^\d{1,3}(\.\d{1,3}){3}$/;

class Refused extends Error {
  readonly reason: PublicFetchRefusal;
  readonly status: number | undefined;
  constructor(reason: PublicFetchRefusal, status?: number) {
    super(reason);
    this.reason = reason;
    this.status = status;
  }
}

// Where one hop may go, or why not.
async function checkTarget(raw: string, resolve: Resolve): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Refused('invalid_url');
  }
  if (url.username || url.password) throw new Refused('invalid_url');
  if (url.protocol !== 'https:' || (url.port !== '' && url.port !== '443')) {
    throw new Refused('not_https');
  }
  const host = url.hostname
    .toLowerCase()
    .replace(/^\[|\]$/g, '')
    .replace(/\.$/, '');
  // An address typed as one is judged as it stands.
  if (IPV4.test(host) || host.includes(':')) {
    if (isPrivateAddress(host)) throw new Refused('private_address');
    return url;
  }
  if (isBlockedHost(host) || !host.includes('.') || host.endsWith('.internal')) {
    throw new Refused('private_address');
  }
  const verdict = await resolvesPublic(host, resolve);
  if (verdict === 'private') throw new Refused('private_address');
  if (verdict === 'unresolved') throw new Refused('unresolved');
  return url;
}

const isRedirect = (status: number) => status >= 300 && status < 400;

// An answer whose body is not wanted: its stream let go. A source whose cancel throws has nothing left to say.
async function discard(res: Response): Promise<void> {
  try {
    await res.body?.cancel();
  } catch {
    // Already closed or errored.
  }
}

/** The bytes at a public https URL, at most `maxBytes`, following at most `maxRedirects` redirects, each checked. */
export async function fetchPublicBytes(
  raw: string,
  options: PublicFetchOptions,
): Promise<PublicFetchResult> {
  const {
    maxBytes,
    timeoutMs = PUBLIC_FETCH_TIMEOUT_MS,
    maxRedirects = PUBLIC_FETCH_MAX_REDIRECTS,
    resolve = dohResolve,
    fetch: doFetch = (request) => fetch(request),
    headers = {},
  } = options;
  if (raw.length > PUBLIC_URL_MAX) return { ok: false, reason: 'invalid_url', url: raw };
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new Refused('timeout'));
    }, timeoutMs);
  });
  let current = raw;
  const run = async (): Promise<Uint8Array> => {
    for (let hop = 0; ; hop += 1) {
      const target = await checkTarget(current, resolve);
      current = target.toString();
      let res: Response;
      try {
        res = await doFetch(
          new Request(current, {
            method: 'GET',
            redirect: 'manual',
            signal: controller.signal,
            headers,
          }),
        );
      } catch {
        throw new Refused(controller.signal.aborted ? 'timeout' : 'unreachable');
      }
      if (isRedirect(res.status)) {
        await discard(res);
        const location = res.headers.get('Location');
        if (!location) throw new Refused('http_status', res.status);
        if (hop >= maxRedirects) throw new Refused('too_many_redirects');
        current = new URL(location, current).toString();
        continue;
      }
      if (!res.ok || res.body === null) {
        await discard(res);
        throw new Refused('http_status', res.status);
      }
      const declared = Number(res.headers.get('Content-Length') ?? '0');
      if (declared > maxBytes) {
        await discard(res);
        throw new Refused('too_large');
      }
      // A response body streams bytes; the Workers types leave its chunks untyped.
      const bytes = await readCappedBody(res.body as ReadableStream<Uint8Array>, maxBytes);
      if (bytes === null) throw new Refused('too_large');
      return bytes;
    }
  };
  try {
    return { ok: true, bytes: await Promise.race([run(), deadline]), url: current };
  } catch (err) {
    if (err instanceof Refused) {
      return {
        ok: false,
        reason: err.reason,
        url: current,
        ...(err.status === undefined ? {} : { status: err.status }),
      };
    }
    // A body that broke off part way (the deadline, which aborts the request, wins the race before its own error).
    return { ok: false, reason: 'unreachable', url: current };
  } finally {
    clearTimeout(timer);
    controller.abort();
  }
}
