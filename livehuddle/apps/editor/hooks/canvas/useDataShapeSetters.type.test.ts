import { describe, expect, it, vi } from 'vitest';
import { createShape, type Element, type ShapeElement } from '@livehuddle/document';
import { track } from '@/lib/telemetry';
import { useDataShapeSetters } from './useDataShapeSetters';

vi.mock('@/lib/telemetry', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/telemetry')>()),
  track: vi.fn(),
}));

// docs/specs/009-elements/office.md "A piece's type": the selection's pieces of one kind change type in one commit.
function harness(selected: string[]) {
  const tab = {
    els: [
      { ...createShape('rug', 0, 0), id: 'rug', label: 'Lounge rug' },
      { ...createShape('rug', 0, 400), id: 'other' },
      { ...createShape('door', 600, 0), id: 'door' },
    ] as Element[],
    commits: 0,
  };
  return {
    deps: {
      currentSelectionIds: () => new Set(selected),
      commit: (map: (els: Element[]) => Element[]) => {
        tab.commits++;
        tab.els = map(tab.els);
      },
      elements: () => tab.els,
    },
    byId: (id: string) => tab.els.find((e) => e.id === id) as ShapeElement,
    commits: () => tab.commits,
  };
}

describe('the type setter', () => {
  it('retypes every selected piece of the kind, leaving another kind and the unselected alone', () => {
    vi.mocked(track).mockClear();
    const h = harness(['rug', 'door']);
    useDataShapeSetters(h.deps).setPieceTypeSelected('rug', 'persian');
    expect(h.byId('rug')).toMatchObject({ variant: 'persian', label: 'Lounge rug' });
    expect(h.byId('other')).not.toHaveProperty('variant');
    expect(h.byId('door')).not.toHaveProperty('variant');
    expect(h.commits()).toBe(1);
    expect(track).toHaveBeenCalledExactlyOnceWith('Element', 'Changed', 'Rug');
  });

  it('commits and counts nothing when no piece changes: its own type, or nothing selected', () => {
    vi.mocked(track).mockClear();
    const h = harness(['rug']);
    useDataShapeSetters(h.deps).setPieceTypeSelected('rug', 'oval');
    useDataShapeSetters(harness([]).deps).setPieceTypeSelected('rug', 'round');
    expect(h.commits()).toBe(0);
    expect(track).not.toHaveBeenCalled();
  });
});
