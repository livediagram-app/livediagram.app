// @vitest-environment jsdom
import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { createShape, type BoxedElement, type TabVote } from '@liveplanner/project';
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

// docs/specs/012-collaboration/session-tools.md "On a small note when zoomed out it folds to a badge".
describe('ElementVoteOverlay on a small element zoomed out', () => {
  function small(zoom: number, opts: { votes?: string[]; onCast?: () => void } = {}) {
    const v: TabVote = { ...vote(true), votes: { [el.id]: opts.votes ?? ['me'] } };
    return render(
      <CanvasZoomProvider zoom={zoom}>
        <ElementVoteOverlay
          voteKey={el.id}
          name="Square"
          vote={v}
          selfId="me"
          voteMax={1}
          votableInVote
          box={{ width: 120, height: 80 }}
          onCastVote={opts.onCast ?? (() => {})}
        />
        <span data-testid="elsewhere" />
      </CanvasZoomProvider>,
    );
  }
  const badgeOf = (c: HTMLElement) =>
    c.querySelector<HTMLButtonElement>('.lvd-vote-badge button[aria-expanded="false"]');

  it('keeps the stepper at 100%, even on a small element', () => {
    const c = small(1).container;
    expect(c.querySelector('.lvd-vote-stepper')).not.toBeNull();
    expect(badgeOf(c)).toBeNull();
  });

  it('folds to a counter-scaled badge with the count, brand-filled while it holds your dots', () => {
    const c = small(0.4).container;
    expect(c.querySelector('.lvd-vote-stepper')).toBeNull();
    const badge = badgeOf(c)!;
    expect(badge.getAttribute('aria-label')).toBe('1 vote on Square. Open the vote stepper');
    expect(badge.textContent).toBe('1+');
    expect(badge.className).toContain('bg-brand-700');
    expect(badge.closest<HTMLElement>('.lvd-vote-badge')!.style.transform).toBe('scale(2.5)');
    const none = small(0.4, { votes: [] }).container;
    expect(badgeOf(none)!.className).not.toContain('bg-brand-700');
  });

  it('opens the stepper on a tap and casts from it, closing on a press elsewhere', () => {
    let cast = 0;
    const r = small(0.4, { onCast: () => cast++ });
    fireEvent.click(badgeOf(r.container)!, { detail: 1 });
    const stepper = r.container.querySelector('.lvd-vote-stepper-open');
    expect(stepper).not.toBeNull();
    fireEvent.click(r.getByRole('button', { name: 'Add a dot to Square' }));
    expect(cast).toBe(1);
    // A tap on its own buttons keeps it open; the badge's own press never reaches the element.
    fireEvent.pointerDown(r.getByRole('button', { name: 'Add a dot to Square' }));
    expect(r.container.querySelector('.lvd-vote-stepper-open')).not.toBeNull();
    fireEvent.pointerDown(r.getByTestId('elsewhere'));
    expect(badgeOf(r.container)).not.toBeNull();
  });

  it('opened from the keyboard, puts focus on the plus', () => {
    const r = small(0.4);
    fireEvent.click(badgeOf(r.container)!, { detail: 0 });
    expect(document.activeElement?.getAttribute('aria-label')).toBe('Add a dot to Square');
  });

  it('stops the press on the badge reaching the element', () => {
    let reached = 0;
    const r = render(
      <CanvasZoomProvider zoom={0.4}>
        <div onPointerDown={() => reached++}>
          <ElementVoteOverlay
            voteKey={el.id}
            name="Square"
            vote={vote(true)}
            selfId="me"
            voteMax={1}
            votableInVote
            box={{ width: 120, height: 80 }}
            onCastVote={() => {}}
          />
        </div>
      </CanvasZoomProvider>,
    );
    fireEvent.pointerDown(badgeOf(r.container)!);
    expect(reached).toBe(0);
  });
});
