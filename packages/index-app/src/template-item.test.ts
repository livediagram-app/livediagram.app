// The apps' template door (liveworkspace/docs/specs/004-index/kits.md "The apps' door"), answered by
// handleInternalItems, and itemFromTemplate, the handler every app binds.
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  handleInternalItems,
  type ImportInput,
  type ImportResult,
  type InternalItemHandlers,
  type TemplateInput,
  type TemplateResult,
} from './internal';
import { itemFromTemplate } from './template-item';

afterEach(() => vi.restoreAllMocks());

const OPTIONS = { key: 'index-key', driveKey: 'drive-key', exportKey: 'media-key' };
const BODY = { owner: 'user_ada', folderId: 'F1', name: 'Apollo Plan', template: 'kanban' };

const request = (method: string, auth: string, body?: unknown) =>
  new Request('https://app.test/api/internal/items/from-template', {
    method,
    headers: { Authorization: `Bearer ${auth}`, 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: typeof body === 'string' ? body : JSON.stringify(body) }),
  });

const send = (req: Request, handlers: Partial<InternalItemHandlers>) =>
  handleInternalItems(req, { ...OPTIONS, handlers: { purge: async () => {}, ...handlers } });

const making = (result: TemplateResult = { status: 'ok', id: 'NEW' }) =>
  vi.fn(async (_input: TemplateInput) => result);

describe('the template door', () => {
  it('makes an item from a template on the index key, answering its id', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const run = making();
    const res = await send(request('POST', 'index-key', { ...BODY, name: '  Apollo Plan ' }), {
      fromTemplate: run,
    });
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ id: 'NEW' });
    expect(run).toHaveBeenCalledWith(BODY);
  });

  it('passes a bare ask on, and refuses a bare that is not a boolean', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const run = making();
    expect(
      (await send(request('POST', 'index-key', { ...BODY, bare: true }), { fromTemplate: run }))
        .status,
    ).toBe(201);
    expect(run).toHaveBeenCalledWith({ ...BODY, bare: true });
    await send(request('POST', 'index-key', { ...BODY, bare: false }), { fromTemplate: run });
    expect(run).toHaveBeenLastCalledWith(BODY);
    expect(
      (await send(request('POST', 'index-key', { ...BODY, bare: 'yes' }), { fromTemplate: run }))
        .status,
    ).toBe(400);
    const fileOf = vi.fn(() => '{"file":1}');
    await itemFromTemplate(
      { ...BODY, bare: true },
      fileOf,
      vi.fn(async () => ({ status: 'ok' as const, id: 'N' })),
    );
    expect(fileOf).toHaveBeenCalledWith('kanban', 'Apollo Plan', { bare: true });
  });

  it('takes a null folder', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const run = making();
    const res = await send(request('POST', 'index-key', { ...BODY, folderId: null }), {
      fromTemplate: run,
    });
    expect(res.status).toBe(201);
    expect(run.mock.calls[0]![0].folderId).toBeNull();
  });

  it('is the index key’s alone', async () => {
    const run = making();
    for (const key of ['drive-key', 'media-key', 'nope'])
      expect((await send(request('POST', key, BODY), { fromTemplate: run })).status).toBe(401);
    expect(run).not.toHaveBeenCalled();
  });

  it('is a 404 for an app without it, and for another method', async () => {
    expect((await send(request('POST', 'index-key', BODY), {})).status).toBe(404);
    const run = making();
    expect((await send(request('PUT', 'index-key', BODY), { fromTemplate: run })).status).toBe(404);
    expect(run).not.toHaveBeenCalled();
  });

  it('refuses a malformed body before anything is made', async () => {
    const run = making();
    for (const body of [
      'not json',
      [],
      { ...BODY, owner: 'guest_ada' },
      { ...BODY, owner: 7 },
      { ...BODY, folderId: '' },
      { ...BODY, folderId: 'x'.repeat(201) },
      { ...BODY, name: '   ' },
      { ...BODY, name: 'x'.repeat(1001) },
      { ...BODY, template: '' },
      { ...BODY, template: 'x'.repeat(101) },
      { ...BODY, template: 3 },
    ])
      expect((await send(request('POST', 'index-key', body), { fromTemplate: run })).status).toBe(
        400,
      );
    expect(run).not.toHaveBeenCalled();
  });

  it('answers an unknown template 404, and a failure 503', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const unknown = await send(request('POST', 'index-key', BODY), {
      fromTemplate: making({ status: 'unknown_template' }),
    });
    expect(unknown.status).toBe(404);
    expect(await unknown.json()).toEqual({ error: 'unknown_template' });
    const failed = await send(request('POST', 'index-key', BODY), {
      fromTemplate: vi.fn(async () => {
        throw new Error('down');
      }),
    });
    expect(failed.status).toBe(503);
  });
});

describe('itemFromTemplate', () => {
  const INPUT: TemplateInput = BODY;
  const importing = (result: ImportResult = { status: 'ok', id: 'NEW' }) =>
    vi.fn(async (_input: ImportInput) => result);

  it('imports the template’s file as the owner’s item', async () => {
    const fileOf = vi.fn(() => '{"file":1}');
    const run = importing();
    expect(await itemFromTemplate(INPUT, fileOf, run)).toEqual({ status: 'ok', id: 'NEW' });
    expect(fileOf).toHaveBeenCalledWith('kanban', 'Apollo Plan');
    expect(run).toHaveBeenCalledWith({
      owner: 'user_ada',
      folderId: 'F1',
      name: 'Apollo Plan',
      file: '{"file":1}',
    });
  });

  it('answers an unknown template without importing', async () => {
    const run = importing();
    expect(await itemFromTemplate(INPUT, () => null, run)).toEqual({
      status: 'unknown_template',
    });
    expect(run).not.toHaveBeenCalled();
  });

  it('throws when the app’s own reader refuses its template', async () => {
    await expect(
      itemFromTemplate(INPUT, () => '{}', importing({ status: 'invalid_file' })),
    ).rejects.toThrow('template_invalid_file');
  });
});
