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
  });
  return { actions, getResult: () => result };
}

const ids = (els: Element[] | null) => (els ?? []).map((e) => e.id).sort();

// A tab or element saved locked before locking left (docs/specs/002-project-scope/not-in-livehuddle.md "Element and
// Tab Locking") deletes like any other.
describe('deleting what was saved locked', () => {
  it('deletes a locked element, on a locked tab, with its locked arrow', () => {
    const els = [
      shape('a', { locked: true } as Partial<ShapeElement>),
      shape('b'),
      { ...pinnedArrow('arrow', 'a', 'b'), locked: true } as ArrowElement,
    ];
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
