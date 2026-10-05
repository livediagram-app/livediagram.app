// The Plan board and Plan card in exports, thumbnails and api or MCP images
// (docs/specs/025-plan/plan-board.md "Both elements everywhere"). The board is
// drawn from the document's items when the caller has them: its header,
// columns with their counts and WIP limits, and the card faces, without the
// interactive controls. Without items the columns draw empty.

import {
  itemAssignee,
  itemTitle,
  itemTypeOf,
  itemVoteTotal,
  isPriority,
  normaliseBoardSetup,
  projectBoard,
  type Item,
} from '@livediagram/items';
import type { BoxedElement } from './index';
import type { CanvasSurface } from './colors';
import { r2, xmlEscape } from './svg-render-primitives';

type Shape = BoxedElement & { type: 'shape' };

const FONT = 'system-ui, sans-serif';
const HEADER_H = 52;
const PAD = 12;
const GAP = 12;
const COL_HEAD_H = 34;
const CARD_H = 64;
const CARD_GAP = 8;

const PRIORITY_COLORS = {
  urgent: '#dc2626',
  high: '#ea580c',
  medium: '#ca8a04',
  low: '#64748b',
} as const;

type Palette = {
  surface: string;
  border: string;
  column: string;
  card: string;
  text: string;
  muted: string;
};

function palette(surface: CanvasSurface): Palette {
  return surface === 'dark'
    ? {
        surface: '#111827',
        border: '#334155',
        column: '#1e293b',
        card: '#0f172a',
        text: '#e2e8f0',
        muted: '#94a3b8',
      }
    : {
        surface: '#f8fafc',
        border: '#e2e8f0',
        column: '#f1f5f9',
        card: '#ffffff',
        text: '#0f172a',
        muted: '#64748b',
      };
}

function text(x: number, y: number, size: number, fill: string, body: string, extra = ''): string {
  return `<text x="${r2(x)}" y="${r2(y)}" font-family="${FONT}" font-size="${size}" fill="${xmlEscape(fill)}"${extra}>${xmlEscape(body)}</text>`;
}

// Cuts `s` to what fits `width` at roughly 0.55em per character.
function fit(s: string, width: number, size: number): string {
  const max = Math.max(1, Math.floor(width / (size * 0.55)));
  return s.length <= max ? s : `${s.slice(0, Math.max(1, max - 1))}…`;
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('');
}

// One card face at (x, y), `w` wide and `h` tall.
export function svgCardFace(
  item: Item | undefined,
  x: number,
  y: number,
  w: number,
  h: number,
  p: Palette,
): string {
  const parts = [
    `<rect x="${r2(x)}" y="${r2(y)}" width="${r2(w)}" height="${r2(h)}" rx="8" fill="${p.card}" stroke="${p.border}" stroke-width="1"/>`,
  ];
  if (!item) {
    parts.push(text(x + 12, y + h / 2 + 4, 12, p.muted, 'Item not found'));
    return parts.join('');
  }
  const type = itemTypeOf(item.type);
  parts.push(
    `<rect x="${r2(x)}" y="${r2(y)}" width="4" height="${r2(h)}" rx="2" fill="${type.color}"/>`,
  );
  parts.push(text(x + 12, y + 18, 11, p.muted, `#${item.key} · ${type.label}`));
  parts.push(
    text(x + 12, y + 36, 13, p.text, fit(itemTitle(item), w - 24, 13), ' font-weight="600"'),
  );
  let cx = x + 12;
  const p0 = item.fields['priority'];
  if (isPriority(p0) && h >= 56) {
    parts.push(
      `<circle cx="${r2(cx + 4)}" cy="${r2(y + h - 12)}" r="4" fill="${PRIORITY_COLORS[p0]}"/>`,
    );
    cx += 14;
  }
  const votes = itemVoteTotal(item);
  if (votes > 0 && h >= 56) parts.push(text(cx, y + h - 8, 11, p.muted, `▲ ${votes}`));
  const who = itemAssignee(item);
  if (who && h >= 56) {
    parts.push(
      `<circle cx="${r2(x + w - 16)}" cy="${r2(y + h - 14)}" r="10" fill="${xmlEscape(who.color)}"/>`,
    );
    parts.push(
      text(
        x + w - 16,
        y + h - 10,
        9,
        '#ffffff',
        initials(who.name),
        ' text-anchor="middle" font-weight="700"',
      ),
    );
  }
  return parts.join('');
}

export function svgPlanBoard(
  el: Shape,
  items: ReadonlyMap<string, Item> | undefined,
  surface: CanvasSurface,
): string {
  const p = palette(surface);
  const setup = normaliseBoardSetup(el.planBoard);
  const parts = [
    `<rect x="${r2(el.x)}" y="${r2(el.y)}" width="${r2(el.width)}" height="${r2(el.height)}" rx="12" fill="${p.surface}" stroke="${p.border}" stroke-width="1.5"/>`,
  ];
  if (!setup) return parts.join('');
  const projection = projectBoard(setup, items ?? new Map());
  parts.push(
    text(
      el.x + PAD + 4,
      el.y + 32,
      18,
      p.text,
      fit(setup.title, el.width / 2, 18),
      ' font-weight="700"',
    ),
  );
  if (items) {
    parts.push(
      text(
        el.x + el.width - PAD - 4,
        el.y + 32,
        12,
        p.muted,
        `${projection.total} items`,
        ' text-anchor="end"',
      ),
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
      text(
        cx + 10,
        top + 22,
        13,
        p.text,
        fit(col.column.name, colW - 60, 13),
        ' font-weight="600"',
      ),
    );
    parts.push(
      text(
        cx + colW - 10,
        top + 22,
        12,
        col.overLimit ? '#b45309' : p.muted,
        count,
        ' text-anchor="end"',
      ),
    );
    let y = top + COL_HEAD_H;
    const cards = col.lanes.flatMap((l) => l.items);
    for (const item of cards) {
      if (y + CARD_H > top + colH - 6) break;
      parts.push(svgCardFace(item, cx + 8, y, colW - 16, CARD_H, p));
      y += CARD_H + CARD_GAP;
    }
  });
  return parts.join('');
}

export function svgPlanCard(
  el: Shape,
  items: ReadonlyMap<string, Item> | undefined,
  surface: CanvasSurface,
): string {
  const id = el.planCard?.itemId ?? '';
  // Without the store in hand, a neutral placeholder rather than "not found".
  const item = items ? items.get(id) : undefined;
  if (!items) {
    const p = palette(surface);
    return (
      `<rect x="${r2(el.x)}" y="${r2(el.y)}" width="${r2(el.width)}" height="${r2(el.height)}" rx="8" fill="${p.card}" stroke="${p.border}" stroke-width="1"/>` +
      text(el.x + 12, el.y + el.height / 2 + 4, 12, p.muted, 'Item')
    );
  }
  return svgCardFace(item, el.x, el.y, el.width, el.height, palette(surface));
}
