import { describe, expect, it, vi } from 'vitest';
import type { ArrowElement, Element, ShapeElement, Tab } from '@livehuddle/document';
// Aliased to a non-`use` name: this factory takes no React state of its
// own (it just closes over the passed deps), so calling it outside a
// component is fine — the alias keeps react-hooks/rules-of-hooks quiet.
import { useElementSelectionActions as buildSelectionActions } from './useElementSelectionActions';

// track() fires telemetry over the network; stub it out for the unit test.
vi.mock('@/lib/telemetry', () => ({ track: () => {} }));

const shape = (id: string, overrides: Partial<ShapeElement> = {}): ShapeElement => ({
  id,
  type: 'shape',
  shape: 'square',
  x: 0,
  y: 0,
  width: 100,
  height: 80,
  ...overrides,
});

const pinnedArrow = (id: string, fromId: string, toId: string): ArrowElement => ({
  id,
  type: 'arrow',
  from: { kind: 'pinned', elementId: fromId, anchor: 'e' },
  to: { kind: 'pinned', elementId: toId, anchor: 'w' },
});

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
    layerLockedIds: new Set<string>(),
    layerInertIds: new Set<string>(),
  });
  return { actions, getResult: () => result };
}

const ids = (els: Element[] | null) => (els ?? []).map((e) => e.id).sort();

describe('deleteSelected lock protection', () => {
  it('keeps a locked element and never commits when only it is selected', () => {
    const { actions, getResult } = setup([shape('a', { locked: true }), shape('b')], {
      selection: ['a'],
    });
    actions.deleteSelected();
    // Nothing deletable → no commit ran at all.
    expect(getResult()).toBeNull();
  });

  it('deletes unlocked members of a group but spares the locked one', () => {
    const els = [shape('a'), shape('b', { locked: true })];
    const { actions, getResult } = setup(els, { selection: ['a', 'b'] });
    actions.deleteSelected();
    expect(ids(getResult())).toEqual(['b']);
  });

  it('refuses to delete anything when the tab is locked', () => {
    const { actions, getResult } = setup([shape('a'), shape('b')], {
      selection: ['a'],
      tabLocked: true,
    });
    actions.deleteSelected();
    expect(getResult()).toBeNull();
  });

  it('cascades arrows of a deleted element but spares a locked arrow', () => {
    const els = [
      shape('a'),
      shape('b'),
      pinnedArrow('open', 'a', 'b'),
      { ...pinnedArrow('locked', 'a', 'b'), locked: true } as ArrowElement,
    ];
    const { actions, getResult } = setup(els, { selection: ['a'] });
    actions.deleteSelected();
    // 'a' goes, its unlocked arrow cascades away, the locked arrow + 'b' stay.
    expect(ids(getResult())).toEqual(['b', 'locked']);
  });
});

describe('deleteMultiSelected lock protection', () => {
  it('keeps locked members and deletes the rest', () => {
    const els = [shape('a'), shape('b', { locked: true }), shape('c')];
    const { actions, getResult } = setup(els, { selection: ['a', 'b', 'c'] });
    actions.deleteMultiSelected();
    expect(ids(getResult())).toEqual(['b']);
  });

  it('is a no-op when every member is locked', () => {
    const els = [shape('a', { locked: true }), shape('b', { locked: true })];
    const { actions, getResult } = setup(els, { selection: ['a', 'b'] });
    actions.deleteMultiSelected();
    expect(getResult()).toBeNull();
  });
});

// A mind node takes its branch (docs/specs/009-elements/mind-node.md "Deleting").
describe('deleting a mind node', () => {
  const mind = (id: string, parent?: string, extra: Partial<ShapeElement> = {}) =>
    shape(id, { shape: 'mind-node', ...(parent ? { mindParentId: parent } : {}), ...extra });
  const map = (): Element[] => [
    mind('root'),
    mind('a', 'root'),
    mind('a1', 'a'),
    mind('b', 'root'),
    pinnedArrow('root-a', 'root', 'a'),
    pinnedArrow('a-a1', 'a', 'a1'),
    pinnedArrow('root-b', 'root', 'b'),
  ];

  it('deletes the node, everything under it and their connectors', () => {
    const { actions, getResult } = setup(map(), { selection: ['a'] });
    actions.deleteSelected();
    expect(ids(getResult())).toEqual(['b', 'root', 'root-b']);
  });

  it('cascades from each node of a multi-selection', () => {
    const { actions, getResult } = setup([...map(), shape('loose')], { selection: ['a', 'loose'] });
    actions.deleteMultiSelected();
    expect(ids(getResult())).toEqual(['b', 'root', 'root-b']);
  });

  it('spares a locked node in the branch, and the nodes under it', () => {
    const els = map().map((el) => (el.id === 'a' ? { ...el, locked: true } : el));
    const { actions, getResult } = setup(els, { selection: ['root'] });
    actions.deleteSelected();
    expect(ids(getResult())).toEqual(['a', 'a-a1', 'a1']);
  });
});

// docs/specs/008-canvas/arrow-to-arrow.md: an arrow hung off a connector goes when the connector does, however the
// connector goes, the cascade from a deleted box included.
describe('the arrow cascade reaches arrows hung off arrows', () => {
  const hung = (id: string, onto: string): ArrowElement => ({
    id,
    type: 'arrow',
    from: { kind: 'free', x: 0, y: 0 },
    to: { kind: 'on-arrow', arrowId: onto, t: 0.5 },
  });
  const els = () => [shape('a'), shape('b'), pinnedArrow('x', 'a', 'b'), hung('y', 'x')];

  it('takes the hung arrow with the connector a single delete takes', () => {
    const { actions, getResult } = setup(els(), { selection: ['a'] });
    actions.deleteSelected();
    expect(ids(getResult())).toEqual(['b']);
  });

  it('takes it on a multi-selection delete too', () => {
    const { actions, getResult } = setup([...els(), shape('c')], { selection: ['a', 'c'] });
    actions.deleteMultiSelected();
    expect(ids(getResult())).toEqual(['b']);
  });
});
