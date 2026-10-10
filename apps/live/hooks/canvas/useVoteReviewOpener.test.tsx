// @vitest-environment jsdom

// docs/specs/012-collaboration/session-tools.md: a results walkthrough started elsewhere opens the
// Vote popover for whoever drives it, once, and never for a follower.

import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DockPanel } from './useDockPopovers';
import { useVoteReviewOpener } from './useVoteReviewOpener';

afterEach(cleanup);

function Harness({
  driving,
  open = null,
  onOpen,
}: {
  driving: boolean;
  open?: DockPanel | null;
  onOpen: (id: DockPanel, button: HTMLElement, above?: boolean) => void;
}) {
  const ref = useVoteReviewOpener(driving, {
    activeDockPanel: open,
    handleDockButtonClick: onOpen,
  });
  return <button ref={ref}>Vote</button>;
}

describe('useVoteReviewOpener', () => {
  it('opens the Vote popover when a walkthrough starts for its driver', () => {
    const onOpen = vi.fn();
    const { rerender } = render(<Harness driving={false} onOpen={onOpen} />);
    expect(onOpen).not.toHaveBeenCalled();
    rerender(<Harness driving onOpen={onOpen} />);
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(onOpen.mock.calls[0]![0]).toBe('session-vote');
    expect(onOpen.mock.calls[0]![2]).toBe(true);
    rerender(<Harness driving onOpen={onOpen} />);
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('leaves an already open Vote popover alone', () => {
    const onOpen = vi.fn();
    const { rerender } = render(<Harness driving={false} open="session-vote" onOpen={onOpen} />);
    rerender(<Harness driving open="session-vote" onOpen={onOpen} />);
    expect(onOpen).not.toHaveBeenCalled();
  });

  it('does nothing for a walkthrough already running on mount (a follower, or a reload)', () => {
    const onOpen = vi.fn();
    render(<Harness driving onOpen={onOpen} />);
    expect(onOpen).not.toHaveBeenCalled();
  });
});
