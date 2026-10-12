// @vitest-environment jsdom

// docs/specs/007-editor/live-app.md: Layers and the Theme & Canvas brush share one strip in every
// mode, and a session without one of the two keeps the other. Diagram mode's Tidy Up leads it
// (docs/specs/008-canvas/layout-cleanup.md "The Tidy Up button").

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LayersThemeStrip } from './LayersThemeStrip';

afterEach(cleanup);

describe('LayersThemeStrip', () => {
  it('puts Layers and the brush in one strip', () => {
    const onToggle = vi.fn();
    const onOpenTheme = vi.fn();
    render(<LayersThemeStrip layers={{ open: false, onToggle }} onOpenTheme={onOpenTheme} />);
    const layers = screen.getByRole('button', { name: 'Open Layers' });
    const theme = screen.getByRole('button', { name: 'Theme and canvas' });
    expect(layers.closest('[data-dock-button]')).toBe(theme.closest('[data-dock-button]'));
    fireEvent.click(layers);
    expect(onToggle).toHaveBeenCalledWith(layers);
    fireEvent.click(theme);
    expect(onOpenTheme).toHaveBeenCalled();
  });

  it('keeps whichever of the two a mode has, and nothing when it has neither', () => {
    render(<LayersThemeStrip onOpenTheme={() => {}} />);
    expect(screen.queryByRole('button', { name: 'Open Layers' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Theme and canvas' })).toBeTruthy();
    cleanup();
    const { container } = render(<LayersThemeStrip />);
    expect(container.innerHTML).toBe('');
  });

  it('puts Tidy Up first in the strip, left of Layers, and toggles its popover', () => {
    const onTidy = vi.fn();
    render(
      <LayersThemeStrip
        tidyUp={{ open: false, onToggle: onTidy }}
        layers={{ open: false, onToggle: () => {} }}
        onOpenTheme={() => {}}
      />,
    );
    const strip = screen.getByRole('button', { name: 'Tidy Up' }).closest('[data-dock-button]')!;
    const names = [...strip.querySelectorAll('button')].map((b) => b.getAttribute('aria-label'));
    expect(names).toEqual(['Tidy Up', 'Open Layers', 'Theme and canvas']);
    const tidy = screen.getByRole('button', { name: 'Tidy Up' });
    expect(tidy.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(tidy);
    expect(onTidy).toHaveBeenCalledWith(tidy);
  });

  it('shows Tidy Up pressed while its popover is open', () => {
    render(<LayersThemeStrip tidyUp={{ open: true, onToggle: () => {} }} />);
    expect(screen.getByRole('button', { name: 'Tidy Up' }).getAttribute('aria-expanded')).toBe(
      'true',
    );
  });
});
