// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { TabVote } from '@livediagram/document';
import { VotePanel } from './VotePanel';

// docs/specs/012-collaboration/session-tools.md "Voting on Plan cards": the results name a card by its number and
// title.
const plan = {
  items: new Map([['i1', { id: 'i1', key: 12, fields: { title: 'Ship it' } }]]),
};
vi.mock('@/components/plan/PlanContext', () => ({ usePlan: () => plan }));
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
  votes: { 'item:i1': ['p', 'q'], 'item:gone': ['p'] },
};

describe('VotePanel results', () => {
  it('names a card by its number and title, and a card no longer here as a card', () => {
    render(
      <VotePanel
        vote={vote}
        elements={[]}
        participantCount={2}
        results={[
          { id: 'item:i1', votes: 2 },
          { id: 'item:gone', votes: 1 },
        ]}
        reviewIndex={0}
        onJumpToResult={() => {}}
        onEndVote={() => {}}
        onRevealVote={() => {}}
        onClearVote={() => {}}
        isHost
        readOnly={false}
        onPopoverClose={() => {}}
        selfId="me"
        review={null}
        onNextResult={() => {}}
        onPrevResult={() => {}}
        onDoneReview={() => {}}
      />,
    );
    expect(screen.getByText('#12 Ship it')).toBeTruthy();
    expect(screen.getByText('Card')).toBeTruthy();
  });
});
