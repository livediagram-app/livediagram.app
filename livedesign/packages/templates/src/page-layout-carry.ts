// A page's content carried into a new layout (docs/specs/007-editor/pages-mode.md "Content
// carries over"): the words, pictures and figures a person put on a page move into the matching
// places of the layout replacing it, each taking its new place's position, size and look. Pure:
// the page's elements and the layout's freshly built ones in, the layout's elements (same ids, so
// its pinned arrows hold) with the carried content out.
import {
  LABEL_FONT_PX,
  labelFontPx,
  type Element,
  type ImageElement,
  type ShapeElement,
  type TextElement,
} from '@livedesign/document';
import { PAGE_LAYOUTS } from './page-layouts';
import { SLIDE_LAYOUTS } from './slide-layouts';
import { LOGO_LAYOUTS } from './logo-layouts';

// What a shape carries into the next shape of its kind: its words and its data, never its
// geometry or look (the new place's own).
const SHAPE_CONTENT = [
  'label',
  'richText',
  'pageTitle',
  'pageSubtitle',
  'iconId',
  'stickerId',
  'progress',
  'rating',
  'stats',
  'processSteps',
  'checklistItems',
  'navLinks',
  'pieSlices',
  'lineCategories',
  'lineSeries',
  'legendItems',
  'conceptRows',
  'agendaItems',
  'sankeyFlows',
  'sankeyNodes',
  'sankeyUnit',
  'chartSource',
] as const satisfies readonly (keyof ShapeElement)[];

// What a picture carries into a picture place: the picture itself and what credits it.
const IMAGE_CONTENT = [
  'imageId',
  'naturalWidth',
  'naturalHeight',
  'credit',
  'alt',
] as const satisfies readonly (keyof ImageElement)[];

// Type at least this large (px, its size times its scale) reads as a large line, and the most
// prominent such words as the title: the large text size.
const LARGE_PX = LABEL_FONT_PX.lg;
// A figure: short, with a digit, and no word of three letters or more ("73%", "7 in 10", "$4.2M").
const FIGURE_MAX_CHARS = 12;
// Two places whose tops are this close (px) read as one row, left to right.
const ROW_TOLERANCE = 4;
// Carried words shrink to fit their place, never below this share of its own size.
const MIN_SHRINK = 0.4;
// The fit's estimate of a glyph's mean advance (a share of the type size; bold is wider) and of a
// line's height.
const GLYPH_WIDTH = 0.55;
const BOLD_GLYPH_WIDTH = 0.6;
const LINE_HEIGHT = 1.25;
// Reference content boxes (tall and wide) the placeholder words are gathered from.
const REFERENCE_BOXES = [
  { x: 0, y: 0, width: 760, height: 1075 },
  { x: 0, y: 0, width: 1700, height: 956 },
];

type Role = 'title' | 'large' | 'body' | 'figure';

// Where leftover words look next once their own role is full (figures stay figures).
const ROLE_FALLBACK: Record<Role, readonly Role[]> = {
  title: ['large', 'body'],
  large: ['body', 'title'],
  body: ['large', 'title'],
  figure: [],
};

/**
 * The layout's `placed` elements with the content of `previous` (the page's elements before the
 * layout) carried into them: words by role, pictures by size, a shape's data into the next shape
 * of its kind. Only what was written carries: any layout's placeholder stays behind.
 */
export function carryPageContent(
  previous: readonly Element[],
  placed: readonly Element[],
): Element[] {
  const out = [...placed];
  const at = new Map(out.map((el, i) => [el.id, i]));
  const put = (el: Element) => (out[at.get(el.id)!] = el);
  const marks = placeholders();

  // Words, by role.
  const written = readingOrder(
    previous.filter(
      (el): el is TextElement => el.type === 'text' && !marks.labels.has(labelOf(el)),
    ),
  );
  const slots = readingOrder(placed.filter((el): el is TextElement => el.type === 'text'));
  const from = byRole(
    previous.filter((el): el is TextElement => el.type === 'text'),
    written,
  );
  const into = byRole(slots, slots);
  const leftover: Record<Role, TextElement[]> = { title: [], large: [], body: [], figure: [] };
  for (const role of ['title', 'large', 'body', 'figure'] as const) {
    from[role].forEach((el, i) => {
      const slot = into[role][i];
      if (slot) put(withWords(slot, el));
      else leftover[role].push(el);
    });
    into[role] = into[role].slice(from[role].length);
  }
  for (const role of ['title', 'large', 'body'] as const) {
    for (const el of leftover[role]) {
      const next = ROLE_FALLBACK[role].find((r) => into[r].length > 0);
      if (next) put(withWords(into[next].shift()!, el));
    }
  }

  // Pictures, the largest first into the largest place.
  const pictures = bySize(
    previous.filter((el): el is ImageElement => el.type === 'image' && !!el.imageId),
  );
  const frames = bySize(placed.filter((el): el is ImageElement => el.type === 'image'));
  pictures.forEach((el, i) => {
    const frame = frames[i];
    if (frame) put({ ...frame, ...pick(el, IMAGE_CONTENT), objectFit: 'cover' });
  });

  // A shape's data, into the next shape of its kind.
  const shapes = readingOrder(
    previous.filter(
      (el): el is ShapeElement =>
        el.type === 'shape' && hasContent(el) && !marks.shapes.has(contentKey(el)),
    ),
  );
  const free = new Map<string, ShapeElement[]>();
  for (const el of readingOrder(placed.filter((el): el is ShapeElement => el.type === 'shape'))) {
    free.set(el.shape, [...(free.get(el.shape) ?? []), el]);
  }
  for (const el of shapes) {
    const slot = free.get(el.shape)?.shift();
    if (slot) put({ ...slot, ...pick(el, SHAPE_CONTENT) });
  }
  return out;
}

function labelOf(el: { label?: string }): string {
  return (el.label ?? '').trim();
}

// The px a text is set in: its size times its scale.
function typePx(el: TextElement): number {
  return labelFontPx(el.textSize) * (el.textScale ?? 1);
}

function isFigure(label: string): boolean {
  return label.length <= FIGURE_MAX_CHARS && /\d/.test(label) && !/\p{L}{3,}/u.test(label);
}

// A page's texts sorted into roles. `all` decides which is the title (the most prominent words,
// topmost on a tie), so a placeholder title left in place still holds the title's role; `kept`
// (in reading order) are the ones sorted.
function byRole(
  all: readonly TextElement[],
  kept: readonly TextElement[],
): Record<Role, TextElement[]> {
  const words = readingOrder(all.filter((el) => labelOf(el) && !isFigure(labelOf(el))));
  const top = words.reduce<TextElement | undefined>(
    (best, el) => (!best || typePx(el) > typePx(best) ? el : best),
    undefined,
  );
  const title = top && typePx(top) >= LARGE_PX ? top : undefined;
  const roles: Record<Role, TextElement[]> = { title: [], large: [], body: [], figure: [] };
  for (const el of kept) {
    const label = labelOf(el);
    if (!label) continue;
    const role: Role = isFigure(label)
      ? 'figure'
      : el === title
        ? 'title'
        : typePx(el) >= LARGE_PX
          ? 'large'
          : 'body';
    roles[role].push(el);
  }
  return roles;
}

// The slot with the words carried in, shrunk (never grown) when they would overflow it.
function withWords(slot: TextElement, from: TextElement): TextElement {
  const label = from.label ?? '';
  const carried: TextElement = { ...slot, label };
  if (from.richText) carried.richText = from.richText;
  else delete carried.richText;
  const shrink = fitShrink(slot, label);
  if (shrink < 1) carried.textScale = Math.round((slot.textScale ?? 1) * shrink * 100) / 100;
  return carried;
}

// How far the slot's type shrinks so the label fits its box (1 when it fits as it is).
function fitShrink(slot: TextElement, label: string): number {
  const px = typePx(slot);
  const glyph = slot.textBold ? BOLD_GLYPH_WIDTH : GLYPH_WIDTH;
  const height = (p: number) =>
    label
      .split('\n')
      .reduce((n, line) => n + Math.max(1, Math.ceil((line.length * p * glyph) / slot.width)), 0) *
    p *
    LINE_HEIGHT;
  if (height(px) <= slot.height) return 1;
  let lo = MIN_SHRINK;
  let hi = 1;
  for (let i = 0; i < 12; i += 1) {
    const mid = (lo + hi) / 2;
    if (height(px * mid) <= slot.height) lo = mid;
    else hi = mid;
  }
  return lo;
}

function readingOrder<T extends Element>(els: readonly T[]): T[] {
  return [...els].sort((a, b) => {
    const ay = 'y' in a ? a.y : 0;
    const by = 'y' in b ? b.y : 0;
    if (Math.abs(ay - by) > ROW_TOLERANCE) return ay - by;
    return ('x' in a ? a.x : 0) - ('x' in b ? b.x : 0);
  });
}

function bySize<T extends ImageElement>(els: readonly T[]): T[] {
  return readingOrder(els).sort((a, b) => b.width * b.height - a.width * a.height);
}

function pick<T extends object, K extends keyof T>(el: T, keys: readonly K[]): Partial<T> {
  const out: Partial<T> = {};
  for (const k of keys) if (el[k] !== undefined) out[k] = el[k];
  return out;
}

function contentKey(el: ShapeElement): string {
  return JSON.stringify([el.shape, pick(el, SHAPE_CONTENT)]);
}

function hasContent(el: ShapeElement): boolean {
  return SHAPE_CONTENT.some((k) => {
    const v = el[k];
    return typeof v === 'string' ? v.trim() !== '' : v !== undefined;
  });
}

/** Gathers every layout's placeholders ahead of the first carry (an idle moment while the layouts
 *  are open), so the first hover preview never pays for it. */
export function warmLayoutPlaceholders(): void {
  placeholders();
}

// Every layout's placeholder words and untouched shapes, gathered once (on the first carry, or
// warmLayoutPlaceholders) from each layout built in a tall and a wide box: ~15 ms each warm.
let marked: { labels: Set<string>; shapes: Set<string> } | null = null;
function placeholders(): { labels: Set<string>; shapes: Set<string> } {
  if (marked) return marked;
  const labels = new Set<string>(['']);
  const shapes = new Set<string>();
  for (const layout of [...PAGE_LAYOUTS, ...SLIDE_LAYOUTS, ...LOGO_LAYOUTS]) {
    for (const box of REFERENCE_BOXES) {
      for (const el of layout.build(box)) {
        if (el.type === 'text') labels.add(labelOf(el));
        else if (el.type === 'shape') shapes.add(contentKey(el));
      }
    }
  }
  marked = { labels, shapes };
  return marked;
}
