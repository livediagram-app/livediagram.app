import { describe, expect, it, vi } from 'vitest';
import type { ArrowElement, Element, ShapeElement, Tab } from '@livediagram/document';
// Aliased to a non-`use` name: this factory takes no React state of its
// own (it just closes over the passed deps), so calling it outside a
// component is fine — the alias keeps react-hooks/rules-of-hooks quiet.
import { useElementSelectionActions as buildSelectionActions } from './useElementSelectionActions';
import type { SheetDeleteGuard } from '@/hooks/sheets/useSheetDeleteGuard';

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
function setup(
  elements: Element[],
  opts: { tabLocked?: boolean; selection?: string[]; guard?: SheetDeleteGuard } = {},
) {
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
    ...(opts.guard ? { sheetDeleteGuard: opts.guard } : {}),
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

// Deleting a Sheet asks first when it takes the sheet (docs/specs/029-sheets/sheet-store.md "Deleting a sheet").
describe('deleting with the sheet guard', () => {
  const answering = (answer: { release: () => void } | null) =>
    vi.fn<SheetDeleteGuard>(() => Promise.resolve(answer));

  it('deletes after the person confirms, then releases the sheets', async () => {
    const release = vi.fn();
    const guard = answering({ release });
    const { actions, getResult } = setup([shape('a'), shape('b')], { selection: ['a'], guard });
    actions.deleteSelected();
    expect(guard).toHaveBeenCalledWith(new Set(['a']));
    expect(getResult()).toBeNull();
    await Promise.resolve();
    expect(ids(getResult())).toEqual(['b']);
    expect(release).toHaveBeenCalledOnce();
  });

  it('deletes nothing when the person cancels', async () => {
    const guard = answering(null);
    const { actions, getResult } = setup([shape('a'), shape('b')], {
      selection: ['a', 'b'],
      guard,
    });
    actions.deleteMultiSelected();
    await Promise.resolve();
    expect(getResult()).toBeNull();
  });

  it('deletes at once when the guard has nothing to ask', () => {
    const guard = vi.fn<SheetDeleteGuard>(() => null);
    const { actions, getResult } = setup([shape('a'), shape('b')], { selection: ['a'], guard });
    actions.deleteSelected();
    expect(ids(getResult())).toEqual(['b']);
  });

  it('never asks for a Cut, nor for a click event passed as the options', () => {
    const guard = answering(null);
    const cut = setup([shape('a'), shape('b')], { selection: ['a', 'b'], guard });
    cut.actions.deleteMultiSelected({ cut: true });
    expect(ids(cut.getResult())).toEqual([]);
    const single = setup([shape('a')], { selection: ['a'], guard });
    single.actions.deleteSelected({ cut: true });
    expect(ids(single.getResult())).toEqual([]);
    expect(guard).not.toHaveBeenCalled();
    const clicked = setup([shape('a')], { selection: ['a'], guard });
    clicked.actions.deleteSelected({ type: 'click' } as never);
    expect(guard).toHaveBeenCalledOnce();
  });
});
