// @vitest-environment jsdom
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { createShape, type BoxedElement, type TabVote } from '@livediagram/document';
import { CanvasZoomProvider } from '@liveworkspace/workbench/components/canvas/CanvasZoomContext';
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

function overlay(v: TabVote | null, zoom = 2, canCast = true) {
  return render(
    <CanvasZoomProvider zoom={zoom}>
      <ElementVoteOverlay
        voteKey={el.id}
        name="Square"
        vote={v}
        selfId="me"
        voteMax={1}
        votableInVote
        onCastVote={canCast ? () => {} : undefined}
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

  // docs/specs/012-collaboration/session-tools.md "Roles": a Viewer watches the live counts but cannot vote.
  it('shows a Viewer the live count, not a stepper whose plus would do nothing', () => {
    const c = overlay(vote(true), 2, false);
    expect(c.querySelector('.lvd-vote-stepper')).toBeNull();
    expect(c.querySelector('[aria-label="1 vote"]')).not.toBeNull();
  });

  it('draws nothing without a vote', () => {
    expect(overlay(null).childElementCount).toBe(0);
  });

  // The stepper sits on the element, not the canvas: a translucent fill took a pale sticky's colour under the
  // dark mode's light count, so the dots you had spent vanished.
  it('draws the stepper on an opaque fill in both modes, holding your dots or not', () => {
    for (const v of [vote(true), { ...vote(true), votes: {} }]) {
      const pill = overlay(v).querySelector('.lvd-vote-stepper > div')!;
      const fills = pill.className.split(/\s+/).filter((c) => /^(dark:)?bg-/.test(c));
      expect(fills.length).toBe(2);
      for (const fill of fills) expect(fill).not.toMatch(/\/\d+$/);
    }
  });
});
