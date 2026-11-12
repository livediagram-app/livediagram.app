// @vitest-environment jsdom
import { fireEvent, render } from '@testing-library/react';
import type { ReactElement } from 'react';
import { beforeAll, describe, expect, it } from 'vitest';
import type { VoteRulesVote } from '@liveworkspace/model-core/vote-rules';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import { CanvasZoomProvider } from './CanvasZoomContext';
import { ElementVoteOverlay } from './ElementVoteOverlay';

// docs/specs/012-collaboration/session-tools.md (livediagram and liveplanner): the one dot-vote overlay both products'
// canvases mount. Each product's own suite drives its door; these cover every branch of the shared copy.

const vote = (over: Partial<VoteRulesVote> = {}): VoteRulesVote => ({
  active: true,
  revealed: false,
  votesPerPerson: 3,
  votes: { k: ['me'] },
  ...over,
});

type Props = Parameters<typeof ElementVoteOverlay>[0];
function overlay(zoom: number, props: Partial<Props> = {}) {
  return render(
    <CanvasZoomProvider zoom={zoom}>
      <ElementVoteOverlay
        voteKey="k"
        name="Idea"
        vote={vote()}
        selfId="me"
        voteMax={1}
        votableInVote
        onCastVote={() => {}}
        {...props}
      />
      <span data-testid="elsewhere" />
    </CanvasZoomProvider>,
  );
}

const SMALL = { width: 180, height: 180 };

describe('ElementVoteOverlay', () => {
  it('draws nothing without a vote, or for an element the vote does not take', () => {
    expect(overlay(1, { vote: null }).container.childElementCount).toBe(1);
    expect(overlay(1, { votableInVote: false }).container.childElementCount).toBe(1);
  });

  it('casts and retracts from the stepper', () => {
    const calls: string[] = [];
    const r = overlay(1, {
      onCastVote: (k) => calls.push(`+${k}`),
      onRetractVote: (k) => calls.push(`-${k}`),
    });
    fireEvent.click(r.getByRole('button', { name: 'Add a dot to Idea' }));
    fireEvent.click(r.getByRole('button', { name: 'Remove a dot from Idea' }));
    expect(calls).toEqual(['+k', '-k']);
  });

  it('announces the product’s vote keys, and none when it has none', () => {
    const keyed = overlay(1, { keyShortcuts: { add: '+', remove: '-' } });
    expect(
      keyed.getByRole('button', { name: 'Add a dot to Idea' }).getAttribute('aria-keyshortcuts'),
    ).toBe('+');
    expect(
      keyed
        .getByRole('button', { name: 'Remove a dot from Idea' })
        .getAttribute('aria-keyshortcuts'),
    ).toBe('-');
    keyed.unmount();
    const plain = overlay(1);
    expect(
      plain.getByRole('button', { name: 'Add a dot to Idea' }).hasAttribute('aria-keyshortcuts'),
    ).toBe(false);
    plain.unmount();
    const badge = overlay(0.4, { box: SMALL, keyShortcuts: { add: '+', remove: '-' } });
    expect(
      badge.container.querySelector('.lvd-vote-badge button')!.getAttribute('aria-keyshortcuts'),
    ).toBe('+ -');
    badge.unmount();
    expect(
      overlay(0.4, { box: SMALL })
        .container.querySelector('.lvd-vote-badge button')!
        .hasAttribute('aria-keyshortcuts'),
    ).toBe(false);
  });

  it('disables the plus on a blank element only in a text-only vote', () => {
    const add = (r: ReturnType<typeof overlay>) =>
      r.getByRole('button', { name: 'Add a dot to Idea' }) as HTMLButtonElement;
    const blank = overlay(1, { vote: vote({ onlyWithText: true }), hasText: false });
    expect(add(blank).disabled).toBe(true);
    blank.unmount();
    expect(add(overlay(1, { hasText: false })).disabled).toBe(false);
  });

  it('without a self, offers no plus', () => {
    const plus = overlay(1, { selfId: null }).getByRole('button', { name: 'Add a dot to Idea' });
    expect((plus as HTMLButtonElement).disabled).toBe(true);
  });

  it('counts only your dots while the tallies are hidden', () => {
    const v = vote({ hideCounts: true, votes: { k: ['me', 'you'] } });
    const r = overlay(1, { vote: v });
    expect(r.container.querySelector('[aria-label="Your 1 dot"]')).not.toBeNull();
    r.unmount();
    const closed = overlay(1, { vote: { ...v, active: false } });
    expect(closed.container.querySelector('[aria-label="Your 1 dot"]')).not.toBeNull();
  });

  it('rings a revealed winner, and yields the ring to the walkthrough’s focus', () => {
    const winner = vote({ active: false, revealed: true });
    const ring = (r: ReturnType<typeof overlay>) =>
      r.container.querySelector('.ring-amber-400:not(.lvd-vote-focus)');
    const r = overlay(1, { vote: winner });
    expect(ring(r)).not.toBeNull();
    r.unmount();
    const review = overlay(1, { vote: winner, voteReviewActive: true });
    expect(ring(review)).toBeNull();
    review.unmount();
    const focus = overlay(1, { vote: winner, voteReviewActive: true, isVoteFocus: true });
    expect(focus.container.querySelector('.lvd-vote-focus')).not.toBeNull();
    focus.unmount();
    // No voteMax: nobody has won.
    expect(ring(overlay(1, { vote: winner, voteMax: null }))).toBeNull();
  });

  it('shows the read-only count brand-filled while it holds your dots', () => {
    const count = (r: ReturnType<typeof overlay>) =>
      r.container.querySelector('[aria-label="1 vote"]')!.className;
    const mine = overlay(1, { vote: vote({ active: false }) });
    expect(count(mine)).toContain('bg-brand-700');
    mine.unmount();
    expect(
      count(overlay(1, { vote: vote({ active: false, votes: { k: ['you'] } }) })),
    ).not.toContain('bg-brand-700');
  });

  it('shows two dots and a count in words', () => {
    const r = overlay(1, { vote: vote({ active: false, votes: { k: ['me', 'you'] } }) });
    expect(r.container.querySelector('[aria-label="2 votes"]')).not.toBeNull();
    r.unmount();
    const hidden = overlay(1, {
      vote: vote({ active: false, hideCounts: true, votes: { k: ['me', 'me', 'you'] } }),
    });
    expect(hidden.container.querySelector('[aria-label="Your 2 dots"]')).not.toBeNull();
  });

  // The stepper and the badge sit on the element, whose own press casts a dot.
  it('keeps a press on the stepper or the badge from reaching the element', () => {
    for (const [zoom, selector] of [
      [1, '.lvd-vote-stepper > div'],
      [0.4, '.lvd-vote-badge button'],
    ] as const) {
      let reached = 0;
      const r = render(
        <CanvasZoomProvider zoom={zoom}>
          <div onPointerDown={() => reached++}>
            <ElementVoteOverlay
              voteKey="k"
              name="Idea"
              vote={vote()}
              selfId="me"
              voteMax={1}
              votableInVote
              box={SMALL}
              onCastVote={() => {}}
            />
          </div>
        </CanvasZoomProvider>,
      );
      fireEvent.pointerDown(r.container.querySelector(selector)!);
      expect(reached).toBe(0);
      r.unmount();
    }
  });
});

// docs/specs/012-collaboration/session-tools.md "Smaller still it shrinks to a dot".
describe('ElementVoteOverlay at a phone’s full Fit of a large board', () => {
  // A 180 px note at 0.13 zoom is 23 px on screen: smaller than the 24 px badge.
  const dot = (r: ReturnType<typeof overlay>) =>
    r.container.querySelector<HTMLElement>('.lvd-vote-dot');

  it('shrinks the badge to a dot that takes no press, keeping the count for a screen reader', () => {
    const r = overlay(0.13, { box: SMALL });
    expect(r.container.querySelector('.lvd-vote-badge')).toBeNull();
    expect(r.container.querySelector('.lvd-vote-stepper')).toBeNull();
    const d = dot(r)!;
    expect(d.className).toContain('pointer-events-none');
    expect(d.style.transform).toBe(`scale(${1 / 0.13})`);
    expect(d.querySelector('[aria-label="1 vote on Idea"]')!.className).toContain('bg-brand-700');
  });

  it('draws the dot dark with only others’ dots and hollow while empty', () => {
    const others = overlay(0.13, { box: SMALL, vote: vote({ votes: { k: ['you'] } }) });
    expect(dot(others)!.firstElementChild!.className).toContain('bg-slate-700');
    others.unmount();
    const empty = overlay(0.13, { box: SMALL, vote: vote({ votes: {} }) });
    expect(dot(empty)!.firstElementChild!.className).toContain('ring-slate-400');
    expect(dot(empty)!.firstElementChild!.getAttribute('aria-label')).toBe('0 votes on Idea');
  });

  it('shrinks the read-only count to a dot too', () => {
    const r = overlay(0.13, { box: SMALL, vote: vote({ active: false }) });
    expect(dot(r)!.firstElementChild!.getAttribute('aria-label')).toBe('1 vote on Idea');
    r.unmount();
    const big = overlay(0.13, { box: { width: 800, height: 800 }, vote: vote({ active: false }) });
    expect(dot(big)).toBeNull();
    expect(big.container.querySelector('[aria-label="1 vote"]')).not.toBeNull();
  });

  it('keeps the badge, then the stepper, as the note grows on screen', () => {
    // 180 px at 0.3 is 54 px: the badge.
    const badge = overlay(0.3, { box: SMALL });
    expect(dot(badge)).toBeNull();
    expect(badge.container.querySelector('.lvd-vote-badge')).not.toBeNull();
    badge.unmount();
    // A Plan card passes no box: always the stepper.
    expect(overlay(0.13).container.querySelector('.lvd-vote-stepper')).not.toBeNull();
  });

  it('closes an open stepper when a zoom out shrinks it, so a zoom back in starts on the badge', () => {
    const at = (zoom: number) => (
      <CanvasZoomProvider zoom={zoom}>
        <ElementVoteOverlay
          voteKey="k"
          name="Idea"
          vote={vote()}
          selfId="me"
          voteMax={1}
          votableInVote
          box={SMALL}
          onCastVote={() => {}}
        />
      </CanvasZoomProvider>
    );
    const r = render(at(0.4));
    fireEvent.click(r.container.querySelector('.lvd-vote-badge button')!, { detail: 1 });
    expect(r.container.querySelector('.lvd-vote-stepper-open')).not.toBeNull();
    r.rerender(at(0.13));
    expect(dot(r)).not.toBeNull();
    r.rerender(at(0.4));
    expect(r.container.querySelector('.lvd-vote-stepper-open')).toBeNull();
    expect(r.container.querySelector('.lvd-vote-badge')).not.toBeNull();
  });

  it('opens from the keyboard with focus on the plus, or on the minus once the plus is spent', () => {
    const r = overlay(0.4, { box: SMALL, vote: vote({ votesPerPerson: 1 }) });
    fireEvent.click(r.container.querySelector('.lvd-vote-badge button')!, { detail: 0 });
    expect(document.activeElement?.getAttribute('aria-label')).toBe('Remove a dot from Idea');
    fireEvent.pointerDown(r.getByTestId('elsewhere'));
    expect(r.container.querySelector('.lvd-vote-badge')).not.toBeNull();
  });
});

// The size check runs for every shown stepper on each zoom frame, so a large board's full Fit must stay cheap. As on
// the canvas, the overlays are built once and only the zoom changes, so a frame re-renders the zoom's readers alone:
// each shown stepper, as on main (a dot is one span where a badge is a button with two, so a frame costs no more).
// The board is built and first drawn outside the timed part. The CPU budget is the guard; the long timeouts only keep
// a loaded runner's wall clock from failing it.
describe('ElementVoteOverlay on a 2,000-note board', () => {
  const WALL_TIMEOUT_MS = 30_000;
  let r: ReturnType<typeof render>;
  let board: (zoom: number) => ReactElement;
  beforeAll(() => {
    const keys = Array.from({ length: 2000 }, (_, i) => `n${i}`);
    const big = vote({ votes: Object.fromEntries(keys.map((k, i) => [k, i % 3 ? [] : ['me']])) });
    const cast = () => {};
    const notes = keys.map((k) => (
      <ElementVoteOverlay
        key={k}
        voteKey={k}
        name={k}
        vote={big}
        selfId="me"
        voteMax={1}
        votableInVote
        box={SMALL}
        onCastVote={cast}
      />
    ));
    board = (zoom) => <CanvasZoomProvider zoom={zoom}>{notes}</CanvasZoomProvider>;
    r = render(board(0.4));
  }, WALL_TIMEOUT_MS);

  it(
    'zooms out to the dots and through its full Fit within a CPU budget',
    () => {
      const frames = [0.3, 0.2, 0.15, 0.13, 0.12, 0.11];
      const ms = cpuMsOf(() => {
        for (const z of frames) r.rerender(board(z));
      });
      expect(r.container.querySelectorAll('.lvd-vote-dot')).toHaveLength(2000);
      expect(ms).toBeLessThan(cpuBudgetMs(1500));
    },
    WALL_TIMEOUT_MS,
  );
});
