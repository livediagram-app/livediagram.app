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
  pickHighlighter: noop,
  beginPolygon: noop,
  beginPath: noop,
  pickMarker: noop,
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
  it('offers no lanes switch — an event-storming board is always on lanes', () => {
    render(<EventStormingBoardRows controls={{}} />);
    expect(screen.queryByRole('switch', { name: /timeline lanes/i })).toBeNull();
  });

  it('offers the photo row when the deployment can read a photo', () => {
    const onImportPhoto = vi.fn();
    render(<EventStormingBoardRows controls={{ onImportPhoto }} />);
    fireEvent.click(screen.getByRole('button', { name: /add from photo/i }));
    expect(onImportPhoto).toHaveBeenCalledTimes(1);
  });
});

describe('the Event Storming palette category', () => {
  it('puts the board rows above the notation', () => {
    render(<PaletteEventStormingTab pendingDraw={null} actions={actions} board={{}} />);
    // The notation is all there, with no board switch above it any more.
    expect(screen.queryByRole('switch', { name: /timeline lanes/i })).toBeNull();
    expect(screen.getByRole('option', { name: /add domain event note/i })).toBeTruthy();
  });

  it('still shows the notation when the category is browsed off an ES board', () => {
    render(<PaletteEventStormingTab pendingDraw={null} actions={actions} />);
    expect(screen.getByRole('option', { name: /add domain event note/i })).toBeTruthy();
  });
});

describe('EventStormingBoardRows disabled photo import', () => {
  it('says why it is disabled in the row itself, not in a hover', () => {
    render(
      <EventStormingBoardRows
        controls={{
          onImportPhoto: noop,
          photoDisabled: true,
          photoDisabledReason: 'Finish the open photo first',
        }}
      />,
    );
    const row = screen.getByRole('button', { name: /Add from photo/ });
    expect(row.textContent).toContain('Finish the open photo first');
    expect(row.hasAttribute('title')).toBe(false);
  });

  it('describes the import while it is available', () => {
    render(<EventStormingBoardRows controls={{ onImportPhoto: noop }} />);
    expect(screen.getByRole('button', { name: /Add from photo/ }).textContent).toContain(
      'Read the stickies off a photo of the wall',
    );
  });
});
