// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  textWordsWidth,
  PADDING_PX,
  createShape,
  createSticky,
  createText,
  type Element,
  type ShapeElement,
  type Tab,
} from '@livediagram/document';
import { useSelectionEditing } from './useSelectionEditing';
import { leaveByEscape, markPlacedEdit } from '@/lib/placed-edit';

// A mind node's lines measure this tall (jsdom lays nothing out).
const mindLines = { height: 0 };
vi.mock('@/components/canvas/text-hug-measure', () => ({
  measureDrawnText: () => () => 0,
  measureDrawnMindLabel: () => () => () => ({ width: 1, height: mindLines.height }),
}));

// docs/specs/008-canvas/canvas-and-palette.md "Rich text labels": a label is saved without
// whitespace at either end, so neither the display nor the editor shows a dangling line.

function setup(
  el: Element,
  tabLocked = false,
  editingId: string | null = null,
  documentName = 'My document',
) {
  const setDocumentName = vi.fn();
  let elements: Element[] = [el];
  const setEditingId = vi.fn();
  const setSelectedId = vi.fn();
  const tickTabs = vi.fn();
  const adoptLayerName = vi.fn();
  // The tab reads the elements as they are now, as the next render would, so a type-to-edit's seed shows in it.
  const tab = {
    id: 't',
    name: 'Tab 1',
    get elements() {
      return elements;
    },
  } as Tab;
  const { result } = renderHook(() =>
    useSelectionEditing({
      readSelection: () => ({ selectedId: null, multiSelectedIds: new Set() }) as never,
      isReadOnly: false,
      tabLocked,
      layerInertIds: new Set(),
      adoptLayerName,
      formatSourceId: null,
      formatToolActive: false,
      documentName,
      tabs: [tab],
      activeTab: tab,
      drawMode: true,
      editingId,
      commit: (fn) => {
        elements = fn(elements);
      },
      discardLastStep: vi.fn(),
      tickTabs,
      applyFormatFromSource: vi.fn(),
      lockedByOther: () => false,
      set: {
        setFormatSourceId: vi.fn(),
        setSelectedId,
        setEditingId,
        setEditCursorAtEnd: vi.fn(),
        setMultiSelectedIds: vi.fn(),
        setDocumentName,
        setContextMenu: vi.fn(),
      },
    }),
  );
  return {
    setDocumentName,
    tickTabs,
    adoptLayerName,
    result,
    setEditingId,
    setSelectedId,
    editing: result.current,
    all: () => elements,
    saved: () => elements[0] as Element & { label?: string; richText?: unknown },
  };
}

describe('commitLabel', () => {
  const cylinder = createShape('cylinder', 0, 0);

  // docs/specs/008-canvas/canvas-and-palette.md "Labels" (Work Tracker 864): Escape out of the editor a drop opened.
  it('leaves the selection when Escape leaves the editor a drop opened with nothing typed', () => {
    const s = setup(cylinder, false, cylinder.id);
    markPlacedEdit(cylinder.id);
    leaveByEscape(() => s.editing.commitLabel(cylinder.id, ''));
    expect(s.setEditingId).toHaveBeenLastCalledWith(null);
    expect(s.setSelectedId).toHaveBeenLastCalledWith(null);
  });

  it('keeps the selection when something was typed, or when a click away leaves the dropped editor', () => {
    const typed = setup(cylinder, false, cylinder.id);
    markPlacedEdit(cylinder.id);
    leaveByEscape(() => typed.editing.commitLabel(cylinder.id, 'Queue'));
    expect(typed.saved().label).toBe('Queue');
    expect(typed.setSelectedId).not.toHaveBeenCalled();
    const blurred = setup(cylinder, false, cylinder.id);
    markPlacedEdit(cylinder.id);
    blurred.editing.commitLabel(cylinder.id, '');
    expect(blurred.setSelectedId).not.toHaveBeenCalled();
  });

  it('keeps the selection when Escape leaves an editor opened on an existing element', () => {
    const s = setup(cylinder, false, cylinder.id);
    leaveByEscape(() => s.editing.commitLabel(cylinder.id, ''));
    expect(s.setSelectedId).not.toHaveBeenCalled();
  });

  // docs/specs/006-document/document-structure.md "The first label names the document, in every mode".
  it.each(['Untitled Whiteboard', 'Untitled Illustration', 'Untitled Plan', 'Untitled Session'])(
    'names a document still called %s after its first element',
    (name) => {
      const s = setup(cylinder, false, null, name);
      s.editing.commitLabel(cylinder.id, 'Launch plan');
      expect(s.setDocumentName).toHaveBeenCalledWith('Launch plan');
    },
  );

  it('keeps a name someone gave the document', () => {
    const s = setup(cylinder);
    s.editing.commitLabel(cylinder.id, 'Launch plan');
    expect(s.setDocumentName).not.toHaveBeenCalled();
  });

  it('saves a label without newlines or spaces at either end', () => {
    const s = setup(cylinder);
    s.editing.commitLabel(cylinder.id, '\n Testing\ntest\ntest\n  \n');
    expect(s.saved().label).toBe('Testing\ntest\ntest');
  });

  it('trims the formatting runs to the same text', () => {
    const s = setup(cylinder);
    s.editing.commitLabel(cylinder.id, 'Bold plain\n', [
      { text: 'Bold', bold: true },
      { text: ' plain\n' },
    ]);
    expect(s.saved().label).toBe('Bold plain');
    expect(s.saved().richText).toEqual([{ text: 'Bold', bold: true }, { text: ' plain' }]);
  });

  it('trims an arrow\u2019s label too, dropping it when nothing is left', () => {
    const arrow = {
      id: 'a',
      type: 'arrow',
      from: { kind: 'free', x: 0, y: 0 },
      to: { kind: 'free', x: 10, y: 0 },
    } as Element;
    const s = setup(arrow);
    s.editing.commitLabel('a', ' Yes \n');
    expect(s.saved().label).toBe('Yes');
    s.editing.commitLabel('a', '\n ');
    expect('label' in s.saved()).toBe(false);
  });
});

// Work Tracker 750 (docs/specs/006-document/document-structure.md "Only a changed label names anything"): the
// welcome card or a template's title is the first element, so opening its own label and leaving it unchanged used to
// name an untitled document, its tab and its layer after it. Only a changed label names them.
describe('the first label names the document, the tab and the layer only when it changed', () => {
  // A note, as Draw mode (this setup's) takes typing on one.
  const welcome = { ...createSticky(0, 0), id: 'welcome', label: 'Welcome' } as Element;

  it('leaves every name alone when the first label is committed unchanged', () => {
    const s = setup(welcome, false, 'welcome', 'Untitled canvas');
    s.editing.commitLabel('welcome', 'Welcome');
    // Whitespace the save trims away is no change either.
    s.editing.commitLabel('welcome', ' Welcome\n');
    expect(s.setDocumentName).not.toHaveBeenCalled();
    expect(s.tickTabs).not.toHaveBeenCalled();
    expect(s.adoptLayerName).not.toHaveBeenCalled();
  });

  it('still names them after a label someone typed', () => {
    const s = setup(welcome, false, 'welcome', 'Untitled canvas');
    s.editing.commitLabel('welcome', 'Launch plan');
    expect(s.setDocumentName).toHaveBeenCalledWith('Launch plan');
    expect(s.tickTabs).toHaveBeenCalledTimes(1);
    const rename = s.tickTabs.mock.calls[0]![0] as (tabs: Tab[]) => Tab[];
    const tab = { id: 't', name: 'Tab 1', elements: [] } as unknown as Tab;
    expect(rename([tab])[0]!.name).toBe('Launch plan');
    expect(s.adoptLayerName).toHaveBeenCalledWith('welcome', 'Launch plan');
  });

  it('counts a type-to-edit by the label it replaced, so one typed letter still names them', () => {
    const s = setup(welcome, false, null, 'Untitled canvas');
    expect(s.editing.typeIntoSelected('welcome', 'W')).toBe(true);
    s.result.current.commitLabel('welcome', 'W');
    expect(s.setDocumentName).toHaveBeenCalledWith('W');
    expect(s.tickTabs).toHaveBeenCalledTimes(1);
  });

  it('a type-to-edit that ends where the label began names nothing', () => {
    const s = setup(welcome, false, null, 'Untitled canvas');
    s.editing.typeIntoSelected('welcome', 'W');
    s.result.current.commitLabel('welcome', 'Welcome');
    expect(s.setDocumentName).not.toHaveBeenCalled();
    expect(s.tickTabs).not.toHaveBeenCalled();
  });
});

// docs/specs/009-elements/mind-node.md "New lines" and "A node grows to fit its label".
describe('committing a mind node label', () => {
  const venue = { ...createShape('mind-node', 0, 0), id: 'venue' };

  it('keeps a new line inside the label', () => {
    mindLines.height = 0;
    const s = setup(venue);
    s.editing.commitLabel('venue', 'Venue\nBudget\n');
    expect(s.saved().label).toBe('Venue\nBudget');
  });

  it('grows the node to fit its lines, in the same commit', () => {
    mindLines.height = 120;
    const s = setup(venue);
    s.editing.commitLabel('venue', 'One\nTwo\nThree\nFour');
    expect((s.saved() as ShapeElement).height).toBe(120 + 2 * PADDING_PX.sm);
    expect((s.saved() as ShapeElement).width).toBe(venue.width);
  });

  it('leaves a node whose lines fit at its size', () => {
    mindLines.height = 30;
    const s = setup(venue);
    s.editing.commitLabel('venue', 'Venue\nBudget');
    expect((s.saved() as ShapeElement).height).toBe(venue.height);
  });
});

// A locked tab refuses every save: no label editor opens to take typing it would throw away.
describe('on a locked tab', () => {
  it('opens no label editor, by double-click, Space or typing', () => {
    const square = createShape('square', 0, 0);
    const s = setup(square, true);
    s.editing.beginEdit(square.id);
    expect(s.editing.typeIntoSelected(square.id, 'a')).toBe(false);
    expect(s.setEditingId).not.toHaveBeenCalled();
    const open = setup(square);
    open.editing.beginEdit(square.id);
    expect(open.setEditingId).toHaveBeenCalledWith(square.id);
  });
});

// docs/specs/023-draw-mode/draw-mode.md "Text boxes": an empty text box that hugs its text is removed when it is
// left, by a click away or by Escape alike.
describe('Escape on a text box', () => {
  const hugging = { ...createText(0, 0), id: 'hug', label: '', sizing: 'fit' } as Element;

  it('removes an empty text box that hugs its text', () => {
    const s = setup(hugging, false, 'hug');
    s.editing.cancelEdit();
    expect(s.all()).toEqual([]);
    expect(s.setEditingId).toHaveBeenCalledWith(null);
    expect(s.setSelectedId).toHaveBeenCalledWith(null);
  });

  it('keeps a hugging text box that has words', () => {
    const worded = { ...hugging, label: 'Keep me' } as Element;
    const s = setup(worded, false, 'hug');
    s.editing.cancelEdit();
    expect(s.all()).toEqual([worded]);
  });

  it('keeps an empty fixed text box, as Diagram mode makes', () => {
    const fixed = { ...createText(0, 0), id: 'fixed', label: '' } as Element;
    const s = setup(fixed, false, 'fixed');
    s.editing.cancelEdit();
    expect(s.all()).toEqual([fixed]);
  });
});

// A template's title sized to its words takes longer typed words on one line, as an agent's do (EO22a, canvas
// "Text sized to its words"): a fixed box whose words sat on one line re-hugs them, up to 1,200 px, kept where its
// words sit. Wrapping text keeps its width.
describe('commitLabel: a fixed text sized to its one line of words', () => {
  const title = (textAlignX: 'left' | 'center' | 'right', width = 320) =>
    ({
      ...createText(100, 0),
      id: 'title',
      width,
      height: 44,
      label: 'Sprint 14 retro',
      textSize: 'lg',
      textBold: true,
      textAlignX,
    }) as Element & { x: number; width: number };
  const longer = 'Sprint 14 retro, the platform team';

  it('widens a left-aligned title at its left edge', () => {
    const s = setup(title('left'));
    s.editing.commitLabel('title', longer);
    const saved = s.saved() as Element & { x: number; width: number };
    expect(saved.width).toBe(textWordsWidth(saved as never));
    expect(saved.x).toBe(100);
  });

  it('keeps a centred title centred, and a right-aligned one at its right edge', () => {
    const centred = setup(title('center'));
    centred.editing.commitLabel('title', longer);
    const c = centred.saved() as Element & { x: number; width: number };
    expect(c.x + c.width / 2).toBe(260);
    const right = setup(title('right'));
    right.editing.commitLabel('title', longer);
    const r = right.saved() as Element & { x: number; width: number };
    expect(r.x + r.width).toBe(420);
    expect(r.width).toBeGreaterThan(320);
  });

  it('leaves text that already wrapped at its width', () => {
    const s = setup(title('left', 60));
    s.editing.commitLabel('title', longer);
    expect((s.saved() as Element & { width: number }).width).toBe(60);
  });
});
