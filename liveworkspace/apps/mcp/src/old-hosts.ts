// The apps' old MCP addresses, now routes on this Worker (liveworkspace/docs/specs/021-mcp/mcp.md "The app MCPs fold
// in"). A connection made to `mcp.<app>.app` before the fold is that app's own MCP, passed through as it was (its
// tool names, descriptions and instructions), until its token ends or the move-over window closes (bearer.ts); nobody
// signs in there any more, so every sign-in endpoint answers, in words, where the connection lives now.
import { bearerChallenge } from '@liveworkspace/mcp-kit/token-refusal';
import { APPS, type AppId } from './apps';
import type { Env } from './env';
import { allowedApps, narrowedApps } from './grants';

// Production's one MCP, named in every refusal.
export const ONE_MCP_URL = 'https://mcp.liveworkspace.app/mcp';

const APP_IDS = new Set<string>(APPS.map((spec) => spec.app));

/** The app whose old address this is (`mcp.<app>.app`, staging `mcp-staging.<app>.app`), or null. */
export function oldHostApp(hostname: string): AppId | null {
  const app = hostname.match(/^mcp(?:-staging)?\.(live[a-z]+)\.app$/)?.[1];
  return app && APP_IDS.has(app) ? (app as AppId) : null;
}

/** Where the connection lives now: this deployment's one MCP. */
function movedTo(url: URL): string {
  return url.hostname.startsWith('mcp-staging.')
    ? 'https://mcp-staging.liveworkspace.app/mcp'
    : ONE_MCP_URL;
}

/** What every refusal on an old address says. */
export function movedDescription(url: URL): string {
  return `This address no longer takes new connections. Connect ${movedTo(url)} instead: one connection for every liveworkspace app.`;
}

/** A 401 on an old address: its own challenge, with the pointer, so a client never signs in there again. */
export function movedChallenge(url: URL): Response {
  return Response.json(
    { error: 'invalid_token', error_description: movedDescription(url) },
    { status: 401, headers: { 'WWW-Authenticate': bearerChallenge(url.origin, true) } },
  );
}

const escape = (text: string) =>
  text.replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]!);

function movedPage(target: string): string {
  const safe = escape(target);
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>This connection has moved</title><style>body{font:16px/1.5 system-ui,sans-serif;margin:0;padding:48px 16px;background:#f6f7fb;color:#111827}main{max-width:480px;margin:0 auto}code{background:#e5e7eb;padding:2px 6px;border-radius:4px;word-break:break-all}@media(prefers-color-scheme:dark){body{background:#0f1320;color:#e5e7eb}code{background:#1f2937}}</style></head><body><main><h1>This connection has moved</h1><p>liveworkspace now has one connection for every app. In your AI tool, remove this server and add:</p><p><code>${safe}</code></p></main></body></html>`;
}

/**
 * An old address's sign-in endpoints, or null for anything else (`/mcp`, `/health`, the server card). Discovery still
 * answers, so a client whose token ended finds the registration endpoint and reads the refusal there; registration,
 * authorize and the token exchange each refuse with the pointer, and device sign-in is gone.
 */
export function oldHostSignIn(request: Request, url: URL): Response | null {
  const base = url.origin;
  const path = url.pathname;
  const description = movedDescription(url);
  if (path === '/.well-known/oauth-authorization-server')
    return Response.json({
      issuer: base,
      authorization_endpoint: `${base}/oauth/authorize`,
      token_endpoint: `${base}/oauth/token`,
      registration_endpoint: `${base}/oauth/register`,
      response_types_supported: ['code'],
      grant_types_supported: ['authorization_code'],
      code_challenge_methods_supported: ['S256'],
      token_endpoint_auth_methods_supported: ['none'],
      service_documentation: movedTo(url),
    });
  if (
    path === '/.well-known/oauth-protected-resource' ||
    path === '/.well-known/oauth-protected-resource/mcp'
  )
    return Response.json({
      resource: `${base}/mcp`,
      authorization_servers: [base],
      bearer_methods_supported: ['header'],
    });
  // RFC 7591 §3.2.2: a refused registration is a 400 with an error code.
  if (path === '/oauth/register' && request.method === 'POST')
    return Response.json(
      { error: 'invalid_client_metadata', error_description: description },
      { status: 400 },
    );
  // A browser lands here: a page in words, with the address, rather than a redirect back to the client with an error
  // most clients show as "access denied".
  if (path === '/oauth/authorize')
    return new Response(movedPage(movedTo(url)), {
      status: 410,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  if (path === '/oauth/token' && request.method === 'POST')
    return Response.json(
      { error: 'invalid_grant', error_description: description },
      { status: 400 },
    );
  if (path.startsWith('/oauth/'))
    return Response.json({ error: 'gone', error_description: description }, { status: 410 });
  return null;
}

/**
 * `/mcp` on an old address: the app's own MCP package, the request passed through as it is, so a client holding the
 * tool list it was given before the fold calls the same names and reads the same texts. A token the person narrowed
 * away from this app, or one the app refuses, gets the pointer.
 */
export async function oldHostMcp(
  request: Request,
  url: URL,
  app: AppId,
  token: string,
  env: Env,
): Promise<Response> {
  const spec = narrowedApps(await allowedApps(env.OAUTH_KV, token), app)[0];
  if (!spec) return movedChallenge(url);
  const inner = new URL(url);
  inner.protocol = 'https:';
  inner.host = `${spec.app}.internal`;
  const response = await env[spec.binding].fetch(new Request(inner, request));
  return response.status === 401 ? movedChallenge(url) : response;
}
