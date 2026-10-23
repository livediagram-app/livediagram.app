// @vitest-environment jsdom

// docs/specs/019-marketing/returning-visitor.md: the landing page's note of recent diagrams asks the
// server for snapshots of cloud designs only. A design in This Browser has none, and a guest's new
// designs start local (docs/specs/006-design/offline-mode.md), so asking would 404 on every save.

import { afterEach, describe, expect, it, vi } from 'vitest';

const remembered = vi.hoisted(() => ({
  fetcher: null as ((id: string, savedAt: number) => Promise<string | null>) | null,
}));
vi.mock('../recent-diagrams-snapshot', () => ({
  rememberRecentDiagrams: (_docs: unknown, fetcher: typeof remembered.fetcher) => {
    remembered.fetcher = fetcher;
  },
}));

import { __setOfflineBackend, offlineCreateDesign } from '../offline/offline-store';
import { memBackend } from '../offline/offline-test-utils';
import { apiListDesigns } from './designs';

afterEach(() => {
  vi.unstubAllGlobals();
  __setOfflineBackend(null);
});

describe('apiListDesigns recent snapshots', () => {
  it('never asks the server for a design in This Browser’s snapshot', async () => {
    __setOfflineBackend(memBackend());
    await offlineCreateDesign({ id: 'local-1', name: 'Sketch' }, 5);
    const seen: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        seen.push(String(url));
        return String(url).includes('/thumbnail')
          ? new Response('<svg/>')
          : Response.json({ designs: [{ id: 'cloud-1', name: 'C', savedAt: 2, empty: false }] });
      }),
    );

    await apiListDesigns('owner-local-recent');
    const fetcher = remembered.fetcher!;

    expect(await fetcher('local-1', 5)).toBeNull();
    expect(seen.some((u) => u.includes('local-1'))).toBe(false);
    expect(await fetcher('cloud-1', 2)).toBe('<svg/>');
    expect(seen.some((u) => u.includes('/designs/cloud-1/thumbnail'))).toBe(true);
  });
});
