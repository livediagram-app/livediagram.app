// @vitest-environment jsdom

// docs/specs/019-marketing/returning-visitor.md: the landing page's note of recent diagrams asks the
// server for snapshots of cloud documents only. A Local only document has none, and a guest's new
// documents start local (docs/specs/006-document/offline-mode.md), so asking would 404 on every save.

import { afterEach, describe, expect, it, vi } from 'vitest';

const remembered = vi.hoisted(() => ({
  fetcher: null as ((id: string, savedAt: number) => Promise<string | null>) | null,
}));
vi.mock('../recent-diagrams-snapshot', () => ({
  rememberRecentDiagrams: (_docs: unknown, fetcher: typeof remembered.fetcher) => {
    remembered.fetcher = fetcher;
  },
}));

import { __setOfflineBackend, offlineCreateDocument } from '../offline/offline-store';
import { memBackend } from '../offline/offline-test-utils';
import { apiListDocuments } from './documents';

afterEach(() => {
  vi.unstubAllGlobals();
  __setOfflineBackend(null);
});

describe('apiListDocuments recent snapshots', () => {
  it('never asks the server for a Local only document’s snapshot', async () => {
    __setOfflineBackend(memBackend());
    await offlineCreateDocument({ id: 'local-1', name: 'Sketch' }, 5);
    const seen: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        seen.push(String(url));
        return String(url).includes('/thumbnail')
          ? new Response('<svg/>')
          : Response.json({ documents: [{ id: 'cloud-1', name: 'C', savedAt: 2, empty: false }] });
      }),
    );

    await apiListDocuments('owner-local-recent');
    const fetcher = remembered.fetcher!;

    expect(await fetcher('local-1', 5)).toBeNull();
    expect(seen.some((u) => u.includes('local-1'))).toBe(false);
    expect(await fetcher('cloud-1', 2)).toBe('<svg/>');
    expect(seen.some((u) => u.includes('/documents/cloud-1/thumbnail'))).toBe(true);
  });
});
