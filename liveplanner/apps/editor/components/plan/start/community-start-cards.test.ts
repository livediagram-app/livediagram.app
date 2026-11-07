// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import type { CommunityStartPost } from '@liveplanner/api-schema';
import { planPalette } from '@liveplanner/project';
import {
  communityStartCardsIn,
  communityStartHref,
  withCommunityStartMatches,
} from '@liveworkspace/community-ui/start';
import type { StartPanelCard } from '@/components/start/StartPanel';
import { communityStartTiles } from './community-start-cards';
import { START_SEARCH_ORDER } from './start-planning-items';

// docs/specs/026-plan/plan-mode.md "From the Community": Start Planning's placing of the shared tiles
// (@liveworkspace/community-ui/start, whose own tests cover the rest).
const tiles = communityStartTiles(planPalette('light', {}));
const tile = (id: string, title: string, category = 'planning'): CommunityStartPost => ({
  id,
  app: 'liveplanner.app',
  title,
  category: category as CommunityStartPost['category'],
  shareCode: `C-${id}`,
  likeCount: 7,
  copyCount: 0,
  anonymous: false,
  authorName: 'Ada',
  line: 'A line.',
});
// Out of the categories' order on purpose: Finance comes before Projects and Teams, Something Else last.
const posts = {
  other: [tile('o1', 'Odd Jobs', 'other')],
  planning: [tile('p1', 'Release Train'), tile('p2', 'Hiring Loop')],
  finance: [tile('f1', 'Release Budget', 'finance')],
};
const template = (id: string): StartPanelCard => ({ id, name: id, line: '', picture: null });
const ids = (groups: readonly { category: string; cards: readonly { id: string }[] }[]) =>
  groups.map((g) => [g.category, g.cards.map((c) => c.id)]);

describe("Inspiration's Community cards", () => {
  it("are every category's tiles in the categories' order, badged Community, and none elsewhere", () => {
    const cards = communityStartCardsIn(posts, 'inspiration', tiles);
    expect(cards.map((c) => [c.id, c.name, c.badge])).toEqual([
      ['community:f1', 'Release Budget', 'Community'],
      ['community:p1', 'Release Train', 'Community'],
      ['community:p2', 'Hiring Loop', 'Community'],
      ['community:o1', 'Odd Jobs', 'Community'],
    ]);
    expect(cards[0]!.note).toBeTruthy();
    expect(communityStartCardsIn(posts, 'recommended', tiles)).toEqual([]);
    expect(communityStartCardsIn(posts, 'boards', tiles)).toEqual([]);
    expect(communityStartCardsIn({}, 'inspiration', tiles)).toEqual([]);
  });

  it("open the person's own copy at liveplanner's share address", () => {
    expect(communityStartHref({ app: 'liveplanner.app', shareCode: 'a b' })).toBe(
      '/project/shared?s=a%20b&copy=1',
    );
  });
});

describe('a search with the Community joined in', () => {
  it("puts the matching tiles after Inspiration's matching templates", () => {
    const results = withCommunityStartMatches(
      [
        { category: 'boards', cards: [template('board:kanban')] },
        { category: 'inspiration', cards: [template('template:product-launch')] },
      ],
      posts,
      'release',
      START_SEARCH_ORDER,
      tiles,
    );
    expect(ids(results)).toEqual([
      ['boards', ['board:kanban']],
      ['inspiration', ['template:product-launch', 'community:f1', 'community:p1']],
    ]);
  });

  it('gives Inspiration its place when only the Community matched, before Import, keeping its name', () => {
    const results = withCommunityStartMatches(
      [
        { category: 'boards', cards: [template('board:kanban')] },
        { category: 'import', name: 'Import', cards: [template('import')] },
      ],
      posts,
      'odd',
      START_SEARCH_ORDER,
      tiles,
    );
    expect(ids(results)).toEqual([
      ['boards', ['board:kanban']],
      ['inspiration', ['community:o1']],
      ['import', ['import']],
    ]);
    expect(results[2]!.name).toBe('Import');
  });

  it('joins nothing when nothing matched', () => {
    const results = [{ category: 'boards' as const, cards: [template('board:kanban')] }];
    expect(withCommunityStartMatches(results, posts, 'zzzz', START_SEARCH_ORDER, tiles)).toEqual(
      results,
    );
  });
});
