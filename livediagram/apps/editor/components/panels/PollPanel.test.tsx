// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { LivePoll } from '@livediagram/api-schema';
import { PollPanel } from './PollPanel';

// A text poll before anyone answers (docs/specs/012-collaboration/live-poll.md): the shared empty state, not a bare
// line (docs/specs/004-interface-design/empty-states.md).

const poll = {
  id: 'p',
  question: 'What should we try next?',
  style: 'text',
  options: [],
  startedAt: 0,
} as unknown as LivePoll;

vi.stubGlobal(
  'ResizeObserver',
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
);

describe('PollPanel', () => {
  it('shows a text poll with no answers as the shared empty state', () => {
    render(
      <PollPanel
        poll={poll}
        answers={new Map()}
        isHost
        onEnd={vi.fn()}
        onDismiss={vi.fn()}
        onPopoverClose={vi.fn()}
      />,
    );
    expect(screen.getByText('No answers yet').closest('[data-empty-state]')).toBeTruthy();
  });

  // A question or text answer of one long word wraps inside the panel instead of running off it.
  it('breaks a long unbroken question and text answer inside the panel', () => {
    const word = 'x'.repeat(200);
    const said = 'z'.repeat(280);
    render(
      <PollPanel
        poll={{ ...poll, question: word }}
        answers={new Map([['a', said]])}
        isHost
        onEnd={vi.fn()}
        onDismiss={vi.fn()}
        onPopoverClose={vi.fn()}
      />,
    );
    expect(screen.getByText(word).className).toContain('[overflow-wrap:anywhere]');
    expect(screen.getByText(said).className).toContain('[overflow-wrap:anywhere]');
  });
});
