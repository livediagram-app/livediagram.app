// The Posters layouts' own parts (docs/specs/007-editor/pages-mode.md "Layouts"): a column
// that shares its height out between fixed and growing blocks, a letter-spaced eyebrow, a headline
// set centred, accent rules and a thin divider. Pure, on the shared kit; no colours of their own.
import type { Element, TextElement } from '@liveplanner/document';
import type { Kit } from './page-layout-kit';

// One block in a column: its base height, a share of any spare room (`grow`, capped at `max`), and
// whether it may drop out (`optional`) when its share would leave it under `min`.
export type Block = {
  h: number;
  grow?: number;
  max?: number;
  min?: number;
  optional?: boolean;
  // The gap above this block (the column's own gap when unset).
  gap?: number;
  draw: (y: number, h: number) => Element[];
};

// Taller than this many times its width, a poster stacks; anything squarer sets side by side.
export const SPLIT_RATIO = 1.2;
export const isSplit = (k: Kit) => k.wide || k.box.height < k.box.width * SPLIT_RATIO;

// How far the gaps may close up before a column overflows, as a share of their set size.
const GAP_FLOOR = 0.4;

// Lays blocks down a column from `top`, `total` tall: the growing blocks share the spare room
// (each up to its cap), an optional block too short to be worth showing drops out, and room left
// once every block is capped opens the gaps evenly (or, `centred`, sits above and below the
// blocks as one group), so nothing floats in empty space.
export function column(
  top: number,
  total: number,
  blocks: readonly Block[],
  gap: number,
  centred = false,
) {
  let live = [...blocks];
  for (let pass = 0; pass < blocks.length + 1; pass += 1) {
    const gaps = live.map((b, i) => (i === 0 ? 0 : (b.gap ?? gap)));
    const sizes = live.map((b) => b.h);
    let spare = total - sizes.reduce((a, b) => a + b, 0) - gaps.reduce((a, b) => a + b, 0);
    // Share the spare room by weight, a capped block passing its excess on.
    let open = live.map((_, i) => i).filter((i) => (live[i]!.grow ?? 0) > 0);
    while (spare > 0.5 && open.length > 0) {
      const weight = open.reduce((a, i) => a + live[i]!.grow!, 0);
      let given = 0;
      const still: number[] = [];
      for (const i of open) {
        const b = live[i]!;
        const want = (spare * b.grow!) / weight;
        const room = (b.max ?? Infinity) - sizes[i]!;
        const add = Math.min(want, room);
        sizes[i] = sizes[i]! + add;
        given += add;
        if (add < want) continue;
        still.push(i);
      }
      spare -= given;
      if (still.length === open.length) break;
      open = still;
    }
    const drop = live.findIndex((b, i) => b.optional && sizes[i]! < (b.min ?? 0));
    if (drop >= 0) {
      live = live.filter((_, i) => i !== drop);
      continue;
    }
    // Spare room opens the gaps; too little room closes them up, to a floor.
    const gapSum = gaps.reduce((a, b) => a + b, 0);
    const slots = Math.max(1, live.length - 1);
    const stretch = spare > 0.5 && !centred ? spare / slots : 0;
    const squeeze = spare < 0 && gapSum > 0 ? Math.max(GAP_FLOOR, 1 + spare / gapSum) : 1;
    const els: Element[] = [];
    let y = centred && spare > 0 ? top + spare / 2 : top;
    live.forEach((b, i) => {
      if (i > 0) y += gaps[i]! * squeeze + stretch;
      els.push(...b.draw(y, sizes[i]!));
      y += sizes[i]!;
    });
    return els;
  }
  return [];
}

// A small bold line in capitals, letter-spaced: the kicker over a poster's headline.
export function eyebrow(
  k: Kit,
  x: number,
  y: number,
  w: number,
  label: string,
  extra: Partial<TextElement> = {},
): TextElement {
  return {
    ...k.text(x, y, w, k.u * 6, label, { textBold: true, textSize: 'md' }),
    letterSpacing: 0.25,
    ...extra,
  };
}

// Capitals run wider than the kit's mean glyph: a headline in capitals is fitted to this share of
// its box's width, and one in mixed case to the larger share, so a big word never wraps.
const CAPS_FIT = 0.8;
const MIXED_FIT = 0.92;

// The kit's headline, fitted with that margin; the box keeps its full width.
export function fitTitle(k: Kit, x: number, y: number, w: number, h: number, label: string) {
  const fit = /[a-z]/.test(label) ? MIXED_FIT : CAPS_FIT;
  return { ...k.title(x, y, w * fit, h, label), width: Math.round(w) };
}

// A headline fitted to its box and centred across it.
export function centredTitle(k: Kit, x: number, y: number, w: number, h: number, label: string) {
  return { ...fitTitle(k, x, y, w, h, label), textAlignX: 'center' as const };
}

// A short accent rule, a rounded bar in the theme's emphasis.
export function accentRule(k: Kit, x: number, y: number, w = k.u * 14) {
  return k.shape('square', x, y, w, k.u * 1.2, { label: '', borderRadius: 'full' });
}

// A hairline across (or, given a height, down) a page: a divider between blocks of a grid.
export function hairline(k: Kit, x: number, y: number, w: number, h = k.u * 0.5) {
  return k.shape('square', x, y, w, h, { label: '', borderRadius: 'none' });
}

// Headlines set over several lines at one size: each fitted to its box, then all brought down to
// the smallest, so a short line does not shout over a long one.
export function matchedTitles(
  k: Kit,
  lines: readonly (readonly [number, number, number, number, string])[],
  extra: Partial<TextElement> = {},
): TextElement[] {
  const titles = lines.map(([x, y, w, h, label]) => ({
    ...fitTitle(k, x, y, w, h, label),
    ...extra,
  }));
  const scale = Math.min(...titles.map((t) => t.textScale ?? 1));
  return titles.map((t) => ({ ...t, textScale: scale }));
}
