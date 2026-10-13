// The Plan board and Plan card in exports, thumbnails and api or MCP images
// (docs/specs/026-plan/plan-board.md "Both elements everywhere"). The board is
// drawn from the document's items when the caller has them: its header,
// columns with their counts and WIP limits, and the card faces, without the
// interactive controls. Without items the columns draw empty.

import { planOwnColoursOf, planPalette } from './plan-palette';
import {
  normaliseBoardSetup,
  ITEM_TYPES,
  planViewMetric,
  PLAN_VISUALISATION_LABELS,
  type PlanVisualisation,
  type Item,
  type ItemTypeDef,
} from '@livediagram/items';
import type { BoxedElement } from './index';
import type { CanvasSurface } from './colors';
import { r2, xmlEscape } from './svg-render-primitives';
import { text as faceText, wrapLines } from './svg-render-face-kit';
import { PLAN_BOARD_PAD, planBoardLayout } from './plan-board-layout';
import { planCardFace } from './svg-render-plan-card';

type Shape = BoxedElement & { type: 'shape' };

const FONT = 'system-ui, sans-serif';
const PAD = PLAN_BOARD_PAD;

// The element's own colours (theme, Quick Style, pickers), for planPalette.
const ownColours = (el: Shape) => planOwnColoursOf(el);

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

export function svgPlanBoard(
  el: Shape,
  items: ReadonlyMap<string, Item> | undefined,
  surface: CanvasSurface,
  types: readonly ItemTypeDef[] = ITEM_TYPES,
): string {
  const p = planPalette(surface, ownColours(el));
  const parts = [
    `<rect x="${r2(el.x)}" y="${r2(el.y)}" width="${r2(el.width)}" height="${r2(el.height)}" rx="12" fill="${p.surface}" stroke="${p.border}" stroke-width="1.5"/>`,
  ];
  // Each card as tall as its type's Display needs at the board's card size (svg-render-plan-card.ts).
  const setupOf = normaliseBoardSetup(el.planBoard);
  const faceCtx = {
    palette: p,
    types,
    ...(setupOf ? { boardFields: setupOf.cardFields, size: setupOf.cardSize ?? 'detailed' } : {}),
    ...(items ? { items } : {}),
  };
  const layout = planBoardLayout(
    el,
    items,
    types,
    (item, width) => planCardFace(item, 0, 0, width, faceCtx, true).height,
  );
  if (!layout) return inFont(parts.join(''));
  const { setup, projection } = layout;
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
  for (const col of layout.columns) {
    const { x: cx, y: top, width: colW, height: colH } = col;
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
  }
  // A swimlane board's rows: a divider and the lane's name across every column, above its cards.
  for (const lane of layout.lanes) {
    const left = el.x + PAD;
    const right = el.x + el.width - PAD;
    parts.push(
      `<line x1="${r2(left)}" y1="${r2(lane.y)}" x2="${r2(right)}" y2="${r2(lane.y)}" stroke="${p.border}" stroke-width="1"/>`,
    );
    const dot = lane.colour
      ? `<circle cx="${r2(left + 10)}" cy="${r2(lane.y + 15)}" r="4" fill="${xmlEscape(lane.colour)}"/>`
      : '';
    parts.push(
      dot +
        text(
          left + (lane.colour ? 20 : 8),
          lane.y + 19,
          12,
          p.muted,
          fit(lane.label || 'None', el.width / 2, 12),
          {
            weight: 600,
          },
        ),
    );
  }
  for (const col of layout.columns)
    for (const card of col.cards)
      parts.push(planCardFace(card.item, card.x, card.y, card.width, faceCtx).svg);
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
  const p = planPalette(surface, ownColours(el));
  if (!item) {
    return inFont(
      `<rect x="${r2(el.x)}" y="${r2(el.y)}" width="${r2(el.width)}" height="${r2(el.height)}" rx="8" fill="${p.card}" stroke="${p.border}" stroke-width="1"/>` +
        text(el.x + 12, el.y + el.height / 2 + 4, 12, p.muted, 'Item not found'),
    );
  }
  // The same face a board draws, Detailed, inside the element's own bounds.
  return inFont(
    planCardFace(item, el.x, el.y, el.width, { palette: p, types, items, height: el.height }).svg,
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
