import { afterEach, describe, expect, it, vi } from 'vitest';
import type { WorkbenchContext } from '../routes/context';
import { workbenchRefusal } from './workbench-confinement';

const base = {
  sessionId: 'abcdef12-0000-4000-8000-000000000000',
  ownerId: 'user_1',
  tokenId: 'tok1',
  pairingId: 'pair1',
  tabId: null,
  origin: 'https://w.example',
  level: 'edit',
  expiresAt: 1,
} as const;

const workbench = (over: { level?: WorkbenchContext['level'] } = {}): WorkbenchContext => ({
  ...base,
  scope: 'document',
  documentId: 'doc1',
  folderId: null,
  ...over,
});

const workspace = (over: { level?: WorkbenchContext['level'] } = {}): WorkbenchContext => ({
  ...base,
  scope: 'workspace',
  documentId: null,
  folderId: null,
  ...over,
});

type Over = { level?: WorkbenchContext['level'] };

const refuse = (
  method: string,
  path: string,
  over: Over = {},
  headers: Record<string, string> = {},
) => workbenchRefusal(workbench(over), method, ['api', ...path.split('/')], new Headers(headers));

const refuseInWorkspace = (
  method: string,
  path: string,
  over: Over = {},
  headers: Record<string, string> = {},
) => workbenchRefusal(workspace(over), method, ['api', ...path.split('/')], new Headers(headers));

async function body(res: Response | null) {
  expect(res).not.toBeNull();
  return { status: res!.status, body: await res!.json() };
}

describe('workbenchRefusal', () => {
  afterEach(() => vi.restoreAllMocks());

  it('lets an allowed route through', () => {
    expect(refuse('PUT', 'documents/doc1/tabs/t1')).toBeNull();
    expect(refuse('GET', 'capabilities')).toBeNull();
  });

  it('answers another document as absent', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    expect(await body(refuse('GET', 'documents/doc2'))).toEqual({
      status: 404,
      body: { error: 'not_found' },
    });
  });

  it('confines every other route and logs it by route label', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    expect(await body(refuse('GET', 'documents'))).toEqual({
      status: 403,
      body: { error: 'workbench_confined' },
    });
    expect(warn).toHaveBeenCalledWith('[workbench] confined', {
      scope: 'document',
      method: 'GET',
      route: expect.any(String),
      sessionPrefix: 'abcdef12',
    });
  });

  it.each(['X-Share-Code', 'X-Owner-Id', 'X-Share-Password'])(
    'refuses an ambient %s beside the session',
    async (header) => {
      vi.spyOn(console, 'warn').mockImplementation(() => {});

      expect(await body(refuse('GET', 'documents/doc1', {}, { [header]: 'x' }))).toEqual({
        status: 403,
        body: { error: 'workbench_confined' },
      });
    },
  );

  it('refuses a view session its writes, but not the room ticket or ending itself', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const view = { level: 'view' as const };

    expect(await body(refuse('PUT', 'documents/doc1/tabs/t1', view))).toEqual({
      status: 403,
      body: { error: 'workbench_read_only' },
    });
    expect(warn).toHaveBeenCalledWith('[workbench] read-only-refused', {
      scope: 'document',
      method: 'PUT',
      route: expect.any(String),
      sessionPrefix: 'abcdef12',
    });
    expect(refuse('POST', 'documents/doc1/room-ticket', view)).toBeNull();
    expect(refuse('DELETE', 'workbench/sessions/current', view)).toBeNull();
    expect(refuse('GET', 'documents/doc1', view)).toBeNull();
  });
});

describe('workbenchRefusal, workspace scope', () => {
  afterEach(() => vi.restoreAllMocks());

  it.each([
    ['GET', 'documents'],
    ['POST', 'documents'],
    ['PUT', 'documents/any/tabs/t1'],
    ['DELETE', 'documents/any'],
    ['POST', 'folders'],
    ['GET', 'teams'],
    ['GET', 'share/abc'],
  ])('lets an Explorer route through: %s %s', (method, path) => {
    expect(refuseInWorkspace(method, path)).toBeNull();
  });

  it('confines the account and logs the scope', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    expect(await body(refuseInWorkspace('GET', 'tokens'))).toEqual({
      status: 403,
      body: { error: 'workbench_confined' },
    });
    expect(warn).toHaveBeenCalledWith('[workbench] confined', {
      scope: 'workspace',
      method: 'GET',
      route: expect.any(String),
      sessionPrefix: 'abcdef12',
    });
  });

  it('refuses the guest header but lets a share link through', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    expect(await body(refuseInWorkspace('GET', 'documents/d', {}, { 'X-Owner-Id': 'u' }))).toEqual({
      status: 403,
      body: { error: 'workbench_confined' },
    });
    expect(refuseInWorkspace('GET', 'documents/d', {}, { 'X-Share-Code': 'c' })).toBeNull();
    expect(refuseInWorkspace('GET', 'documents/d', {}, { 'X-Share-Password': 'p' })).toBeNull();
  });

  it('keeps a view session to browsing and reading, the share-link list included', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const view = { level: 'view' as const };

    for (const [method, path] of [
      ['POST', 'documents'],
      ['DELETE', 'folders/f1'],
      ['GET', 'documents/d/share'],
    ] as const) {
      expect(await body(refuseInWorkspace(method, path, view))).toEqual({
        status: 403,
        body: { error: 'workbench_read_only' },
      });
    }
    expect(refuseInWorkspace('GET', 'documents', view)).toBeNull();
    expect(refuseInWorkspace('POST', 'documents/d/room-ticket', view)).toBeNull();
  });
});
