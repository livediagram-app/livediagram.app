// Live app worker. Wraps the static-export assets binding with a
// single path rewrite: any `/diagram/<anything>` request serves the
// single placeholder HTML built by Next.js, and the client extracts
// the real diagram id from `window.location.pathname`. See spec/14
// for why we can't enumerate user-minted ids at build time.

type AssetsBinding = { fetch: (request: Request) => Promise<Response> };
type Env = { ASSETS: AssetsBinding };

// Defense-in-depth response headers. None of these block existing
// functionality; they shut down whole classes of attack surface that
// the editor doesn't need to expose:
//   - X-Frame-Options DENY: stop the editor being framed inside a
//     malicious site (clickjacking).
//   - X-Content-Type-Options nosniff: stop the browser sniffing a
//     mistyped response into an executable type.
//   - Referrer-Policy strict-origin-when-cross-origin: URLs carry
//     diagram ids in the path; don't leak full paths to third-party
//     sites the user might click out to.
//   - Permissions-Policy: deny every powerful feature the editor
//     doesn't use (camera / mic / geolocation / payment / USB) so a
//     compromised script can't request them. Clipboard isn't denied
//     because the image picker uses paste; fullscreen=self is
//     allowed for the laser-presenter view.
//   - Strict-Transport-Security: 1-year HSTS with includeSubDomains.
//     Pins the browser to HTTPS for the apex + every subdomain
//     after the first visit; subsequent loads can't be downgraded
//     to plain HTTP by a network-level attacker. Cloudflare's zone-
//     level toggle covers the same ground but this code-side header
//     is the source of truth so self-host deployments inherit it.
//
// CSP itself is left for a dedicated cycle: it needs explicit allow-
// listing for Clerk's external script + the api / R2 origins, and
// getting that wrong silently breaks auth.
const SECURITY_HEADERS: Record<string, string> = {
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy':
    'camera=(), microphone=(), geolocation=(), payment=(), usb=(), fullscreen=(self)',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
};

function withSecurityHeaders(res: Response): Response {
  // Response headers from the assets binding are immutable when the
  // body is a stream, so we clone into a fresh Response with the
  // merged headers. Status / body pass through.
  const merged = new Headers(res.headers);
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) merged.set(k, v);
  return new Response(res.body, {
    status: res.status,
    statusText: res.statusText,
    headers: merged,
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    // `/diagram` and everything under it shares one HTML file. We
    // rewrite the request rather than redirect so the browser URL
    // stays `/diagram/<id>` (that's the whole point of the path
    // scheme).
    if (url.pathname === '/diagram' || url.pathname.startsWith('/diagram/')) {
      // Skip if the request already points at the placeholder asset
      // (otherwise we'd loop). Static Assets resolves the extension.
      if (url.pathname !== '/diagram/placeholder') {
        const rewritten = new URL(request.url);
        rewritten.pathname = '/diagram/placeholder';
        return withSecurityHeaders(
          await env.ASSETS.fetch(new Request(rewritten.toString(), request)),
        );
      }
    }
    return withSecurityHeaders(await env.ASSETS.fetch(request));
  },
};
