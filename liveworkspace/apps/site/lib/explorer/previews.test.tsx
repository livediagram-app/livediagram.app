// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { Item } from '@liveworkspace/index-client';

vi.mock('./token', () => ({ workspaceToken: async () => 'tok' }));

import {
  loadPreview,
  PREVIEW_CONCURRENCY,
  previewUrl,
  renderPreview,
  resetPreviews,
} from './previews';

const item = (over: Partial<Item> = {}) =>
  ({
    id: 'p1',
    app: 'liveplanner',
    updatedAt: 5,
    summary: {},
    sharedVia: null,
    ...over,
  }) as unknown as Item;

beforeEach(() => {
  resetPreviews();
  vi.stubGlobal(
    'URL',
    Object.assign(URL, { createObjectURL: () => 'blob:x', revokeObjectURL: vi.fn() }),
  );
});

describe('previews on liveworkspace.app', () => {
  it('asks one address on the page’s own origin for every app, cache-busted by its version', () => {
    expect(previewUrl(item())).toBe('/api/previews/items/p1?v=5');
    expect(previewUrl(item({ app: 'livedocuments', id: 'd 1' }))).toBe(
      '/api/previews/items/d%201?v=5',
    );
    expect(renderPreview(item({ app: 'livedocuments' }), 'card')).not.toBeNull();
    expect(renderPreview(item({ summary: { empty: true } }), 'card')).toBeNull();
    expect(loadPreview(item({ summary: { empty: true } }))).toBeNull();
  });

  it('fetches each version once with the bearer and share code, a few at a time', async () => {
    let open = 0;
    let most = 0;
    const fetch = vi.fn(async (_url: string, init: RequestInit) => {
      open++;
      most = Math.max(most, open);
      await new Promise((r) => setTimeout(r, 5));
      open--;
      expect(new Headers(init.headers).get('Authorization')).toBe('Bearer tok');
      return new Response('<svg/>', { status: 200 });
    });
    vi.stubGlobal('fetch', fetch);
    const items = Array.from({ length: 10 }, (_, i) => item({ id: `p${i}` }));
    await Promise.all([...items, ...items].map((it) => loadPreview(it) ?? Promise.resolve(null)));
    expect(fetch).toHaveBeenCalledTimes(10);
    expect(most).toBeLessThanOrEqual(PREVIEW_CONCURRENCY);
    await loadPreview(items[0]!);
    expect(fetch).toHaveBeenCalledTimes(10);
    await loadPreview(item({ id: 'p0', updatedAt: 6 }));
    expect(fetch).toHaveBeenCalledTimes(11);
    await loadPreview(item({ id: 's', sharedVia: 'code' }));
    expect(new Headers(fetch.mock.calls.at(-1)![1].headers).get('X-Share-Code')).toBe('code');
  });
});
