import { describe, expect, it } from 'vitest';
import { isLaneBand, laneGutterEdge, type LaneGutterEdge } from './LaneGutter';

// The lane's gutter is the title's backdrop, so it has to end up on the edge
// the title went to. Aligning the title top-centre used to leave the strip
// standing vertically down the middle of the band with the words perched at
// its top: the lane still read as horizontal while the title read as a header.
//
// These pin the mapping rather than the CSS. The component turns an edge into
// inset/border/radius classes, which is mechanical; deciding WHICH edge is the
// part with a rule behind it.

const EDGE = (x: 'left' | 'center' | 'right', y: 'top' | 'middle' | 'bottom'): LaneGutterEdge =>
  laneGutterEdge(x, y);

describe('laneGutterEdge', () => {
  it('follows a horizontally pinned title at any height', () => {
    // The swimlane idiom: a title down the leading edge. Nudging it up or down
    // that edge must not re-orient the lane.
    for (const y of ['top', 'middle', 'bottom'] as const) {
      expect(EDGE('left', y)).toBe('left');
      expect(EDGE('right', y)).toBe('right');
    }
  });

  it('turns the lane on its side when the title is centred at top or bottom', () => {
    expect(EDGE('center', 'top')).toBe('top');
    expect(EDGE('center', 'bottom')).toBe('bottom');
  });

  it('keeps the centre strip when neither axis is pinned', () => {
    expect(EDGE('center', 'middle')).toBe('centre-x');
  });

  it('leaves the default lane exactly as it was', () => {
    // shape-factory builds a lane with textAlignX 'left' / textAlignY
    // 'middle'. A change to the mapping must not move the gutter on every
    // lane that already exists.
    expect(EDGE('left', 'middle')).toBe('left');
    expect(isLaneBand(EDGE('left', 'middle'))).toBe(false);
  });

  it('reports a band only for the two across-the-lane edges', () => {
    const banded = (['left', 'center', 'right'] as const).flatMap((x) =>
      (['top', 'middle', 'bottom'] as const)
        .filter((y) => isLaneBand(EDGE(x, y)))
        .map((y) => `${x}/${y}`),
    );
    expect(banded).toEqual(['center/top', 'center/bottom']);
  });

  it('resolves every alignment pair to exactly one edge', () => {
    // Nine pairs, no gaps: an unmapped pair would fall through to the centre
    // strip silently, which is how a title ends up floating over the work.
    const seen = (['left', 'center', 'right'] as const).flatMap((x) =>
      (['top', 'middle', 'bottom'] as const).map((y) => EDGE(x, y)),
    );
    expect(seen).toHaveLength(9);
    expect(new Set(seen)).toEqual(new Set(['left', 'right', 'top', 'bottom', 'centre-x']));
  });
});
