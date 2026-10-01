// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createShape,
  defaultScheme,
  isWhiteboardTab,
  type Element,
  type Tab,
} from '@livediagram/document';
import type { PendingDraw } from '@/lib/draw-mode';
import { boardShape, whiteboardShapeIntent } from '@/lib/whiteboard-tool';
import { useQuickStyle } from './useQuickStyle';
import { useStyleMemory } from './useStyleMemory';

// docs/specs/023-whiteboard/whiteboard.md "Shapes": a whiteboard keeps its own style memory, so a
// board's styles never dress a diagram's next shape, nor a diagram's a board's, for any shape kind,
// tool style or restyle, in the same document or another. The real memory and the real panel,
// rendered together as the editor renders them, across tab and document switches.

const theme = defaultScheme('light');
const diagram = { id: 'd', name: 'Diagram', kind: 'diagram', elements: [] } as unknown as Tab;
const board = { id: 'wb', name: 'Board', kind: 'whiteboard', elements: [] } as unknown as Tab;
const rectangle = whiteboardShapeIntent('rectangle');

type Props = { documentId: string; tab: Tab; intent: PendingDraw | null };

function setup(initial: Props) {
  return renderHook(
    ({ documentId, tab, intent }: Props) => {
      const memory = useStyleMemory({ documentId, theme, board: isWhiteboardTab(tab) });
      const quick = useQuickStyle({
        activeTab: tab,
        theme,
        selectionIds: new Set(),
        editsBlocked: false,
        liveElements: () => tab.elements,
        commit: vi.fn(),
        memory,
        swatchOverrides: { overrides: {}, setOverride: vi.fn(), clearOverride: vi.fn() } as never,
        toolIntent: intent,
      });
      return { memory, quick };
    },
    { initialProps: initial },
  );
}

// A diagram restyle: a square turned green and thick, recorded as the context menu records it.
function restyleDiagramSquare(memory: ReturnType<typeof useStyleMemory>) {
  const square = { ...createShape('square', 0, 0), id: 's' } as Element;
  memory.recordEdit(
    [square],
    [{ ...square, strokeColor: '#2f9e44', strokeWidth: 'thick' } as Element],
  );
}

const nextSquare = (memory: ReturnType<typeof useStyleMemory>, onBoard: boolean) =>
  memory.styleNewElement(
    onBoard ? boardShape(createShape('square', 0, 0)) : createShape('square', 0, 0),
  );

// Each test its own document: an unmounting hook flushes its memory after any cleanup here.
let n = 0;
let DOC = 'doc-0';
beforeEach(() => {
  n += 1;
  DOC = `doc-${n}`;
});
afterEach(() => localStorage.clear());

describe('style memory across a diagram tab and a whiteboard tab', () => {
  it('keeps a diagram restyle off the board, and the board tool style off the diagram', () => {
    const view = setup({ documentId: DOC, tab: diagram, intent: null });
    act(() => restyleDiagramSquare(view.result.current.memory));

    // The whiteboard's next rectangle is plain ink: the diagram's green never shows.
    view.rerender({ documentId: DOC, tab: board, intent: rectangle });
    expect(view.result.current.quick.view?.caption).toBe('Next rectangle');
    expect(view.result.current.quick.view?.sections.boardStroke?.value).toBe('ink');
    expect(view.result.current.quick.view?.sections.width?.value).not.toBe('thick');
    expect(nextSquare(view.result.current.memory, true)).not.toMatchObject({
      strokeColor: '#2f9e44',
    });

    // Next rectangle red, on the board: the stock colour, by name.
    act(() => view.result.current.quick.setBoardStroke('red'));
    expect(nextSquare(view.result.current.memory, true).penColour).toBe('red');

    // Back on the diagram: green and thick, never red.
    view.rerender({ documentId: DOC, tab: diagram, intent: null });
    const drawn = nextSquare(view.result.current.memory, false);
    expect(drawn).toMatchObject({ strokeColor: '#2f9e44', strokeWidth: 'thick' });
    expect(drawn.strokeSwatch).toBeUndefined();
    expect(drawn.penColour).toBeUndefined();
  });

  it('keeps a board restyle of a drawn shape off the diagram', () => {
    const view = setup({ documentId: DOC, tab: board, intent: null });
    act(() => restyleDiagramSquare(view.result.current.memory));
    view.rerender({ documentId: DOC, tab: diagram, intent: null });
    expect(nextSquare(view.result.current.memory, false)).not.toMatchObject({
      strokeColor: '#2f9e44',
    });
  });

  it('keeps the diagram’s Clear styles off the board', () => {
    const view = setup({ documentId: DOC, tab: board, intent: rectangle });
    act(() => view.result.current.quick.setBoardStroke('red'));
    view.rerender({ documentId: DOC, tab: diagram, intent: null });
    act(() => view.result.current.memory.forget(['shape:square']));
    view.rerender({ documentId: DOC, tab: board, intent: null });
    expect(nextSquare(view.result.current.memory, true).penColour).toBe('red');
  });

  it('shows the next rectangle of the document it is in, never the last one’s', () => {
    const view = setup({ documentId: 'first', tab: board, intent: rectangle });
    act(() => view.result.current.quick.setBoardStroke('red'));
    expect(view.result.current.quick.view?.sections.boardStroke?.value).toBe('red');

    // Another document, its whiteboard open, the rectangle still in hand.
    view.rerender({ documentId: 'second', tab: board, intent: rectangle });
    expect(view.result.current.quick.view?.sections.boardStroke?.value).toBe('ink');
    expect(nextSquare(view.result.current.memory, true).penColour).toBeUndefined();
  });
});
