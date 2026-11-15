// @vitest-environment jsdom

// A cluster segment is a popover button by default (aria-expanded) and a switch with `toggle` (aria-pressed), as
// livedesign's Flow view uses it (livedesign/docs/specs/007-editor/wireframe-pages.md "Flow view").

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ClusterPopoverSegment } from './ClusterPopoverButton';

afterEach(cleanup);

const base = {
  label: 'Flow View',
  hoverTitle: 'Flow View',
  hoverDescription: 'Arrows',
  icon: <span />,
};

describe('ClusterPopoverSegment', () => {
  it('says a popover is open with aria-expanded', () => {
    render(<ClusterPopoverSegment {...base} popoverOpen onTogglePopover={() => {}} />);
    const button = screen.getByRole('button', { name: 'Flow View' });
    expect(button.getAttribute('aria-expanded')).toBe('true');
    expect(button.hasAttribute('aria-pressed')).toBe(false);
  });

  it('says a switch is on with aria-pressed, and flips it on a press', () => {
    const onToggle = vi.fn();
    const { rerender } = render(
      <ClusterPopoverSegment {...base} toggle popoverOpen={false} onTogglePopover={onToggle} />,
    );
    const button = screen.getByRole('button', { name: 'Flow View' });
    expect(button.getAttribute('aria-pressed')).toBe('false');
    expect(button.hasAttribute('aria-expanded')).toBe(false);
    fireEvent.click(button);
    expect(onToggle).toHaveBeenCalledWith(button);
    rerender(<ClusterPopoverSegment {...base} toggle popoverOpen onTogglePopover={onToggle} />);
    expect(screen.getByRole('button', { name: 'Flow View' }).getAttribute('aria-pressed')).toBe(
      'true',
    );
  });
});
