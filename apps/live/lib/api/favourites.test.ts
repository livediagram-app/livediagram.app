import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { __setOfflineBackend, offlineCreateDiagram } from '../offline/offline-store';
import { memBackend } from '../offline/offline-test-utils';
import { apiListFavourites, apiSetFavourite } from './favourites';

// Starring an OFFLINE diagram (spec/76) must stay in the browser.
//
// The favourites table carries `FOREIGN KEY (diagram_id) REFERENCES
// diagrams(id)` (migration 0040), and an offline diagram has no row in
// `diagrams` by definition — it lives only in this browser's IndexedDB. So a
// star sent to the server does not merely go unused, it is REJECTED:
// "FOREIGN KEY constraint failed". apiSetFavourite swallows the failure, and
// the toggle is optimistic, so the star appears on click and is gone on the
// next reload, with nothing logged anywhere the user can see.
//
// spec/76 states the rule these lock directly: offline rows never trigger a
// server fetch, "list, thumbnail, or otherwise". A star is an "otherwise".

describe('favourites on an offline diagram', () => {
  let fetchCalls: string[];

  beforeEach(() => {
    __setOfflineBackend(memBackend());
    fetchCalls = [];
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
        fetchCalls.push(String(url));
        return Promise.resolve(new Response(JSON.stringify({ ids: [] }), { status: 200 }));
      }),
    );
  });
  afterEach(() => {
    __setOfflineBackend(null);
    vi.unstubAllGlobals();
  });

  it('stars an offline diagram without reaching the server', async () => {
    await offlineCreateDiagram({ id: 'off-1', name: 'Local only' }, 1000);
    await apiSetFavourite('owner-1', 'off-1', true);
    expect(fetchCalls).toEqual([]);
  });

  it('remembers the star, so it survives a reload', async () => {
    await offlineCreateDiagram({ id: 'off-1', name: 'Local only' }, 1000);
    await apiSetFavourite('owner-1', 'off-1', true);
    expect(await apiListFavourites('owner-1')).toContain('off-1');
  });

  it('un-stars it again', async () => {
    await offlineCreateDiagram({ id: 'off-1', name: 'Local only' }, 1000);
    await apiSetFavourite('owner-1', 'off-1', true);
    await apiSetFavourite('owner-1', 'off-1', false);
    expect(await apiListFavourites('owner-1')).not.toContain('off-1');
  });

  it('still sends a cloud diagram to the server', async () => {
    await apiSetFavourite('owner-1', 'cloud-1', true);
    expect(fetchCalls.some((u) => u.includes('/favourites/cloud-1'))).toBe(true);
  });
});
