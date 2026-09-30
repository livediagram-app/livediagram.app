import { describe, expect, it } from 'vitest';
import {
  WHITEBOARD_BOARD,
  WHITEBOARD_INK,
  createFreehand,
  createPath,
  createShape,
  penColourHex,
  type Tab,
} from '@livediagram/document';
import { tabAsSeen } from './export-as-seen';

// Export what the author is looking at (docs/specs/023-whiteboard/path-tool.md "Export, sharing and
// import": paths export exactly as on the canvas): a whiteboard's unpainted elements take its ink.
const path = createPath(
  [
    { x: 0, y: 0, mode: 'corner' },
    { x: 10, y: 10, mode: 'corner' },
  ],
  false,
);

describe('tabAsSeen', () => {
  it('draws a whiteboard on its board, its unpainted elements in its ink', () => {
    const tab = { id: 't', name: 'Board', kind: 'whiteboard', elements: [path] } as Tab;
    const seen = tabAsSeen(tab, 'dark');
    expect(seen.backgroundColor).toBe(WHITEBOARD_BOARD.dark);
    expect(seen.elements[0]).toMatchObject({
      strokeColor: WHITEBOARD_INK.dark,
      fillColor: 'transparent',
    });
    expect(tabAsSeen(tab, 'light').elements[0]!.strokeColor).toBe(WHITEBOARD_INK.light);
  });

  it('exports a named marker colour in its version for the appearance', () => {
    // docs/specs/023-whiteboard/whiteboard.md "The colour picker": exports adapt as the board does.
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
    const tab = { id: 't', name: 'Board', kind: 'whiteboard', elements: [stroke] } as Tab;
    expect(tabAsSeen(tab, 'light').elements[0]!.strokeColor).toBe(penColourHex('red', 'light'));
    expect(tabAsSeen(tab, 'dark').elements[0]!.strokeColor).toBe(penColourHex('red', 'dark'));
  });

  it('leaves a diagram tab’s elements as they are', () => {
    const square = createShape('square', 0, 0);
    const tab = { id: 't', name: 'Tab', kind: 'diagram', elements: [square] } as Tab;
    expect(tabAsSeen(tab, 'dark').elements[0]).toBe(square);
  });
});
