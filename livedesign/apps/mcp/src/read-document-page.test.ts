import { describe, expect, it, vi } from 'vitest';
import type { Tab } from '@livedesign/document';

// read_document's page (docs/specs/015-api/mcp-server.md §4.2): one page of a Pages tab, by id, place or name.
vi.mock('./render', () => ({ svgToPngBase64: async () => 'cG5n' }));
const { pageAsked } = await import('./read-document');

const page = (id: string, name?: string) => ({
  id,
  orientation: 'portrait',
  size: 'a4',
  kind: 'infographic',
  ...(name ? { name } : {}),
});
const pages = {
  id: 't',
  name: 'T',
  opensIn: 'pages',
  pages: [page('p-a'), page('p-b', 'Back')],
  elements: [],
} as unknown as Tab;

describe('the page a preview draws', () => {
  it('is none when not asked, and the page an id, place or name names', () => {
    expect(pageAsked(pages, undefined)).toBeUndefined();
    expect(pageAsked(pages, 'p-a')).toMatchObject({ id: 'p-a', index: 0 });
    expect(pageAsked(pages, 2)).toMatchObject({ id: 'p-b' });
    expect(pageAsked(pages, 'back')).toMatchObject({ id: 'p-b' });
  });

  it('is refused on a tab with no pages, or by a name the tab lacks, naming its pages', () => {
    expect(pageAsked({ id: 't', name: 'T', elements: [] }, 1)).toMatch(/^That tab has no pages/);
    expect(pageAsked(pages, 'Front')).toBe(
      'No page "Front" on that tab. Pages: 1 p-a, 2 p-b "Back".',
    );
  });
});
