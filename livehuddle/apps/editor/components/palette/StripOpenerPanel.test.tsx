// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { getPaletteDragPreview, setPaletteDragPreview } from '@/lib/palette-drag-preview';
import { tilesForCategory } from './palette-tile-defs';
import type { PaletteTileActions } from './PaletteTileGrid';
import { StripOpenerPanel } from './StripOpenerPanel';

// docs/specs/007-editor/editor-modes.md "Popular": a category opener's popover shows its tiles as cards that place,
// arm and drag as the tiles do.

const actions = () =>
  new Proxy({ hasImage: true } as unknown as PaletteTileActions, {
    get: (target, key) =>
      key in target ? target[key as never] : (target[key as never] = vi.fn() as never),
  });

const panel = (a: PaletteTileActions) =>
  render(
    <StripOpenerPanel
      label="Travel"
      description="How people get somewhere."
      tiles={tilesForCategory('collab-travel')}
      actions={a}
      pendingDraw={null}
    />,
  );

describe('StripOpenerPanel', () => {
  it('names the category and lists its tiles as cards', () => {
    panel(actions());
    expect(screen.getByRole('heading', { name: 'Travel' })).toBeTruthy();
    expect(screen.getAllByRole('button')).toHaveLength(tilesForCategory('collab-travel').length);
  });

  it('places what a card stands for', () => {
    const a = actions();
    panel(a);
    const tile = tilesForCategory('collab-travel').find((t) => t.id === 'tools:mode-avatar')!;
    fireEvent.click(screen.getByRole('button', { name: tile.label }));
    expect(a.addShape).toHaveBeenCalledWith(
      'mode-button',
      expect.objectContaining({ mode: 'avatar' }),
    );
  });

  it('clears the canvas preview when a drag ends, dropped or not', () => {
    panel(actions());
    const tile = tilesForCategory('collab-travel').find((t) => t.id === 'tools:mode-avatar')!;
    const card = screen.getByRole('button', { name: tile.label });
    setPaletteDragPreview({ kind: 'mode-button', width: 10, height: 10 });
    fireEvent.dragEnd(card);
    expect(getPaletteDragPreview()).toBeNull();
  });
});
