import { describe, expect, it } from 'vitest';
import { HELP_SEARCH_ITEMS } from './help-search';

describe('new element articles are searchable from the editor', () => {
  const find = (q: string) =>
    HELP_SEARCH_ITEMS.filter((i) =>
      `${i.title} ${i.keywords}`.toLowerCase().includes(q.toLowerCase()),
    ).map((i) => i.title);
  it('finds them by the words a user would type', () => {
    for (const [q, want] of [
      ['mind map', 'Mind Maps'],
      ['swimlane', 'Lanes'],
      ['uml', 'Entities'],
      ['figma', 'Embeds on the canvas'],
      ['erd', 'Entities'],
      ['vimeo', 'Embeds on the canvas'],
    ] as const) {
      expect(find(q), q).toContain(want);
    }
  });
});
