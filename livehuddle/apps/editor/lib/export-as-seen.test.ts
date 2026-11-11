import { describe, expect, it } from 'vitest';
import {
  PEN_INK,
  createShape,
  createSticky,
  penColourHex,
  type ShapeElement,
  type Tab,
} from '@livehuddle/document';
import { canvasSurface } from '@livehuddle/document';
import { tabAsSeen } from './export-as-seen';
import { renderTabToSvg } from './export-tab';

// Export what the author is looking at (docs/specs/007-editor/editor-modes.md "One look"): the
// tab's Diagram backdrop for the export's appearance, whoever exports and in whichever mode, and
// every stock colour stored by name in its version for that canvas.
const strokeOf = (tab: Tab, i: number) => (tab.elements[i] as ShapeElement).strokeColor;

describe('tabAsSeen', () => {
  it('draws a themed tab’s canvas in the export’s half, and a picked canvas as it is', () => {
    const tab = { id: 't', name: 'Tab', theme: 'slate', backgroundColor: '#fdf2f8' } as Tab;
    expect(tabAsSeen({ ...tab, elements: [] }, 'light').backgroundColor).toBe('#fdf2f8');
    expect(canvasSurface(tabAsSeen({ ...tab, elements: [] }, 'dark').backgroundColor)).toBe('dark');
    const picked = { ...tab, backgroundColor: '#123456' };
    expect(tabAsSeen({ ...picked, elements: [] }, 'dark').backgroundColor).toBe('#123456');
  });

  it('exports a named line colour in its version for the appearance, on any tab', () => {
    const named = { ...createSticky(0, 0), penColour: 'red' as const };
    const tab = { id: 't', name: 'Tab', elements: [named] } as Tab;
    expect(strokeOf(tabAsSeen(tab, 'light'), 0)).toBe(penColourHex('red', 'light'));
    expect(strokeOf(tabAsSeen(tab, 'dark'), 0)).toBe(penColourHex('red', 'dark'));
  });

  it('exports named text, line and Ink colours in their version for the appearance', () => {
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
    const named = { ...createShape('room', 0, 40), penColour: 'violet' as const };
    const inked = { ...createSticky(40, 0), penColour: 'ink' as const };
    const tab = { id: 't', name: 'Tab', elements: [text, named, inked] } as Tab;
    for (const board of ['light', 'dark'] as const) {
      const seen = tabAsSeen(tab, board);
      expect((seen.elements[0] as { textColor?: string }).textColor).toBe(
        penColourHex('green', board),
      );
      expect(strokeOf(seen, 1)).toBe(penColourHex('violet', board));
      expect(strokeOf(seen, 2)).toBe(PEN_INK[board]);
      const svg = renderTabToSvg(seen);
      expect(svg).toContain(penColourHex('green', board));
      expect(svg).toContain(penColourHex('violet', board));
    }
  });

  it('leaves an element with no stock colour as it is', () => {
    const square = createSticky(0, 0);
    const tab = { id: 't', name: 'Tab', elements: [square] } as Tab;
    expect(tabAsSeen(tab, 'dark').elements[0]).toBe(square);
  });
});
