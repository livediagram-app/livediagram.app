// Each page kind offers its Pages tour track once (docs/specs/007-editor/pages-tour.md "Where it appears").
import { describe, expect, it } from 'vitest';
import { PAGES_TOUR_KINDS, pagesKindSeen, markPagesKindSeen } from './pages-tour';

describe('the Pages tour’s seen kinds', () => {
  it('counts a kind once answered, and the rest still owed', () => {
    const prefs = markPagesKindSeen({}, 'slide');
    expect(pagesKindSeen(prefs, 'slide')).toBe(true);
    expect(pagesKindSeen(prefs, 'article')).toBe(false);
  });

  it('owes nothing once every kind is answered', () => {
    let prefs = {};
    for (const kind of ['slide', 'infographic', 'article', 'logo'] as const)
      prefs = markPagesKindSeen(prefs, kind);
    expect(PAGES_TOUR_KINDS.every((k) => pagesKindSeen(prefs, k))).toBe(true);
  });

  it('offers every kind again to someone who answered the single tour before it split', () => {
    expect(pagesKindSeen({ pagesTourSeen: true }, 'logo')).toBe(false);
  });

  it('counts every kind seen for a power user with the tour off', () => {
    expect(pagesKindSeen({ pagesTourSeen: true, powerUserMode: true }, 'logo')).toBe(true);
  });

  it('never lists a kind twice', () => {
    const prefs = markPagesKindSeen(markPagesKindSeen({}, 'slide'), 'slide');
    expect(prefs.pagesTourKinds).toEqual(['slide']);
  });
});
