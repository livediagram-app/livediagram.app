// @vitest-environment jsdom
// docs/specs/008-canvas/polygon-tool.md "Gesture": while a polygon is being drawn, a double-click finishes it
// wherever it lands, over an element too, and the element under it never enters text editing. The canvas takes
// the press and the double-click in its capture phase (Canvas.tsx), ahead of the element's own gestures; this
// drives the real polygon gesture and a real text element's gestures through the same DOM order.
import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from 'react';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createText } from '@livedesign/design';
import type { PendingDraw } from '@/lib/draw-mode';
import type { CanvasProps } from '@/components/canvas/Canvas.types';
import { takeDrawDoubleClick } from './draw-double-click';
import { useBoxedElementGestures } from './useBoxedElementGestures';
import { useCanvasPolygonGesture } from './useCanvasPolygonGesture';

const POLYGON = { type: 'polygon' } as PendingDraw;
const text = createText(0, 0);

const wrapper = document.createElement('div');
wrapper.getBoundingClientRect = () => ({ left: 0, top: 0, width: 1000, height: 1000 }) as DOMRect;

function Canvas({
  pendingDraw,
  onCommitPolygon,
  onBeginEdit,
}: {
  pendingDraw: PendingDraw | null;
  onCommitPolygon: CanvasProps['onCommitPolygon'];
  onBeginEdit: (id: string) => void;
}) {
  const polygon = useCanvasPolygonGesture({
    pendingDraw,
    elements: [text],
    wrapperRef: { current: wrapper },
    viewportZoom: 1,
    onCommitPolygon,
  });
  const element = useBoxedElementGestures({
    element: text,
    wrapperRef: { current: null },
    isEditing: false,
    remotelyLocked: false,
    isAnnotation: false,
    isPaintMode: false,
    isSelected: false,
    isMultiSelected: false,
    onBeginDrag: vi.fn(),
    onBeginEdit,
  } as never);
  return (
    <div
      data-testid="canvas"
      onPointerDownCapture={(e: ReactPointerEvent) => {
        if (polygon.beginPolygonPoint(e)) e.stopPropagation();
      }}
      onDoubleClickCapture={(e: ReactMouseEvent) =>
        takeDrawDoubleClick(e, polygon.handlePolygonDoubleClick)
      }
    >
      <div
        data-testid="text"
        onPointerDown={element.handleShapeDown}
        onDoubleClick={element.handleDoubleClick}
      />
    </div>
  );
}

afterEach(cleanup);

const at = (x: number, y: number) => ({ button: 0, pointerId: 1, clientX: x, clientY: y });

describe('a double-click while a polygon is being drawn', () => {
  it('finishes the polygon over a text element and never edits the text', () => {
    const onCommitPolygon = vi.fn();
    const onBeginEdit = vi.fn();
    const r = render(
      <Canvas pendingDraw={POLYGON} onCommitPolygon={onCommitPolygon} onBeginEdit={onBeginEdit} />,
    );
    const canvas = r.getByTestId('canvas');
    const over = r.getByTestId('text');
    fireEvent.pointerDown(canvas, at(10, 10));
    // The double-click's two presses, then the double-click itself, all on the text.
    fireEvent.pointerDown(over, at(200, 40));
    fireEvent.pointerDown(over, at(200, 40));
    fireEvent.doubleClick(over, { clientX: 200, clientY: 40 });
    expect(onCommitPolygon).toHaveBeenCalledWith(
      [
        { x: 10, y: 10 },
        { x: 200, y: 40 },
      ],
      false,
    );
    expect(onBeginEdit).not.toHaveBeenCalled();
  });

  it('leaves a double-click on text to edit it when no polygon is under way', () => {
    const onCommitPolygon = vi.fn();
    const onBeginEdit = vi.fn();
    const r = render(
      <Canvas pendingDraw={null} onCommitPolygon={onCommitPolygon} onBeginEdit={onBeginEdit} />,
    );
    fireEvent.doubleClick(r.getByTestId('text'));
    expect(onBeginEdit).toHaveBeenCalledWith(text.id);
    expect(onCommitPolygon).not.toHaveBeenCalled();
  });
});

describe('takeDrawDoubleClick', () => {
  it('stops at the first tool that takes it, and lets it through when none does', () => {
    const stop = vi.fn();
    const later = vi.fn(() => true);
    expect(takeDrawDoubleClick({ stopPropagation: stop }, () => true, later)).toBe(true);
    expect(later).not.toHaveBeenCalled();
    expect(stop).toHaveBeenCalledTimes(1);
    const none = vi.fn();
    expect(
      takeDrawDoubleClick(
        { stopPropagation: none },
        () => false,
        () => false,
      ),
    ).toBe(false);
    expect(none).not.toHaveBeenCalled();
  });
});
