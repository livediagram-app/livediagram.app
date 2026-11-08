// @vitest-environment jsdom

// A tile with presets on the Toolbar strip (docs/specs/009-elements/office.md "Room presets"): drawn as an opener with
// a caret, and pressing it opens its presets rather than placing the element.

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { tileItems, type useStripOpeners } from './strip-rail-items';
import { tileById } from './palette-tile-defs';
import { ROOM_PRESET_TILES } from './palette-floor-presets';
import type { PaletteTileActions } from './PaletteTileGrid';

afterEach(cleanup);

describe('a tile with presets on the strip', () => {
  it('opens the Room presets instead of placing a room', () => {
    const room = tileById('tools:room')!;
    const toggleOpen = vi.fn();
    const openers = { isOpen: () => false, toggleOpen } as unknown as ReturnType<
      typeof useStripOpeners
    >;
    const actions = { onAddShape: vi.fn() } as unknown as PaletteTileActions;
    render(<>{tileItems([room], new Set(), actions, null, openers)}</>);
    const button = screen.getByRole('button', { name: 'Room' });
    expect(button.getAttribute('aria-haspopup')).toBe('dialog');
    fireEvent.click(button);
    expect(toggleOpen).toHaveBeenCalledWith(
      expect.objectContaining({
        key: 'tools:room',
        label: 'Room',
        variants: expect.objectContaining({ tiles: ROOM_PRESET_TILES }),
      }),
      expect.any(HTMLElement),
    );
    expect(
      (actions as unknown as { onAddShape: ReturnType<typeof vi.fn> }).onAddShape,
    ).not.toHaveBeenCalled();
  });
});
