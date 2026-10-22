// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  applyMindMoves,
  createPinnedArrow,
  createShape,
  relayoutMindMap,
  type Element,
  type ShapeElement,
} from '@livepages/document';
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

function setters(elements: Element[]) {
  const notify = vi.fn();
  let committed: Element[] | null = null;
  const { result } = renderHook(() =>
    useMindMapSetters({
      currentSelectionIds: () => new Set(['a']),
      commit: (fn) => {
        committed = fn(elements);
      },
      elements: () => elements,
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
