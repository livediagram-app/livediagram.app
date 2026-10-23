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
  it("asks the item's own app, cache-busted by its version, and only apps that serve one", () => {
    expect(previewUrl(item())).toBe('https://www.liveplanner.app/api/projects/p1/thumbnail?v=5');
    expect(previewUrl(item({ app: 'livediagram' }))).toBe(
      'https://www.livediagram.app/api/documents/p1/thumbnail?v=5',
    );
    expect(previewUrl(item({ app: 'livedesign' }))).toBe(
      'https://www.livedesign.app/api/designs/p1/thumbnail?v=5',
    );
    expect(renderPreview(item({ app: 'livedocuments' }), 'card')).toBeNull();
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
