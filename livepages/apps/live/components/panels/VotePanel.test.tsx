// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { Element, TabVote } from '@livepages/document';
import { VotePanel } from './VotePanel';

afterEach(cleanup);
// jsdom has no ResizeObserver; the movable panel measures itself with one.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;

const vote: TabVote = {
  active: false,
  revealed: true,
  votesPerPerson: 3,
  votes: { e1: ['p', 'q'], gone: ['p'] },
};
const shipIt = {
  id: 'e1',
  type: 'shape',
  shape: 'square',
  x: 0,
  y: 0,
  width: 120,
  height: 60,
  label: 'Ship it',
} as Element;

describe('VotePanel results', () => {
  // docs/specs/012-collaboration/session-tools.md: the results name each element its dots went to.
  it('names an element by its label, and one no longer here as an element', () => {
    render(
      <VotePanel
        vote={vote}
        elements={[shipIt]}
        participantCount={2}
        results={[
          { id: 'e1', votes: 2 },
          { id: 'gone', votes: 1 },
        ]}
        reviewIndex={0}
        onJumpToResult={() => {}}
        onEndVote={() => {}}
        onRevealVote={() => {}}
        onClearVote={() => {}}
        isHost
        readOnly={false}
        canVote
        onPopoverClose={() => {}}
        selfId="me"
        review={null}
        onNextResult={() => {}}
        onPrevResult={() => {}}
        onDoneReview={() => {}}
      />,
    );
    expect(screen.getByText('Ship it')).toBeTruthy();
    expect(screen.getByText('Element')).toBeTruthy();
  });
});

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
