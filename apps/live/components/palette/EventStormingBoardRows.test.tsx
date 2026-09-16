// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EventStormingBoardRows } from './EventStormingBoardRows';
import { PaletteEventStormingTab } from './palette-create-tabs';
import type { PaletteTileActions } from './PaletteTileGrid';

afterEach(cleanup);

const noop = () => {};
const actions = {
  addShape: noop,
  addText: noop,
  beginFreehand: noop,
  beginShapePen: noop,
  beginPolygon: noop,
  addArrow: noop,
  addSticky: noop,
  addTable: noop,
  addImage: noop,
  addAnnotation: noop,
  addLinkCard: noop,
  addVideo: noop,
  addSticker: noop,
  addComponent: noop,
  addIcon: noop,
  addTechIcon: noop,
  hasImage: false,
} satisfies PaletteTileActions;

describe('EventStormingBoardRows', () => {
  it('reads as one switch — label, hint and control together', () => {
    const onToggleLanes = vi.fn();
    render(
      <EventStormingBoardRows controls={{ lanesOn: false, lanesDisabled: false, onToggleLanes }} />,
    );
    const sw = screen.getByRole('switch', { name: /timeline lanes/i });
    expect(sw.getAttribute('aria-checked')).toBe('false');
    fireEvent.click(sw);
    expect(onToggleLanes).toHaveBeenCalledTimes(1);
  });

  it('shows the lanes as on when they are', () => {
    render(
      <EventStormingBoardRows
        controls={{ lanesOn: true, lanesDisabled: false, onToggleLanes: noop }}
      />,
    );
    expect(
      screen.getByRole('switch', { name: /timeline lanes/i }).getAttribute('aria-checked'),
    ).toBe('true');
  });

  it('stays visible but refuses the flip in a read-only / locked session', () => {
    const onToggleLanes = vi.fn();
    render(
      <EventStormingBoardRows controls={{ lanesOn: true, lanesDisabled: true, onToggleLanes }} />,
    );
    const sw = screen.getByRole('switch', { name: /timeline lanes/i }) as HTMLButtonElement;
    expect(sw.disabled).toBe(true);
    fireEvent.click(sw);
    expect(onToggleLanes).not.toHaveBeenCalled();
  });
});

describe('the Event Storming palette category', () => {
  it('puts the board switch above the notation', () => {
    render(
      <PaletteEventStormingTab
        pendingDraw={null}
        actions={actions}
        board={{ lanesOn: false, lanesDisabled: false, onToggleLanes: noop }}
      />,
    );
    expect(screen.getByRole('switch', { name: /timeline lanes/i })).toBeTruthy();
    // …and the notation is still all there underneath it.
    expect(screen.getByRole('option', { name: /add domain event note/i })).toBeTruthy();
  });

  it('shows no board switch when the category is browsed off an ES board', () => {
    render(<PaletteEventStormingTab pendingDraw={null} actions={actions} />);
    expect(screen.queryByRole('switch', { name: /timeline lanes/i })).toBeNull();
    expect(screen.getByRole('option', { name: /add domain event note/i })).toBeTruthy();
  });
});
