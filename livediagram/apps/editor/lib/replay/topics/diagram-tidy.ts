import {
  bestAnchorTowards,
  type ArrowElement,
  type Element,
  type ShapeElement,
} from '@livediagram/document';
import { cleanupElements } from '@/lib/tab-cleanup';
import { between, frameOf, lerp, type Chapter, type CursorTarget, type Topic } from '../topic';
import { boxedShape } from './shared';

// Tidy Up (docs/specs/007-editor/watch-it-built.md "The curriculum"): a flow laid down by hand, every step a little off,
// then the footer's Tidy Up opened for real and its Auto Layout picked: the shapes glide into the layout that press
// gives. The press itself would rearrange the person's own tab, so it is never made; the glide ends exactly where the
// editor's own tidier (lib/tab-cleanup.ts) puts the demo.

export const CHAPTERS: readonly Chapter[] = [
  {
    id: 'tidy-mess',
    name: 'The Mess',
    shortName: 'Mess',
    ms: 4500,
    say: 'Diagrams built by hand end up a little crooked.',
    sayTouch: 'Diagrams built by hand end up a little crooked.',
  },
  {
    id: 'tidy-press',
    name: 'Tidy Up',
    shortName: 'Tidy',
    ms: 7500,
    say: 'Tidy Up in the bottom bar lays the whole tab out neatly in one press.',
    sayTouch: 'Tidy Up in the bottom bar lays the whole tab out neatly in one tap.',
  },
];

// The Mess: the steps land one after another. Tidy Up: open it, pick Auto Layout, and the glide.
export const MESS = { every: 450 } as const;
export const TIDY = { open: 1300, pick: 3000, glide: [3300, 4900] } as const;

const STEPS = [
  { id: 'wib-tidy-start', label: 'Start', kind: 'circle', w: 90, h: 90, dx: -170, dy: -330 },
  { id: 'wib-tidy-form', label: 'Fill in form', kind: 'square', w: 170, h: 64, dx: 60, dy: -285 },
  { id: 'wib-tidy-check', label: 'Complete?', kind: 'diamond', w: 150, h: 100, dx: -120, dy: -175 },
  { id: 'wib-tidy-fix', label: 'Ask for more', kind: 'square', w: 170, h: 64, dx: 170, dy: -140 },
  { id: 'wib-tidy-done', label: 'Approved', kind: 'square', w: 150, h: 64, dx: -10, dy: -40 },
] as const;
const JOINS = [
  [0, 1],
  [1, 2],
  [2, 3],
  [2, 4],
  [3, 1],
] as const;

const TIDY_KIND: CursorTarget = { kind: 'find', selector: '[data-tidy-kind="smart"]' };

export type TidyLayout = {
  readonly mess: readonly Element[];
  // The same elements as Tidy Up leaves them, by id: the shapes moved, the arrows' ends chosen again.
  readonly tidy: ReadonlyMap<string, Element>;
};

export const tidy: Topic<TidyLayout> = {
  id: 'diagram-tidy',
  chapters: CHAPTERS,

  layout({ centre, size, tab }) {
    // A phone gets the same flow, drawn smaller; tidied, it runs four rows down, so it starts high.
    const k = size.width < 700 ? 0.6 : 0.85;
    const shapes = STEPS.map((s) =>
      boxedShape(tab, s.id, s.label, s.w * k, s.h * k, centre.x + s.dx * k, centre.y + s.dy * k, s.kind),
    );
    const stroke = shapes[0]!.strokeColor;
    const arrows: ArrowElement[] = JOINS.map(([a, b], i) => {
      const from = shapes[a]!;
      const to = shapes[b]!;
      return {
        id: `wib-tidy-arrow-${i}`,
        type: 'arrow',
        from: { kind: 'pinned', elementId: from.id, anchor: bestAnchorTowards(from, middle(to)) },
        to: { kind: 'pinned', elementId: to.id, anchor: bestAnchorTowards(to, middle(from)) },
        ...(stroke ? { strokeColor: stroke } : {}),
      };
    });
    const mess: Element[] = [...shapes, ...arrows];
    return { mess, tidy: new Map(cleanupElements(mess, 'smart').map((e) => [e.id, e])) };
  },

  frame(index, ms, layout) {
    const id = CHAPTERS[Math.max(0, Math.min(index, CHAPTERS.length - 1))]!.id;
    const shapes = layout.mess.filter((e): e is ShapeElement => e.type === 'shape');
    if (id === 'tidy-mess') {
      // The steps land one by one, each with the arrows into it once both ends are down.
      const landed = new Set(shapes.slice(0, 1 + Math.floor(ms / MESS.every)).map((s) => s.id));
      return frameOf(
        layout.mess.filter((e) =>
          e.type === 'arrow'
            ? e.from.kind === 'pinned' &&
              e.to.kind === 'pinned' &&
              landed.has(e.from.elementId) &&
              landed.has(e.to.elementId)
            : landed.has(e.id),
        ),
      );
    }
    const p = between(ms, TIDY.glide[0], TIDY.glide[1]);
    const els = layout.mess.map((e) => {
      const to = layout.tidy.get(e.id);
      if (!to || p === 0) return e;
      // The arrows take their tidied ends as the glide starts; the shapes slide there.
      if (e.type !== 'shape' || to.type !== 'shape') return to;
      return { ...e, x: lerp(e.x, to.x, p), y: lerp(e.y, to.y, p) };
    });
    return frameOf(els, { open: ms >= TIDY.open && ms < TIDY.pick + 250 ? ['tidy-up'] : [] });
  },

  plan(index) {
    const id = CHAPTERS[index]?.id ?? 'tidy-mess';
    if (id === 'tidy-press') {
      return [
        { at: TIDY.open, to: { kind: 'tour', id: 'tidy-up' }, press: true },
        { at: TIDY.pick, to: TIDY_KIND, press: true },
        { at: TIDY.glide[1] + 600, to: { kind: 'element', id: STEPS[2].id } },
      ];
    }
    return [
      { at: 900, to: { kind: 'element', id: STEPS[0].id } },
      { at: 2600, to: { kind: 'element', id: STEPS[3].id } },
    ];
  },
};

const middle = (s: ShapeElement) => ({ x: s.x + s.width / 2, y: s.y + s.height / 2 });
