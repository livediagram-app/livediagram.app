// The shape of a URL a server may fetch for someone (liveworkspace/docs/specs/004-index/webhooks.md "Security";
// livediagram/docs/specs/009-elements/live-status.md "The binding"): HTTPS on 443, no user name or password, and a
// host NAME that could leave a network, never an IP address or an internal name. Pure and synchronous, so a client
// can refuse as someone types and a document's validation can hold a stored URL to it. Resolving the name to public
// addresses only is the fetcher's (@liveworkspace/api-kit/public-address), right before each request.

export type PublicHttpsUrlRefusal = 'invalid' | 'private';

export type PublicHttpsUrlResult =
  { ok: true; url: URL; host: string } | { ok: false; error: PublicHttpsUrlRefusal };

export const PUBLIC_HTTPS_URL_MAX = 2048;

// Names that only mean something inside a network.
export const INTERNAL_HOST_SUFFIXES: readonly string[] = [
  '.local',
  '.localhost',
  '.internal',
  '.lan',
  '.home.arpa',
  '.intranet',
];

const IPV4 = /^\d{1,3}(\.\d{1,3}){3}$/;

/** The URL a server may fetch, or why not: `invalid` for its shape, `private` for an address or internal name. */
export function parsePublicHttpsUrl(
  raw: unknown,
  max: number = PUBLIC_HTTPS_URL_MAX,
): PublicHttpsUrlResult {
  if (typeof raw !== 'string') return { ok: false, error: 'invalid' };
  const trimmed = raw.trim();
  if (trimmed.length === 0 || trimmed.length > max) return { ok: false, error: 'invalid' };
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return { ok: false, error: 'invalid' };
  }
  if (url.protocol !== 'https:' || url.username || url.password) {
    return { ok: false, error: 'invalid' };
  }
  if (url.port !== '' && url.port !== '443') return { ok: false, error: 'invalid' };
  const host = url.hostname.toLowerCase().replace(/\.$/, '');
  // An address rather than a name (the URL parser has already turned `0x7f000001` into dotted decimal), or a name
  // that never leaves a network.
  if (IPV4.test(host) || host.startsWith('[') || host.includes(':')) {
    return { ok: false, error: 'private' };
  }
  if (
    !host.includes('.') ||
    host === 'localhost' ||
    INTERNAL_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix))
  ) {
    return { ok: false, error: 'private' };
  }
  return { ok: true, url, host };
}
