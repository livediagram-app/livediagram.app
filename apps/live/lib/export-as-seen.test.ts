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
import { renderTabToSvg } from './export-tab';

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
  it('draws a tab in Draw mode on its board, its unpainted elements in its ink', () => {
    const tab = { id: 't', name: 'Board', opensIn: 'draw', elements: [path] } as Tab;
    const seen = tabAsSeen(tab, 'draw', 'dark');
    expect(seen.backgroundColor).toBe(WHITEBOARD_BOARD.dark);
    expect(seen.elements[0]).toMatchObject({
      strokeColor: WHITEBOARD_INK.dark,
      fillColor: 'transparent',
    });
    expect(tabAsSeen(tab, 'draw', 'light').elements[0]!.strokeColor).toBe(WHITEBOARD_INK.light);
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
    const tab = { id: 't', name: 'Board', opensIn: 'draw', elements: [stroke] } as Tab;
    expect(tabAsSeen(tab, 'draw', 'light').elements[0]!.strokeColor).toBe(
      penColourHex('red', 'light'),
    );
    expect(tabAsSeen(tab, 'draw', 'dark').elements[0]!.strokeColor).toBe(
      penColourHex('red', 'dark'),
    );
  });

  it('exports a named text colour and a named path colour in their version for the appearance', () => {
    // docs/specs/023-whiteboard/whiteboard.md "Imported and pasted content": imported text and paths
    // keep their stock colours by name, and every export draws them as the board does.
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
    const tab = { id: 't', name: 'Board', opensIn: 'draw', elements: [text, named] } as Tab;
    for (const board of ['light', 'dark'] as const) {
      const seen = tabAsSeen(tab, 'draw', board);
      expect(seen.elements[0]!.textColor).toBe(penColourHex('green', board));
      expect(seen.elements[1]!.strokeColor).toBe(penColourHex('violet', board));
      const svg = renderTabToSvg(seen);
      expect(svg).toContain(penColourHex('green', board));
      expect(svg).toContain(penColourHex('violet', board));
    }
  });

  it('leaves the elements as they are in Diagram mode, whatever the tab opens in', () => {
    const square = createShape('square', 0, 0);
    const tab = { id: 't', name: 'Tab', opensIn: 'draw', elements: [square] } as Tab;
    expect(tabAsSeen(tab, 'diagram', 'dark').elements[0]).toBe(square);
  });
});
