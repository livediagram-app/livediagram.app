import {
  bestAnchorTowards,
  type ArrowElement,
  type Element,
  type Tab,
} from '@livediagram/document';
import { lookMatches, tabLookById, withLookApplied, type TabLook } from '@/lib/tab-looks';
import { frameOf, type Chapter, type Frame, type Topic, type TopicEnv } from '../topic';
import { boxedShape } from './shared';

// Look and Feel (docs/specs/007-editor/watch-it-built.md "The curriculum"): the footer's Style opens the real Tab Style
// dialog, two looks are picked in turn and the demo and canvas restyle, then the Canvas panel and a new background.
// Nothing in the dialog is ever pressed for real (a look or pattern press writes the tab): each pick is drawn as the
// look the press would give, through the frame's `tab`, which the canvas and the dialog both show.

export const CHAPTERS: readonly Chapter[] = [
  {
    id: 'look-open',
    name: 'Open Style',
    shortName: 'Style',
    ms: 4500,
    say: 'Press Style in the bottom bar to change how the whole tab looks.',
    sayTouch: 'Tap Style in the bottom bar to change how the whole tab looks.',
  },
  {
    id: 'look-pick',
    name: 'Pick a Look',
    shortName: 'Looks',
    ms: 8000,
    say: 'A look sets colours, font and canvas in one click. Try a few.',
    sayTouch: 'A look sets colours, font and canvas in one tap. Try a few.',
  },
  {
    id: 'look-canvas',
    name: 'Canvas',
    shortName: 'Canvas',
    ms: 7500,
    say: 'Fine-tune any part: open Canvas for a new background.',
    sayTouch: 'Fine-tune any part: open Canvas for a new background.',
  },
];

export const OPEN = { press: 2100 } as const;
export const PICK = { first: 1600, second: 4800 } as const;
export const CANVAS = { open: 1500, pick: 4000 } as const;

export const LOOK_IDS = { a: 'wib-look-a', b: 'wib-look-b', c: 'wib-look-c' } as const;

type Look = {
  readonly look: TabLook;
  readonly tab: Partial<Tab>;
  readonly elements: readonly Element[];
};

export type LookLayout = {
  readonly elements: readonly Element[];
  // The two looks picked, in order, each as the tab and the demo wear it.
  readonly first: Look;
  readonly second: Look;
  // The second look on the background the Canvas chapter picks, and that pattern's button words.
  readonly canvas: { readonly tab: Partial<Tab>; readonly label: string };
};

// Looks on the dialog's first page, bold and unlike each other: rainbow colours, then a mono marker whiteboard.
const LOOK_ORDER = ['spectrum', 'whiteboard', 'textbook', 'boardroom'] as const;
// Backgrounds the Canvas chapter picks, by their button's words (components/palette/palette-patterns.ts).
const PATTERN_PICKS = [
  { pattern: 'graph', label: 'Graph' },
  { pattern: 'lines', label: 'Lines' },
] as const;

// What a look changes on the tab, without the tab's elements (those are the demo's, drawn on their own).
function lookOf(tab: Tab, demo: readonly Element[], look: TabLook): Look {
  const { elements, ...worn } = withLookApplied({ ...tab, elements: [...demo] }, look);
  return { look, tab: worn, elements };
}

// Three steps of a little plan, side by side on a wide view, stacked near the top on a phone (where the dialog is a
// sheet over the bottom). On a wide view they sit up and to the left, clear of the dialog flying up at the bottom right.
function demo(env: TopicEnv): Element[] {
  const { centre, size, tab } = env;
  const narrow = size.width < 700;
  const labels = ['Idea', 'Plan', 'Launch'];
  const w = narrow ? 96 : 150;
  const h = narrow ? 48 : 60;
  const gap = narrow ? 24 : 70;
  const row = labels.length * w + (labels.length - 1) * gap;
  const left = narrow
    ? centre.x - row / 2
    : Math.max(centre.x - size.width / 2 + 60, centre.x - row - 40);
  const top = narrow ? centre.y - size.height / 2 + 120 : centre.y - size.height / 2 + 150;
  const ids = [LOOK_IDS.a, LOOK_IDS.b, LOOK_IDS.c];
  const shapes = labels.map((label, i) =>
    boxedShape(
      tab,
      ids[i]!,
      label,
      w,
      h,
      left + i * (w + gap) + w / 2,
      top,
      i === 1 ? 'hexagon' : 'square',
    ),
  );
  const arrows: ArrowElement[] = shapes.slice(1).map((to, i) => {
    const from = shapes[i]!;
    return {
      id: `wib-look-arrow-${i}`,
      type: 'arrow',
      from: {
        kind: 'pinned',
        elementId: from.id,
        anchor: bestAnchorTowards(from, { x: to.x, y: to.y + h / 2 }),
      },
      to: {
        kind: 'pinned',
        elementId: to.id,
        anchor: bestAnchorTowards(to, { x: from.x + w, y: from.y + h / 2 }),
      },
      ...(from.strokeColor ? { strokeColor: from.strokeColor } : {}),
    };
  });
  return [...shapes, ...arrows];
}

const lookTile = (look: TabLook) =>
  ({
    kind: 'find',
    selector: '[data-tour-id="tab-style-looks"] button',
    text: look.label,
  }) as const;

export const look: Topic<LookLayout> = {
  id: 'diagram-look',
  chapters: CHAPTERS,

  layout(env) {
    const elements = demo(env);
    // Two looks the tab is not already wearing.
    const looks = LOOK_ORDER.map((id) => tabLookById(id)!).filter(
      (l) =>
        !lookMatches(
          {
            theme: env.tab.theme ?? 'brand',
            finish: env.tab.finish,
            font: env.tab.font,
            backgroundPattern: env.tab.backgroundPattern ?? 'grid',
            backgroundOpacity: env.tab.backgroundOpacity,
          },
          l,
        ),
    );
    const first = lookOf(env.tab, elements, looks[0]!);
    const second = lookOf(env.tab, elements, looks[1]!);
    const pick = PATTERN_PICKS.find((p) => p.pattern !== second.tab.backgroundPattern)!;
    return {
      elements,
      first,
      second,
      canvas: { tab: { ...second.tab, backgroundPattern: pick.pattern }, label: pick.label },
    };
  },

  frame(index, ms, layout) {
    const id = CHAPTERS[Math.max(0, Math.min(index, CHAPTERS.length - 1))]!.id;
    const { first, second, canvas } = layout;
    const top = { player: 'top' } as const;
    if (id === 'look-open') {
      const open = ms >= OPEN.press;
      return frameOf(layout.elements, open ? { open: ['tab-style'], ...top } : {});
    }
    if (id === 'look-pick') {
      const worn: Look | null = ms >= PICK.second ? second : ms >= PICK.first ? first : null;
      return withTab(worn ? worn.elements : layout.elements, worn?.tab, {
        open: ['tab-style'],
        ...top,
      });
    }
    const open = ms >= CANVAS.open ? ['tab-style', 'tab-style-canvas'] : ['tab-style'];
    return withTab(second.elements, ms >= CANVAS.pick ? canvas.tab : second.tab, { open, ...top });
  },

  plan(index, layout) {
    const id = CHAPTERS[index]?.id ?? 'look-open';
    if (id === 'look-pick') {
      return [
        { at: PICK.first, to: lookTile(layout.first.look), press: true },
        { at: PICK.second, to: lookTile(layout.second.look), press: true },
      ];
    }
    if (id === 'look-canvas') {
      return [
        {
          at: CANVAS.open,
          to: {
            kind: 'find',
            selector: '[data-tour-id="tab-style-fine-tune"] button',
            text: 'canvas',
          },
          press: true,
        },
        {
          at: CANVAS.pick,
          to: {
            kind: 'find',
            selector: '[data-tab-style-view="canvas"] button',
            text: layout.canvas.label,
          },
          press: true,
        },
      ];
    }
    return [
      { at: 900, to: { kind: 'element', id: LOOK_IDS.b } },
      { at: OPEN.press, to: { kind: 'tour', id: 'canvas-theme' }, press: true },
    ];
  },
};

function withTab(
  elements: readonly Element[],
  tab: Partial<Tab> | undefined,
  rest: Partial<Frame>,
): Frame {
  return frameOf(elements, tab ? { ...rest, tab } : rest);
}
