import { describe, expect, it, vi } from 'vitest';
import type { ExportView } from '@liveworkspace/data-export';
import { handle, parseStart, type ExportObject, type RouteDeps } from './routes';

const VIEW: ExportView = {
  id: 'ex_1',
  status: 'ready',
  phase: null,
  requestedBy: 'user_ada',
  startedAt: 1,
  finishedAt: 2,
  expiresAt: 10_000,
  itemsTotal: 1,
  itemsDone: 1,
  imagesTotal: 0,
  imagesDone: 0,
  bytes: 3,
  leftOut: 0,
  problems: 0,
};

function deps(overrides: Partial<RouteDeps> = {}, object: Partial<ExportObject> = {}) {
  const objects: string[] = [];
  const obj: ExportObject = {
    start: vi.fn(async () => ({
      ok: true as const,
      view: { ...VIEW, status: 'running' as const },
    })),
    status: vi.fn(async () => VIEW),
    remove: vi.fn(async () => {}),
    ...object,
  };
  const d: RouteDeps = {
    key: 'k',
    object: (key) => (objects.push(key), obj),
    file: vi.fn(async () => ({ body: new Blob(['zip']).stream(), size: 3 })),
    now: () => 5000,
    ...overrides,
  };
  return { d, obj, objects };
}

const req = (method: string, path: string, body?: unknown, key = 'k') =>
  new Request(`https://export${path}`, {
    method,
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });

const START = {
  key: 'personal:user_ada',
  requestedBy: 'user_ada',
  scope: { kind: 'personal', personId: 'user_ada' },
  profile: { name: 'Ada' },
};

describe('the key', () => {
  it('is a 404 when unset, a 401 when wrong, and nothing outside the path', async () => {
    expect(
      (await handle(req('POST', '/internal/exports', START), deps({ key: undefined }).d)).status,
    ).toBe(404);
    expect((await handle(req('POST', '/internal/exports', START, 'x'), deps().d)).status).toBe(401);
    expect(
      (await handle(new Request('https://export/internal/exports', { method: 'POST' }), deps().d))
        .status,
    ).toBe(401);
    expect((await handle(req('GET', '/other'), deps().d)).status).toBe(404);
  });
});

describe('start', () => {
  it('starts the scope’s export', async () => {
    const { d, obj, objects } = deps();
    const res = await handle(req('POST', '/internal/exports', START), d);
    expect(res.status).toBe(202);
    expect(((await res.json()) as { export: ExportView }).export.status).toBe('running');
    expect(objects).toEqual(['personal:user_ada']);
    expect(obj.start).toHaveBeenCalledWith(START);
  });

  it('answers 409 while one runs, and 400 for a bad call', async () => {
    const { d } = deps({}, { start: async () => ({ ok: false, error: 'export_running' }) });
    expect((await handle(req('POST', '/internal/exports', START), d)).status).toBe(409);
    expect(
      (await handle(req('POST', '/internal/exports', { ...START, key: 'personal:user_bo' }), d))
        .status,
    ).toBe(400);
    expect((await handle(req('POST', '/internal/exports', [1]), d)).status).toBe(400);
    const broken = new Request('https://export/internal/exports', {
      method: 'POST',
      headers: { Authorization: 'Bearer k' },
      body: '{',
    });
    expect((await handle(broken, d)).status).toBe(400);
  });
});

describe('parseStart', () => {
  it('takes a team call and trims its name', () => {
    expect(
      parseStart({
        key: 'team:t1',
        requestedBy: 'user_ada',
        scope: { kind: 'team', teamId: 't1', teamName: 'D'.repeat(300) },
      }),
    ).toEqual({
      key: 'team:t1',
      requestedBy: 'user_ada',
      scope: { kind: 'team', teamId: 't1', teamName: 'D'.repeat(200) },
    });
  });

  it('refuses mismatches and drops a profile that is not an object', () => {
    expect(parseStart(null)).toBeNull();
    expect(
      parseStart({
        key: 'team:t1',
        requestedBy: 'user_ada',
        scope: { kind: 'team', teamId: 't2', teamName: 'D' },
      }),
    ).toBeNull();
    expect(
      parseStart({
        key: 'team:t1',
        requestedBy: 'user_ada',
        scope: { kind: 'team', teamId: 't1' },
      }),
    ).toBeNull();
    expect(
      parseStart({
        key: 'team:t1',
        requestedBy: 'bad id!',
        scope: { kind: 'team', teamId: 't1', teamName: 'D' },
      }),
    ).toBeNull();
    expect(parseStart({ key: 'nope', requestedBy: 'user_ada', scope: {} })).toBeNull();
    expect(parseStart({ ...START, profile: [1] })).toEqual({
      key: START.key,
      requestedBy: START.requestedBy,
      scope: START.scope,
    });
  });
});

describe('status', () => {
  it('answers each key once', async () => {
    const { d, objects } = deps(
      {},
      { status: vi.fn().mockResolvedValueOnce(VIEW).mockResolvedValueOnce(null) },
    );
    const res = await handle(
      req('POST', '/internal/exports/status', { keys: ['personal:a', 'team:t', 'personal:a'] }),
      d,
    );
    expect(await res.json()).toEqual({ exports: { 'personal:a': VIEW, 'team:t': null } });
    expect(objects).toEqual(['personal:a', 'team:t']);
  });

  it('refuses keys that are not keys, or too many', async () => {
    const { d } = deps();
    expect((await handle(req('POST', '/internal/exports/status', { keys: ['x'] }), d)).status).toBe(
      400,
    );
    expect(
      (await handle(req('POST', '/internal/exports/status', { keys: Array(52).fill('team:t') }), d))
        .status,
    ).toBe(400);
    expect((await handle(req('POST', '/internal/exports/status', {}), d)).status).toBe(400);
  });
});

describe('file', () => {
  it('streams a ready, unexpired zip', async () => {
    const { d } = deps();
    const res = await handle(req('GET', '/internal/exports/personal%3Auser_ada/file'), d);
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Length')).toBe('3');
    expect(res.headers.get('X-Export-Id')).toBe('ex_1');
    expect(await res.text()).toBe('zip');
    expect(d.file).toHaveBeenCalledWith('exports/personal:user_ada/ex_1.zip');
  });

  it('is a 404 when not ready, lapsed, missing in R2, or for a bad key', async () => {
    const path = '/internal/exports/personal:user_ada/file';
    expect(
      (
        await handle(
          req('GET', path),
          deps({}, { status: async () => ({ ...VIEW, status: 'running' }) }).d,
        )
      ).status,
    ).toBe(404);
    expect((await handle(req('GET', path), deps({}, { status: async () => null }).d)).status).toBe(
      404,
    );
    expect((await handle(req('GET', path), deps({ now: () => 10_000 }).d)).status).toBe(404);
    expect(
      (
        await handle(
          req('GET', path),
          deps({}, { status: async () => ({ ...VIEW, expiresAt: null }) }).d,
        )
      ).status,
    ).toBe(404);
    expect((await handle(req('GET', path), deps({ file: async () => null }).d)).status).toBe(404);
    expect((await handle(req('GET', '/internal/exports/bad/file'), deps().d)).status).toBe(404);
    expect((await handle(req('PUT', path), deps().d)).status).toBe(404);
    expect((await handle(req('GET', '/internal/exports'), deps().d)).status).toBe(404);
  });
});

it('deletes an export', async () => {
  const { d, obj } = deps();
  expect((await handle(req('DELETE', '/internal/exports/team:t1'), d)).status).toBe(204);
  expect(obj.remove).toHaveBeenCalled();
});
