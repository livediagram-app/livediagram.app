// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { getPaletteDragPreview, setPaletteDragPreview } from '@/lib/palette-drag-preview';
import { tilesForCategory } from './palette-tile-defs';
import type { PaletteTileActions } from './PaletteTileGrid';
import { StripOpenerPanel } from './StripOpenerPanel';

// docs/specs/007-editor/toolbar-layout.md "A tile's side panel": a category opener's popover shows its tiles as cards that place,
// arm and drag as the tiles do.

const actions = () =>
  new Proxy({ hasImage: true } as unknown as PaletteTileActions, {
    get: (target, key) =>
      key in target ? target[key as never] : (target[key as never] = vi.fn() as never),
  });

const panel = (a: PaletteTileActions) =>
  render(
    <StripOpenerPanel
      label="Ask"
      description="Ask the room."
      tiles={tilesForCategory('collab-ask')}
      actions={a}
      pendingDraw={null}
    />,
  );

describe('StripOpenerPanel', () => {
  it('names the category and lists its tiles as cards', () => {
    panel(actions());
    expect(screen.getByRole('heading', { name: 'Ask' })).toBeTruthy();
    expect(screen.getAllByRole('button')).toHaveLength(tilesForCategory('collab-ask').length);
  });

  it('places what a card stands for', () => {
    const a = actions();
    panel(a);
    const vote = tilesForCategory('collab-ask').find((t) => t.id === 'tools:session-vote')!;
    fireEvent.click(screen.getByRole('button', { name: vote.label }));
    expect(a.addShape).toHaveBeenCalledWith(
      'session-button',
      expect.objectContaining({ session: 'vote' }),
    );
  });

  it('clears the canvas preview when a drag ends, dropped or not', () => {
    panel(actions());
    const vote = tilesForCategory('collab-ask').find((t) => t.id === 'tools:session-vote')!;
    const card = screen.getByRole('button', { name: vote.label });
    setPaletteDragPreview({ kind: 'session-button', width: 10, height: 10 });
    fireEvent.dragEnd(card);
    expect(getPaletteDragPreview()).toBeNull();
  });
});
