// @vitest-environment jsdom

// The Logo category's body (docs/specs/007-editor/logo-pages.md "The Logo palette").
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { EditorContext } from '@/app/document/[id]/EditorContext';
import type { PendingDraw } from '@/lib/draw-mode';
import { PaletteLogoTab, useLogoMarkerTiles } from './PaletteLogoTab';
import { tileById, type PaletteTileDef } from './palette-tile-defs';
import type { PaletteTileActions } from './PaletteTileGrid';

afterEach(() => cleanup());

const pens = [
  { id: 'main', colour: null, width: 4 },
  { id: 'second', colour: 'blue', width: 4 },
  { id: 'third', colour: 'red', width: 4 },
];
const editor = (over: Record<string, unknown> = {}) => ({
  beginDraw: vi.fn(),
  whiteboardDock: {
    prefs: { pens, recognise: false },
    updatePen: vi.fn(),
    colourMemory: { yours: [], forget: vi.fn(), remember: vi.fn() },
  },
  ...over,
});
const actions = {
  hasImage: false,
  beginPath: vi.fn(),
  beginFreehand: vi.fn(),
} as unknown as PaletteTileActions;

function Tab({ pendingDraw }: { pendingDraw: PendingDraw | null }) {
  const markers = useLogoMarkerTiles(true);
  const tiles = [tileById('logo:pen')!, tileById('tools:pencil')!, ...markers] as PaletteTileDef[];
  return <PaletteLogoTab tiles={tiles} actions={actions} pendingDraw={pendingDraw} />;
}

function show(ctx: ReturnType<typeof editor>, pendingDraw: PendingDraw | null = null) {
  const wrap = ({ children }: { children: ReactNode }) => (
    <EditorContext.Provider value={ctx as never}>{children}</EditorContext.Provider>
  );
  render(<Tab pendingDraw={pendingDraw} />, { wrapper: wrap });
}

describe('PaletteLogoTab', () => {
  it('offers the Pen, the Pencil and the three markers', () => {
    show(editor());
    for (const name of ['Pen', 'Freehand Pencil', 'Marker 1', 'Marker 2', 'Marker 3'])
      expect(screen.getByRole('option', { name })).toBeTruthy();
    fireEvent.click(screen.getByRole('option', { name: 'Pen' }));
    expect(actions.beginPath).toHaveBeenCalled();
  });

  it('picks a marker up for one stroke, from the live pen', () => {
    const ctx = editor();
    show(ctx);
    fireEvent.click(screen.getByRole('option', { name: 'Marker 2' }));
    expect(ctx.beginDraw).toHaveBeenCalledWith({
      type: 'freehand',
      variant: 'whiteboard',
      colour: 'blue',
      width: 4,
      recognise: false,
      penId: 'second',
      once: true,
    });
  });

  it('reads only the marker in hand as held, even beside one set alike', () => {
    const alike = editor();
    (alike.whiteboardDock.prefs.pens as { colour: string | null }[])[2]!.colour = 'blue';
    show(alike, {
      type: 'freehand',
      variant: 'whiteboard',
      colour: 'blue',
      width: 4,
      recognise: false,
      penId: 'third',
      once: true,
    });
    expect(screen.getByRole('option', { name: 'Marker 3' }).getAttribute('aria-pressed')).toBe(
      'true',
    );
    expect(screen.getByRole('option', { name: 'Marker 2' }).getAttribute('aria-pressed')).toBe(
      'false',
    );
    (alike.whiteboardDock.prefs.pens as { colour: string | null }[])[2]!.colour = 'red';
  });

  it('opens a held marker’s colour and width on a second press', () => {
    show(editor(), {
      type: 'freehand',
      variant: 'whiteboard',
      colour: 'blue',
      width: 4,
      recognise: false,
      once: true,
    });
    const row = screen.getByRole('option', { name: 'Marker 2' });
    expect(row.getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(row);
    expect(row.getAttribute('aria-expanded')).toBe('true');
  });
});
