import { articles } from '@liveknowledge/help-registry';
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
    const health = HELP_SEARCH_ITEMS.find((i) => i.href === '/help/knowledgebase/page-health/');
    expect(health?.leaf).toMatch(/page-health$/);
  });

  it('finds an article by concept when the title is no exact match', () => {
    // "stale" is in no title, only the Review Period article's keywords.
    const out = buildSearchResults({
      query: 'stale',
      documents: [],
      folders: [],
      helpItems: HELP_SEARCH_ITEMS,
    });
    const help = out.find((g) => g.key === 'help')!;
    expect(help.items.map((i) => (i.kind === 'help' ? i.href : ''))).toContain(
      '/help/knowledgebase/review-due-and-the-review-period/',
    );
  });
});
