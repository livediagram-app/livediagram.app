import { type Element, type ShapeElement } from '@livediagram/diagram';
import { describe, expect, it } from 'vitest';
import { deriveCanvasSelection } from './canvas-selection';

const box = (id: string, overrides: Partial<ShapeElement> = {}): ShapeElement => ({
  id,
  type: 'shape',
  shape: 'square',
  x: 0,
  y: 0,
  width: 100,
  height: 60,
  ...overrides,
});

const arrow = (id: string, from = { x: 0, y: 0 }, to = { x: 50, y: 50 }): Element => ({
  id,
  type: 'arrow',
  from: { kind: 'free', ...from },
  to: { kind: 'free', ...to },
});

// Default "clean editor" flags: nothing being edited, no modes, unlocked,
// editable. Individual tests override what they exercise.
const base = {
  editingId: null,
  isPaintMode: false,
  isGroupMode: false,
  tabLocked: false,
  readOnly: false,
};

function derive(over: Partial<Parameters<typeof deriveCanvasSelection>[0]>) {
  return deriveCanvasSelection({
    elements: [],
    selectedId: null,
    multiSelectedIds: new Set<string>(),
    ...base,
    ...over,
  });
}

describe('deriveCanvasSelection', () => {
  it('reports nothing selected when there is no selection', () => {
    const s = derive({ elements: [box('a')] });
    expect(s.selected).toBeNull();
    expect(s.selectionBounds).toBeNull();
    expect(s.showPopover).toBe(false);
    expect(s.showPlus).toBe(false);
    expect(s.showHandlesFor('a')).toBe(false);
    expect(s.showUnionResize).toBe(false);
  });

  it('resolves a single boxed selection and shows all single-select chrome', () => {
    const a = box('a');
    const s = derive({ elements: [a], selectedId: 'a' });
    expect(s.selected).toBe(a);
    expect(s.selectionScope).toBe('single');
    expect(s.selectedIsBoxed).toBe(true);
    expect(s.selectionBounds).toEqual({ x: 0, y: 0, width: 100, height: 60 });
    expect(s.showPopover).toBe(true);
    expect(s.showPlus).toBe(true);
    expect(s.showHandlesFor('a')).toBe(true);
    expect(s.showAnchorsFor('a')).toBe(true);
    // Predicates are per-id: a different element never shows handles.
    expect(s.showHandlesFor('b')).toBe(false);
    expect(s.showUnionResize).toBe(false);
  });

  it('hides handles + plus while editing the selected element (popover hides too)', () => {
    const s = derive({ elements: [box('a')], selectedId: 'a', editingId: 'a' });
    expect(s.showPopover).toBe(false);
    expect(s.showPlus).toBe(false);
    expect(s.showHandlesFor('a')).toBe(false);
  });

  it('a locked element keeps the popover but loses plus + handles', () => {
    const s = derive({ elements: [box('a', { locked: true })], selectedId: 'a' });
    expect(s.selectedLocked).toBe(true);
    expect(s.showPopover).toBe(true); // popover does NOT gate on the element lock
    expect(s.showPlus).toBe(false);
    expect(s.showHandlesFor('a')).toBe(false);
  });

  it('read-only keeps the popover but suppresses plus + handles', () => {
    const s = derive({ elements: [box('a')], selectedId: 'a', readOnly: true });
    expect(s.showPopover).toBe(true); // popover does NOT gate on readOnly
    expect(s.showPlus).toBe(false);
    expect(s.showHandlesFor('a')).toBe(false);
  });

  it('a locked tab suppresses every chrome including the popover', () => {
    const s = derive({ elements: [box('a')], selectedId: 'a', tabLocked: true });
    expect(s.showPopover).toBe(false);
    expect(s.showPlus).toBe(false);
    expect(s.showHandlesFor('a')).toBe(false);
  });

  it('format-paint / group mode suppress single-select chrome', () => {
    const paint = derive({ elements: [box('a')], selectedId: 'a', isPaintMode: true });
    expect(paint.showPopover).toBe(false);
    expect(paint.showHandlesFor('a')).toBe(false);
    const group = derive({ elements: [box('a')], selectedId: 'a', isGroupMode: true });
    expect(group.showPopover).toBe(false);
    expect(group.showHandlesFor('a')).toBe(false);
  });

  it('a marquee multi-selection uses union resize and hides the single popover', () => {
    const els: Element[] = [box('a'), box('b', { x: 200 })];
    const s = derive({
      elements: els,
      selectedId: null,
      multiSelectedIds: new Set(['a', 'b']),
    });
    expect(s.selectionScope).toBe('multi');
    expect(s.multiPrimaryId).toBe('a');
    expect(s.showPopover).toBe(false); // per-element popover is meaningless for many
    expect(s.showUnionResize).toBe(true);
    expect(s.unionResizePrimaryId).toBe('a');
    // The floating toolbar shows for the boxed multi too, anchored on the
    // same union bounds.
    expect(s.showMultiToolbar).toBe(true);
    expect(s.multiToolbarBounds).toEqual({ x: 0, y: 0, width: 300, height: 60 });
    // Per-element single-handles stay off when the selection is a group/multi.
    expect(s.showHandlesFor('a')).toBe(false);
    // Quick-connect plus buttons are single-element only.
    expect(s.showPlus).toBe(false);
  });

  it('an arrow-only marquee shows the floating toolbar (spanning the arrows) but no resize box', () => {
    const els: Element[] = [
      arrow('a', { x: 0, y: 0 }, { x: 40, y: 20 }),
      arrow('b', { x: 60, y: 30 }, { x: 100, y: 80 }),
    ];
    const s = derive({
      elements: els,
      selectedId: null,
      multiSelectedIds: new Set(['a', 'b']),
    });
    expect(s.selectionScope).toBe('multi');
    // No boxed members, so the resize box (and its handles) stays hidden...
    expect(s.showUnionResize).toBe(false);
    expect(s.unionResizeBounds).toBeNull();
    // ...but the toolbar still appears, anchored on the arrows' union AABB,
    // so the user can reach the Flow / animate menu via its "More" button.
    expect(s.showMultiToolbar).toBe(true);
    expect(s.multiToolbarBounds).toEqual({ x: 0, y: 0, width: 100, height: 80 });
  });

  it('suppresses the floating toolbar in read-only / locked-tab modes', () => {
    const els: Element[] = [arrow('a'), arrow('b')];
    const ro = derive({ elements: els, multiSelectedIds: new Set(['a', 'b']), readOnly: true });
    expect(ro.showMultiToolbar).toBe(false);
    const locked = derive({
      elements: els,
      multiSelectedIds: new Set(['a', 'b']),
      tabLocked: true,
    });
    expect(locked.showMultiToolbar).toBe(false);
  });

  it('a group selection (>1 member) shows union resize, not per-element handles', () => {
    const els: Element[] = [box('a', { groupId: 'g' }), box('b', { x: 200, groupId: 'g' })];
    const s = derive({ elements: els, selectedId: 'a' });
    expect(s.memberIds.size).toBe(2);
    expect(s.selectionScope).toBe('group');
    expect(s.showUnionResize).toBe(true);
    expect(s.unionResizePrimaryId).toBe('a');
    expect(s.showHandlesFor('a')).toBe(false); // memberIds.size !== 1
    // Quick-connect pluses ring the group's union bounds (spec/09), and the
    // bounds they anchor to are the union of both members.
    expect(s.showPlus).toBe(true);
    expect(s.selectionBounds).toEqual({ x: 0, y: 0, width: 300, height: 60 });
  });

  it('group pluses ignore per-type exclusions but keep the mode/lock gates', () => {
    // A grouped table doesn't suppress the pluses — they belong to the
    // union box, not the table.
    const table = (id: string, overrides: Partial<Element> = {}): Element =>
      ({
        id,
        type: 'table',
        x: 200,
        y: 0,
        width: 100,
        height: 60,
        cells: [['', '']],
        ...overrides,
      }) as Element;
    const grouped: Element[] = [box('t', { groupId: 'g' }), table('u', { groupId: 'g' })];
    expect(derive({ elements: grouped, selectedId: 'u' }).showPlus).toBe(true);
    // A lone table shows the pluses too (the slimmed table ring, spec/09);
    // annotations and frames stay excluded.
    expect(derive({ elements: [table('t')], selectedId: 't' }).showPlus).toBe(true);
    // Locked / read-only still suppress group pluses.
    const locked: Element[] = [
      box('a', { groupId: 'g', locked: true }),
      box('b', { groupId: 'g' }),
    ];
    expect(derive({ elements: locked, selectedId: 'a' }).showPlus).toBe(false);
    expect(derive({ elements: grouped, selectedId: 'u', readOnly: true }).showPlus).toBe(false);
  });

  it('a drilled-in (solo) group member behaves as a single selection', () => {
    const els: Element[] = [box('a', { groupId: 'g' }), box('b', { x: 200, groupId: 'g' })];
    const s = derive({ elements: els, selectedId: 'a', soloSelectedId: 'a' });
    expect(s.memberIds).toEqual(new Set(['a']));
    expect(s.selectionScope).toBe('single');
    expect(s.showHandlesFor('a')).toBe(true); // single-element handles
    expect(s.showUnionResize).toBe(false);
    expect(s.selectionBounds).toEqual({ x: 0, y: 0, width: 100, height: 60 });
    // A stale solo id (selection moved on) is ignored: group rules apply.
    const stale = derive({ elements: els, selectedId: 'a', soloSelectedId: 'b' });
    expect(stale.memberIds.size).toBe(2);
    expect(stale.selectionScope).toBe('group');
  });

  it('a marquee multi-selection still suppresses the pluses', () => {
    const els: Element[] = [box('a'), box('b', { x: 200 })];
    const s = derive({ elements: els, multiSelectedIds: new Set(['a', 'b']) });
    expect(s.showPlus).toBe(false);
  });
});
