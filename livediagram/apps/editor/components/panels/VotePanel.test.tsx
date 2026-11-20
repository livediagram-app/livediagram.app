// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { TabVote } from '@livediagram/document';
import { VotePanel } from './VotePanel';

afterEach(cleanup);
// jsdom has no ResizeObserver; the movable panel measures itself with one.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;

// docs/specs/013-workspace/share-roles.md: a Participant is read-only but votes, so it sees its dots left.
describe('VotePanel dots left', () => {
  const casting: TabVote = {
    active: true,
    revealed: false,
    votesPerPerson: 3,
    votes: { a: ['me'] },
  };
  const panel = (readOnly: boolean, canVote: boolean, vote = casting, participantCount = 2) =>
    render(
      <VotePanel
        vote={vote}
        elements={[]}
        participantCount={participantCount}
        results={[]}
        reviewIndex={null}
        onJumpToResult={() => {}}
        onEndVote={() => {}}
        onRevealVote={() => {}}
        onClearVote={() => {}}
        isHost={false}
        readOnly={readOnly}
        canVote={canVote}
        onPopoverClose={() => {}}
        selfId="me"
        review={null}
        onNextResult={() => {}}
        onPrevResult={() => {}}
        onDoneReview={() => {}}
      />,
    );

  it('shows a Participant its dots left', () => {
    panel(true, true);
    expect(screen.getByText('2 of 3 dots left')).toBeTruthy();
  });

  it('shows a Viewer none', () => {
    panel(true, false);
    expect(screen.queryByText(/dots left/)).toBeNull();
  });

  // docs/specs/012-collaboration/session-tools.md: turnout answers "is everyone done".
  it('says who still holds dots, and that everyone has voted only once they are all spent', () => {
    panel(false, true, casting, 1);
    expect(screen.getByText('0 of 1 finished')).toBeTruthy();
    expect(screen.getByText('1 person has dots left')).toBeTruthy();
    expect(screen.queryByText('Everyone here has voted')).toBeNull();
    cleanup();
    panel(false, true, { ...casting, votes: { a: ['me'], b: ['me', 'me'] } }, 1);
    expect(screen.getByText('Everyone here has voted')).toBeTruthy();
  });

  it('still counts people who have not started first', () => {
    panel(false, true, casting, 3);
    expect(screen.getByText('2 people haven’t voted yet')).toBeTruthy();
  });
});
