import { describe, expect, it } from 'vitest';
import {
  DARK_CANVAS_BACKGROUND_COLOR,
  DEFAULT_BACKGROUND_COLOR,
  PEN_INK,
  createFreehand,
  createPath,
  createShape,
  penColourHex,
  type Tab,
} from '@livediagram/document';
import { tabAsSeen } from './export-as-seen';
import { renderTabToSvg } from './export-tab';

// Export what the author is looking at (docs/specs/007-editor/editor-modes.md "One look"): the
// tab's Diagram backdrop for the export's appearance, whoever exports and in whichever mode, and
// every stock colour stored by name in its version for that canvas.
const path = createPath(
  [
    { x: 0, y: 0, mode: 'corner' },
    { x: 10, y: 10, mode: 'corner' },
  ],
  false,
);

describe('tabAsSeen', () => {
  it('paints the tab’s own backdrop, with its stored pattern, for the appearance', () => {
    const tab = {
      id: 't',
      name: 'Board',
      opensIn: 'draw',
      backgroundPattern: 'blank',
      elements: [path],
    } as Tab;
    expect(tabAsSeen(tab, 'dark')).toMatchObject({
      backgroundColor: DARK_CANVAS_BACKGROUND_COLOR,
      backgroundPattern: 'blank',
    });
    expect(tabAsSeen(tab, 'light').backgroundColor).toBe(DEFAULT_BACKGROUND_COLOR);
  });

  it('keeps a themed tab’s canvas', () => {
    const tab = { id: 't', name: 'Tab', theme: 'slate', backgroundColor: '#fdf2f8' } as Tab;
    expect(tabAsSeen({ ...tab, elements: [] }, 'dark').backgroundColor).toBe('#fdf2f8');
  });

  it('exports a named marker colour in its version for the appearance, on any tab', () => {
    const stroke = {
      ...createFreehand(
        [
          { x: 0, y: 0 },
          { x: 9, y: 9 },
        ],
        false,
      ),
      penWidth: 1.5,
      penColour: 'red' as const,
    };
    const tab = { id: 't', name: 'Tab', elements: [stroke] } as Tab;
    expect(tabAsSeen(tab, 'light').elements[0]!.strokeColor).toBe(penColourHex('red', 'light'));
    expect(tabAsSeen(tab, 'dark').elements[0]!.strokeColor).toBe(penColourHex('red', 'dark'));
  });

  it('exports named text, path and Ink colours in their version for the appearance', () => {
    const text = {
      id: 'x',
      type: 'text' as const,
      x: 0,
      y: 0,
      width: 80,
      height: 24,
      label: 'Hello',
      penTextColour: 'green' as const,
    };
    const named = { ...path, penColour: 'violet' as const };
    const inked = { ...createShape('square', 40, 0), penColour: 'ink' as const };
    const tab = { id: 't', name: 'Tab', elements: [text, named, inked] } as Tab;
    for (const board of ['light', 'dark'] as const) {
      const seen = tabAsSeen(tab, board);
      expect(seen.elements[0]!.textColor).toBe(penColourHex('green', board));
      expect(seen.elements[1]!.strokeColor).toBe(penColourHex('violet', board));
      expect(seen.elements[2]!.strokeColor).toBe(PEN_INK[board]);
      const svg = renderTabToSvg(seen);
      expect(svg).toContain(penColourHex('green', board));
      expect(svg).toContain(penColourHex('violet', board));
    }
  });

  it('leaves an element with no stock colour as it is', () => {
    const square = createShape('square', 0, 0);
    const tab = { id: 't', name: 'Tab', elements: [square] } as Tab;
    expect(tabAsSeen(tab, 'dark').elements[0]).toBe(square);
  });
});
