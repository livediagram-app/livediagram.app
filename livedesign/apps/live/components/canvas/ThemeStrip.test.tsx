// @vitest-environment jsdom

// docs/specs/007-editor/live-app.md: the Theme & Canvas brush is a strip of its own in the bottom-right cluster
// (its Layers neighbour retired with the Layers panel, docs/specs/006-design/layers.md), and a session without it
// draws nothing.

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ThemeStrip } from './ThemeStrip';

afterEach(cleanup);

describe('ThemeStrip', () => {
  it('opens the theme from its one button, with no Layers button', () => {
    const onOpenTheme = vi.fn();
    render(<ThemeStrip onOpenTheme={onOpenTheme} />);
    expect(screen.queryByRole('button', { name: 'Open Layers' })).toBeNull();
    const theme = screen.getByRole('button', { name: 'Theme and canvas' });
    expect(theme.closest('[data-dock-button]')).toBeTruthy();
    fireEvent.click(theme);
    expect(onOpenTheme).toHaveBeenCalled();
  });

  it('draws nothing without the button', () => {
    const { container } = render(<ThemeStrip />);
    expect(container.innerHTML).toBe('');
  });
});
