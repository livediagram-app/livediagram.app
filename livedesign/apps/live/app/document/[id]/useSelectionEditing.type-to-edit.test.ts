// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Element, Tab } from '@livedesign/document';
import { useSelectionEditing } from './useSelectionEditing';

vi.mock('@/components/canvas/text-hug-measure', () => ({
  measureDrawnText: () => () => 0,
  measureDrawnMindLabel: () => () => () => ({ width: 1, height: 0 }),
}));

// docs/specs/008-canvas/canvas-and-palette.md "Type-to-edit": a printable key on a selected element opens its
// editor seeded with that character. The seed is written onto the element, so Escape (cancel) has to take it back:
// otherwise an Escape left a teammate's sticky reading one letter, for everyone in the room.

function setup(label: string, richText?: { text: string; bold?: boolean }[]) {
  // A history of the element list, as useDocumentHistory keeps one: commit pushes, discardLastStep pops.
  const past: Element[][] = [];
  let elements: Element[] = [
    {
      id: 'note',
      type: 'sticky',
      x: 0,
      y: 0,
      width: 200,
      height: 200,
      label,
      ...(richText ? { richText } : {}),
    },
  ];
  const commit = (fn: (els: Element[]) => Element[]) => {
    past.push(elements);
    elements = fn(elements);
  };
  const discardLastStep = vi.fn(() => {
    elements = past.pop() ?? elements;
  });
  const hook = renderHook(() => {
    const tab = { id: 't', name: 'Tab 1', elements } as Tab;
    return useSelectionEditing({
      readSelection: () => ({ selectedId: null, multiSelectedIds: new Set() }) as never,
      isReadOnly: false,
      layerInertIds: new Set(),
      adoptLayerName: vi.fn(),
      formatSourceId: null,
      formatToolActive: false,
      documentName: 'My document',
      tabs: [tab],
      activeTab: tab,
      drawMode: false,
      editingId: null,
      commit,
      discardLastStep,
      tickTabs: vi.fn(),
      applyFormatFromSource: vi.fn(),
      lockedByOther: () => false,
      set: {
        setFormatSourceId: vi.fn(),
        setSelectedId: vi.fn(),
        setEditingId: vi.fn(),
        setEditCursorAtEnd: vi.fn(),
        setMultiSelectedIds: vi.fn(),
        setDocumentName: vi.fn(),
        setContextMenu: vi.fn(),
      },
    });
  });
  const id = elements[0]!.id;
  return {
    id,
    hook,
    discardLastStep,
    label: () => (elements[0] as Element & { label?: string }).label,
    element: () => elements[0] as Element & { headerSize?: number; richText?: unknown },
    undo: () => {
      elements = past.pop() ?? elements;
      return (elements[0] as Element & { label?: string }).label;
    },
  };
}

describe('type-to-edit, then Escape', () => {
  it('puts back the label the first typed character replaced', () => {
    const s = setup('Ship the beta in May');
    expect(s.hook.result.current.typeIntoSelected(s.id, 'N')).toBe(true);
    s.hook.rerender();
    expect(s.label()).toBe('N');
    s.hook.result.current.cancelEdit();
    expect(s.discardLastStep).toHaveBeenCalledTimes(1);
    expect(s.label()).toBe('Ship the beta in May');
  });

  it('leaves a new, empty sticky empty', () => {
    const s = setup('');
    s.hook.result.current.typeIntoSelected(s.id, 'E');
    s.hook.rerender();
    s.hook.result.current.cancelEdit();
    expect(s.label()).toBe('');
  });

  it('commits the typed label in the seed’s place, so one undo puts back the label before the first key', () => {
    const s = setup('Old');
    s.hook.result.current.typeIntoSelected(s.id, 'N');
    s.hook.rerender();
    s.hook.result.current.commitLabel(s.id, 'New text');
    s.hook.rerender();
    expect(s.discardLastStep).toHaveBeenCalledTimes(1);
    expect(s.label()).toBe('New text');
    // One step back from the commit is the label before the seed, not the seed.
    expect(s.undo()).toBe('Old');
  });

  it('takes nothing back once the edit was committed', () => {
    const s = setup('Old');
    s.hook.result.current.typeIntoSelected(s.id, 'N');
    s.hook.rerender();
    s.hook.result.current.commitLabel(s.id, 'New text');
    s.hook.rerender();
    s.hook.result.current.cancelEdit();
    expect(s.discardLastStep).toHaveBeenCalledTimes(1);
    expect(s.label()).toBe('New text');
  });

  it('writes the label back, keeping a later change, when the seed is no longer the newest step', () => {
    const s = setup('Old');
    s.hook.result.current.typeIntoSelected(s.id, 'N');
    s.hook.rerender();
    // A later step changed the same element (its header size): popping the newest step would undo that instead.
    s.hook.result.current.commitHeaderSize(s.id, 10);
    s.hook.rerender();
    s.hook.result.current.cancelEdit();
    expect(s.discardLastStep).not.toHaveBeenCalled();
    expect(s.label()).toBe('Old');
    expect(s.element().headerSize).toBe(10);
  });

  it('keeps the formatting the seed dropped', () => {
    const s = setup('Bold', [{ text: 'Bold', bold: true }]);
    s.hook.result.current.typeIntoSelected(s.id, 'N');
    s.hook.rerender();
    s.hook.result.current.commitHeaderSize(s.id, 10);
    s.hook.rerender();
    s.hook.result.current.cancelEdit();
    expect(s.element().richText).toEqual([{ text: 'Bold', bold: true }]);
  });

  it('a double-click edit cancelled with Escape changes nothing', () => {
    const s = setup('Keep me');
    s.hook.result.current.beginEdit(s.id);
    s.hook.result.current.cancelEdit();
    expect(s.discardLastStep).not.toHaveBeenCalled();
    expect(s.label()).toBe('Keep me');
  });
});
