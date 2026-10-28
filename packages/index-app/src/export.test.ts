// The export door (liveworkspace/docs/specs/006-media/previews.md "The export door"), answered by handleInternalItems.
import { describe, expect, it, vi } from 'vitest';
import { etagVersion, handleInternalItems, type InternalItemHandlers } from './internal';

const exportRequest = (path: string, auth: string, headers: Record<string, string> = {}) =>
  new Request(`https://app.test${path}`, {
    headers: { Authorization: `Bearer ${auth}`, ...headers },
  });

const handlers = (run: InternalItemHandlers['export']): InternalItemHandlers => ({
  purge: async () => {},
  export: run,
});

describe('the export door', () => {
  it('answers the drawing with its version, to the index key or the media key', async () => {
    const run = vi.fn(async () => ({
      status: 'ok' as const,
      body: '<svg/>',
      contentType: 'image/svg+xml',
      version: 42,
    }));
    for (const auth of ['index-key', 'media-key']) {
      const res = await handleInternalItems(
        exportRequest('/api/internal/items/A/export?format=svg&tab=T1', auth),
        { key: 'index-key', exportKey: 'media-key', handlers: handlers(run) },
      );
      expect(res.status).toBe(200);
      expect(res.headers.get('ETag')).toBe('"42"');
      expect(res.headers.get('Content-Type')).toBe('image/svg+xml');
      expect(await res.text()).toBe('<svg/>');
    }
    expect(run).toHaveBeenCalledWith('A', {
      format: 'svg',
      tabId: 'T1',
      code: null,
      appearance: null,
      ifVersion: null,
    });
  });

  it('hands the reader’s appearance to the app, and refuses any other', async () => {
    const run = vi.fn(async () => ({ status: 'empty' as const, version: 7 }));
    const opts = { key: 'k', handlers: handlers(run) };
    await handleInternalItems(
      exportRequest('/api/internal/items/A/export?appearance=dark', 'k'),
      opts,
    );
    expect(run).toHaveBeenCalledWith('A', expect.objectContaining({ appearance: 'dark' }));
    const bad = await handleInternalItems(
      exportRequest('/api/internal/items/A/export?appearance=sepia', 'k'),
      opts,
    );
    expect(bad.status).toBe(400);
    expect(run).toHaveBeenCalledOnce();
  });

  it('opens no other door to the media key', async () => {
    const purge = vi.fn(async () => {});
    const res = await handleInternalItems(
      new Request('https://app.test/api/internal/items/A', {
        method: 'DELETE',
        headers: { Authorization: 'Bearer media-key' },
      }),
      { key: 'index-key', exportKey: 'media-key', handlers: { purge } },
    );
    expect(res.status).toBe(401);
    expect(purge).not.toHaveBeenCalled();
  });

  it('takes the media key with no index key configured', async () => {
    const run = vi.fn(async () => ({ status: 'empty' as const, version: 7 }));
    const res = await handleInternalItems(
      exportRequest('/api/internal/items/A/export', 'media-key'),
      {
        key: undefined,
        exportKey: 'media-key',
        handlers: handlers(run),
      },
    );
    expect(res.status).toBe(204);
    expect(res.headers.get('ETag')).toBe('"7"');
  });

  it('passes If-None-Match and the public code on, and answers 304 and 404', async () => {
    const run = vi.fn(async (_id: string, q: { ifVersion: number | null; code: string | null }) =>
      q.code === 'HIDDEN'
        ? ({ status: 'not_found' } as const)
        : ({ status: 'unchanged', version: q.ifVersion ?? 0 } as const),
    );
    const options = { key: 'k', handlers: handlers(run) };
    const unchanged = await handleInternalItems(
      exportRequest('/api/internal/items/A/export?code=POST', 'k', { 'If-None-Match': 'W/"9"' }),
      options,
    );
    expect(unchanged.status).toBe(304);
    expect(run).toHaveBeenLastCalledWith('A', {
      format: 'svg',
      tabId: null,
      code: 'POST',
      appearance: null,
      ifVersion: 9,
    });
    const hidden = await handleInternalItems(
      exportRequest('/api/internal/items/A/export?code=HIDDEN', 'k'),
      options,
    );
    expect(hidden.status).toBe(404);
  });

  it('refuses an unknown format, and is a 404 without a handler', async () => {
    const run = vi.fn();
    const bad = await handleInternalItems(
      exportRequest('/api/internal/items/A/export?format=docx', 'k'),
      { key: 'k', handlers: handlers(run) },
    );
    expect(bad.status).toBe(400);
    const none = await handleInternalItems(exportRequest('/api/internal/items/A/export', 'k'), {
      key: 'k',
      handlers: { purge: async () => {} },
    });
    expect(none.status).toBe(404);
    expect(run).not.toHaveBeenCalled();
  });

  it('reads the version an If-None-Match names', () => {
    expect(etagVersion('"12"')).toBe(12);
    expect(etagVersion('W/"12", "13"')).toBe(12);
    expect(etagVersion('*')).toBeNull();
    expect(etagVersion(null)).toBeNull();
  });
});
