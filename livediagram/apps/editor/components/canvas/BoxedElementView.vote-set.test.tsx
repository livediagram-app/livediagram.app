// @vitest-environment jsdom
import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { createShape, type BoxedElement, type TabVote } from '@livediagram/document';
import { BoxedElementView } from '@/components/canvas/BoxedElementView';

// docs/specs/012-collaboration/vote-layer-scope.md "Showing the votable set" and session-tools.md "Only items with
// text": a vote that narrows the votable set (a layer, or text only) dims what is out and rings what is in, while
// casting is open.

function wrapperFor(vote: TabVote, votableInVote: boolean, label?: string) {
  const element = { ...createShape('square', 0, 0), label } as BoxedElement;
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
      readOnly={false}
      remoteSelectors={[]}
      vote={vote}
      votableInVote={votableInVote}
      selfId="me"
      onCastVote={vi.fn()}
    />,
  );
  const wrapper = container.querySelector<HTMLElement>(`[data-element-id="${element.id}"]`)!;
  const steppers = [...wrapper.querySelectorAll('.lvd-vote-stepper button')].map((b) =>
    b.getAttribute('aria-label'),
  );
  return { wrapper, ringed: !!wrapper.querySelector('.ring-brand-400\\/70'), steppers };
}

const open: TabVote = { active: true, revealed: false, votesPerPerson: 3, votes: {} };

describe('the votable set on a text-only vote', () => {
  it('dims a blank element and leaves it unringed', () => {
    const { wrapper, ringed } = wrapperFor({ ...open, onlyWithText: true }, false);
    expect(wrapper.style.opacity).toBe('0.35');
    expect(ringed).toBe(false);
  });

  it('rings an element with text at full opacity', () => {
    const { wrapper, ringed } = wrapperFor({ ...open, onlyWithText: true }, true);
    expect(wrapper.style.opacity).toBe('1');
    expect(ringed).toBe(true);
  });

  it('shows nothing extra once the vote has ended', () => {
    const { wrapper, ringed } = wrapperFor({ ...open, active: false, onlyWithText: true }, false);
    expect(wrapper.style.opacity).toBe('1');
    expect(ringed).toBe(false);
  });

  it('shows nothing extra on an ordinary whole-canvas vote', () => {
    const { wrapper, ringed } = wrapperFor(open, true);
    expect(wrapper.style.opacity).toBe('1');
    expect(ringed).toBe(false);
  });

  // A blank element still holding dots keeps its stepper; its buttons need a name, not "Add a dot to ".
  it("names a blank element's stepper buttons", () => {
    expect(wrapperFor(open, true, '  ').steppers).toEqual([
      'Remove a dot from this element',
      'Add a dot to this element',
    ]);
    expect(wrapperFor(open, true, 'Idea').steppers).toEqual([
      'Remove a dot from Idea',
      'Add a dot to Idea',
    ]);
  });
});
