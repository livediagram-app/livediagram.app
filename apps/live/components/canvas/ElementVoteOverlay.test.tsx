// @vitest-environment jsdom
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { createShape, type BoxedElement, type TabVote } from '@livediagram/document';
import { CanvasZoomProvider } from './CanvasZoomContext';
import { ElementVoteOverlay } from './ElementVoteOverlay';

// docs/specs/012-collaboration/session-tools.md: a votable element carries a stepper while casting is
// open, and a read-only count once it closes, both a constant size on screen.

const el = createShape('square', 0, 0) as BoxedElement;
const vote = (active: boolean): TabVote => ({
  active,
  revealed: false,
  votesPerPerson: 3,
  votes: { [el.id]: ['me'] },
});

function overlay(v: TabVote | null, zoom = 2) {
  return render(
    <CanvasZoomProvider zoom={zoom}>
      <ElementVoteOverlay
        voteKey={el.id}
        name="Square"
        vote={v}
        selfId="me"
        voteMax={1}
        votableInVote
      />
    </CanvasZoomProvider>,
  ).container;
}

describe('ElementVoteOverlay', () => {
  it('shows the stepper while casting is open, counter-scaled to the zoom', () => {
    const stepper = overlay(vote(true)).querySelector<HTMLElement>('.lvd-vote-stepper');
    expect(stepper).not.toBeNull();
    expect(stepper!.style.transform).toBe('scale(0.5)');
  });

  it('shows a counter-scaled count once casting has closed', () => {
    const scaled = overlay(vote(false)).querySelector<HTMLElement>('[style*="scale(0.5)"]');
    expect(scaled?.textContent).toContain('1');
  });

  it('draws nothing without a vote', () => {
    expect(overlay(null).childElementCount).toBe(0);
  });
});
