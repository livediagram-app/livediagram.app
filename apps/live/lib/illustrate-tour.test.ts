// Each page kind offers its Illustrate tour track once (docs/specs/007-editor/illustrate-tour.md "Where it appears").
import { describe, expect, it } from 'vitest';
import { illustrateKindSeen, illustrateTourOwed, markIllustrateKindSeen } from './illustrate-tour';

describe('the Illustrate tour’s seen kinds', () => {
  it('counts a kind once answered, and the rest still owed', () => {
    const prefs = markIllustrateKindSeen({}, 'slide');
    expect(illustrateKindSeen(prefs, 'slide')).toBe(true);
    expect(illustrateKindSeen(prefs, 'article')).toBe(false);
    expect(illustrateTourOwed(prefs)).toBe(true);
  });

  it('owes nothing once every kind is answered', () => {
    let prefs = {};
    for (const kind of ['slide', 'infographic', 'article', 'logo'] as const)
      prefs = markIllustrateKindSeen(prefs, kind);
    expect(illustrateTourOwed(prefs)).toBe(false);
  });

  it('offers every kind again to someone who answered the single tour before it split', () => {
    expect(illustrateKindSeen({ illustrateTourSeen: true }, 'logo')).toBe(false);
    expect(illustrateTourOwed({ illustrateTourSeen: true })).toBe(true);
  });

  it('counts every kind seen for a power user with the tour off', () => {
    expect(illustrateKindSeen({ illustrateTourSeen: true, powerUserMode: true }, 'logo')).toBe(
      true,
    );
  });

  it('never lists a kind twice', () => {
    const prefs = markIllustrateKindSeen(markIllustrateKindSeen({}, 'slide'), 'slide');
    expect(prefs.illustrateTourKinds).toEqual(['slide']);
  });
});
