import { describe, expect, it } from 'vitest';
import { categories, getCategoryGroups } from '@/lib/articles';

// docs/specs/018-help/help-pages.md "Groups": a category with more than a dozen cards is split into named groups,
// every card in it belongs to one, and the category's `groups` names exactly the groups its cards use, in order.
const MAX_UNGROUPED = 12;

describe('category groups', () => {
  it.each(categories.map((c) => c.slug))('%s is grouped once it outgrows one grid', (slug) => {
    const groups = getCategoryGroups(slug);
    const cards = groups.reduce((n, g) => n + g.articles.length, 0);
    if (cards > MAX_UNGROUPED) expect(groups.every((g) => g.group !== '')).toBe(true);
  });

  it.each(categories.filter((c) => c.groups).map((c) => [c.slug, c.groups!] as const))(
    '%s lists its groups in the order they show',
    (slug, order) => {
      expect(getCategoryGroups(slug).map((g) => g.group)).toEqual(order);
    },
  );
});
