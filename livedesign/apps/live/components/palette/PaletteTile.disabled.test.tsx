// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PaletteTile, type PaletteTileActions } from './PaletteTileGrid';
import { tileById } from './palette-tile-defs';

// A tile with a static reason is greyed out, focusable and inert.
afterEach(cleanup);

describe('a disabled palette tile', () => {
  it('honours a static reason on any tile', () => {
    const addShape = vi.fn();
    const actions = { addShape, hasImage: false } as unknown as PaletteTileActions;
    render(
      <PaletteTile
        def={{ ...tileById('shapes:square')!, disabled: { reason: 'Not here' } }}
        actions={actions}
        pendingDraw={null}
      />,
    );
    const button = screen.getByRole('button', { name: 'Add Square' });
    expect(button.getAttribute('aria-disabled')).toBe('true');
    expect(button.hasAttribute('disabled')).toBe(false);
    fireEvent.click(button);
    expect(addShape).not.toHaveBeenCalled();
  });
});
