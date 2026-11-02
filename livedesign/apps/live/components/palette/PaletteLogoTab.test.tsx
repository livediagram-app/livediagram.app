// @vitest-environment jsdom

// A logo page's Draw body, with its markers (docs/specs/007-editor/logo-pages.md "The Logo palette").
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { EditorContext } from '@/app/design/[id]/EditorContext';
import type { PendingDraw } from '@/lib/draw-mode';
import { PaletteLogoTab, useLogoMarkerTiles } from './PaletteLogoTab';
import { tileById, type PaletteTileDef } from './palette-tile-defs';
import { tileHandler, type PaletteTileActions } from './PaletteTileGrid';
import { fillToolTile } from './FillToolRow';
import { defaultFill, FILL_CHOICE_KEY, resetFillColour } from './fill-tool-colour';
import { track } from '@/lib/telemetry';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

afterEach(() => {
  cleanup();
  localStorage.clear();
  resetFillColour();
  vi.mocked(track).mockClear();
});

const pens = [
  { id: 'main', colour: null, width: 4 },
  { id: 'second', colour: 'blue', width: 4 },
  { id: 'third', colour: 'red', width: 4 },
];
const editor = (over: Record<string, unknown> = {}) => ({
  beginDraw: vi.fn(),
  markerPens: {
    prefs: { pens },
    updatePen: vi.fn(),
  },
  ...over,
});
const actions = {
  hasImage: false,
  beginPath: vi.fn(),
  beginFreehand: vi.fn(),
} as unknown as PaletteTileActions;

function Tab({
  pendingDraw,
  extra = [],
}: {
  pendingDraw: PendingDraw | null;
  extra?: PaletteTileDef[];
}) {
  const markers = useLogoMarkerTiles(true);
  const tiles = [
    tileById('logo:pen')!,
    tileById('tools:pencil')!,
    ...markers,
    ...extra,
  ] as PaletteTileDef[];
  return <PaletteLogoTab tiles={tiles} actions={actions} pendingDraw={pendingDraw} />;
}

function show(
  ctx: ReturnType<typeof editor>,
  pendingDraw: PendingDraw | null = null,
  extra: PaletteTileDef[] = [],
) {
  const wrap = ({ children }: { children: ReactNode }) => (
    <EditorContext.Provider value={ctx as never}>{children}</EditorContext.Provider>
  );
  render(<Tab pendingDraw={pendingDraw} extra={extra} />, { wrapper: wrap });
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
      penId: 'second',
      once: true,
    });
  });

  it('reads only the marker in hand as held, even beside one set alike', () => {
    const alike = editor();
    (alike.markerPens.prefs.pens as { colour: string | null }[])[2]!.colour = 'blue';
    show(alike, {
      type: 'freehand',
      variant: 'whiteboard',
      colour: 'blue',
      width: 4,
      penId: 'third',
      once: true,
    });
    expect(screen.getByRole('option', { name: 'Marker 3' }).getAttribute('aria-pressed')).toBe(
      'true',
    );
    expect(screen.getByRole('option', { name: 'Marker 2' }).getAttribute('aria-pressed')).toBe(
      'false',
    );
    (alike.markerPens.prefs.pens as { colour: string | null }[])[2]!.colour = 'red';
  });

  it('opens a held marker’s colour and width on a second press', () => {
    show(editor(), {
      type: 'freehand',
      variant: 'whiteboard',
      colour: 'blue',
      width: 4,
      once: true,
    });
    const row = screen.getByRole('option', { name: 'Marker 2' });
    expect(row.getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(row);
    expect(row.getAttribute('aria-expanded')).toBe('true');
  });

  // docs/specs/023-draw-mode/drawing-tools.md "The Fill tool".
  it('offers the Fill tool after the markers and picks it up in the soft Blue until a colour is picked', () => {
    const ctx = editor();
    show(ctx);
    const fill = screen.getByRole('option', { name: 'Fill' });
    expect(fill.querySelector('[data-fill-bar]')!.getAttribute('stroke')).toBe(
      defaultFill('light'),
    );
    fireEvent.click(fill);
    expect(ctx.beginDraw).toHaveBeenCalledWith({ type: 'fill', fill: defaultFill('light') });
    expect(track).toHaveBeenCalledWith('Draw', 'Toggled', 'Fill');
  });

  it('opens a held Fill tool’s colour picker, whose pick is remembered and re-arms it', () => {
    const ctx = editor();
    show(ctx, { type: 'fill', fill: '#dbeafe' });
    const fill = screen.getByRole('option', { name: 'Fill' });
    expect(fill.getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(fill);
    expect(fill.getAttribute('aria-expanded')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: 'No fill' }));
    expect(localStorage.getItem(FILL_CHOICE_KEY)).toBe('transparent');
    expect(ctx.beginDraw).toHaveBeenLastCalledWith({ type: 'fill', fill: 'transparent' });
    expect(track).toHaveBeenCalledWith('Draw', 'Changed', 'FillColour');
    // The same colour again changes nothing.
    vi.mocked(track).mockClear();
    fireEvent.click(screen.getByRole('button', { name: 'No fill' }));
    expect(track).not.toHaveBeenCalled();
    // No fill shows on the bucket as the no-colour chip.
    expect(fill.querySelector('[data-fill-bar]')!.tagName.toLowerCase()).toBe('rect');
    fireEvent.click(fill);
    expect(fill.getAttribute('aria-expanded')).toBe('false');
  });

  it('starts from a colour this browser kept, without picking the bucket up on a change', () => {
    localStorage.setItem(FILL_CHOICE_KEY, '#123456');
    const ctx = editor();
    show(ctx);
    fireEvent.click(screen.getByRole('option', { name: 'Fill' }));
    expect(ctx.beginDraw).toHaveBeenCalledWith({ type: 'fill', fill: '#123456' });
  });

  it('has no Fill row outside an editor, and its tile picks up only where the editor can', () => {
    render(<Tab pendingDraw={null} />);
    expect(screen.queryByRole('option', { name: 'Fill' })).toBeNull();
    expect(tileHandler(fillToolTile('#123456'), actions, null)()).toBeUndefined();
    const beginFill = vi.fn();
    tileHandler(fillToolTile('#123456'), { ...actions, beginFill }, null)();
    expect(beginFill).toHaveBeenCalledWith('#123456');
  });

  it('draws the catalogue’s Fill tile once, as its own row', () => {
    show(editor(), null, [fillToolTile('#123456')]);
    expect(screen.getAllByRole('option', { name: 'Fill' })).toHaveLength(1);
  });
});
