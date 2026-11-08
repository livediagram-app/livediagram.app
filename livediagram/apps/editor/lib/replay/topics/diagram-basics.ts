import {
  bestAnchorTowards,
  shapeColorPresets,
  type ArrowElement,
  type Element,
  type ShapeElement,
} from '@livediagram/document';
import { getTheme } from '@/lib/themes';
import { applyColorPresetToEl } from '@/lib/style-presets';
import { between, centreOf, frameOf, lerp, typedAt, type Chapter, type Topic } from '../topic';
import { boxedShape, carried, PALETTE_TILE, type Tile } from './shared';

export { carried };

// The Basics (docs/specs/007-editor/watch-it-built.md "The replay"): Add, Connect, Label, Style.

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

export type BasicsLayout = {
  // Shape A ("Order received") and shape B as they end the Add chapter (B still unlabelled).
  readonly a: ShapeElement;
  readonly b: ShapeElement;
  // The pinned arrow from A to B as the Connect chapter leaves it.
  readonly arrow: ArrowElement;
  // B with the Success preset the Style chapter picks (its label is the script's).
  readonly green: ShapeElement;
  readonly tile: Tile;
};

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

export const basics: Topic<BasicsLayout> = {
  id: 'diagram-basics',
  chapters: CHAPTERS,

  layout({ centre, tab }) {
    // Far enough apart that B's selection toolbar sits clear of A, and high enough that the menu clears the player.
    const a = boxedShape(tab, DEMO_IDS.a, 'Order received', 200, 56, centre.x, centre.y - 250);
    const b = boxedShape(tab, DEMO_IDS.b, '', 200, 64, centre.x, centre.y - 50);
    const stroke = a.strokeColor ?? getTheme(tab.theme).elementStroke ?? undefined;
    const arrow: ArrowElement = {
      id: DEMO_IDS.arrow,
      type: 'arrow',
      from: {
        kind: 'pinned',
        elementId: a.id,
        anchor: bestAnchorTowards(a, { x: b.x + b.width / 2, y: b.y }),
      },
      to: {
        kind: 'pinned',
        elementId: b.id,
        anchor: bestAnchorTowards(b, { x: a.x + a.width / 2, y: a.y + a.height }),
      },
      ...(stroke ? { strokeColor: stroke } : {}),
    };
    // The Style chapter's pick: the menu's own Success preset, as a press on it would apply it.
    const success = shapeColorPresets(getTheme(tab.theme)).find((p) => p.id === 'success');
    const green = (success ? applyColorPresetToEl(b, success) : b) as ShapeElement;
    return { a, b, arrow, green, tile: null };
  },

  // Where the palette's first tile is, for a carried shape to start from: read again until the first carry (the
  // palette can still be settling as it opens), then kept.
  measure(layout, index, ms, screen) {
    if (layout.tile && !(index === 0 && ms < ADD.drag1[0])) return null;
    const point = screen.find(PALETTE_TILE);
    if (!point) return null;
    const tile = screen.toCanvas(point);
    if (layout.tile && layout.tile.x === tile.x && layout.tile.y === tile.y) return null;
    return { ...layout, tile };
  },

  frame(index, ms, layout) {
    const { a, b, arrow, green, tile } = layout;
    const id = CHAPTERS[Math.max(0, Math.min(index, CHAPTERS.length - 1))]!.id;
    const blank: ShapeElement = { ...b, label: '' };
    const labelled: ShapeElement = { ...b, label: B_LABEL };
    const styled: ShapeElement = { ...green, label: B_LABEL };

    if (id === 'add') {
      const els: Element[] = [];
      let hold = null;
      if (ms >= ADD.drag1[0]) {
        const carriedA = carried(a, tile, between(ms, ADD.drag1[0], ADD.drag1[1]));
        els.push(carriedA);
        if (tile && ms < ADD.drag1[1]) hold = centreOf(carriedA);
      }
      if (ms >= ADD.drag2[0]) {
        const carriedB = carried(blank, tile, between(ms, ADD.drag2[0], ADD.drag2[1]));
        els.push(carriedB);
        if (tile && ms < ADD.drag2[1]) hold = centreOf(carriedB);
      }
      const paletteOpen =
        (ms >= ADD.open1 && ms < ADD.drag1[0] + 200) ||
        (ms >= ADD.open2 && ms < ADD.drag2[0] + 200);
      return frameOf(els, { open: paletteOpen ? ['palette'] : [], hold });
    }
    if (id === 'connect') {
      if (ms < CONNECT.drag[0])
        return frameOf([a, blank], { selectedId: ms >= CONNECT.select ? a.id : null });
      if (ms < CONNECT.drag[1]) {
        // The arrow is dragged from A's bottom towards B's top, its loose end under the cursor.
        const p = between(ms, CONNECT.drag[0], CONNECT.drag[1]);
        const from = { x: a.x + a.width / 2, y: a.y + a.height };
        const to = { x: b.x + b.width / 2, y: b.y };
        const loose: ArrowElement = {
          ...arrow,
          to: { kind: 'free', x: lerp(from.x, to.x, p), y: lerp(from.y, to.y, p) },
        };
        return frameOf([a, blank, loose], { selectedId: a.id });
      }
      return frameOf([a, blank, arrow], {
        selectedId: ms < CONNECT.drag[1] + 600 ? arrow.id : null,
      });
    }
    const base: Element[] = [a, arrow];
    if (id === 'label') {
      return frameOf(
        [...base, { ...b, label: typedAt(B_LABEL, ms, LABEL.type[0], LABEL.type[1]) }],
        {
          selectedId: ms >= LABEL.select ? b.id : null,
          typing: ms >= LABEL.select && ms < LABEL.type[1] + 500,
        },
      );
    }
    // Style.
    const path = ms >= STYLE.presets ? ['Style', 'Presets'] : ms >= STYLE.flyout ? ['Style'] : [];
    return frameOf([...base, ms >= STYLE.pick ? styled : labelled], {
      selectedId: ms >= STYLE.menu ? b.id : null,
      menu: ms >= STYLE.menu && ms < STYLE.close ? { on: b.id, path } : null,
    });
  },

  plan(index) {
    const id = CHAPTERS[index]?.id ?? 'add';
    const A = DEMO_IDS.a;
    const B = DEMO_IDS.b;
    const category = { kind: 'tour', id: 'palette-category' } as const;
    switch (id) {
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
      default:
        return [
          { at: ADD.open1, to: category, press: true },
          { at: ADD.drag1[0], to: PALETTE_TILE, press: true },
          { at: ADD.drag1[1], to: { kind: 'element', id: A } },
          { at: ADD.open2, to: category, press: true },
          { at: ADD.drag2[0], to: PALETTE_TILE, press: true },
          { at: ADD.drag2[1], to: { kind: 'element', id: B } },
        ];
    }
  },
};
