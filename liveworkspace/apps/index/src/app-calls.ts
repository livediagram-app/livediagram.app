// The index calling an app's internal routes (liveworkspace/docs/one-explorer-contracts.md): copy an
// item's content, drop a purged item's content, tell an item a link was revoked, and the migration's handoff
// (migration-handoff.ts). Each carries the
// app's key and name, the same pair the app pushes with.

import { INDEX_APP_HEADER, type App } from '@liveworkspace/index-client';
import { APP_CALL_TIMEOUT_MS } from './config';
import { appKey, appOrigin, type Env } from './env';

export type AppCallResult = { ok: true } | { ok: false; error: string };

export async function callApp(
  env: Env,
  app: App,
  method: 'POST' | 'PUT' | 'DELETE',
  path: string,
  body?: unknown,
  timeoutMs = APP_CALL_TIMEOUT_MS,
): Promise<AppCallResult> {
  const origin = appOrigin(env, app);
  const key = appKey(env, app);
  if (!origin || !key) return { ok: false, error: 'app_not_configured' };
  const headers: Record<string, string> = {
    Authorization: `Bearer ${key}`,
    [INDEX_APP_HEADER]: app,
  };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  try {
    const res = await fetch(`${origin}/api/internal${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
    // The body isn't needed; release it.
    await res.body?.cancel();
    // A purge of content the app never had (or already dropped) is done all the same.
    if (res.ok || (method === 'DELETE' && res.status === 404)) return { ok: true };
    return { ok: false, error: `status_${res.status}` };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.name : 'fetch_failed' };
  }
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
