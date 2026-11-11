// What every workbench route (./routes) shares: the limits, the answers, a checked origin and name, the pairing's
// view, and who is asking (an API token or a signed-in account). Re-exported from ./routes.
import { sameSiteOrigin } from '@liveworkspace/sites/www';
import type { Auth } from '../auth.ts';
import { bearerOf, bearerPerson } from '../bearer.ts';
import type { Env } from '../env.ts';
import { hasApiTokenPrefix, verifyApiToken, type VerifiedToken } from '../tokens.ts';
import { wireScope, type Dialect } from './apps.ts';
import type { WorkbenchLevel, WorkbenchPairingRow } from './store.ts';

// ---------- Constants (each app's docs/specs/013-workspace/blueprints/workbench-embeds.md) ---------------------

export const WORKBENCH_TICKET_TTL_MS = 60_000;
export const WORKBENCH_SESSION_TTL_MS = 8 * 60 * 60 * 1000;
export const WORKBENCH_TICKETS_PER_MINUTE = 30;
export const WORKBENCH_NAME_MAX_LENGTH = 40;
export const WORKBENCH_ORIGIN_MAX_LENGTH = 255;
// How often the waiting CLI asks again, in seconds (the device flow's).
export const WORKBENCH_POLL_INTERVAL_S = 5;
const ID_MAX = 64;

// ---------- Answers ----------------------------------------------------------------------------------------------

export const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { 'cache-control': 'no-store' } });
export const fail = (status: number, error: string, extra: Record<string, unknown> = {}) =>
  json({ error, ...extra }, status);
export const noContent = () =>
  new Response(null, { status: 204, headers: { 'cache-control': 'no-store' } });
export const badRequest = (message: string) => fail(400, 'bad_request', { message });
export const invalidValue = (message: string) => fail(400, 'invalid_value', { message });
export const notFound = () => fail(404, 'not_found');
export const signInRequired = () => fail(401, 'sign_in_required');
export const tokenRequired = () => fail(403, 'token_required');
export const rateLimited = () => fail(429, 'rate_limited');
export const unknownApp = () => fail(400, 'invalid_value', { message: 'name the app' });

export const isId = (value: unknown): value is string =>
  typeof value === 'string' && value.length >= 1 && value.length <= ID_MAX;

const LEVELS: readonly WorkbenchLevel[] = ['view', 'participate', 'edit'];
// The lower of two levels; no ceiling gives the level.
export const capLevel = (level: WorkbenchLevel, ceiling?: WorkbenchLevel): WorkbenchLevel =>
  ceiling && LEVELS.indexOf(ceiling) < LEVELS.indexOf(level) ? ceiling : level;

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

// Exactly `scheme://host[:port]`: https anywhere, http on a loopback host only, as the browser reports an origin.
export function parseWorkbenchOrigin(input: unknown): string | null {
  if (typeof input !== 'string' || input.length === 0 || input.length > WORKBENCH_ORIGIN_MAX_LENGTH)
    return null;
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    return null;
  }
  const schemeOk =
    url.protocol === 'https:' || (url.protocol === 'http:' && LOOPBACK_HOSTS.has(url.hostname));
  if (!schemeOk || url.username || url.password || url.search || url.hash) return null;
  if (url.pathname !== '/' || input.endsWith('/') || input !== url.origin) return null;
  return input;
}

// The workbench's name (shown, never enforced): trimmed, 1 to WORKBENCH_NAME_MAX_LENGTH characters.
export function normaliseWorkbenchName(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length >= 1 && trimmed.length <= WORKBENCH_NAME_MAX_LENGTH ? trimmed : null;
}

export async function readBody(request: Request): Promise<Record<string, unknown> | Response> {
  try {
    const body: unknown = await request.json();
    return typeof body === 'object' && body !== null && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : badRequest('expected a JSON object');
  } catch {
    return badRequest('invalid json');
  }
}

// A pairing as the app's wire has always shown it, with its app for liveworkspace.app's list of every app's.
export const pairingView = (dialect: Dialect, p: WorkbenchPairingRow) => ({
  id: p.id,
  tokenId: p.tokenId,
  origin: p.origin,
  name: p.name,
  scope: wireScope(dialect, p.scope),
  pairedAt: p.pairedAt,
  app: p.app,
});

export const pairingUrlOf = (env: Env, code: string) =>
  `${env.BASE_URL}/workbench/pair?code=${code}`;

// ---------- Who is asking -----------------------------------------------------------------------------------------

export type WorkbenchContext = {
  request: Request;
  env: Env;
  auth: Auth;
  waitUntil: (promise: Promise<unknown>) => void;
  now: number;
};

// The API token a request presents, checked in accounts' own table (one indexed read).
export async function apiTokenOf(ctx: WorkbenchContext): Promise<VerifiedToken | null> {
  const bearer = bearerOf(ctx.request);
  if (!bearer || !hasApiTokenPrefix(bearer)) return null;
  return verifyApiToken(ctx.env.AUTH_DB, bearer, ctx.now);
}

// The account signed in: the site's session cookie (a write from the site itself only), or an account's access
// token for one of the apps (what an app's Settings sends). Never an API token or a workbench session.
export async function signedInAccount(ctx: WorkbenchContext): Promise<string | null> {
  const bearer = bearerOf(ctx.request);
  if (bearer) {
    if (hasApiTokenPrefix(bearer) || bearer.startsWith('lvw_')) return null;
    const person = await bearerPerson(bearer, ctx.env, ctx.auth, ctx.now);
    return person?.kind === 'account' ? person.userId : null;
  }
  // A write from the site itself, on either of its hosts while the move to www. lasts.
  if (
    ctx.request.method !== 'GET' &&
    !sameSiteOrigin(ctx.request.headers.get('origin') ?? '', ctx.env.BASE_URL)
  )
    return null;
  const session = await ctx.auth.api.getSession({ headers: ctx.request.headers }).catch(() => null);
  return session?.user.id ?? null;
}

// The mint and the pairing request share one bucket per token.
export async function limited(ctx: WorkbenchContext, tokenId: string): Promise<boolean> {
  const limiter = ctx.env.WORKBENCH_LIMITER;
  if (!limiter) return false;
  return !(await limiter.limit({ key: `workbench-ticket:${tokenId}` })).success;
}
