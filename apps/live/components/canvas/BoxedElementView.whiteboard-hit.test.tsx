// @vitest-environment jsdom
import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { createFreehand, createShape, type BoxedElement } from '@livediagram/document';
import { BoxedElementView } from '@/components/canvas/BoxedElementView';
import { CanvasStillProvider } from '@/components/canvas/CanvasStillContext';

// docs/specs/023-draw-mode/draw-mode.md "Selecting": on a whiteboard a shape or a pen stroke is
// picked by its drawn line. Once selected its box catches pointers too, and the line still does,
// outside the box as well, so a double-click on its outer half reaches it, never the board.

function draw(element: BoxedElement, selected: boolean) {
  const { container } = render(
    <CanvasStillProvider still>
      <BoxedElementView
        element={element}
        isSelected={selected}
        isEditing={false}
        isPaintMode={false}
        showHandles={false}
        showAnchors={false}
        onBeginDrag={vi.fn()}
        onBeginEdit={vi.fn()}
        onCommitLabel={vi.fn()}
        onCommitTable={vi.fn()}
        onCancelEdit={vi.fn()}
        onFollowLink={vi.fn()}
        onOpenComments={vi.fn()}
        onOpenAction={vi.fn()}
        onOpenNote={vi.fn()}
        isoDepth={0}
        onSetPageHeading={vi.fn()}
        onContextSelect={vi.fn()}
        tabLocked={false}
        tabSummaries={[]}
        readOnly={false}
        remoteSelectors={[]}
      />
    </CanvasStillProvider>,
  );
  const wrapper = container.querySelector<HTMLElement>(`[data-element-id="${element.id}"]`)!;
  return { container, wrapper };
}

const rect = { ...createShape('square', 0, 0), width: 200, height: 100 } as BoxedElement;
const stroke = {
  ...createFreehand(
    [
      { x: 0, y: 0 },
      { x: 50, y: 20 },
    ],
    false,
  ),
  penWidth: 1.5,
} as BoxedElement;

describe('whiteboard picking by the drawn line', () => {
  it('lets an unselected shape\u2019s box pass pointers through, its outline catching them', () => {
    const { container, wrapper } = draw(rect, false);
    expect(wrapper.style.pointerEvents).toBe('none');
    expect(container.querySelector('[data-shape-hit="line"]')).not.toBeNull();
  });

  it('keeps a selected shape\u2019s outline catching pointers, with its box catching them too', () => {
    const { container, wrapper } = draw(rect, true);
    expect(wrapper.style.pointerEvents).toBe('');
    expect(container.querySelector('[data-shape-hit="line"]')).not.toBeNull();
  });

  it('keeps a selected pen stroke\u2019s line catching pointers, with its box catching them too', () => {
    const { container, wrapper } = draw(stroke, true);
    expect(wrapper.style.pointerEvents).toBe('');
    expect(container.querySelector('[data-stroke-hit]')).not.toBeNull();
    expect(draw(stroke, false).wrapper.style.pointerEvents).toBe('none');
  });
});
