import { describe, expect, it, vi } from 'vitest';
import { createShape, type Element, type ShapeElement } from '@livehuddle/document';
import { track } from '@/lib/telemetry';
import { useDataShapeSetters } from './useDataShapeSetters';

vi.mock('@/lib/telemetry', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/telemetry')>()),
  track: vi.fn(),
}));

// docs/specs/009-elements/furniture-facing.md: a facing picked outright, or a quarter turn, of every piece that turns
// in the selection, in one change.
function useTurnSetup(els: Element[], selected: string[]) {
  const state = { els, commits: 0 };
  const setters = useDataShapeSetters({
    currentSelectionIds: () => new Set(selected),
    commit: (map) => {
      state.commits += 1;
      state.els = map(state.els);
    },
    elements: () => state.els,
  });
  return { state, ...setters };
}

describe('the facing setter', () => {
  it('turns a chair and a meeting table in one selection', () => {
    const table = { ...createShape('meeting-table', 0, 0), id: 'table' } as Element;
    const chair = { ...createShape('chair', 300, 0), id: 'chair' } as Element;
    let els: Element[] = [table, chair];
    const { setChairFacingSelected } = useDataShapeSetters({
      currentSelectionIds: () => new Set(['table', 'chair']),
      commit: (map) => {
        els = map(els);
      },
      elements: () => els,
    });
    setChairFacingSelected('w');
    expect(els.find((e) => e.id === 'table')).toHaveProperty('chairFacing', 'w');
    expect(els.find((e) => e.id === 'chair')).toHaveProperty('chairFacing', 'w');
    // One change, counted once, by the first piece it turned, as Element · Added names it.
    expect(track).toHaveBeenCalledTimes(1);
    expect(track).toHaveBeenCalledWith('Element', 'Changed', 'Meeting-table');
  });
});

describe('a quarter turn', () => {
  it('turns each piece about its own centre, in one change', () => {
    const sofa = { ...createShape('sofa', 0, 0), id: 'sofa' } as Element;
    const lockers = { ...createShape('lockers', 500, 0), id: 'lockers' } as Element;
    const plant = { ...createShape('plant', 900, 0), id: 'plant' } as Element;
    const h = useTurnSetup([sofa, lockers, plant], ['sofa', 'lockers', 'plant']);
    h.turnSelected(1);
    expect(h.state.commits).toBe(1);
    const [s, l, p] = h.state.els as ShapeElement[];
    expect(s).toHaveProperty('chairFacing', 'e');
    expect(l).toHaveProperty('chairFacing', 'e');
    expect(p).toBe(plant);
    const was = sofa as ShapeElement;
    expect(s!.x + s!.width / 2).toBeCloseTo(was.x + was.width / 2);
    h.turnSelected(-1);
    expect(h.state.els[0]).toHaveProperty('chairFacing', 'n');
  });

  it('changes nothing when nothing turns', () => {
    const plant = { ...createShape('plant', 0, 0), id: 'plant' } as Element;
    const h = useTurnSetup([plant], ['plant']);
    h.turnSelected(1);
    expect(h.state.commits).toBe(0);
    expect(h.state.els[0]).toBe(plant);
  });
});
