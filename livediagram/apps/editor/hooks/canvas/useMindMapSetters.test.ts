// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  applyMindMoves,
  createPinnedArrow,
  createShape,
  relayoutMindMap,
  type Element,
  type Layer,
  type ShapeElement,
} from '@livediagram/document';
import { useMindMapSetters } from './useMindMapSetters';

// Tidy Map says what it did (docs/specs/009-elements/mind-node.md "Tidy Map").

const node = (id: string, parent?: string) =>
  ({
    ...createShape('mind-node', 0, 0),
    id,
    label: id,
    ...(parent ? { mindParentId: parent } : { mindFlow: 'tree' }),
  }) as ShapeElement;

function map(): Element[] {
  return [
    node('root'),
    node('a', 'root'),
    node('b', 'root'),
    createPinnedArrow('root', 'e', 'a', 'w'),
    createPinnedArrow('root', 'e', 'b', 'w'),
  ];
}

function setters(elements: Element[], layers?: Layer[]) {
  const notify = vi.fn();
  let committed: Element[] | null = null;
  const { result } = renderHook(() =>
    useMindMapSetters({
      currentSelectionIds: () => new Set(['a']),
      commit: (fn) => {
        committed = fn(elements);
      },
      elements: () => elements,
      layers: () => layers,
      notify,
    }),
  );
  return { api: result.current, notify, committed: () => committed };
}

describe('Tidy Map', () => {
  it('tidies a messy map and says so', () => {
    const { api, notify, committed } = setters(map());
    api.tidyMindMap('root');
    expect(notify).toHaveBeenCalledWith('success', 'Map tidied');
    expect(committed()).not.toBeNull();
  });

  it('says a tidy map is already tidy, and commits nothing', () => {
    const messy = map();
    const plan = relayoutMindMap(messy, 'root')!;
    const tidy = applyMindMoves(messy, plan.moves, plan.reanchored);
    const { api, notify, committed } = setters(tidy);
    api.tidyMindMapSelected();
    expect(notify).toHaveBeenCalledWith('info', 'Map already tidy');
    expect(committed()).toBeNull();
  });

  // A locked node keeps its place (mind-node.md "Tidy Map"), so a map whose only stray node is locked is
  // already as tidy as Tidy Map can make it.
  it('leaves a locked stray node in place and says the map is already tidy', () => {
    const messy = map();
    const plan = relayoutMindMap(messy, 'root')!;
    const tidy = applyMindMoves(messy, plan.moves, plan.reanchored).map((el) =>
      el.id === 'a' ? { ...el, x: (el as ShapeElement).x + 300, locked: true } : el,
    );
    const { api, notify, committed } = setters(tidy);
    api.tidyMindMap('root');
    expect(notify).toHaveBeenCalledWith('info', 'Map already tidy');
    expect(committed()).toBeNull();
  });

  it('re-lays the map around a locked node without moving it', () => {
    const els = map().map((el) => (el.id === 'a' ? { ...el, locked: true } : el));
    const { api, committed } = setters(els);
    api.setMindFlowSelected('downward');
    const a = committed()!.find((e) => e.id === 'a') as ShapeElement;
    expect(a).toMatchObject({ x: 0, y: 0 });
  });
});

// mind-node.md "Tidy Map": nodes on a locked layer stay put too, and the notice counts them.
describe('Tidy Map on a locked layer', () => {
  const layers: Layer[] = [
    { id: 'base', name: 'Base' },
    { id: 'frozen', name: 'Frozen', locked: true },
  ];
  const strayOnFrozen = () => {
    const messy = map();
    const plan = relayoutMindMap(messy, 'root')!;
    return applyMindMoves(messy, plan.moves, plan.reanchored).map((el) =>
      el.id === 'a' ? { ...el, x: (el as ShapeElement).x + 300, layerId: 'frozen' } : el,
    );
  };

  it('keeps the node where it is and counts it', () => {
    const { api, notify, committed } = setters(strayOnFrozen(), layers);
    api.tidyMindMap('root');
    expect(notify).toHaveBeenCalledWith('info', 'Map already tidy, 1 node held by a locked layer');
    expect(committed()).toBeNull();
  });

  it('tidies the rest of the map and still counts the held node', () => {
    const els = strayOnFrozen().map((el) =>
      el.id === 'b' ? { ...el, y: (el as ShapeElement).y + 500 } : el,
    );
    const { api, notify, committed } = setters(els, layers);
    api.tidyMindMap('root');
    const out = committed()!;
    expect(out.find((e) => e.id === 'a')).toBe(els.find((e) => e.id === 'a'));
    expect(out.find((e) => e.id === 'b')).not.toBe(els.find((e) => e.id === 'b'));
    expect(notify).toHaveBeenCalledWith('success', 'Map tidied, 1 node held by a locked layer');
  });

  it('moves the node once its layer is unlocked', () => {
    const open = layers.map((l) => ({ ...l, locked: false }));
    const { api, notify } = setters(strayOnFrozen(), open);
    api.tidyMindMap('root');
    expect(notify).toHaveBeenCalledWith('success', 'Map tidied');
  });
});

// docs/specs/009-elements/mind-node.md "Spacing": stored on the root and the map re-laid out, in one commit.
describe('Spacing', () => {
  it('stores the spacing on the root and re-lays the map out at it', () => {
    const tidy = (() => {
      const m = map();
      const plan = relayoutMindMap(m, 'root')!;
      return applyMindMoves(m, plan.moves, plan.reanchored);
    })();
    const { api, committed } = setters(tidy);
    api.setMindSpacingSelected('wide');
    const out = committed()!;
    const root = out.find((e) => e.id === 'root') as ShapeElement;
    const a = out.find((e) => e.id === 'a') as ShapeElement;
    const before = tidy.find((e) => e.id === 'a') as ShapeElement;
    expect(root.mindSpacing).toBe('wide');
    expect(a.x - (root.x + root.width)).toBe(96);
    expect(a.x).toBeGreaterThan(before.x);
  });
});
