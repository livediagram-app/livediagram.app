import type { ReplayDock } from '../topic';
import { frameOf, type Chapter, type Point, type Topic } from '../topic';
import { dockItem, inkAt, penInHand, THICK_PX, type Pen, type Stroke } from './draw-shared';

// Pens and Colours (docs/specs/007-editor/watch-it-built.md "The curriculum", Draw; docs/specs/023-draw-mode/
// draw-mode.md "Pens"): Open, Colour, Draw. Example picks up Marker 2 and presses it again: its real flyout opens (the
// player presses the button only while it reads as in hand, so it never picks the pen up for real). The colour and
// width it picks are shown on the dock from the replay's `dock`, never stored, and the stroke after is drawn in them.

export const CHAPTERS: readonly Chapter[] = [
  {
    id: 'pens-open',
    name: 'Open',
    shortName: 'Open',
    ms: 6000,
    say: 'Click the marker in hand again for its colours and widths.',
    sayTouch: 'Tap the marker in hand again for its colours and widths.',
  },
  {
    id: 'pens-colour',
    name: 'Colour',
    shortName: 'Colour',
    ms: 6000,
    say: 'Pick a colour and a width; the marker keeps them.',
    sayTouch: 'Tap a colour and a width; the marker keeps them.',
  },
  {
    id: 'pens-draw',
    name: 'Draw',
    shortName: 'Draw',
    ms: 6000,
    say: 'Draw, and the stroke wears the new pen.',
    sayTouch: 'Draw, and the stroke wears the new pen.',
  },
];

// Marker 2: the main marker always stays the ink (lib/whiteboard-prefs.ts penAdjustsColour), so its flyout has no
// colours.
export const MARKER = 'second';
// The swatch and the width picked, by their accessible names (ColourPicker.tsx's stock colours by name;
// dock-flyouts.tsx PenFlyoutBody's widths).
export const COLOUR = { name: 'green', label: 'Green' } as const;
export const WIDTH_LABEL = 'Thick';
export const OPEN = { pick: 1000, again: 2600, flyout: 2700 } as const;
export const COLOUR_BEATS = { colour: 1500, width: 3200, close: 4800 } as const;
export const DRAW = { stroke: [600, 4200], rest: 5200 } as const;

export const NEW_PEN: Pen = { colour: COLOUR.name, width: THICK_PX };

export type PensLayout = { readonly stroke: Stroke; readonly rest: Point };

// The marker in hand, as far as the Colour chapter has changed it.
const dockAt = (colour: boolean, width: boolean): ReplayDock =>
  penInHand(MARKER, {
    pens: {
      [MARKER]: {
        ...(colour ? { colour: NEW_PEN.colour } : {}),
        ...(width ? { width: NEW_PEN.width } : {}),
      },
    },
  });

const swatch = {
  kind: 'find',
  selector: `#whiteboard-flyout-${MARKER} button[data-colour-key][aria-label="${COLOUR.label}"]`,
} as const;
const widthOption = {
  kind: 'find',
  selector: `#whiteboard-flyout-${MARKER} button[aria-label="${WIDTH_LABEL}"]`,
} as const;

export const pens: Topic<PensLayout> = {
  id: 'draw-pens',
  chapters: CHAPTERS,

  layout({ centre: c }) {
    // A loop-the-loop across the board, as a person tries a new pen.
    const points = Array.from({ length: 64 }, (_, i) => {
      const t = i / 63;
      const a = t * Math.PI * 6;
      return { x: c.x - 150 + 300 * t + 26 * Math.cos(a), y: c.y - 110 + 34 * Math.sin(a) };
    });
    return {
      stroke: {
        id: 'wib-pens-stroke',
        points,
        from: DRAW.stroke[0],
        to: DRAW.stroke[1],
        pen: NEW_PEN,
      },
      rest: { x: c.x + 60, y: c.y - 10 },
    };
  },

  frame(index, ms, layout) {
    const id = CHAPTERS[Math.max(0, Math.min(index, CHAPTERS.length - 1))]!.id;
    if (id === 'pens-open') {
      return frameOf([], {
        dock: ms >= OPEN.pick ? dockAt(false, false) : undefined,
        open: ms >= OPEN.flyout ? ['dock-pen-second'] : [],
      });
    }
    if (id === 'pens-colour') {
      return frameOf([], {
        dock: dockAt(ms >= COLOUR_BEATS.colour, ms >= COLOUR_BEATS.width),
        open: ms < COLOUR_BEATS.close ? ['dock-pen-second'] : [],
      });
    }
    const { elements, hold } = inkAt([layout.stroke], ms);
    return frameOf(elements, { hold, dock: dockAt(true, true) });
  },

  plan(index, layout) {
    const id = CHAPTERS[index]?.id ?? 'pens-open';
    const start = { kind: 'canvas', ...layout.stroke.points[0]! } as const;
    if (id === 'pens-colour')
      return [
        { at: COLOUR_BEATS.colour, to: swatch, press: true },
        { at: COLOUR_BEATS.width, to: widthOption, press: true },
        { at: COLOUR_BEATS.close, to: dockItem(MARKER), press: true },
      ];
    if (id === 'pens-draw')
      return [
        { at: DRAW.stroke[0], to: start },
        { at: DRAW.rest, to: { kind: 'canvas', ...layout.rest } },
      ];
    return [
      { at: OPEN.pick, to: dockItem(MARKER), press: true },
      { at: OPEN.again, to: dockItem(MARKER), press: true },
    ];
  },
};
