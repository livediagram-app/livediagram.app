// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { createShape, type Element, type Tab } from '@livediagram/document';
import { useSelectionEditing } from './useSelectionEditing';

vi.mock('@/components/canvas/text-hug-measure', () => ({ measureDrawnText: () => () => 0 }));

// docs/specs/008-canvas/canvas-and-palette.md "Rich text labels": a label is saved without
// whitespace at either end, so neither the display nor the editor shows a dangling line.

function setup(el: Element, tabLocked = false) {
  let elements: Element[] = [el];
  const setEditingId = vi.fn();
  const tab = { id: 't', name: 'Tab 1', elements } as Tab;
  const { result } = renderHook(() =>
    useSelectionEditing({
      readSelection: () => ({ selectedId: null, multiSelectedIds: new Set() }) as never,
      isReadOnly: false,
      tabLocked,
      layerInertIds: new Set(),
      adoptLayerName: vi.fn(),
      formatSourceId: null,
      formatToolActive: false,
      documentName: 'My document',
      tabs: [tab],
      activeTab: tab,
      drawMode: true,
      commit: (fn) => {
        elements = fn(elements);
      },
      tickTabs: vi.fn(),
      applyFormatFromSource: vi.fn(),
      lockedByOther: () => false,
      set: {
        setFormatSourceId: vi.fn(),
        setSelectedId: vi.fn(),
        setEditingId,
        setEditCursorAtEnd: vi.fn(),
        setMultiSelectedIds: vi.fn(),
        setDocumentName: vi.fn(),
        setContextMenu: vi.fn(),
      },
    }),
  );
  return {
    setEditingId,
    editing: result.current,
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
