// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { Item } from '@liveworkspace/index-client';
import { act } from 'react';
import { createRoot } from 'react-dom/client';

vi.mock('./token', () => ({ workspaceToken: async () => 'tok' }));

import {
  loadPreview,
  PREVIEW_CACHE_CEILING,
  PREVIEW_CACHE_MAX,
  PREVIEW_CONCURRENCY,
  previewCacheSize,
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
    expect(previewUrl(item())).toBe('/api/previews/items/p1?v=5&appearance=light');
    expect(previewUrl(item({ app: 'livedocuments', id: 'd 1' }))).toBe(
      '/api/previews/items/d%201?v=5&appearance=light',
    );
    // In the reader’s appearance (previews.md): the other half is its own address.
    expect(previewUrl(item(), 'dark')).toBe('/api/previews/items/p1?v=5&appearance=dark');
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

  it('drops the least recently used preview when full, not the first fetched', async () => {
    const fetch = vi.fn(async () => new Response('<svg/>', { status: 200 }));
    vi.stubGlobal('fetch', fetch);
    const items = Array.from({ length: PREVIEW_CACHE_MAX }, (_, i) => item({ id: `p${i}` }));
    for (const it of items) await loadPreview(it);
    // The first one is asked for again (still on screen), so it is the most recently used.
    await loadPreview(items[0]!);
    await loadPreview(item({ id: 'one-more' }));
    expect(fetch).toHaveBeenCalledTimes(PREVIEW_CACHE_MAX + 1);
    await loadPreview(items[0]!);
    expect(fetch).toHaveBeenCalledTimes(PREVIEW_CACHE_MAX + 1);
    // p1 was the least recently used, so it went.
    await loadPreview(items[1]!);
    expect(fetch).toHaveBeenCalledTimes(PREVIEW_CACHE_MAX + 2);
  });

  it('keeps every mounted preview past PREVIEW_CACHE_MAX, fetching each once, and shrinks back on unmount', async () => {
    const fetch = vi.fn(async () => new Response('<svg/>', { status: 200 }));
    vi.stubGlobal('fetch', fetch);
    const n = PREVIEW_CACHE_MAX + 100;
    const view = mountPreviews(Array.from({ length: n }, (_, i) => item({ id: `m${i}` })));
    await until(() => view.images() === n);
    // Settled: no box lost its picture to another and asked again.
    await act(() => new Promise((r) => setTimeout(r, 50)));
    expect(fetch).toHaveBeenCalledTimes(n);
    expect(view.images()).toBe(n);
    view.unmount();
    expect(previewCacheSize()).toBe(PREVIEW_CACHE_MAX);
  });

  it('never holds more than PREVIEW_CACHE_CEILING, mounted or not', async () => {
    const fetch = vi.fn(async () => new Response('<svg/>', { status: 200 }));
    vi.stubGlobal('fetch', fetch);
    const items = Array.from({ length: PREVIEW_CACHE_CEILING + 20 }, (_, i) =>
      item({ id: `c${i}` }),
    );
    const view = mountPreviews(items);
    await until(() => fetch.mock.calls.length >= items.length);
    await act(() => new Promise((r) => setTimeout(r, 20)));
    expect(previewCacheSize()).toBeLessThanOrEqual(PREVIEW_CACHE_CEILING);
    view.unmount();
  }, 20_000);
});

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function mountPreviews(items: Item[]) {
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  act(() =>
    root.render(
      <div>
        {items.map((it) => (
          <span key={it.id}>{renderPreview(it, 'card')}</span>
        ))}
      </div>,
    ),
  );
  return {
    images: () => host.querySelectorAll('img').length,
    unmount: () => {
      act(() => root.unmount());
      host.remove();
    },
  };
}

async function until(done: () => boolean, ms = 10_000) {
  const end = Date.now() + ms;
  while (!done()) {
    if (Date.now() > end) throw new Error('timed out');
    await act(() => new Promise((r) => setTimeout(r, 5)));
  }
}
