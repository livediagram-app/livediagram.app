// The Cloudflare REST calls previews make. Deletions go through here rather than wrangler so
// "already gone" is a status code, not parsed output
// (docs/specs/016-platform/blueprints/pr-previews.md "Teardown").

import { isNotFound, type ApiOutcome } from '../src/teardown.ts';

const BASE = 'https://api.cloudflare.com/client/v4';
// Emptying a bucket lists and deletes up to 1000 objects a pass; 100 passes bounds it at 100k
// objects, far above what the per-owner image caps allow a preview, so a listing that never
// shrinks fails the teardown instead of looping.
const MAX_EMPTY_PASSES = 100;

interface Envelope<T> extends ApiOutcome {
  success: boolean;
  result: T;
  result_info?: { page?: number; total_pages?: number; cursor?: string };
}

function credentials(): { token: string; account: string } {
  const token = process.env.CLOUDFLARE_API_TOKEN;
  const account = process.env.CLOUDFLARE_ACCOUNT_ID;
  if (!token || !account)
    throw new Error('CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID are required');
  return { token, account };
}

async function call<T>(method: string, path: string, body?: unknown): Promise<Envelope<T>> {
  const { token, account } = credentials();
  const response = await fetch(`${BASE}/accounts/${account}${path}`, {
    method,
    headers: {
      authorization: `Bearer ${token}`,
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let parsed: Partial<Envelope<T>> = {};
  try {
    parsed = JSON.parse(text) as Partial<Envelope<T>>;
  } catch {
    // A non-JSON body (an edge error page) keeps the status, which is what callers judge.
  }
  return {
    status: response.status,
    success: response.ok && parsed.success !== false,
    errors: parsed.errors ?? [],
    result: parsed.result as T,
    result_info: parsed.result_info,
  };
}

function fail(what: string, outcome: ApiOutcome): never {
  throw new Error(`${what} failed: HTTP ${outcome.status} ${JSON.stringify(outcome.errors ?? [])}`);
}

/** 'deleted' or 'gone'; anything else throws. */
async function remove(what: string, path: string): Promise<'deleted' | 'gone'> {
  const outcome = await call<unknown>('DELETE', path);
  if (outcome.success) return 'deleted';
  if (isNotFound(outcome)) return 'gone';
  return fail(what, outcome);
}

export async function listWorkers(): Promise<string[]> {
  const out = await call<{ id: string }[]>('GET', '/workers/scripts');
  if (!out.success) fail('list workers', out);
  return out.result.map((script) => script.id);
}

export async function deleteWorker(name: string): Promise<'deleted' | 'gone'> {
  return remove(`delete worker ${name}`, `/workers/scripts/${encodeURIComponent(name)}?force=true`);
}

interface D1Database {
  uuid: string;
  name: string;
}

export async function listD1(name?: string): Promise<D1Database[]> {
  const all: D1Database[] = [];
  for (let page = 1; ; page += 1) {
    const query = new URLSearchParams({ page: String(page), per_page: '100' });
    if (name !== undefined) query.set('name', name);
    const out = await call<D1Database[]>('GET', `/d1/database?${query}`);
    if (!out.success) fail('list D1 databases', out);
    all.push(...out.result);
    if (out.result.length < 100) return all;
  }
}

async function findD1(name: string): Promise<D1Database | undefined> {
  return (await listD1(name)).find((db) => db.name === name);
}

/** The database's id, creating it when missing; `created` says which. */
export async function ensureD1(name: string): Promise<{ id: string; created: boolean }> {
  const existing = await findD1(name);
  if (existing) return { id: existing.uuid, created: false };
  const out = await call<D1Database>('POST', '/d1/database', { name });
  if (!out.success) fail(`create D1 ${name}`, out);
  return { id: out.result.uuid, created: true };
}

export async function deleteD1(name: string): Promise<'deleted' | 'gone'> {
  const existing = await findD1(name);
  if (!existing) return 'gone';
  return remove(`delete D1 ${name}`, `/d1/database/${existing.uuid}`);
}

export async function listR2(): Promise<string[]> {
  const names: string[] = [];
  let cursor: string | undefined;
  do {
    const query = new URLSearchParams({ per_page: '1000' });
    if (cursor) query.set('cursor', cursor);
    const out = await call<{ buckets: { name: string }[] }>('GET', `/r2/buckets?${query}`);
    if (!out.success) fail('list R2 buckets', out);
    names.push(...out.result.buckets.map((bucket) => bucket.name));
    cursor = out.result_info?.cursor || undefined;
  } while (cursor);
  return names;
}

export async function ensureR2(name: string): Promise<boolean> {
  if ((await listR2()).includes(name)) return false;
  const out = await call<unknown>('POST', '/r2/buckets', { name });
  if (!out.success) fail(`create R2 ${name}`, out);
  return true;
}

/** Deletes every object, then the bucket: Cloudflare refuses to delete one that is not empty. */
export async function emptyAndDeleteR2(name: string): Promise<'deleted' | 'gone'> {
  const bucket = `/r2/buckets/${encodeURIComponent(name)}`;
  for (let pass = 0; ; pass += 1) {
    if (pass === MAX_EMPTY_PASSES)
      throw new Error(`${name} still holds objects after ${pass} passes`);
    const out = await call<{ key: string }[]>('GET', `${bucket}/objects?per_page=1000`);
    if (!out.success) {
      if (isNotFound(out)) return 'gone';
      fail(`list objects in ${name}`, out);
    }
    if (out.result.length === 0) break;
    for (const { key } of out.result) {
      await remove(`delete ${name}/${key}`, `${bucket}/objects/${encodeURIComponent(key)}`);
    }
  }
  return remove(`delete R2 ${name}`, bucket);
}
