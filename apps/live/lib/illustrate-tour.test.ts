// Each page kind offers its Illustrate tour track once (docs/specs/007-editor/illustrate-tour.md "Where it appears").
import { describe, expect, it } from 'vitest';
import { illustrateKindSeen, markIllustrateKindSeen } from './illustrate-tour';

describe('the Illustrate tour’s seen kinds', () => {
  it('counts a kind once answered, and the rest still owed', () => {
    const prefs = markIllustrateKindSeen({}, 'slide');
    expect(illustrateKindSeen(prefs, 'slide')).toBe(true);
    expect(illustrateKindSeen(prefs, 'article')).toBe(false);
    expect(prefs.illustrateTourSeen).toBeUndefined();
  });

  it('marks the whole tour seen once every kind is', () => {
    let prefs = {};
    for (const kind of ['slide', 'infographic', 'article', 'logo'] as const)
      prefs = markIllustrateKindSeen(prefs, kind);
    expect(prefs).toMatchObject({ illustrateTourSeen: true });
  });

  it('treats the whole tour seen (Settings off, power user mode) as every kind', () => {
    expect(illustrateKindSeen({ illustrateTourSeen: true }, 'logo')).toBe(true);
  });

  it('never lists a kind twice', () => {
    const prefs = markIllustrateKindSeen(markIllustrateKindSeen({}, 'slide'), 'slide');
    expect(prefs.illustrateTourKinds).toEqual(['slide']);
  });
});
