// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { LivePoll } from '@livepages/api-schema';
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
});
