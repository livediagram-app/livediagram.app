// @vitest-environment jsdom

// docs/specs/012-collaboration/assigned-actions.md §5: the Collaborate button after Layers, on the
// Layers button's contract (LayersThemeStrip).

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CollaborateClusterButton } from './CollaborateClusterButton';

afterEach(cleanup);

describe('CollaborateClusterButton', () => {
  it('toggles the popover anchored to itself, showing pressed while open', () => {
    const onTogglePopover = vi.fn();
    render(
      <CollaborateClusterButton openCount={3} popoverOpen onTogglePopover={onTogglePopover} />,
    );
    const button = screen.getByRole('button', { name: 'Open Collaborate (3 open)' });
    expect(button.getAttribute('aria-expanded')).toBe('true');
    fireEvent.click(button);
    expect(onTogglePopover).toHaveBeenCalledWith(button);
  });

  it('shows the open count as a badge, and none at zero', () => {
    const { rerender } = render(
      <CollaborateClusterButton openCount={2} popoverOpen={false} onTogglePopover={() => {}} />,
    );
    expect(screen.getByText('2')).toBeTruthy();
    rerender(
      <CollaborateClusterButton openCount={0} popoverOpen={false} onTogglePopover={() => {}} />,
    );
    expect(screen.queryByText('0')).toBeNull();
  });
});
