// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  PADDING_PX,
  createShape,
  createText,
  type Element,
  type ShapeElement,
  type Tab,
} from '@liveplanner/project';
import { useSelectionEditing } from './useSelectionEditing';

// A mind node's lines measure this tall (jsdom lays nothing out).
const mindLines = { height: 0 };
vi.mock('@/components/canvas/text-hug-measure', () => ({
  measureDrawnText: () => () => 0,
  measureDrawnMindLabel: () => () => () => ({ width: 1, height: mindLines.height }),
}));

// docs/specs/008-canvas/canvas-and-palette.md "Rich text labels": a label is saved without
// whitespace at either end, so neither the display nor the editor shows a dangling line.

function setup(el: Element, tabLocked = false, editingId: string | null = null) {
  let elements: Element[] = [el];
  const setEditingId = vi.fn();
  const setSelectedId = vi.fn();
  const tab = { id: 't', name: 'Tab 1', elements } as Tab;
  const { result } = renderHook(() =>
    useSelectionEditing({
      readSelection: () => ({ selectedId: null, multiSelectedIds: new Set() }) as never,
      isReadOnly: false,
      tabLocked,
      layerInertIds: new Set(),
      adoptLayerName: vi.fn(),
      projectName: 'My project',
      tabs: [tab],
      activeTab: tab,
      editingId,
      commit: (fn) => {
        elements = fn(elements);
      },
      discardLastStep: vi.fn(),
      tickTabs: vi.fn(),
      lockedByOther: () => false,
      set: {
        setSelectedId,
        setEditingId,
        setEditCursorAtEnd: vi.fn(),
        setMultiSelectedIds: vi.fn(),
        setProjectName: vi.fn(),
        setContextMenu: vi.fn(),
      },
    }),
  );
  return {
    setEditingId,
    setSelectedId,
    editing: result.current,
    all: () => elements,
    saved: () => elements[0] as Element & { label?: string; richText?: unknown },
  };
}

describe('commitLabel', () => {
  const cylinder = createShape('cylinder', 0, 0);

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

// docs/specs/007-editor/editor-modes.md "A text box's sizing": an empty text box that hugs its text is removed when it is
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
