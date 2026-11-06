// @vitest-environment jsdom

// docs/specs/007-editor/editor-app.md: the Theme & Canvas brush has a strip of its own in the bottom-right cluster.
// Diagram mode's Tidy Up leads it (docs/specs/008-canvas/layout-cleanup.md "The Tidy Up button").

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ThemeStrip } from './ThemeStrip';

afterEach(cleanup);

describe('ThemeStrip', () => {
  it('opens the theme from the brush, and renders nothing with neither button', () => {
    const onOpenTheme = vi.fn();
    render(<ThemeStrip onOpenTheme={onOpenTheme} />);
    fireEvent.click(screen.getByRole('button', { name: 'Theme and canvas' }));
    expect(onOpenTheme).toHaveBeenCalled();
    cleanup();
    const { container } = render(<ThemeStrip />);
    expect(container.innerHTML).toBe('');
  });

  it('puts Tidy Up first in the strip, and toggles its popover', () => {
    const onTidy = vi.fn();
    render(<ThemeStrip tidyUp={{ open: false, onToggle: onTidy }} onOpenTheme={() => {}} />);
    const strip = screen.getByRole('button', { name: 'Tidy Up' }).closest('[data-dock-button]')!;
    const names = [...strip.querySelectorAll('button')].map((b) => b.getAttribute('aria-label'));
    expect(names).toEqual(['Tidy Up', 'Theme and canvas']);
    const tidy = screen.getByRole('button', { name: 'Tidy Up' });
    expect(tidy.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(tidy);
    expect(onTidy).toHaveBeenCalledWith(tidy);
  });

  it('shows Tidy Up pressed while its popover is open', () => {
    render(<ThemeStrip tidyUp={{ open: true, onToggle: () => {} }} />);
    expect(screen.getByRole('button', { name: 'Tidy Up' }).getAttribute('aria-expanded')).toBe(
      'true',
    );
  });
});
