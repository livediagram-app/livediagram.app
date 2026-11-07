import type { CommunityStartPost } from '@liveworkspace/community';
import { contrastRatio } from '@liveworkspace/brand/colour';
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  COMMUNITY_START_BADGE_TINT,
  communityStartBadgeStyle,
  communityStartCardsIn,
  communityStartCreditNote,
  communityStartPostsInto,
  communityStartTile,
  withCommunityStartMatches,
  type CommunityStartTileOptions,
} from './index';

// Start With's Community tiles in a picker's groups and search (liveworkspace/docs/specs/007-community/community.md
// "Start With"), and their badge's colours.

const tile = (id: string, title: string, category = 'processes'): CommunityStartPost => ({
  id,
  app: 'livediagram.app',
  title,
  category: category as CommunityStartPost['category'],
  shareCode: `C-${id}`,
  likeCount: 7,
  copyCount: 0,
  anonymous: false,
  authorName: 'Ada',
  line: 'A line.',
});
const posts = {
  processes: [tile('p1', 'Release Train'), tile('p2', 'Hiring Loop')],
  spaces: [tile('s1', 'Release Hall', 'spaces')],
};
type Card = { id: string; name: string; line: string; picture: null };
const template = (id: string): Card => ({ id, name: id, line: '', picture: null });
const options: CommunityStartTileOptions = {
  imageUrl: (code) => `/api/share/${code}/image.svg`,
  note: communityStartCreditNote('#5d6d83'),
};
const ids = (groups: readonly { category: string; cards: readonly { id: string }[] }[]) =>
  groups.map((g) => [g.category, g.cards.map((c) => c.id)]);

describe("a group's Community cards", () => {
  it('are its tiles, badged Community, with the credit as their note, and none for a group without any', () => {
    const cards = communityStartCardsIn(posts, 'processes', options);
    expect(cards.map((c) => [c.id, c.name, c.badge, c.ariaKind])).toEqual([
      ['community:p1', 'Release Train', 'Community', 'from the Community'],
      ['community:p2', 'Hiring Loop', 'Community', 'from the Community'],
    ]);
    const { container } = render(<>{cards[0]!.note}</>);
    expect(container.textContent).toBe('By Ada');
    expect((container.firstChild as HTMLElement).style.color).toBe('rgb(93, 109, 131)');
    expect(communityStartCardsIn(posts, 'recommended', options)).toEqual([]);
  });

  it('carry no note when the product draws none', () => {
    expect('note' in communityStartTile(tile('p1', 'Release Train'), { imageUrl: () => '' })).toBe(
      false,
    );
  });

  it("fold every category into one group, in the categories' order, where the rail is not the categories", () => {
    const into: CommunityStartTileOptions = {
      ...options,
      postsFor: communityStartPostsInto('inspiration', ['spaces', 'processes', 'missing']),
    };
    expect(communityStartCardsIn(posts, 'inspiration', into).map((c) => c.id)).toEqual([
      'community:s1',
      'community:p1',
      'community:p2',
    ]);
    expect(communityStartCardsIn(posts, 'boards', into)).toEqual([]);
    expect(communityStartCardsIn({}, 'inspiration', into)).toEqual([]);
  });
});

describe('a search with the Community joined in', () => {
  it("puts each group's matching tiles after its templates, in rail order, and only the rail's groups", () => {
    const results = withCommunityStartMatches(
      [
        { category: 'processes', cards: [template('flowchart')] },
        { category: 'elsewhere', cards: [template('stray')] },
      ],
      posts,
      'release',
      ['ideas', 'processes'],
      options,
    );
    expect(ids(results)).toEqual([['processes', ['flowchart', 'community:p1']]]);
  });

  it('gives a group only the Community matched its place in the rail, and keeps a group’s name', () => {
    const results = withCommunityStartMatches(
      [{ category: 'processes', name: 'Processes', cards: [template('flowchart')] }],
      posts,
      'hall',
      ['spaces', 'processes'],
      options,
    );
    expect(ids(results)).toEqual([
      ['spaces', ['community:s1']],
      ['processes', ['flowchart']],
    ]);
    expect(results[1]!.name).toBe('Processes');
  });

  it('joins a folded group before the groups the rail puts after it, and nothing when nothing matched', () => {
    const into: CommunityStartTileOptions = {
      ...options,
      postsFor: communityStartPostsInto('inspiration', ['processes', 'spaces']),
    };
    const rail = ['boards', 'inspiration', 'import'] as const;
    const found = [
      { category: 'boards' as const, cards: [template('board:kanban')] },
      { category: 'import' as const, name: 'Import', cards: [template('import')] },
    ];
    expect(ids(withCommunityStartMatches(found, posts, 'release', rail, into))).toEqual([
      ['boards', ['board:kanban']],
      ['inspiration', ['community:p1', 'community:s1']],
      ['import', ['import']],
    ]);
    expect(withCommunityStartMatches(found, posts, 'zzzz', rail, into)).toEqual(found);
  });
});

describe("a Start With card's badge", () => {
  const LIGHT = '#f8fafc';
  const DARK = '#111827';
  // Each app's own accent, light and dark (@liveworkspace/brand apps.ts lockup), on the panel's default surface.
  const ACCENTS: [string, string, string][] = [
    ['livediagram', '#0284c7', '#38bdf8'],
    ['liveplanner', '#7c3aed', '#a78bfa'],
    ['livedocuments', '#a34a0c', '#fbbf24'],
    ['livedesign', '#be123c', '#fb7185'],
    ['livehuddle', '#047857', '#34d399'],
  ];

  it.each(ACCENTS)('reads at AA in light and dark (%s)', (_app, light, dark) => {
    for (const [accent, surface] of [
      [light, LIGHT],
      [dark, DARK],
    ] as const) {
      const style = communityStartBadgeStyle(accent, surface);
      expect(contrastRatio(style.color, style.backgroundColor)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('keeps the tint, and the accent itself where it already reads', () => {
    // livediagram's sky on its tint read 3.3:1: deepened, keeping its hue.
    const sky = communityStartBadgeStyle('#0284c7', LIGHT);
    expect(sky.backgroundColor).toBe('#d6e9f5');
    expect(sky.color).not.toBe('#0284c7');
    expect(COMMUNITY_START_BADGE_TINT).toBe(14);
    expect(communityStartBadgeStyle('#38bdf8', DARK).color).toBe('#38bdf8');
  });

  it('lifts the ink on a dark surface, and goes all the way where nothing short of it reads', () => {
    const lifted = communityStartBadgeStyle('#334155', DARK);
    expect(contrastRatio(lifted.color, lifted.backgroundColor)).toBeGreaterThanOrEqual(4.5);
    // White on a mid grey's tint (#777777, 4.48:1): no step short of black reads, so black.
    expect(communityStartBadgeStyle('#ffffff', '#616161')).toEqual({
      backgroundColor: '#777777',
      color: '#000000',
    });
  });

  it('keeps the plain look for a colour it cannot measure', () => {
    expect(communityStartBadgeStyle('var(--accent)', LIGHT)).toEqual({
      backgroundColor: 'color-mix(in srgb, var(--accent) 14%, transparent)',
      color: 'var(--accent)',
    });
  });
});
