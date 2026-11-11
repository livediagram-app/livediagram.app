import { describe, expect, it, vi } from 'vitest';
import type { Element, ShapeElement, Tab } from '@livehuddle/document';
// Aliased to a non-`use` name: this factory takes no React state of its
// own (it just closes over the passed deps), so calling it outside a
// component is fine — the alias keeps react-hooks/rules-of-hooks quiet.
import { useElementSelectionActions as buildSelectionActions } from './useElementSelectionActions';

// track() fires telemetry over the network; stub it out for the unit test.
vi.mock('@/lib/telemetry', () => ({ track: () => {} }));

const shape = (id: string, overrides: Partial<ShapeElement> = {}): ShapeElement => ({
  id,
  type: 'shape',
  shape: 'focus-button',
  x: 0,
  y: 0,
  width: 100,
  height: 80,
  ...overrides,
});

// A stored arrow, retired (docs/specs/002-project-scope/not-in-livehuddle.md "The element engine", part 4).
const pinnedArrow = (id: string, fromId: string, toId: string): Element =>
  ({
    id,
    type: 'arrow',
    from: { kind: 'pinned', elementId: fromId, anchor: 'e' },
    to: { kind: 'pinned', elementId: toId, anchor: 'w' },
  }) as unknown as Element;

// Build the hook over fake deps. `commit` synchronously applies the
// mapper to `elements` and stashes the result so a test can assert on it.
function setup(elements: Element[], opts: { tabLocked?: boolean; selection?: string[] } = {}) {
  const activeTab: Tab = {
    id: 't1',
    name: 'Tab',
    elements,
    ...(opts.tabLocked ? { locked: true } : {}),
  };
  let result: Element[] | null = null;
  const selection = new Set(opts.selection ?? []);
  const actions = buildSelectionActions({
    currentSelectionIds: () => selection,
    readSelection: () => ({ selectedId: opts.selection?.[0] ?? null, multiSelectedIds: selection }),
    activeTab,
    commit: (map) => {
      result = map(elements);
    },
    setSelectedId: () => {},
    setEditingId: () => {},
    setMultiSelectedIds: () => {},
    setFormatSourceId: () => {},
    lockedByOther: () => false,
  });
  return { actions, getResult: () => result };
}

const ids = (els: Element[] | null) => (els ?? []).map((e) => e.id).sort();

// A tab or element saved locked before locking left (docs/specs/002-project-scope/not-in-livehuddle.md "Element and
// Tab Locking") deletes like any other.
describe('deleting what was saved locked', () => {
  it('deletes a locked element on a locked tab', () => {
    const els = [shape('a', { locked: true } as Partial<ShapeElement>), shape('b')];
    const { actions, getResult } = setup(els, { selection: ['a'], tabLocked: true });
    actions.deleteSelected();
    expect(ids(getResult())).toEqual(['b']);
  });

  it('deletes every member of a multi-selection, locked ones included', () => {
    const els = [shape('a'), shape('b', { locked: true } as Partial<ShapeElement>), shape('c')];
    const { actions, getResult } = setup(els, { selection: ['a', 'b'] });
    actions.deleteMultiSelected();
    expect(ids(getResult())).toEqual(['c']);
  });
});

// docs/specs/002-project-scope/blueprints/element-engine.md D23: no cascade. A stored arrow pinned to what goes
// stays, and only what was picked is deleted.
describe('deleting what a stored arrow is pinned to', () => {
  const els = () => [shape('a'), shape('b'), pinnedArrow('x', 'a', 'b')];

  it('keeps the arrow on a single delete', () => {
    const { actions, getResult } = setup(els(), { selection: ['a'] });
    actions.deleteSelected();
    expect(ids(getResult())).toEqual(['b', 'x']);
  });

  it('keeps it on a multi-selection delete too', () => {
    const { actions, getResult } = setup([...els(), shape('c')], { selection: ['a', 'c'] });
    actions.deleteMultiSelected();
    expect(ids(getResult())).toEqual(['b', 'x']);
  });

  it('deletes the arrow itself when it is the one picked', () => {
    const { actions, getResult } = setup(els(), { selection: ['x'] });
    actions.deleteSelected();
    expect(ids(getResult())).toEqual(['a', 'b']);
  });
});
