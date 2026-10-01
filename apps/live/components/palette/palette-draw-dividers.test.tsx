// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { PaletteDrawTab } from './palette-create-tabs';
import { PaletteToolRows } from './PaletteToolRows';
import { tilesInToolGroup } from './palette-tile-defs';
import type { PaletteTileActions } from './PaletteTileGrid';

// The Draw category's fixed dividers (docs/specs/008-canvas/canvas-and-palette.md "The whiteboard's
// pens in the Draw category"): after the markers, and after Polygon.

afterEach(cleanup);

const noop = () => {};
const actions = {
  addShape: noop,
  addText: noop,
  beginFreehand: noop,
  beginShapePen: noop,
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

// The row label just before each divider.
function labelsBeforeDividers(container: HTMLElement): string[] {
  return [...container.querySelectorAll('[data-palette-divider]')].map(
    (d) => (d.previousElementSibling as HTMLElement | null)?.textContent ?? '',
  );
}

describe('the Draw list', () => {
  it('draws a divider after Marker 3 and after Polygon', () => {
    const { container } = render(<PaletteDrawTab pendingDraw={null} actions={actions} />);
    const before = labelsBeforeDividers(container);
    expect(before).toHaveLength(2);
    expect(before[0]).toContain('Marker 3');
    expect(before[1]).toContain('Polygon');
  });

  it('draws none where the list is not the category in its own order', () => {
    const { container } = render(
      <PaletteToolRows tiles={tilesInToolGroup('draw')} actions={actions} pendingDraw={null} />,
    );
    expect(container.querySelectorAll('[data-palette-divider]')).toHaveLength(0);
  });
});
