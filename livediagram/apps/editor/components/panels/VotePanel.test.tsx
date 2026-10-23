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
  const panel = (readOnly: boolean, canVote: boolean) =>
    render(
      <VotePanel
        vote={casting}
        elements={[]}
        participantCount={2}
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
});
