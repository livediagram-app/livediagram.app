// @vitest-environment jsdom
import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { createShape, type BoxedElement } from '@livediagram/document';
import { BoxedElementView } from '@/components/canvas/BoxedElementView';

// docs/specs/013-workspace/share-roles.md: a Participant moves stickies and what it added, nothing else, so the
// move cursor shows only where a drag would start.

function wrapperFor(props: { readOnly: boolean; movable?: boolean; locked?: boolean }) {
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
      isoDepth={0}
      onSetPageHeading={vi.fn()}
      onContextSelect={vi.fn()}
      tabLocked={false}
      tabSummaries={[]}
      readOnly={props.readOnly}
      movable={props.movable}
      remoteSelectors={[]}
    />,
  );
  return container.querySelector<HTMLElement>(`[data-element-id="${element.id}"]`)!;
}

describe('the move cursor', () => {
  it('shows on an element an Editor can drag', () => {
    expect(wrapperFor({ readOnly: false }).className).toContain('cursor-move');
  });

  it('shows on an element a Participant may move', () => {
    expect(wrapperFor({ readOnly: true, movable: true }).className).toContain('cursor-move');
  });

  it('is the plain arrow on an element a Participant may not move', () => {
    const cls = wrapperFor({ readOnly: true, movable: false }).className;
    expect(cls).not.toContain('cursor-move');
    expect(cls).toContain('cursor-default');
  });

  it('is the plain arrow on a locked element', () => {
    expect(wrapperFor({ readOnly: false, locked: true }).className).toContain('cursor-default');
  });
});
