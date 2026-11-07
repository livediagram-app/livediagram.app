// The index calling an app's internal routes (liveworkspace/docs/specs/004-index/one-explorer-contracts.md): copy an
// item's content, drop a purged item's content, tell an item a link was revoked, the migration's handoff
// (migration-handoff.ts), and a connected tab's reverse write (connections.ts). Each carries the
// app's key and name, the same pair the app pushes with.

import { INDEX_APP_HEADER, type App } from '@liveworkspace/index-client';
import { APP_CALL_TIMEOUT_MS } from './config';
import { appKey, appOrigin, type Env } from './env';

export type AppCallResult = { ok: true } | { ok: false; error: string };

// One call to an app's internal route with its key and name: the app's response, or why there was none.
async function sendToApp(
  env: Env,
  app: App,
  method: 'POST' | 'PUT' | 'DELETE',
  path: string,
  body: unknown,
  timeoutMs: number,
): Promise<Response | { error: string }> {
  const origin = appOrigin(env, app);
  const key = appKey(env, app);
  if (!origin || !key) return { error: 'app_not_configured' };
  const headers: Record<string, string> = {
    Authorization: `Bearer ${key}`,
    [INDEX_APP_HEADER]: app,
  };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  try {
    return await fetch(`${origin}/api/internal${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    return { error: err instanceof Error ? err.name : 'fetch_failed' };
  }
}

export async function callApp(
  env: Env,
  app: App,
  method: 'POST' | 'PUT' | 'DELETE',
  path: string,
  body?: unknown,
  timeoutMs = APP_CALL_TIMEOUT_MS,
): Promise<AppCallResult> {
  const res = await sendToApp(env, app, method, path, body, timeoutMs);
  if (!(res instanceof Response)) return { ok: false, error: res.error };
  // The body isn't needed; release it.
  await res.body?.cancel();
  // A purge of content the app never had (or already dropped) is done all the same.
  if (res.ok || (method === 'DELETE' && res.status === 404)) return { ok: true };
  return { ok: false, error: `status_${res.status}` };
}

// A POST whose answer is read (a connected tab's reverse write): the app's JSON object on a 2xx, else why not. A 2xx
// whose body is not a JSON object is a failure too.
export async function callAppForJson(
  env: Env,
  app: App,
  path: string,
  body: unknown,
  timeoutMs: number,
): Promise<{ ok: true; body: Record<string, unknown> } | { ok: false; error: string }> {
  const res = await sendToApp(env, app, 'POST', path, body, timeoutMs);
  if (!(res instanceof Response)) return { ok: false, error: res.error };
  if (!res.ok) {
    await res.body?.cancel();
    return { ok: false, error: `status_${res.status}` };
  }
  const parsed = (await res.json().catch(() => null)) as unknown;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { ok: false, error: 'invalid_answer' };
  }
  return { ok: true, body: parsed as Record<string, unknown> };
}

// Runs `work` over `items`, at most `limit` at a time.
export async function eachLimited<T>(
  items: T[],
  limit: number,
  work: (item: T) => Promise<void>,
): Promise<void> {
  let next = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const item = items[next++]!;
      await work(item);
    }
  });
  await Promise.all(runners);
}
