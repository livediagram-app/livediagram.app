import { articles } from '@livediagram/help-registry';
import { describe, expect, it } from 'vitest';
import { HELP_SEARCH_ITEMS } from './help-search';
import { buildSearchResults } from './search';

// The SearchPanel's Help group is derived from the FULL shared registry
// (spec/55): every help article must be findable from the canvas, matched on
// title + description + keyword synonyms, with a well-formed cross-app href.

describe('HELP_SEARCH_ITEMS', () => {
  it('covers the entire help registry (no curated subset)', () => {
    expect(HELP_SEARCH_ITEMS).toHaveLength(articles.length);
    expect(new Set(HELP_SEARCH_ITEMS.map((i) => i.id)).size).toBe(articles.length);
  });

  it('builds absolute /help hrefs and slash-free telemetry leaves', () => {
    for (const item of HELP_SEARCH_ITEMS) {
      expect(item.href).toMatch(/^\/help\/.+\/$/);
      expect(item.leaf).not.toContain('/');
      expect(item.href.endsWith(`/${item.leaf}/`)).toBe(true);
    }
  });

  it('finds an article by concept when the title is no exact match', () => {
    // The user-reported case: searching "opacity" must surface the element
    // opacity article (Layer Order and Opacity) in the editor's search.
    const out = buildSearchResults({
      query: 'opacity',
      diagrams: [],
      folders: [],
      helpItems: HELP_SEARCH_ITEMS,
    });
    const help = out.find((g) => g.key === 'help')!;
    const hrefs = help.items.map((i) => (i.kind === 'help' ? i.href : ''));
    expect(hrefs).toContain('/help/canvas/layer-order/');

    // And by pure synonym: "transparency" appears in no title, only keywords.
    const bySynonym = buildSearchResults({
      query: 'transparency',
      diagrams: [],
      folders: [],
      helpItems: HELP_SEARCH_ITEMS,
    });
    const helpBySynonym = bySynonym.find((g) => g.key === 'help')!;
    expect(
      helpBySynonym.items.some((i) => i.kind === 'help' && i.href === '/help/canvas/layer-order/'),
    ).toBe(true);
  });
});
