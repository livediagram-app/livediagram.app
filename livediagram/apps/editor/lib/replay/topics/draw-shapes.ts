import { createSticky, type ShapeElement, type StickyElement } from '@livediagram/document';
import { deriveNewBoxedColours } from '@/lib/themes';
import { boardShape } from '@/lib/whiteboard-tool';
import { between, frameOf, lerp, typedAt, type Chapter, type Point, type Topic } from '../topic';
import { boxedShape } from './shared';
import { dockItem } from './draw-shared';

// Shapes and Stickies (docs/specs/007-editor/watch-it-built.md "The curriculum", Draw; docs/specs/023-draw-mode/
// draw-mode.md "Shapes", "Shape slots"): Shapes, Sticky. Example opens the dock's real Shapes flyout, types into its
// search, presses a result and draws it on the board. The shape armed shows on the dock from the replay's `dock`; the
// pick is never made, so nothing is armed or counted towards the person's slots.

export const CHAPTERS: readonly Chapter[] = [
  {
    id: 'shapes-rectangle',
    name: 'Shapes',
    shortName: 'Shapes',
    ms: 9000,
    say: 'Open Shapes on the dock, pick one and drag it out on the board.',
    sayTouch: 'Tap Shapes on the dock, pick one and drag it out on the board.',
  },
  {
    id: 'shapes-sticky',
    name: 'Sticky',
    shortName: 'Sticky',
    ms: 9000,
    say: 'Find the sticky note in Shapes, click the board and type.',
    sayTouch: 'Find the sticky note in Shapes, tap the board and type.',
  },
];

// The Shapes flyout's search field and a result by its shape key (ShapesFlyout.tsx: the field inside the flyout,
// `data-shape-option` on each entry).
export const SEARCH = '#whiteboard-flyout-shapes input';
const option = (key: string) =>
  ({ kind: 'find', selector: `#whiteboard-flyout-shapes [data-shape-option="${key}"]` }) as const;

export const RECT = {
  open: 1000,
  type: [1600, 2600],
  pick: 3200,
  close: 3500,
  drag: [4400, 6400],
  rest: 7800,
} as const;
export const STICKY = {
  open: 800,
  type: [1300, 2200],
  pick: 2800,
  close: 3100,
  place: 4200,
  write: [4800, 7000],
  rest: 8000,
} as const;
export const RECT_QUERY = 'rectangle';
export const STICKY_QUERY = 'sticky';
export const STICKY_TEXT = 'Ideas!';

export type ShapesLayout = {
  readonly rectangle: ShapeElement;
  readonly sticky: StickyElement;
};

const IDS = { rectangle: 'wib-shapes-rectangle', sticky: 'wib-shapes-sticky' } as const;

export const shapes: Topic<ShapesLayout> = {
  id: 'draw-shapes',
  chapters: CHAPTERS,

  layout({ centre: c, tab }) {
    // A dock rectangle as Draw writes it (lib/whiteboard-tool.ts boardShape): an Ink outline by name, no fill.
    const rectangle = boardShape(boxedShape(tab, IDS.rectangle, '', 150, 90, c.x - 110, c.y - 150));
    // A sticky note dropped with a click: centred on it at the note's own size, in the tab's colours
    // (lib/draw-commit.ts buildDrawnBoxed).
    const base = createSticky(0, 0);
    const colours = deriveNewBoxedColours(base, {
      backgroundColor: tab.backgroundColor,
      patternColor: tab.patternColor,
      theme: tab.theme,
    });
    const sticky: StickyElement = {
      ...base,
      ...colours,
      ...(tab.defaultTextSize ? { textSize: tab.defaultTextSize } : {}),
      id: IDS.sticky,
      x: c.x + 85 - base.width / 2,
      y: c.y - 70 - base.height / 2,
    };
    return { rectangle, sticky };
  },

  frame(index, ms, layout) {
    const { rectangle, sticky } = layout;
    if (index <= 0) {
      const open = ms >= RECT.open && ms < RECT.close ? ['dock-shapes'] : [];
      const typed =
        ms >= RECT.type[0] && ms < RECT.close
          ? { selector: SEARCH, text: typedAt(RECT_QUERY, ms, RECT.type[0], RECT.type[1]) }
          : null;
      const armed = ms >= RECT.pick && ms < RECT.drag[1];
      const dock = armed ? ({ tool: 'shape', armedShape: 'rectangle' } as const) : undefined;
      if (ms < RECT.drag[0]) return frameOf([], { open, typed, dock });
      // Dragged out from its top-left corner, the box following the cursor.
      const dragged = dragOut(rectangle, between(ms, RECT.drag[0], RECT.drag[1]));
      const hold =
        ms < RECT.drag[1] ? { x: dragged.x + dragged.width, y: dragged.y + dragged.height } : null;
      return frameOf([dragged], {
        dock,
        hold,
        // A shape just drawn stays selected (draw-mode.md "Keyboard shortcuts").
        selectedId: ms >= RECT.drag[1] ? rectangle.id : null,
      });
    }
    const open = ms >= STICKY.open && ms < STICKY.close ? ['dock-shapes'] : [];
    const typed =
      ms >= STICKY.type[0] && ms < STICKY.close
        ? { selector: SEARCH, text: typedAt(STICKY_QUERY, ms, STICKY.type[0], STICKY.type[1]) }
        : null;
    const dock =
      ms >= STICKY.pick && ms < STICKY.place
        ? ({ tool: 'shape', armedShape: 'sticky' } as const)
        : undefined;
    if (ms < STICKY.place) return frameOf([rectangle], { open, typed, dock });
    // Placed from the dock, it opens for typing at once (draw-mode.md "What a whiteboard shows").
    return frameOf(
      [rectangle, { ...sticky, label: typedAt(STICKY_TEXT, ms, STICKY.write[0], STICKY.write[1]) }],
      { selectedId: sticky.id, typing: ms < STICKY.write[1] + 500 },
    );
  },

  plan(index, layout) {
    const { rectangle, sticky } = layout;
    if (index <= 0) {
      const corner = (p: number): Point => ({
        x: rectangle.x + rectangle.width * p,
        y: rectangle.y + rectangle.height * p,
      });
      return [
        { at: RECT.open, to: dockItem('shapes'), press: true },
        { at: RECT.pick, to: option('rectangle'), press: true },
        { at: RECT.drag[0], to: { kind: 'canvas', ...corner(0) }, press: true },
        {
          at: RECT.rest,
          to: {
            kind: 'canvas',
            x: rectangle.x + rectangle.width + 30,
            y: rectangle.y + rectangle.height + 40,
          },
        },
      ];
    }
    return [
      { at: STICKY.open, to: dockItem('shapes'), press: true },
      { at: STICKY.pick, to: option('sticky'), press: true },
      // The click that drops it: where its middle lands.
      {
        at: STICKY.place,
        to: { kind: 'canvas', x: sticky.x + sticky.width / 2, y: sticky.y + sticky.height / 2 },
        press: true,
      },
      {
        at: STICKY.rest,
        to: { kind: 'canvas', x: sticky.x + sticky.width + 10, y: sticky.y + sticky.height + 10 },
      },
    ];
  },
};

// The shape as dragged out so far: from its top-left corner to `p` of its size (at least a sliver, as the preview is).
function dragOut(el: ShapeElement, p: number): ShapeElement {
  return {
    ...el,
    width: Math.max(4, lerp(0, el.width, p)),
    height: Math.max(4, lerp(0, el.height, p)),
  };
}
