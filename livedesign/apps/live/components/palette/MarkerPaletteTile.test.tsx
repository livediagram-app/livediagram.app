// @vitest-environment jsdom

// A marker's tile, anywhere the palette shows it (docs/specs/007-editor/logo-pages.md "The Logo
// palette"): pressed again while held, it opens Draw mode's colour and width.
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { EditorContext } from '@/app/document/[id]/EditorContext';
import type { PendingDraw } from '@/lib/draw-mode';
import type { PaletteTileDef } from './palette-tile-defs';
import { PaletteTile, type PaletteTileActions } from './PaletteTileGrid';

afterEach(() => cleanup());

const def: PaletteTileDef = {
  id: 'draw:marker-second',
  section: 'tools',
  label: 'Marker 2',
  description: 'Marker 2',
  action: { type: 'marker', penId: 'second', colour: 'blue', width: 4, once: true },
  icon: <span />,
};
const ctx = {
  whiteboardDock: {
    prefs: { pens: [{ id: 'second', colour: 'blue', width: 4 }], recognise: false },
    updatePen: vi.fn(),
    colourMemory: { yours: [], forget: vi.fn(), remember: vi.fn() },
  },
};
const held: PendingDraw = {
  type: 'freehand',
  variant: 'whiteboard',
  colour: 'blue',
  width: 4,
  recognise: false,
  penId: 'second',
  once: true,
};

function show(pendingDraw: PendingDraw | null) {
  const actions = { beginMarker: vi.fn(), hasImage: false } as unknown as PaletteTileActions;
  const wrap = ({ children }: { children: ReactNode }) => (
    <EditorContext.Provider value={ctx as never}>{children}</EditorContext.Provider>
  );
  render(<PaletteTile def={def} actions={actions} pendingDraw={pendingDraw} compact />, {
    wrapper: wrap,
  });
  return actions;
}

describe('a marker tile', () => {
  it('picks the marker up, for one stroke', () => {
    const actions = show(null);
    fireEvent.click(screen.getByRole('button', { name: /Marker 2/ }));
    expect(actions.beginMarker).toHaveBeenCalledWith('second', true);
  });

  it('opens its colour and width when pressed again while held', () => {
    const actions = show(held);
    fireEvent.click(screen.getByRole('button', { name: /Marker 2/ }));
    expect(actions.beginMarker).not.toHaveBeenCalled();
    expect(document.getElementById('marker-tile-draw:marker-second-flyout')).not.toBeNull();
  });
});
