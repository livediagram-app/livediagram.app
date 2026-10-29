import { describe, it, expect, vi, beforeEach } from 'vitest';

// A request that throws, at any step from resolving who is calling to the route's own work, is answered by the worker
// (docs/specs/015-api/api.md "When a request fails"). The token lookup runs before any route, so it stands in for the
// identity steps; the folder list for a route.
vi.mock('./auth/accounts', () => ({ getPersonIdentity: async () => null }));
const { resolveApiTokenMock, handleFoldersMock, reportServerEventMock } = vi.hoisted(() => ({
  resolveApiTokenMock: vi.fn(),
  handleFoldersMock: vi.fn(),
  reportServerEventMock: vi.fn(async () => {}),
}));
vi.mock('./db', () => ({ resolveApiToken: resolveApiTokenMock }));
vi.mock('./routes/folders', () => ({ handleFolders: handleFoldersMock }));
vi.mock('./server-telemetry', () => ({
  reportServerEvent: reportServerEventMock,
  telemetryEnabled: () => true,
}));

import { DOCUMENT_FORMAT_HEADER } from '@livediagram/api-schema';
import worker from './index';
import type { Env } from './types';

const TOKEN = `lwt_${'a'.repeat(40)}`;
const D1_INTERNAL = new Error('D1_ERROR: internal error; reference = 5jadrun66l32vrvmnfk8kgts');
const DO_RESET = Object.assign(new Error('Durable Object reset because its code was updated.'), {
  retryable: true,
});
const TOKEN_AUTH = { ownerId: 'acct-1', tokenId: 't-1', readOnly: false, teams: [] };

const env = { BUILD_ID: 'build-1' } as unknown as Env;
const pending: Promise<unknown>[] = [];
const ctx = { waitUntil: (p: Promise<unknown>) => void pending.push(p) } as ExecutionContext;
const listFolders = () =>
  worker.fetch(
    new Request('https://api.test/api/folders', { headers: { Authorization: `Bearer ${TOKEN}` } }),
    env,
    ctx,
  );

let errors: unknown[][];
beforeEach(() => {
  errors = [];
  pending.length = 0;
  vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => void errors.push(args));
  resolveApiTokenMock.mockReset();
  handleFoldersMock.mockReset();
  reportServerEventMock.mockClear();
});

describe('worker when its storage is unavailable', () => {
  it('answers 503 storage_unavailable when the token lookup throws, with CORS and the release', async () => {
    resolveApiTokenMock.mockRejectedValue(D1_INTERNAL);

    const res = await listFolders();

    expect(res.status).toBe(503);
    expect(res.headers.get('Retry-After')).toBe('5');
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect(res.headers.get(DOCUMENT_FORMAT_HEADER)).not.toBeNull();
    expect(await res.json()).toEqual({ error: 'storage_unavailable' });
    expect(errors).toContainEqual(['[d1] unavailable route=Get.Folders', D1_INTERNAL]);
  });

  it("answers 503 storage_unavailable when a route's Durable Object is unavailable", async () => {
    resolveApiTokenMock.mockResolvedValue(TOKEN_AUTH);
    handleFoldersMock.mockRejectedValue(DO_RESET);

    const res = await listFolders();

    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: 'storage_unavailable' });
    expect(errors).toContainEqual(['[durable-object] unavailable route=Get.Folders', DO_RESET]);
    expect(reportServerEventMock).not.toHaveBeenCalled();
  });
});

describe('worker when a request fails otherwise', () => {
  it('answers 500 internal_error when the token lookup throws a bug, and counts the crash', async () => {
    const bug = new TypeError('cannot read properties of undefined');
    resolveApiTokenMock.mockRejectedValue(bug);

    const res = await listFolders();
    await Promise.all(pending);

    expect(res.status).toBe(500);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect(await res.json()).toEqual({ error: 'internal_error' });
    expect(errors).toContainEqual(['api error route=Get.Folders', bug]);
    expect(reportServerEventMock).toHaveBeenCalledWith(env, 'Error', 'Api', 'Internal.Get.Folders');
  });

  it('answers 500 internal_error when a route throws a bug', async () => {
    resolveApiTokenMock.mockResolvedValue(TOKEN_AUTH);
    handleFoldersMock.mockRejectedValue(new Error('D1_ERROR: no such table: secret_table'));

    const res = await listFolders();

    expect(res.status).toBe(500);
    expect(await res.text()).not.toContain('secret_table');
  });
});
