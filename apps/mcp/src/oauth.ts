// OAuth 2.1 + PKCE (S256) + dynamic client registration for the MCP (spec/62
// §3). The flow mints an ordinary lvd_ token under the hood (via the api
// worker's /api/oauth/exchange, called by the Clerk-authed consent page in
// apps/live) and hands it to the client through the standard code+PKCE exchange.
// All transient state lives in OAUTH_KV with short TTLs; no parallel credential
// model — the heavy lifting (verify, revoke, caps, expiry) is the token's.
import type { Hono } from 'hono';
import type { Env } from './env';

// ---- KV record shapes (all short-lived) ----
type ClientReg = { redirectUris: string[]; clientName: string };
type AuthSession = {
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  state?: string;
  clientName: string;
};
type AuthCode = {
  token: string;
  codeChallenge: string;
  redirectUri: string;
  clientId: string;
  // The token's absolute expiry (epoch ms), so /oauth/token can report a
  // truthful expires_in (spec/62 §3.5).
  expiresAt?: number;
};

const CLIENT_TTL = 60 * 60 * 24 * 30; // 30 days
const SESSION_TTL = 60 * 10; // 10 minutes
const CODE_TTL = 60 * 5; // 5 minutes

function randomId(): string {
  return crypto.randomUUID().replace(/-/g, '');
}

function base64url(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function sha256base64url(s: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return base64url(new Uint8Array(buf));
}

function isHttpsOrLocalhost(uri: string): boolean {
  try {
    const u = new URL(uri);
    return u.protocol === 'https:' || u.hostname === 'localhost' || u.hostname === '127.0.0.1';
  } catch {
    return false;
  }
}

// The MCP's own public origin, derived from the request so it's host-agnostic
// (works on mcp.livediagram.app and any self-host).
function selfOrigin(reqUrl: string): string {
  return new URL(reqUrl).origin;
}

export function registerOauthRoutes(app: Hono<{ Bindings: Env }>): void {
  // --- Discovery (RFC 8414 + protected-resource metadata) ---
  app.get('/.well-known/oauth-authorization-server', (c) => {
    const base = selfOrigin(c.req.url);
    return c.json({
      issuer: base,
      authorization_endpoint: `${base}/oauth/authorize`,
      token_endpoint: `${base}/oauth/token`,
      registration_endpoint: `${base}/oauth/register`,
      response_types_supported: ['code'],
      grant_types_supported: ['authorization_code'],
      code_challenge_methods_supported: ['S256'],
      token_endpoint_auth_methods_supported: ['none'],
    });
  });

  app.get('/.well-known/oauth-protected-resource', (c) => {
    const base = selfOrigin(c.req.url);
    return c.json({
      resource: `${base}/mcp`,
      authorization_servers: [base],
    });
  });

  // --- Dynamic client registration (RFC 7591) ---
  app.post('/oauth/register', async (c) => {
    // Per-IP cap (spec/62 §3.2) so an open registration endpoint can't be used
    // to flood KV. KV-backed, sliding hour window; good enough for DCR abuse.
    const ip = c.req.header('CF-Connecting-IP') ?? 'unknown';
    const rateKey = `reg-rate:${ip}`;
    const count = Number((await c.env.OAUTH_KV.get(rateKey)) ?? '0');
    if (count >= 20) return c.json({ error: 'rate_limited' }, 429);
    await c.env.OAUTH_KV.put(rateKey, String(count + 1), { expirationTtl: 3600 });

    const body = (await c.req.json().catch(() => ({}))) as {
      redirect_uris?: unknown;
      client_name?: unknown;
    };
    const uris = Array.isArray(body.redirect_uris)
      ? body.redirect_uris.filter((u) => typeof u === 'string')
      : [];
    if (uris.length === 0 || !uris.every(isHttpsOrLocalhost)) {
      return c.json(
        {
          error: 'invalid_redirect_uri',
          error_description: 'https or localhost redirect_uris required',
        },
        400,
      );
    }
    const clientId = randomId();
    const clientName =
      typeof body.client_name === 'string' ? body.client_name.slice(0, 120) : 'MCP client';
    const reg: ClientReg = { redirectUris: uris as string[], clientName };
    await c.env.OAUTH_KV.put(`client:${clientId}`, JSON.stringify(reg), {
      expirationTtl: CLIENT_TTL,
    });
    return c.json(
      {
        client_id: clientId,
        client_name: clientName,
        redirect_uris: uris,
        token_endpoint_auth_method: 'none',
        grant_types: ['authorization_code'],
        response_types: ['code'],
      },
      201,
    );
  });

  // --- Authorize: validate, stash a session, hand off to the consent page ---
  app.get('/oauth/authorize', async (c) => {
    const q = c.req.query();
    const clientId = q.client_id;
    const redirectUri = q.redirect_uri;
    const codeChallenge = q.code_challenge;
    if (!clientId || !redirectUri || !codeChallenge) {
      return c.text('missing client_id, redirect_uri, or code_challenge', 400);
    }
    if (q.code_challenge_method && q.code_challenge_method !== 'S256') {
      return c.text('only S256 PKCE is supported', 400);
    }
    // A real S256 challenge is base64url(SHA-256) = 43 chars; reject anything
    // shorter so a client can't downgrade to a trivially-guessable challenge.
    if (codeChallenge.length < 43) {
      return c.text('invalid code_challenge', 400);
    }
    if (q.response_type && q.response_type !== 'code') {
      return c.text('only response_type=code is supported', 400);
    }
    const reg = await c.env.OAUTH_KV.get<ClientReg>(`client:${clientId}`, 'json');
    if (!reg || !reg.redirectUris.includes(redirectUri)) {
      return c.text('unknown client or unregistered redirect_uri', 400);
    }
    const session = randomId();
    const record: AuthSession = {
      clientId,
      redirectUri,
      codeChallenge,
      state: q.state,
      clientName: reg.clientName,
    };
    await c.env.OAUTH_KV.put(`session:${session}`, JSON.stringify(record), {
      expirationTtl: SESSION_TTL,
    });
    const consentBase = c.env.CONSENT_BASE_URL ?? 'https://livediagram.app';
    // client name is display-only; the binding is the session + PKCE.
    // Pass the (validated, registered) redirect host so the consent screen can
    // show WHERE access will go — anti-phishing for a misleadingly-named client.
    let toHost = '';
    try {
      toHost = new URL(redirectUri).host;
    } catch {
      // already validated above; ignore
    }
    return c.redirect(
      `${consentBase}/oauth/consent?session=${encodeURIComponent(session)}` +
        `&client=${encodeURIComponent(reg.clientName)}&to=${encodeURIComponent(toHost)}`,
    );
  });

  // --- Complete: the Clerk-authed consent page posts the minted token here,
  // bound to a fresh authorization code (one-time, PKCE-gated at /oauth/token).
  app.post('/oauth/complete', async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as {
      session?: string;
      token?: string;
      expiresAt?: number;
    };
    if (!body.session || !body.token) return c.json({ error: 'invalid_request' }, 400);
    const session = await c.env.OAUTH_KV.get<AuthSession>(`session:${body.session}`, 'json');
    if (!session) return c.json({ error: 'invalid_session' }, 400);
    await c.env.OAUTH_KV.delete(`session:${body.session}`);
    const code = randomId();
    const record: AuthCode = {
      token: body.token,
      codeChallenge: session.codeChallenge,
      redirectUri: session.redirectUri,
      clientId: session.clientId,
      expiresAt: typeof body.expiresAt === 'number' ? body.expiresAt : undefined,
    };
    await c.env.OAUTH_KV.put(`code:${code}`, JSON.stringify(record), { expirationTtl: CODE_TTL });
    const url = new URL(session.redirectUri);
    url.searchParams.set('code', code);
    if (session.state) url.searchParams.set('state', session.state);
    return c.json({ redirectTo: url.toString(), clientName: session.clientName });
  });

  // --- Token: redeem code + PKCE verifier for the lvd_ access token ---
  app.post('/oauth/token', async (c) => {
    const form = await c.req.parseBody().catch(() => ({}) as Record<string, unknown>);
    const grantType = String(form.grant_type ?? '');
    const code = String(form.code ?? '');
    const verifier = String(form.code_verifier ?? '');
    const redirectUri = String(form.redirect_uri ?? '');
    if (grantType !== 'authorization_code' || !code || !verifier) {
      return c.json({ error: 'invalid_request' }, 400);
    }
    // RFC 7636: the code_verifier is 43-128 chars. Enforce it so a weak verifier
    // can't undermine PKCE.
    if (verifier.length < 43 || verifier.length > 128) {
      return c.json({ error: 'invalid_request', error_description: 'bad code_verifier' }, 400);
    }
    const record = await c.env.OAUTH_KV.get<AuthCode>(`code:${code}`, 'json');
    if (!record) return c.json({ error: 'invalid_grant' }, 400);
    // One-time: burn the code regardless of outcome.
    await c.env.OAUTH_KV.delete(`code:${code}`);
    if (redirectUri && redirectUri !== record.redirectUri) {
      return c.json({ error: 'invalid_grant', error_description: 'redirect_uri mismatch' }, 400);
    }
    const challenge = await sha256base64url(verifier);
    if (challenge !== record.codeChallenge) {
      return c.json({ error: 'invalid_grant', error_description: 'PKCE verification failed' }, 400);
    }
    // expires_in reflects the token's remaining 6-month life (spec/62 §3.5);
    // fall back to the full window if the consent page didn't pass an expiry.
    const SIX_MONTHS = 60 * 60 * 24 * 180;
    const expiresIn = record.expiresAt
      ? Math.max(0, Math.floor((record.expiresAt - Date.now()) / 1000))
      : SIX_MONTHS;
    return c.json({ access_token: record.token, token_type: 'Bearer', expires_in: expiresIn });
  });
}

// Exported for unit tests.
export const __test = { sha256base64url, base64url, isHttpsOrLocalhost };
