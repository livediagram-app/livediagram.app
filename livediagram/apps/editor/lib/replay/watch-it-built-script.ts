import type { ArrowElement, Element, ShapeElement } from '@livediagram/document';

// Watch It Built's script (docs/specs/007-editor/watch-it-built.md "The replay"): four chapters, and for any moment in
// one of them, what the demo looks like and where Example is heading. Pure: the host's clock asks, nothing is replayed,
// so pausing, a chapter press and reduced motion's Next are only a different moment.

export type ChapterId = 'add' | 'connect' | 'label' | 'style';

export type Chapter = {
  readonly id: ChapterId;
  readonly name: string;
  // Shortened for a phone's player.
  readonly shortName: string;
  readonly ms: number;
  readonly say: string;
  readonly sayTouch: string;
};

// The ids are read by the telemetry dashboard (computed-emitters.ts TOUR_STEP_SOURCE) as `TourStep<Id>`.
export const CHAPTERS: readonly Chapter[] = [
  {
    id: 'add',
    name: 'Add',
    shortName: 'Add',
    ms: 8000,
    say: 'Pick a shape from the palette and drop it on the canvas.',
    sayTouch: 'Tap a shape in the palette and drag it onto the canvas.',
  },
  {
    id: 'connect',
    name: 'Connect',
    shortName: 'Join',
    ms: 6000,
    say: 'Drag from the ring round a shape onto another to join them.',
    sayTouch: 'Tap a shape, then drag from its ring onto another to join them.',
  },
  {
    id: 'label',
    name: 'Label',
    shortName: 'Label',
    ms: 5000,
    say: 'Double-click a shape to name it.',
    sayTouch: 'Double-tap a shape to name it.',
  },
  {
    id: 'style',
    name: 'Style',
    shortName: 'Style',
    ms: 6000,
    say: 'Right-click anything for its colours and options.',
    sayTouch: 'Long-press anything for its colours and options.',
  },
];

export const DEMO_IDS = { a: 'wib-a', b: 'wib-b', arrow: 'wib-arrow' } as const;

const B_LABEL = 'Check stock';

/** What the host works the demo out from: the two finished shapes and arrow, and where the palette's tile was. */
export type ReplayLayout = {
  // Shape A ("Order received") and shape B as they end the Add chapter (B still unlabelled).
  readonly a: ShapeElement;
  readonly b: ShapeElement;
  // The pinned arrow from A to B as the Connect chapter leaves it.
  readonly arrow: ArrowElement;
  // B with the Success preset the Style chapter picks (its label is the script's).
  readonly green: ShapeElement;
  // The palette tile's centre in canvas coordinates, where a dragged shape starts. Null before it was seen.
  readonly tile: { readonly x: number; readonly y: number } | null;
};

export type DemoFrame = {
  readonly elements: readonly Element[];
  readonly selectedId: string | null;
  // Whether the element menu is open on B (the host places it beside B).
  readonly menuOnB: boolean;
  // How far into the menu Example has gone: 0 the menu, 1 its Style flyout, 2 the flyout's Presets open.
  readonly menuDepth: 0 | 1 | 2;
  readonly paletteOpen: boolean;
  // Whether a caret shows at the end of B's label (the Label chapter's typing).
  readonly typing: boolean;
};

const ease = (p: number) => (p < 0.5 ? 4 * p * p * p : 1 - (-2 * p + 2) ** 3 / 2);
const between = (ms: number, from: number, to: number) =>
  ms <= from ? 0 : ms >= to ? 1 : ease((ms - from) / (to - from));
const lerp = (a: number, b: number, p: number) => a + (b - a) * p;

// A shape carried from the palette tile to where it lands, its centre under the cursor.
function carried(el: ShapeElement, tile: ReplayLayout['tile'], p: number): ShapeElement {
  if (!tile || p >= 1) return el;
  const startX = tile.x - el.width / 2;
  const startY = tile.y - el.height / 2;
  return { ...el, x: lerp(startX, el.x, p), y: lerp(startY, el.y, p) };
}

// The Add chapter's beats, in ms: open the palette, carry A, open it again, carry B.
export const ADD = {
  open1: 1200,
  drag1: [2400, 4000],
  open2: 4400,
  drag2: [5400, 7000],
} as const;
export const CONNECT = { select: 900, drag: [1800, 3800] } as const;
export const LABEL = { select: 1000, type: [1300, 3800] } as const;
export const STYLE = { menu: 800, flyout: 1700, presets: 2600, pick: 3600, close: 4400 } as const;

/** The demo at `ms` into chapter `index`: every chapter before it finished, this one part played. */
export function demoAt(index: number, ms: number, layout: ReplayLayout): DemoFrame {
  const { a, b, arrow, green, tile } = layout;
  const id = CHAPTERS[Math.max(0, Math.min(index, CHAPTERS.length - 1))]!.id;

  const blank: ShapeElement = { ...b, label: '' };
  const labelled: ShapeElement = { ...b, label: B_LABEL };
  const styled: ShapeElement = { ...green, label: B_LABEL };
  const frame = (
    elements: Element[],
    rest: Partial<Omit<DemoFrame, 'elements'>> = {},
  ): DemoFrame => ({
    elements,
    selectedId: null,
    menuOnB: false,
    menuDepth: 0,
    paletteOpen: false,
    typing: false,
    ...rest,
  });

  if (id === 'add') {
    // Before it is carried, A waits unseen where it will land: the host measures it there to map the screen onto the
    // canvas, so a carried shape stays under the cursor at any zoom.
    const els: Element[] = ms < ADD.drag1[0] ? [{ ...a, opacity: 0 }] : [];
    if (ms >= ADD.drag1[0]) els.push(carried(a, tile, between(ms, ADD.drag1[0], ADD.drag1[1])));
    if (ms >= ADD.drag2[0]) els.push(carried(blank, tile, between(ms, ADD.drag2[0], ADD.drag2[1])));
    const paletteOpen =
      (ms >= ADD.open1 && ms < ADD.drag1[0] + 200) || (ms >= ADD.open2 && ms < ADD.drag2[0] + 200);
    return frame(els, { paletteOpen });
  }
  if (id === 'connect') {
    if (ms < CONNECT.drag[0])
      return frame([a, blank], { selectedId: ms >= CONNECT.select ? a.id : null });
    if (ms < CONNECT.drag[1]) {
      // The arrow is dragged from A's bottom towards B's top, its loose end under the cursor.
      const p = between(ms, CONNECT.drag[0], CONNECT.drag[1]);
      const from = { x: a.x + a.width / 2, y: a.y + a.height };
      const to = { x: b.x + b.width / 2, y: b.y };
      const loose: ArrowElement = {
        ...arrow,
        to: { kind: 'free', x: lerp(from.x, to.x, p), y: lerp(from.y, to.y, p) },
      };
      return frame([a, blank, loose], { selectedId: a.id });
    }
    return frame([a, blank, arrow], { selectedId: ms < CONNECT.drag[1] + 600 ? arrow.id : null });
  }
  const base: Element[] = [a, arrow];
  if (id === 'label') {
    const p = (ms - LABEL.type[0]) / (LABEL.type[1] - LABEL.type[0]);
    const shown = B_LABEL.slice(
      0,
      Math.max(0, Math.min(B_LABEL.length, Math.ceil(p * B_LABEL.length))),
    );
    const typing = ms >= LABEL.select && ms < LABEL.type[1] + 500;
    return frame([...base, { ...b, label: shown }], {
      selectedId: ms >= LABEL.select ? b.id : null,
      typing,
    });
  }
  // Style.
  const picked = ms >= STYLE.pick;
  return frame([...base, picked ? styled : labelled], {
    selectedId: ms >= STYLE.menu ? b.id : null,
    menuOnB: ms >= STYLE.menu && ms < STYLE.close,
    menuDepth: ms >= STYLE.presets ? 2 : ms >= STYLE.flyout ? 1 : 0,
  });
}

/** Where Example points, as something the host finds on screen. */
export type CursorTarget =
  | { readonly kind: 'category' }
  | { readonly kind: 'tile' }
  | { readonly kind: 'element'; readonly id: string; readonly at?: 'centre' | 'bottom' | 'top' }
  // A row or tile in the element menu or its flyout, by the words on it.
  | { readonly kind: 'menu'; readonly name: string };

export type Waypoint = {
  // When Example arrives here, in ms into the chapter.
  readonly at: number;
  readonly to: CursorTarget;
  // A press shows a small ring under Example as it arrives.
  readonly press?: boolean;
};

/** Example's path through a chapter: it travels to each waypoint, arriving at its `at`. */
export function cursorPlan(index: number): readonly Waypoint[] {
  const id = CHAPTERS[index]?.id ?? 'add';
  const A = DEMO_IDS.a;
  const B = DEMO_IDS.b;
  switch (id) {
    case 'add':
      return [
        { at: ADD.open1, to: { kind: 'category' }, press: true },
        { at: ADD.drag1[0], to: { kind: 'tile' }, press: true },
        { at: ADD.drag1[1], to: { kind: 'element', id: A } },
        { at: ADD.open2, to: { kind: 'category' }, press: true },
        { at: ADD.drag2[0], to: { kind: 'tile' }, press: true },
        { at: ADD.drag2[1], to: { kind: 'element', id: B } },
      ];
    case 'connect':
      return [
        { at: CONNECT.select, to: { kind: 'element', id: A }, press: true },
        { at: CONNECT.drag[0], to: { kind: 'element', id: A, at: 'bottom' }, press: true },
        { at: CONNECT.drag[1], to: { kind: 'element', id: B, at: 'top' } },
      ];
    case 'label':
      return [{ at: LABEL.select, to: { kind: 'element', id: B }, press: true }];
    case 'style':
      return [
        { at: STYLE.menu, to: { kind: 'element', id: B }, press: true },
        { at: STYLE.flyout, to: { kind: 'menu', name: 'Style' }, press: true },
        { at: STYLE.presets, to: { kind: 'menu', name: 'Presets' }, press: true },
        { at: STYLE.pick, to: { kind: 'menu', name: 'Success' }, press: true },
        { at: STYLE.close + 800, to: { kind: 'element', id: B } },
      ];
  }
}

/** The whole replay's length, for the player's progress. */
export const TOTAL_MS = CHAPTERS.reduce((sum, c) => sum + c.ms, 0);
