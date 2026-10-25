// The Drive mirror's two doors (liveworkspace/docs/drive.md "Contracts > The apps"), answered by handleInternalItems:
// the file export and the import, and the Drive key that opens those two and nothing else.
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  handleInternalItems,
  IMPORT_MAX_BYTES,
  type ImportInput,
  type ImportResult,
  type InternalItemHandlers,
} from './internal';

afterEach(() => vi.restoreAllMocks());

const OPTIONS = { key: 'index-key', exportKey: 'media-key', driveKey: 'drive-key' };
const FILE = '{"kind":"livedesign.design"}';
const BODY = { owner: 'user_ada', folderId: 'F1', name: 'Logo', file: FILE };

const request = (
  method: string,
  path: string,
  auth: string,
  body?: unknown,
  headers: Record<string, string> = {},
) =>
  new Request(`https://app.test/api/internal/${path}`, {
    method,
    headers: { Authorization: `Bearer ${auth}`, 'Content-Type': 'application/json', ...headers },
    ...(body === undefined ? {} : { body: typeof body === 'string' ? body : JSON.stringify(body) }),
  });

const send = (req: Request, handlers: Partial<InternalItemHandlers>) =>
  handleInternalItems(req, { ...OPTIONS, handlers: { purge: async () => {}, ...handlers } });

const importing = (result: ImportResult = { status: 'ok', id: 'NEW' }) =>
  vi.fn(async (_input: ImportInput) => result);

describe('the Drive key', () => {
  it('opens the file export, and answers the envelope with its version', async () => {
    const run = vi.fn(async () => ({
      status: 'ok' as const,
      body: FILE,
      contentType: 'application/vnd.livedesign+json',
      version: 5,
    }));
    const res = await send(request('GET', 'items/A/export?format=file', 'drive-key'), {
      export: run,
    });
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('application/vnd.livedesign+json');
    expect(res.headers.get('ETag')).toBe('"5"');
    expect(await res.text()).toBe(FILE);
    expect(run).toHaveBeenCalledWith('A', {
      format: 'file',
      tabId: null,
      code: null,
      ifVersion: null,
    });
  });

  it('opens the svg export too, and answers 304 for an unchanged version', async () => {
    const run = vi.fn(async (_id: string, q: { ifVersion: number | null }) => ({
      status: 'unchanged' as const,
      version: q.ifVersion ?? 0,
    }));
    const res = await send(
      request('GET', 'items/A/export?format=file', 'drive-key', undefined, {
        'If-None-Match': '"5"',
      }),
      { export: run },
    );
    expect(res.status).toBe(304);
    expect(res.headers.get('ETag')).toBe('"5"');
    expect(
      (await send(request('GET', 'items/A/export', 'drive-key'), { export: run })).status,
    ).toBe(304);
  });

  it('opens the import door', async () => {
    const run = importing();
    const res = await send(request('POST', 'items/import', 'drive-key', BODY), { import: run });
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ id: 'NEW' });
    expect(run).toHaveBeenCalledWith(BODY);
  });

  it('opens no other door', async () => {
    const purge = vi.fn(async () => {});
    const copy = vi.fn(async () => ({ tabs: 1, items: 0 }));
    const revoke = vi.fn(async () => 0);
    const personMerged = vi.fn(async () => {});
    const handlers = { purge, copy, revoke, personMerged, import: importing() };
    const doors = [
      request('DELETE', 'items/A', 'drive-key'),
      request('POST', 'items/purge', 'drive-key', { ids: ['A'] }),
      request('POST', 'items/A/copy-to/B', 'drive-key', {}),
      request('POST', 'items/A/revoke', 'drive-key', { codes: ['c'] }),
      request('POST', 'people/guest_a/merge', 'drive-key', { into: 'user_a' }),
      // The export door is a GET: another method is no way in.
      request('POST', 'items/A/export?format=file', 'drive-key'),
      // The import door is a POST.
      request('GET', 'items/import', 'drive-key'),
    ];
    for (const door of doors) expect((await send(door, handlers)).status).toBe(401);
    expect(purge).not.toHaveBeenCalled();
    expect(copy).not.toHaveBeenCalled();
    expect(revoke).not.toHaveBeenCalled();
    expect(personMerged).not.toHaveBeenCalled();
    expect(handlers.import).not.toHaveBeenCalled();
  });

  it('is refused with the wrong key, and the import door is the index key’s too', async () => {
    const run = importing();
    expect(
      (await send(request('POST', 'items/import', 'nope', BODY), { import: run })).status,
    ).toBe(401);
    expect(
      (await send(request('POST', 'items/import', 'media-key', BODY), { import: run })).status,
    ).toBe(401);
    expect(
      (await send(request('POST', 'items/import', 'index-key', BODY), { import: run })).status,
    ).toBe(201);
  });

  it('is a 404 when no key is configured but the Drive key, on any other door', async () => {
    const res = await handleInternalItems(request('DELETE', 'items/A', 'drive-key'), {
      key: undefined,
      driveKey: 'drive-key',
      handlers: { purge: async () => {} },
    });
    expect(res.status).toBe(404);
  });
});

describe('the import door', () => {
  it('answers each outcome', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const post = (run: InternalItemHandlers['import']) =>
      send(request('POST', 'items/import', 'drive-key', BODY), { import: run });
    const invalid = await post(importing({ status: 'invalid_file' }));
    expect(invalid.status).toBe(400);
    expect(await invalid.json()).toEqual({ error: 'invalid_file' });
    const large = await post(importing({ status: 'too_large' }));
    expect(large.status).toBe(413);
    expect(await large.json()).toEqual({ error: 'too_large' });
    const failing = await post(
      vi.fn(async () => {
        throw new Error('down');
      }),
    );
    expect(failing.status).toBe(503);
  });

  it('is a 404 without a handler', async () => {
    expect((await send(request('POST', 'items/import', 'drive-key', BODY), {})).status).toBe(404);
  });

  it('checks the body before the handler sees it', async () => {
    const run = importing();
    const bad = [
      'not json',
      [],
      { ...BODY, owner: 'guest_ada' },
      { ...BODY, owner: 'ada' },
      { ...BODY, owner: undefined },
      { ...BODY, folderId: undefined },
      { ...BODY, folderId: 7 },
      { ...BODY, folderId: '' },
      { ...BODY, name: '   ' },
      { ...BODY, name: 'x'.repeat(1001) },
      { ...BODY, name: 3 },
      { ...BODY, file: '' },
      { ...BODY, file: { kind: 'livedesign.design' } },
    ];
    for (const body of bad) {
      expect(
        (await send(request('POST', 'items/import', 'drive-key', body), { import: run })).status,
      ).toBe(400);
    }
    expect(run).not.toHaveBeenCalled();
  });

  it('takes a null folder and trims the name', async () => {
    const run = importing();
    const res = await send(
      request('POST', 'items/import', 'drive-key', { ...BODY, folderId: null, name: '  Logo ' }),
      { import: run },
    );
    expect(res.status).toBe(201);
    expect(run).toHaveBeenCalledWith({ ...BODY, folderId: null, name: 'Logo' });
  });

  it('refuses a body declared past the cap unread', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const run = importing();
    const res = await send(
      request('POST', 'items/import', 'drive-key', BODY, {
        'Content-Length': String(IMPORT_MAX_BYTES + 1),
      }),
      { import: run },
    );
    expect(res.status).toBe(413);
    expect(run).not.toHaveBeenCalled();
  });
});
