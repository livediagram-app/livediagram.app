// The migration handoff's edges (migration-handoff.ts), called directly: a method it does not take, a body past the
// cap by its header, one that cannot be read, JSON that is not an object, a write that fails for another reason than
// a taken id, and the Drive mirror told when the person's tree grew.
import { describe, expect, it, vi } from 'vitest';
import { HANDOFF_MAX_BYTES } from './config';
import type { Env } from './env';
import { handleMigrationHandoff } from './migration-handoff';
import { h, useHarness } from './test-support';

const DRIVE_CALLS: string[] = [];
useHarness({
  INDEX_KEY_LIVEDOCUMENTS: 'ldoc-key',
  APP_ORIGIN_LIVEDOCUMENTS: 'https://livedocuments.app',
  DRIVE: {
    fetch: async (input: RequestInfo | URL) => {
      DRIVE_CALLS.push(String(input));
      return new Response(null, { status: 202 });
    },
  } as unknown as Fetcher,
});

const GOOD = {
  app: 'livedocuments',
  title: 'Deck',
  payload: { v: 1, app: 'livedocuments', id: 'part-1', tabs: [] },
};

function request(
  over: { method?: string; body?: BodyInit | null; headers?: Record<string, string> } = {},
) {
  const method = over.method ?? 'POST';
  return new Request('https://liveworkspace.app/api/index/app/migration/handoff', {
    method,
    headers: { 'X-Index-Person': 'user_ada', ...over.headers },
    ...(method === 'GET' ? {} : { body: over.body ?? JSON.stringify(GOOD) }),
  });
}

const run = (req: Request, env: Env = h.db.env) => handleMigrationHandoff(req, env, 'livediagram');

describe('the migration handoff, edge by edge', () => {
  it('takes only a POST', async () => {
    expect((await run(request({ method: 'GET' }))).status).toBe(404);
  });

  it('refuses a body its header says is over the cap, before reading it', async () => {
    const req = request({ headers: { 'Content-Length': String(HANDOFF_MAX_BYTES + 1) } });
    const read = vi.spyOn(req, 'arrayBuffer');
    expect((await run(req)).status).toBe(413);
    expect(read).not.toHaveBeenCalled();
  });

  it('answers 400 for a body that cannot be read, is not JSON, or is not an object', async () => {
    const unreadable = request();
    vi.spyOn(unreadable, 'arrayBuffer').mockRejectedValue(new Error('aborted'));
    expect((await run(unreadable)).status).toBe(400);
    expect((await run(request({ body: '{not json' }))).status).toBe(400);
    expect((await run(request({ body: '[1]' }))).status).toBe(400);
    expect((await run(request({ body: 'null' }))).status).toBe(400);
  });

  it('rethrows a write failure that is not a taken id', async () => {
    const db = new Proxy(h.db.env.INDEX_DB, {
      get(target, prop) {
        if (prop === 'batch') return () => Promise.reject(new Error('disk gone'));
        const value = Reflect.get(target, prop);
        return typeof value === 'function' ? value.bind(target) : value;
      },
    });
    await expect(run(request(), { ...h.db.env, INDEX_DB: db as never })).rejects.toThrow(
      'disk gone',
    );
  });

  it('tells the Drive mirror the person’s tree grew, when there is one', async () => {
    const res = await run(request());
    expect(res.status).toBe(201);
    // The default waitUntil took the signal; an unflagged person's costs the mirror nothing.
    await Promise.resolve();
    expect(DRIVE_CALLS).toEqual([]);
  });
});
