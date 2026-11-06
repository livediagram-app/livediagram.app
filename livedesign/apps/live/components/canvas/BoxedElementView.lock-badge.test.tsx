// @vitest-environment jsdom
import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { createShape, type BoxedElement } from '@livedesign/design';
import { BoxedElementView } from '@/components/canvas/BoxedElementView';

// docs/specs/008-canvas/canvas-and-palette.md "Locking": the padlock badge marks the element's own lock; a locked
// tab says so once, on its tab, and its elements show none.

function wrapperFor(props: {
  readOnly: boolean;
  movable?: boolean;
  locked?: boolean;
  tabLocked?: boolean;
  remoteSelectors?: { id: string; name: string; color: string; holds: boolean }[];
}) {
  const element = { ...createShape('square', 0, 0), locked: props.locked } as BoxedElement;
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
      onCommitTable={vi.fn()}
      onCancelEdit={vi.fn()}
      onFollowLink={vi.fn()}
      onOpenComments={vi.fn()}
      onOpenAction={vi.fn()}
      onOpenNote={vi.fn()}
      onSetPageHeading={vi.fn()}
      onContextSelect={vi.fn()}
      tabLocked={props.tabLocked ?? false}
      tabSummaries={[]}
      readOnly={props.readOnly}
      movable={props.movable}
      remoteSelectors={props.remoteSelectors ?? []}
    />,
  );
  return container.querySelector<HTMLElement>(`[data-element-id="${element.id}"]`)!;
}

describe('the lock badge', () => {
  const badge = (props: Parameters<typeof wrapperFor>[0]) =>
    wrapperFor(props).querySelector('[data-lock-badge]');

  it('shows on an element locked on its own', () => {
    expect(badge({ readOnly: false, locked: true })).not.toBeNull();
  });

  it('shows on a locked element on a locked tab', () => {
    expect(badge({ readOnly: false, locked: true, tabLocked: true })).not.toBeNull();
  });

  it('stays off an unlocked element on a locked tab', () => {
    expect(badge({ readOnly: false, tabLocked: true })).toBeNull();
  });

  it('stays off an unlocked element', () => {
    expect(badge({ readOnly: false })).toBeNull();
  });

  it("keeps a locked tab's elements from dragging all the same", () => {
    expect(wrapperFor({ readOnly: false, tabLocked: true }).className).toContain('cursor-default');
  });
});
