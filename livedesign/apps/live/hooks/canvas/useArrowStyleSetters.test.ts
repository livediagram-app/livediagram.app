import { describe, expect, it, vi } from 'vitest';
import type { ArrowElement, Element } from '@livedesign/document';
import { useArrowStyleSetters } from './useArrowStyleSetters';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

// An ER relationship: its start head differs from its end's.
const er: ArrowElement = {
  id: 'r',
  type: 'arrow',
  from: { kind: 'free', x: 0, y: 0 },
  to: { kind: 'free', x: 100, y: 0 },
  arrowEnds: 'both',
  arrowheadShape: 'many',
  arrowheadStartShape: 'one',
};

describe('the arrowhead shape picker', () => {
  it('sets both ends, so an ER relationship’s own start head can be made even again', () => {
    let els: Element[] = [er];
    const { setArrowheadShapeSelected } = useArrowStyleSetters({
      currentSelectionIds: () => new Set(['r']),
      commit: (map) => {
        els = map(els);
      },
    });
    setArrowheadShapeSelected('triangle');
    expect(els[0]).toMatchObject({ arrowheadShape: 'triangle' });
    expect((els[0] as ArrowElement).arrowheadStartShape).toBeUndefined();
  });
});
