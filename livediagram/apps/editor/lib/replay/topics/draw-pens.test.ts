import { describe, expect, it } from 'vitest';
import type { FreehandElement, Tab } from '@livediagram/document';
import { CHAPTERS, COLOUR_BEATS, DRAW, MARKER, NEW_PEN, OPEN, pens } from './draw-pens';

// Pens and Colours (docs/specs/023-draw-mode/draw-mode.md "Pens"). What every topic holds is in topics.test.ts.

const env = {
  centre: { x: 400, y: 300 },
  size: { width: 1440, height: 820 },
  tab: { id: 't', elements: [] } as unknown as Tab,
};
const layout = pens.layout(env);

describe('Pens and Colours', () => {
  it('plays Open, Colour, Draw', () => {
    expect(CHAPTERS.map((c) => c.id)).toEqual(['pens-open', 'pens-colour', 'pens-draw']);
  });

  it('picks Marker 2 up, then presses it again to open its flyout while it is in hand', () => {
    expect(pens.frame(0, OPEN.pick - 1, layout).dock).toBeUndefined();
    expect(pens.frame(0, OPEN.pick, layout).dock).toMatchObject({
      tool: 'pen',
      prefs: { activePenId: MARKER },
    });
    expect(pens.frame(0, OPEN.flyout - 1, layout).open).toEqual([]);
    const open = pens.frame(0, OPEN.flyout, layout);
    expect(open.open).toEqual(['dock-pen-second']);
    expect(open.dock?.tool).toBe('pen');
    const presses = pens.plan(0, layout).filter((w) => w.press);
    expect(presses.map((w) => w.at)).toEqual([OPEN.pick, OPEN.again]);
  });

  it('shows the colour, then the width, as picked, and closes the flyout by its marker', () => {
    const pen = (ms: number) => pens.frame(1, ms, layout).dock?.pens?.[MARKER];
    expect(pen(COLOUR_BEATS.colour - 1)).toEqual({});
    expect(pen(COLOUR_BEATS.colour)).toEqual({ colour: 'green' });
    expect(pen(COLOUR_BEATS.width)).toEqual({ colour: 'green', width: NEW_PEN.width });
    expect(pens.frame(1, COLOUR_BEATS.close - 1, layout).open).toEqual(['dock-pen-second']);
    expect(pens.frame(1, COLOUR_BEATS.close, layout).open).toEqual([]);
    const targets = pens.plan(1, layout).map((w) => (w.to.kind === 'find' ? w.to.selector : ''));
    expect(targets[0]).toMatch(/data-colour-key.*Green/);
    expect(targets[1]).toMatch(/aria-label="Thick"/);
  });

  it('draws the stroke in the new pen, with it still in hand', () => {
    const end = pens.frame(2, DRAW.stroke[1], layout);
    expect(end.elements[0] as FreehandElement).toMatchObject({
      type: 'freehand',
      penColour: 'green',
      penWidth: 4,
    });
    expect(end.dock?.pens?.[MARKER]).toEqual({ colour: 'green', width: 4 });
    expect(pens.frame(2, (DRAW.stroke[0] + DRAW.stroke[1]) / 2, layout).hold).not.toBeNull();
  });
});
