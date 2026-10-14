// @vitest-environment jsdom

// A tile with presets on the Toolbar strip (docs/specs/009-elements/card.md "Card presets"): drawn as an opener with a
// caret, and pressing it opens its presets rather than placing the element.

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { tileItems, type useStripOpeners } from './strip-rail-items';
import { tileById } from './palette-tile-defs';
import { CARD_PRESET_TILES } from './palette-card-presets';
import type { PaletteTileActions } from './PaletteTileGrid';

afterEach(cleanup);

describe('a tile with presets on the strip', () => {
  it('opens the Card presets instead of placing a card', () => {
    const card = tileById('components:card')!;
    const toggleOpen = vi.fn();
    const openers = { isOpen: () => false, toggleOpen } as unknown as ReturnType<
      typeof useStripOpeners
    >;
    const actions = { onAddShape: vi.fn() } as unknown as PaletteTileActions;
    render(<>{tileItems([card], new Set(), actions, null, openers)}</>);
    const button = screen.getByRole('button', { name: 'Card' });
    expect(button.getAttribute('aria-haspopup')).toBe('dialog');
    fireEvent.click(button);
    expect(toggleOpen).toHaveBeenCalledWith(
      expect.objectContaining({
        key: 'components:card',
        label: 'Card',
        variants: expect.objectContaining({ tiles: CARD_PRESET_TILES }),
      }),
      expect.any(HTMLElement),
    );
    expect(
      (actions as unknown as { onAddShape: ReturnType<typeof vi.fn> }).onAddShape,
    ).not.toHaveBeenCalled();
  });

  it('offers six presets, each a card tile with its own variant', () => {
    expect(CARD_PRESET_TILES.map((t) => t.caption)).toEqual([
      'Service',
      'Compact',
      'Panel',
      'Person',
      'Accent',
      'Callout',
    ]);
    for (const t of CARD_PRESET_TILES)
      expect(t.action).toMatchObject({ type: 'shape', kind: 'card' });
    expect(new Set(CARD_PRESET_TILES.map((t) => t.id)).size).toBe(6);
  });
});
