import { type Element, type ShapeElement } from '@livediagram/document';
import { describe, expect, it } from 'vitest';
import { deriveCanvasSelection, elementGrips } from './canvas-selection';

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

  // docs/specs/026-plan/plan-board.md "Maximised board", "Fill Tab": a board drawn over the canvas covers it, so no
  // selection chrome floats there, alone or in a multi-selection; the selection itself stands.
  it('shows no toolbar, popover or plus while a Plan board covers the canvas', () => {
    const board = box('b', { shape: 'plan-board' });
    const one = derive({ elements: [board, box('a')], selectedId: 'b', canvasCovered: true });
    expect(one.selected).toBe(board);
    expect(one.showPopover).toBe(false);
    expect(one.showPlus).toBe(false);
    const other = derive({ elements: [board, box('a')], selectedId: 'a', canvasCovered: true });
    expect(other.showPopover).toBe(false);
    expect(other.showPlus).toBe(false);
    const all = derive({
      elements: [board, box('a')],
      selectedId: 'b',
      multiSelectedIds: new Set(['a', 'b']),
      canvasCovered: true,
    });
    expect(all.showMultiToolbar).toBe(false);
    expect(derive({ elements: [board], selectedId: 'b' }).showPopover).toBe(true);
  });

  // docs/specs/026-plan/plan-board.md: a board's cards are its content, not nodes to chain from.
  it('shows no quick-connect pluses on a Plan board or Plan card', () => {
    for (const shape of ['plan-board', 'plan-card'] as const) {
      const s = derive({ elements: [box('p', { shape })], selectedId: 'p' });
      expect(s.showPlus).toBe(false);
      expect(s.showPopover).toBe(true);
    }
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

  it('an element the caller blocks (an object in an article) keeps the popover but loses the plus', () => {
    const s = derive({
      elements: [box('a'), box('b')],
      selectedId: 'a',
      plusBlocked: (el) => el.id === 'a',
    });
    expect(s.showPopover).toBe(true);
    expect(s.showPlus).toBe(false);
    expect(s.showHandlesFor('a')).toBe(true);
    expect(
      derive({ elements: [box('b')], selectedId: 'b', plusBlocked: (el) => el.id === 'a' })
        .showPlus,
    ).toBe(true);
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

  it('format-paint mode suppresses single-select chrome', () => {
    const paint = derive({ elements: [box('a')], selectedId: 'a', isPaintMode: true });
    expect(paint.showPopover).toBe(false);
    expect(paint.showHandlesFor('a')).toBe(false);
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

  it('pluses follow the element kind and the mode / lock gates', () => {
    const table = (id: string): Element =>
      ({
        id,
        type: 'table',
        x: 200,
        y: 0,
        width: 100,
        height: 60,
        cells: [['', '']],
      }) as Element;
    // A lone table shows the pluses (the slimmed table ring, docs/specs/008-canvas/canvas-and-palette.md).
    expect(derive({ elements: [table('t')], selectedId: 't' }).showPlus).toBe(true);
    // A frame shows them as well: it is a container you chain from, the same
    // as a lane, which always did.
    const frame = box('f', { shape: 'frame', width: 600, height: 400 });
    expect(derive({ elements: [frame], selectedId: 'f' }).showPlus).toBe(true);
    // An annotation marker is a note rather than a node to chain from.
    const marker: Element = {
      id: 'n',
      type: 'annotation',
      x: 0,
      y: 0,
      width: 24,
      height: 24,
    } as Element;
    expect(derive({ elements: [marker], selectedId: 'n' }).showPlus).toBe(false);
    // Locked / read-only suppress them.
    expect(derive({ elements: [box('a', { locked: true })], selectedId: 'a' }).showPlus).toBe(
      false,
    );
    expect(derive({ elements: [box('a')], selectedId: 'a', readOnly: true }).showPlus).toBe(false);
  });

  it('a single selection is bounded by the element itself (no groups, docs/specs/009-elements/web-components-and-no-groups.md)', () => {
    const s = derive({ elements: [box('a'), box('b', { x: 200 })], selectedId: 'a' });
    expect(s.selectionScope).toBe('single');
    expect(s.showHandlesFor('a')).toBe(true);
    expect(s.showUnionResize).toBe(false);
    expect(s.selectionBounds).toEqual({ x: 0, y: 0, width: 100, height: 60 });
  });

  it('a marquee multi-selection still suppresses the pluses', () => {
    const els: Element[] = [box('a'), box('b', { x: 200 })];
    const s = derive({ elements: els, multiSelectedIds: new Set(['a', 'b']) });
    expect(s.showPlus).toBe(false);
  });
});

// A fixed-size element (docs/specs/009-elements/mode-button.md buttons, docs/specs/021-event-storming/event-storming.md event-storming notes)
// advertises NO resize affordance — and the edge "anchor" grips are resize
// grips today (arrows are drawn from the quick-connect menu now), so they
// have to disappear with the corner handles. Leaving them behind is exactly
// the bug that let an event-storming sticky be dragged wider.
describe('deriveCanvasSelection — fixed-size elements', () => {
  const fixedSticky = {
    id: 'f',
    type: 'sticky',
    x: 0,
    y: 0,
    width: 200,
    height: 200,
    fixedSize: true,
  } as unknown as Element;

  it('hides both the corner handles and the edge grips', () => {
    const s = derive({ elements: [fixedSticky], selectedId: 'f' });
    expect(s.showHandlesFor('f')).toBe(false);
    expect(s.showAnchorsFor('f')).toBe(false);
  });

  it('still shows both for an ordinary sticky', () => {
    const plain = { ...fixedSticky, id: 'p', fixedSize: undefined } as unknown as Element;
    const s = derive({ elements: [plain], selectedId: 'p' });
    expect(s.showHandlesFor('p')).toBe(true);
    expect(s.showAnchorsFor('p')).toBe(true);
  });
});

// Event-storming boards are a low-threshold CAPTURE surface (docs/specs/021-event-storming/event-storming.md):
// every control that doesn't serve "add a note, type, drag" is a
// distraction. The quick-connect pluses ring every selected note with four
// affordances nobody reaches for mid-workshop, so they stand down there —
// and stay exactly as they are on every other tab.
describe('deriveCanvasSelection — quick-connect on an event-storming board', () => {
  const sticky = {
    id: 's',
    type: 'sticky',
    x: 0,
    y: 0,
    width: 200,
    height: 200,
  } as unknown as Element;

  it('hides the pluses when the board is event storming', () => {
    const s = derive({ elements: [sticky], selectedId: 's', esBoard: true });
    expect(s.showPlus).toBe(false);
    // The rest of the single-selection chrome is untouched.
    expect(s.showPopover).toBe(true);
  });

  it('keeps them everywhere else', () => {
    const s = derive({ elements: [sticky], selectedId: 's' });
    expect(s.showPlus).toBe(true);
  });
});

// One question, one answer: a left click asks "what is this?" (the selection
// popover) and a right click asks "what can I do with it?" (the context
// menu). Showing both at once puts two toolbars around one element and
// duplicates half the verbs, so the menu — the deliberate, more specific
// gesture — wins while it is open.
describe('deriveCanvasSelection — popover yields to an open context menu', () => {
  const box = {
    id: 'a',
    type: 'shape',
    shape: 'square',
    x: 0,
    y: 0,
    width: 100,
    height: 60,
  } as unknown as Element;

  it('hides the popover (and its pluses) while an element menu is open', () => {
    const s = derive({ elements: [box], selectedId: 'a', elementMenuOpen: true });
    expect(s.showPopover).toBe(false);
    expect(s.showPlus).toBe(false);
  });

  it('brings them back once the menu closes', () => {
    const s = derive({ elements: [box], selectedId: 'a', elementMenuOpen: false });
    expect(s.showPopover).toBe(true);
    expect(s.showPlus).toBe(true);
  });
});

// An arrow's label belongs to its line (docs/specs/008-canvas/arrow-labels.md), so the
// floating toolbars treat it as part of the arrow and never float over it.
describe('deriveCanvasSelection — an arrow label is part of its arrow', () => {
  const line = arrow('ar', { x: 100, y: 200 }, { x: 500, y: 200 });
  const above = { x: 280, y: 150, width: 40, height: 20 };
  const labelRectOf = (id: string) => (id === 'ar' ? above : null);

  it('spans the label in a selected arrow’s bounds', () => {
    const s = derive({ elements: [line], selectedId: 'ar', labelRectOf });
    expect(s.selectionBounds).toEqual({ x: 100, y: 150, width: 400, height: 50 });
  });

  it('keeps the line’s own bounds when the arrow has no label', () => {
    const s = derive({ elements: [line], selectedId: 'ar', labelRectOf: () => null });
    expect(s.selectionBounds).toEqual({ x: 100, y: 200, width: 400, height: 0 });
  });

  it('never widens a boxed element by a label rect', () => {
    const s = derive({ elements: [box('a')], selectedId: 'a', labelRectOf: () => above });
    expect(s.selectionBounds).toEqual({ x: 0, y: 0, width: 100, height: 60 });
  });

  it('spans selected arrows’ labels in the multi-selection toolbar bounds', () => {
    const s = derive({
      elements: [line, box('b', { x: 100, y: 300 })],
      multiSelectedIds: new Set(['ar', 'b']),
      labelRectOf,
    });
    expect(s.multiToolbarBounds).toEqual({ x: 100, y: 150, width: 400, height: 210 });
  });
});

// docs/specs/008-canvas/blueprints/selection-store.md: each element view decides its own grips, by the
// same rule the whole-selection derivation uses.
describe('elementGrips', () => {
  const table = { ...box('t'), type: 'table' } as unknown as Element;
  const fixed = box('f', { fixedSize: true } as Partial<ShapeElement>);
  const locked = box('l', { locked: true });
  const elements: Element[] = [box('a'), box('b'), table, fixed, locked, arrow('r')];
  const flagsSets: { selectedId: string | null; multi: string[] }[] = [
    { selectedId: null, multi: [] },
    { selectedId: 'a', multi: [] },
    { selectedId: 't', multi: [] },
    { selectedId: 'f', multi: [] },
    { selectedId: 'l', multi: [] },
    { selectedId: 'r', multi: [] },
    { selectedId: 'a', multi: ['a', 'b'] },
  ];
  const contexts = [
    base,
    { ...base, editingId: 'a' },
    { ...base, isPaintMode: true },
    { ...base, tabLocked: true },
    { ...base, readOnly: true },
  ];

  it('agrees with deriveCanvasSelection for every element, selection and mode', () => {
    for (const sel of flagsSets)
      for (const ctx of contexts) {
        const whole = derive({
          elements,
          selectedId: sel.selectedId,
          multiSelectedIds: new Set(sel.multi),
          ...ctx,
        });
        for (const el of elements) {
          const single = sel.selectedId === el.id && sel.multi.length === 0;
          expect(
            elementGrips(el, single, ctx),
            `${el.id} ${JSON.stringify(sel)} ${JSON.stringify(ctx)}`,
          ).toEqual({
            handles: whole.showHandlesFor(el.id),
            anchors: whole.showAnchorsFor(el.id),
          });
        }
      }
  });
});
