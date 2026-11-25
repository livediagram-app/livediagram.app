// Which apps a connection may reach (liveworkspace/docs/specs/021-mcp/mcp.md "Sign-in and per-app consent"): the
// consent page's ticks, kept by the token's SHA-256 (never the token) as long as a client registration. A token with
// no record, one pasted from Settings, reaches every app.
import { CLIENT_TTL } from '@liveworkspace/mcp-kit/oauth';
import { APPS, appById, type AppSpec } from './apps';

export async function tokenKey(token: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return `apps:${[...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')}`;
}

/** The apps a grant names, as far as they are apps; null when it names none (then every app). */
export function grantedApps(value: unknown): AppSpec[] | null {
  if (!Array.isArray(value)) return null;
  const specs = APPS.filter((spec) => value.includes(spec.app));
  return specs.length > 0 ? specs : null;
}

/** Keeps a grant's ticked apps (the consent page sends `apps`). Every app ticked keeps nothing: that is the default. */
export async function keepGrant(kv: KVNamespace, token: string, apps: unknown): Promise<void> {
  const specs = grantedApps(apps);
  if (!specs || specs.length === APPS.length) return;
  await kv.put(await tokenKey(token), JSON.stringify(specs.map((s) => s.app)), {
    expirationTtl: CLIENT_TTL,
  });
}

// Read per request; kept per isolate a minute, so a burst of calls reads KV once.
const ALLOWED_TTL_MS = 60 * 1000;
const MAX_KEPT = 500;
const kept = new Map<string, { at: number; apps: AppSpec[] }>();

/** The store holding a token's ticked apps couldn't be read; the entry answers 503 rather than widening the grant. */
export class GrantUnreadable extends Error {
  constructor(cause: unknown) {
    super('grant unreadable', { cause });
    this.name = 'GrantUnreadable';
  }
}

export async function allowedApps(kv: KVNamespace, token: string): Promise<AppSpec[]> {
  const key = await tokenKey(token);
  const hit = kept.get(key);
  if (hit && Date.now() - hit.at < ALLOWED_TTL_MS) return hit.apps;
  // A failed read throws rather than reading as no record: no record is every app, so a store failure would widen a
  // connection the person narrowed (the entry answers 503).
  let stored: unknown;
  try {
    stored = await kv.get<unknown>(key, 'json');
  } catch (err) {
    throw new GrantUnreadable(err);
  }
  const apps = (Array.isArray(stored) ? stored : [])
    .filter((app): app is string => typeof app === 'string')
    .map((app) => appById(app))
    .filter((spec): spec is AppSpec => spec !== null);
  const result = apps.length > 0 ? apps : [...APPS];
  if (kept.size >= MAX_KEPT) kept.clear();
  kept.set(key, { at: Date.now(), apps: result });
  return result;
}

/**
 * `allowed` narrowed to one app: an app's old MCP address serves only that app (mcp.md "The app MCPs fold in"). It
 * only ever narrows; no app leaves `allowed` as it is.
 */
export function narrowedApps(allowed: readonly AppSpec[], app: string | null): AppSpec[] {
  if (app === null) return [...allowed];
  return allowed.filter((spec) => spec.app === app);
}
