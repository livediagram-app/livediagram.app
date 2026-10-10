// @vitest-environment jsdom

// The document list leaves the landing page its note of recent diagrams, and the thumbnail calls
// behind it and the Explorer (docs/specs/019-marketing/returning-visitor.md).

import { RECENT_DIAGRAMS_KEY, parseRecentDiagrams } from '@livediagram/api-schema';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { __setOfflineBackend, offlineCreateDocument } from '../offline/offline-store';
import { memBackend } from '../offline/offline-test-utils';
import {
  apiFetchDocumentThumbnailSvg,
  apiFetchDocumentThumbnailUrl,
  apiListDocuments,
} from './documents';

const SVG = '<svg viewBox="0 0 4 2" width="400" height="200"><rect fill="#fafafa"/></svg>';

function stubFetch(answer: (url: string) => Response): string[] {
  const seen: string[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      seen.push(String(url));
      return answer(String(url));
    }),
  );
  return seen;
}

afterEach(() => {
  vi.unstubAllGlobals();
  __setOfflineBackend(null);
  localStorage.clear();
});

describe('apiListDocuments', () => {
  it('leaves the note of recent diagrams for the landing page', async () => {
    __setOfflineBackend(memBackend());
    stubFetch(() =>
      Response.json({
        documents: [
          { id: 'old', name: 'Old', savedAt: 1, empty: false, opensIn: 'draw' },
          { id: 'new', name: 'New', savedAt: 2, empty: false, opensIn: null },
        ],
      }),
    );

    await apiListDocuments('owner-recent');

    expect(parseRecentDiagrams(localStorage.getItem(RECENT_DIAGRAMS_KEY))).toEqual([
      { id: 'new', name: 'New', savedAt: 2, mode: null },
      { id: 'old', name: 'Old', savedAt: 1, mode: 'draw' },
    ]);
  });
});

describe('apiListDocuments thumbnails', () => {
  it('never asks the server for an offline document’s snapshot', async () => {
    // docs/specs/006-document/offline-mode.md: offline rows never trigger a server fetch.
    __setOfflineBackend(memBackend());
    await offlineCreateDocument(
      { id: 'local', name: 'Local', tabs: [{ id: 't', name: 't', elements: [{} as never] }] },
      5,
    );
    const stored = new Map<string, Response>();
    vi.stubGlobal('caches', {
      open: async () => ({
        keys: async () => [],
        match: async (url: string) => stored.get(url),
        put: async (url: string, res: Response) => void stored.set(url, res),
        delete: async () => true,
      }),
    });
    const seen = stubFetch((url) =>
      url.includes('/thumbnail')
        ? new Response(SVG)
        : Response.json({
            documents: [{ id: 'cloud', name: 'Cloud', savedAt: 1, empty: false, opensIn: null }],
          }),
    );

    await apiListDocuments('owner-thumbs');
    // Both diagrams' entries land: the cloud one's snapshot, the local one remembered as having
    // none. (An earlier list's idle pass may add its own entries; only these two are asserted.)
    const cachedFor = (id: string) => [...stored.keys()].some((url) => url.includes(id));
    await vi.waitFor(() => expect(cachedFor('cloud') && cachedFor('local')).toBe(true), {
      timeout: 5000,
    });

    const thumbnails = seen.filter((u) => u.includes('/thumbnail'));
    expect(thumbnails).toContainEqual(expect.stringMatching(/\/documents\/cloud\/thumbnail/));
    expect(thumbnails.filter((u) => u.includes('/documents/local/'))).toEqual([]);
  });
});

describe('apiFetchDocumentThumbnailSvg', () => {
  it('returns the snapshot text, versioned by save', async () => {
    const seen = stubFetch(() => new Response(SVG));

    expect(await apiFetchDocumentThumbnailSvg('owner', 'd 1', { version: 7 })).toBe(SVG);
    expect(seen[0]).toMatch(/\/documents\/d%201\/thumbnail\?v=7$/);
  });

  it('is null when the server has no snapshot', async () => {
    stubFetch(() => new Response('', { status: 404 }));

    expect(await apiFetchDocumentThumbnailSvg('owner', 'd1')).toBeNull();
  });
});

describe('apiFetchDocumentThumbnailUrl', () => {
  it('hands back a blob URL of the scalable snapshot and its background colour', async () => {
    stubFetch(() => new Response(SVG));
    const blobs: Blob[] = [];
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: (b: Blob) => (blobs.push(b), 'blob:thumb'),
    });

    const thumb = await apiFetchDocumentThumbnailUrl('owner', 'd1');

    expect(thumb).toEqual({ url: 'blob:thumb', backgroundColor: '#fafafa' });
    expect(await blobs[0]!.text()).toBe('<svg viewBox="0 0 4 2"><rect fill="#fafafa"/></svg>');
  });

  it('is null when there is no snapshot', async () => {
    stubFetch(() => new Response('', { status: 403 }));

    expect(await apiFetchDocumentThumbnailUrl('owner', 'd1')).toBeNull();
  });
});
