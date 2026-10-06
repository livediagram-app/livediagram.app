// The Plan board and Plan card in exports, thumbnails and api or MCP images
// (docs/specs/026-plan/plan-board.md "Both elements everywhere"). The board is
// drawn from the document's items when the caller has them: its header,
// columns with their counts and WIP limits, and the card faces, without the
// interactive controls. Without items the columns draw empty.

import { FLAG_COLOUR, PRIORITY_COLOURS, planPalette, type PlanPalette } from './plan-palette';
import {
  itemAssignee,
  itemTitle,
  ITEM_TYPES,
  typeIn,
  itemVoteTotal,
  isFlagged,
  isPriority,
  normaliseBoardSetup,
  projectBoard,
  planViewMetric,
  PLAN_VISUALISATION_LABELS,
  type PlanVisualisation,
  type Item,
  type ItemTypeDef,
} from '@livediagram/items';
import type { BoxedElement } from './index';
import type { CanvasSurface } from './colors';
import { r2, xmlEscape } from './svg-render-primitives';
import { personDisc, text as faceText, wrapLines } from './svg-render-face-kit';
import { initialsOf } from './names';

type Shape = BoxedElement & { type: 'shape' };

const FONT = 'system-ui, sans-serif';
const HEADER_H = 52;
const PAD = 12;
const GAP = 12;
const COL_HEAD_H = 34;
const CARD_H = 64;
const CARD_GAP = 8;

type Palette = PlanPalette;

// The element's own colours (theme, Quick Style, pickers), for planPalette.
const ownColours = (el: Shape) => ({
  fill: el.fillColor,
  stroke: el.strokeColor,
  text: el.textColor,
});

// The face kit's text marks leave the typeface to their group; every Plan drawing sets it once here.
const inFont = (body: string) => `<g font-family="${FONT}">${body}</g>`;

function text(
  x: number,
  y: number,
  size: number,
  color: string,
  body: string,
  o: { weight?: number; anchor?: 'end' | 'middle' } = {},
): string {
  return faceText(x, y, body, { size, color, ...o });
}

// `s` on one line that fits `width`, ending in an ellipsis when it runs on.
const fit = (s: string, width: number, size: number) => wrapLines(s, width, size, 1)[0] ?? '';

// One card face at (x, y), `w` wide and `h` tall.
export function svgCardFace(
  item: Item | undefined,
  x: number,
  y: number,
  w: number,
  h: number,
  p: Palette,
  types: readonly ItemTypeDef[] = ITEM_TYPES,
): string {
  const parts = [
    `<rect x="${r2(x)}" y="${r2(y)}" width="${r2(w)}" height="${r2(h)}" rx="8" fill="${p.card}" stroke="${p.border}" stroke-width="1"/>`,
  ];
  if (!item) {
    parts.push(text(x + 12, y + h / 2 + 4, 12, p.muted, 'Item not found'));
    return parts.join('');
  }
  const type = typeIn(types, item.type);
  parts.push(
    `<rect x="${r2(x)}" y="${r2(y)}" width="4" height="${r2(h)}" rx="2" fill="${type.color}"/>`,
  );
  parts.push(text(x + 12, y + 18, 11, p.muted, `#${item.key} · ${type.label}`));
  // A flagged card (docs/specs/026-plan/items.md "Flags"): its flag at the top right.
  if (isFlagged(item)) {
    parts.push(text(x + w - 12, y + 18, 12, FLAG_COLOUR, '⚑', { anchor: 'end' }));
  }
  parts.push(text(x + 12, y + 36, 13, p.text, fit(itemTitle(item), w - 24, 13), { weight: 600 }));
  let cx = x + 12;
  const p0 = item.fields['priority'];
  if (isPriority(p0) && h >= 56) {
    parts.push(
      `<circle cx="${r2(cx + 4)}" cy="${r2(y + h - 12)}" r="4" fill="${PRIORITY_COLOURS[p0]}"/>`,
    );
    cx += 14;
  }
  const votes = itemVoteTotal(item);
  if (votes > 0 && h >= 56) parts.push(text(cx, y + h - 8, 11, p.muted, `▲ ${votes}`));
  const who = itemAssignee(item);
  if (who && h >= 56) {
    parts.push(
      personDisc(x + w - 16, y + h - 14, 10, who.color, {
        initials: initialsOf(who.name),
        fill: who.color,
      }),
    );
  }
  return parts.join('');
}

export function svgPlanBoard(
  el: Shape,
  items: ReadonlyMap<string, Item> | undefined,
  surface: CanvasSurface,
  types: readonly ItemTypeDef[] = ITEM_TYPES,
): string {
  const p = planPalette(surface, ownColours(el));
  const setup = normaliseBoardSetup(el.planBoard);
  const parts = [
    `<rect x="${r2(el.x)}" y="${r2(el.y)}" width="${r2(el.width)}" height="${r2(el.height)}" rx="12" fill="${p.surface}" stroke="${p.border}" stroke-width="1.5"/>`,
  ];
  if (!setup) return inFont(parts.join(''));
  const projection = projectBoard(setup, items ?? new Map(), undefined, types);
  parts.push(
    text(el.x + PAD + 4, el.y + 32, 18, p.text, fit(setup.title, el.width / 2, 18), {
      weight: 700,
    }),
  );
  if (items) {
    parts.push(
      text(el.x + el.width - PAD - 4, el.y + 32, 12, p.muted, `${projection.total} items`, {
        anchor: 'end',
      }),
    );
  }
  const n = projection.columns.length;
  const colW = (el.width - PAD * 2 - GAP * (n - 1)) / n;
  const top = el.y + HEADER_H;
  const colH = el.height - HEADER_H - PAD;
  projection.columns.forEach((col, i) => {
    const cx = el.x + PAD + i * (colW + GAP);
    parts.push(
      `<rect x="${r2(cx)}" y="${r2(top)}" width="${r2(colW)}" height="${r2(colH)}" rx="10" fill="${p.column}"/>`,
    );
    if (col.column.color) {
      parts.push(
        `<rect x="${r2(cx)}" y="${r2(top)}" width="${r2(colW)}" height="4" rx="2" fill="${xmlEscape(col.column.color)}"/>`,
      );
    }
    const count = col.column.wipLimit ? `${col.count} / ${col.column.wipLimit}` : `${col.count}`;
    parts.push(
      text(cx + 10, top + 22, 13, p.text, fit(col.column.name, colW - 60, 13), { weight: 600 }),
    );
    parts.push(
      text(cx + colW - 10, top + 22, 12, col.overLimit ? '#b45309' : p.muted, count, {
        anchor: 'end',
      }),
    );
    let y = top + COL_HEAD_H;
    const cards = col.lanes.flatMap((l) => l.items);
    for (const item of cards) {
      if (y + CARD_H > top + colH - 6) break;
      parts.push(svgCardFace(item, cx + 8, y, colW - 16, CARD_H, p, types));
      y += CARD_H + CARD_GAP;
    }
  });
  return inFont(parts.join(''));
}

export function svgPlanCard(
  el: Shape,
  items: ReadonlyMap<string, Item> | undefined,
  surface: CanvasSurface,
  types: readonly ItemTypeDef[] = ITEM_TYPES,
): string {
  const id = el.planCard?.itemId ?? '';
  // Without the store in hand, a neutral placeholder rather than "not found".
  const item = items ? items.get(id) : undefined;
  if (!items) {
    const p = planPalette(surface, ownColours(el));
    return inFont(
      `<rect x="${r2(el.x)}" y="${r2(el.y)}" width="${r2(el.width)}" height="${r2(el.height)}" rx="8" fill="${p.card}" stroke="${p.border}" stroke-width="1"/>` +
        text(el.x + 12, el.y + el.height / 2 + 4, 12, p.muted, 'Item'),
    );
  }
  return inFont(
    svgCardFace(item, el.x, el.y, el.width, el.height, planPalette(surface, ownColours(el)), types),
  );
}

// A plan view (docs/specs/026-plan/plan-views.md "On the canvas") in an export: a labelled box, its view's
// name, not the live chart.
export function svgPlanView(el: Shape, surface: CanvasSurface): string {
  const p = planPalette(surface, ownColours(el));
  const view = el.planView?.view;
  const label =
    view && !planViewMetric(view) ? PLAN_VISUALISATION_LABELS[view as PlanVisualisation] : 'Metric';
  const size = Math.min(14, Math.max(10, el.height / 4));
  return inFont(
    `<rect x="${r2(el.x)}" y="${r2(el.y)}" width="${r2(el.width)}" height="${r2(el.height)}" rx="10" fill="${p.surface}" stroke="${p.border}" stroke-width="1"/>` +
      text(
        el.x + PAD,
        el.y + Math.min(el.height / 2 + 4, PAD + size),
        size,
        p.text,
        fit(label, el.width - PAD * 2, size),
        { weight: 600 },
      ),
  );
}
