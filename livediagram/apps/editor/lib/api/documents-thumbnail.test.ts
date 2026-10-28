import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiFetchDocumentThumbnailSvg } from './documents';

// The Explorer's preview request (docs/specs/006-document/document-snapshots.md "In the viewer's half"): keyed by the
// save, and drawn in the viewer's appearance when it names one.
describe('apiFetchDocumentThumbnailSvg', () => {
  const originalFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  function answer(response: () => Response) {
    const seen: string[] = [];
    globalThis.fetch = vi.fn(async (url: string | URL | Request) => {
      seen.push(String(url instanceof Request ? url.url : url));
      return response();
    });
    return seen;
  }

  it('asks for the viewer’s half, keyed by the save', async () => {
    const seen = answer(() => new Response('<svg/>'));
    expect(
      await apiFetchDocumentThumbnailSvg('owner', 'd 1', { version: 7, appearance: 'dark' }),
    ).toBe('<svg/>');
    expect(seen[0]).toMatch(/\/previews\/items\/d%201\?v=7&appearance=dark$/);
  });

  it('asks as stored when no appearance is named, and is null without a preview', async () => {
    const seen = answer(() => new Response('', { status: 404 }));
    expect(await apiFetchDocumentThumbnailSvg('owner', 'd1', { version: 7 })).toBeNull();
    expect(seen[0]).toMatch(/\/previews\/items\/d1\?v=7$/);
  });
});
