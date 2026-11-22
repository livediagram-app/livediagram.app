// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  textWordsWidth,
  createShape,
  createText,
  type Element,
  type Tab,
} from '@liveknowledge/document';
import { useSelectionEditing } from './useSelectionEditing';

vi.mock('@/components/canvas/text-hug-measure', () => ({
  measureDrawnText: () => () => 0,
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
      documentName,
      tabs: [tab],
      activeTab: tab,
      editingId,
      commit: (fn) => {
        elements = fn(elements);
      },
      discardLastStep: vi.fn(),
      tickTabs: vi.fn(),
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
    setEditingId,
    setSelectedId,
    editing: result.current,
    all: () => elements,
    saved: () => elements[0] as Element & { label?: string; richText?: unknown },
  };
}

describe('commitLabel', () => {
  const cylinder = createShape('cylinder', 0, 0);

  // docs/specs/030-knowledgebase/knowledgebases-and-pages.md "A knowledgebase": its name is "Untitled Knowledgebase"
  // until a person names it. The fork named a still untitled document after its first label.
  it.each(['Untitled Knowledgebase', 'Untitled Article', 'Roadmap'])(
    'leaves a knowledgebase called %s its name when a first label is typed',
    (name) => {
      const s = setup(cylinder, false, null, name);
      s.editing.commitLabel(cylinder.id, 'Launch plan');
      expect(s.setDocumentName).not.toHaveBeenCalled();
    },
  );

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

// docs/specs/008-canvas/canvas-and-palette.md "Labels": an empty text box that hugs its text is removed when it
// is left, by a click away or by Escape alike.
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
