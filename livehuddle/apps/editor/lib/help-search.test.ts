import { articles } from '@livehuddle/help-registry';
import { describe, expect, it } from 'vitest';
import { HELP_SEARCH_ITEMS } from './help-search';
import { buildSearchResults } from './search';

// The SearchPanel's Help group is derived from the FULL shared registry
// (liveworkspace/docs/specs/017-help/help-centre.md): every help article must be findable from the canvas, matched on
// title + description + keyword synonyms, with a well-formed cross-app href.

describe('HELP_SEARCH_ITEMS', () => {
  it('covers the entire help registry (no curated subset)', () => {
    expect(HELP_SEARCH_ITEMS).toHaveLength(articles.length);
    expect(new Set(HELP_SEARCH_ITEMS.map((i) => i.id)).size).toBe(articles.length);
  });

  it('builds absolute /help hrefs and slash-free telemetry ids', () => {
    for (const item of HELP_SEARCH_ITEMS) {
      expect(item.href).toMatch(/^\/help\/.+\/$/);
      expect(item.leaf).not.toContain('/');
    }
  });

  it('reports each article under its own telemetry id', () => {
    // Two articles on one id read as one on the dashboard (docs/specs/017-telemetry/telemetry.md).
    expect(new Set(HELP_SEARCH_ITEMS.map((i) => i.leaf)).size).toBe(articles.length);
    // Format Painter left livehuddle (docs/specs/002-project-scope/not-in-livehuddle.md), its tip with it.
    expect(HELP_SEARCH_ITEMS.some((i) => i.href.includes('format-painter'))).toBe(false);
  });

  it('finds an article by concept when the title is no exact match', () => {
    // The user-reported case: searching "opacity" must surface an opacity article in the editor's search. livehuddle's
    // is Panel Opacity (the element one left with the menus' looks, docs/specs/002-project-scope/not-in-livehuddle.md).
    const out = buildSearchResults({
      query: 'opacity',
      documents: [],
      folders: [],
      helpItems: HELP_SEARCH_ITEMS,
    });
    const help = out.find((g) => g.key === 'help')!;
    const hrefs = help.items.map((i) => (i.kind === 'help' ? i.href : ''));
    expect(hrefs).toContain('/help/palette/panel-opacity/');

    // And by pure synonym: "transparency" appears in no title, only keywords.
    const bySynonym = buildSearchResults({
      query: 'transparency',
      documents: [],
      folders: [],
      helpItems: HELP_SEARCH_ITEMS,
    });
    const helpBySynonym = bySynonym.find((g) => g.key === 'help')!;
    expect(
      helpBySynonym.items.some(
        (i) => i.kind === 'help' && i.href === '/help/palette/panel-opacity/',
      ),
    ).toBe(true);
  });
});
