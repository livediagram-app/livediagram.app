// @vitest-environment jsdom
import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { createShape, createSticky, type BoxedElement } from '@livehuddle/document';
import { BoxedElementView } from '@/components/canvas/BoxedElementView';

// docs/specs/008-canvas/3d-view.md "Pieces stand up": a piece drawn upright marks its box to stand in the 3D view.
function boxOf(element: BoxedElement) {
  const { container } = render(
    <BoxedElementView
      element={element}
      isSelected={false}
      isEditing={false}
      isPaintMode={false}
      showHandles={false}
      showAnchors={false}
      onBeginDrag={vi.fn()}
      onBeginEdit={vi.fn()}
      onCommitLabel={vi.fn()}
      onCancelEdit={vi.fn()}
      onFollowLink={vi.fn()}
      onContextSelect={vi.fn()}
      tabSummaries={[]}
      readOnly
      remoteSelectors={[]}
    />,
  );
  return container.querySelector<HTMLElement>(`[data-element-id="${element.id}"]`)!;
}

describe('the 3D view’s standing mark', () => {
  it('marks an upright piece to stand about its front edge', () => {
    expect(boxOf(createShape('bookshelf', 0, 0) as BoxedElement).dataset.spaceStands).toBe('base');
  });

  it('marks a turned piece to stand about its middle', () => {
    const plant = { ...createShape('plant', 0, 0), rotation: 20 } as BoxedElement;
    expect(boxOf(plant).dataset.spaceStands).toBe('centre');
  });

  it("hides a fence's flat drawing, whose run stands as a wall", () => {
    for (const kind of ['fence', 'garden-fence'] as const)
      expect(boxOf(createShape(kind, 0, 0) as BoxedElement).hasAttribute('data-space-walled')).toBe(
        true,
      );
    expect(
      boxOf(createShape('chair', 0, 0) as BoxedElement).hasAttribute('data-space-walled'),
    ).toBe(false);
  });

  it('leaves a floor covering and a sticky unmarked', () => {
    expect(boxOf(createShape('rug', 0, 0) as BoxedElement).hasAttribute('data-space-stands')).toBe(
      false,
    );
    expect(boxOf(createSticky(0, 0) as BoxedElement).hasAttribute('data-space-stands')).toBe(false);
  });
});
