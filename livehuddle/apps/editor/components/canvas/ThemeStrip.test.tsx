// @vitest-environment jsdom

// docs/specs/007-editor/editor-app.md: the Theme & Canvas brush has a strip of its own in the bottom-right cluster.

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

  // livehuddle has no Tidy Up button (docs/specs/008-canvas/layout-cleanup.md "No Tidy Up button").
  it('holds the brush alone, with no Tidy Up', () => {
    render(<ThemeStrip onOpenTheme={() => {}} />);
    expect(screen.queryByRole('button', { name: 'Tidy Up' })).toBeNull();
    const strip = screen
      .getByRole('button', { name: 'Theme and canvas' })
      .closest('[data-dock-button]')!;
    expect(strip.querySelectorAll('button')).toHaveLength(1);
  });
});
