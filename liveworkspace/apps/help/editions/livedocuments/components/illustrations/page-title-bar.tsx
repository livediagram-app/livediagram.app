// The page title bar's buttons (docs/specs/007-editor/pages-mode.md "Beside the
// cog"), drawn once for every scene that shows a page: Layout (PageLayoutsButton.tsx, the
// panels-top-left glyph), Tidy (PageTidyUpButton.tsx, the broom), Background
// (PageBackgroundButton.tsx, the paint roller) and the page's padlock (PageLockButton.tsx). Each
// glyph is drawn about 12 units square around its centre; `TitleButton` frames one as the title
// bar does, named beside its icon while the page has room, tinted while its popover is open.

import type { ReactElement } from 'react';
import { Label } from '@liveworkspace/help-site/art/primitives';

type GlyphProps = { cx: number; cy: number; on?: boolean };

const ink = (on?: boolean) => (on ? 'stroke-brand-600' : 'stroke-slate-500');

/** Layout: a panel with a bar across its top and a column down its left. */
export function LayoutGlyph({ cx, cy, on }: GlyphProps) {
  return (
    <g
      transform={`translate(${cx} ${cy})`}
      fill="none"
      className={ink(on)}
      strokeWidth={1.3}
      strokeLinecap="round"
    >
      <rect x={-5.5} y={-5.5} width={11} height={11} rx={1.8} />
      <path d="M-5.5 -1.5 h11 M-1.5 -1.5 v7" />
    </g>
  );
}

/** Tidy: a broom, its handle up to the right and its head fanned down to the left. */
export function TidyUpGlyph({ cx, cy, on }: GlyphProps) {
  return (
    <g
      transform={`translate(${cx} ${cy})`}
      fill="none"
      className={ink(on)}
      strokeWidth={1.3}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5.5 -5.5 L0.8 -0.8" />
      <path d="M-0.6 -2.2 L2.2 0.6 L-1.4 5.6 L-6 1 Z" />
      <path d="M-3.8 3.4 L-2 1.6" />
    </g>
  );
}

/** Background: a paint roller, its handle bending down from the roller's right end. */
export function BackgroundGlyph({ cx, cy, on }: GlyphProps) {
  return (
    <g
      transform={`translate(${cx} ${cy})`}
      fill="none"
      className={ink(on)}
      strokeWidth={1.3}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x={-5.5} y={-5.5} width={9} height={4} rx={1.2} />
      <path d="M3.5 -3.5 h1.4 a0.8 0.8 0 0 1 0.8 0.8 v1.6 a0.8 0.8 0 0 1 -0.8 0.8 h-4.6 a0.8 0.8 0 0 0 -0.8 0.8 v1.2" />
      <rect x={-1.3} y={1.7} width={2.2} height={4} rx={0.6} />
    </g>
  );
}

/** The page's padlock, open: the Lock page button. */
export function PadlockGlyph({ cx, cy }: { cx: number; cy: number }) {
  return (
    <g transform={`translate(${cx} ${cy})`}>
      <rect x={-4.5} y={-1} width={9} height={7} rx={1.5} className="fill-slate-500" />
      <path
        d="M-2.5 -1 v-2.5 a2.6 2.6 0 0 1 5.2 0"
        fill="none"
        className="stroke-slate-500"
        strokeWidth={1.3}
        strokeLinecap="round"
      />
    </g>
  );
}

/** A title-bar glyph alone, a little smaller, for a page drawn too small on screen to name its
 *  buttons (they drop to their icons, as the real title bar does when zoomed out). */
export function TitleIcon({
  cx,
  cy,
  Glyph,
}: {
  cx: number;
  cy: number;
  Glyph: (props: GlyphProps) => ReactElement;
}) {
  return (
    <g transform={`translate(${cx} ${cy}) scale(0.85)`}>
      <Glyph cx={0} cy={0} />
    </g>
  );
}

/** A rough width for a title-bar name at 10 units, so a named button fits it. */
export function titleButtonWidth(name?: string): number {
  return name ? 26 + name.length * 5.4 : 22;
}

/** A title-bar button from `x`, centred on `cy`: its glyph, its name beside it when given, tinted
 *  (brand) while its popover is open. */
export function TitleButton({
  x,
  cy,
  name,
  on = false,
  Glyph,
}: {
  x: number;
  cy: number;
  name?: string;
  on?: boolean;
  Glyph: (props: GlyphProps) => ReactElement;
}) {
  const w = titleButtonWidth(name);
  return (
    <g>
      {on && <rect x={x} y={cy - 11} width={w} height={22} rx={6} className="fill-brand-100" />}
      <Glyph cx={x + 11} cy={cy} on={on} />
      {name && (
        <Label x={x + 21} y={cy + 0.5} size={10} weight={500} tone={on ? 'accent' : 'body'}>
          {name}
        </Label>
      )}
    </g>
  );
}

/** The page's settings cog, drawn as a glyph like the others: it sits in the title bar card now, last at the
 *  page's corner (PageTitleBar.tsx `PageCog`), tinted while its panel is open. */
export function CogGlyph({ cx, cy, on }: GlyphProps) {
  const spokes = [0, 45, 90, 135, 180, 225, 270, 315];
  return (
    <g transform={`translate(${cx} ${cy})`} fill="none" className={ink(on)} strokeLinecap="round">
      {spokes.map((a) => (
        <line
          key={a}
          x1={0}
          y1={-3.4}
          x2={0}
          y2={-5.4}
          transform={`rotate(${a})`}
          strokeWidth={1.6}
        />
      ))}
      <circle r={3} strokeWidth={1.4} />
    </g>
  );
}

/** One control in the title bar card: its glyph, its name beside it when named, tinted while `on`. */
export type TitleBarItem = {
  Glyph: (props: GlyphProps) => ReactElement;
  name?: string;
  on?: boolean;
};

// The card's measures in figure units, scaled from the real bar (PageTitleBar.tsx: 28 px buttons, a 2 px gap,
// 3 px edges, a 9 px divider): an icon-only cell `cell` wide, a hairline divider with its margins, the card's edge.
const GAP = 1.5;
const DIVIDER = 7;
const EDGE = 2;

/** Where the card and each control sit, laid out from the card's right edge at `right`: the card's left and
 *  width, and each control's left, width and centre, group by group. A pure measure, so a figure can point at a
 *  control (a tooltip, a popover under it) or keep its label clear of the card. */
export function titleBarLayout(
  right: number,
  groups: readonly (readonly TitleBarItem[])[],
  cell = 16,
) {
  const shown = groups.filter((g) => g.length > 0);
  const widthOf = (item: TitleBarItem) => (item.name ? titleButtonWidth(item.name) : cell);
  const inner =
    shown.reduce((s, g) => s + g.reduce((t, it) => t + widthOf(it), 0) + (g.length - 1) * GAP, 0) +
    (shown.length - 1) * (DIVIDER + 2 * GAP);
  const width = inner + 2 * EDGE;
  const left = right - width;
  let at = left + EDGE;
  const items: { item: TitleBarItem; x: number; w: number; cx: number }[] = [];
  const dividers: number[] = [];
  shown.forEach((group, gi) => {
    if (gi > 0) {
      dividers.push(at + GAP + DIVIDER / 2);
      at += DIVIDER + 2 * GAP;
    }
    group.forEach((item, ii) => {
      if (ii > 0) at += GAP;
      const w = widthOf(item);
      items.push({ item, x: at, w, cx: at + w / 2 });
      at += w;
    });
  });
  return { left, width, items, dividers };
}

/** A page's title bar as the editor draws it now (PageTitleBar.tsx): one small white card, a hairline border and
 *  a soft shadow, its controls in groups split by short hairlines (how the page looks, then tools, then the page
 *  itself: its padlock and its cog), its right edge at `right` (the page's right edge), centred on `cy`. `cell` is
 *  an icon-only control's width: 16 for a page drawn small (its controls as icons alone), 22 at full size. */
export function TitleBarCard({
  right,
  cy,
  groups,
  cell = 16,
}: {
  right: number;
  cy: number;
  groups: readonly (readonly TitleBarItem[])[];
  cell?: number;
}) {
  const { left, width, items, dividers } = titleBarLayout(right, groups, cell);
  const h = cell + 2 * EDGE;
  const top = cy - h / 2;
  const scale = cell >= 22 ? 1 : 0.85;
  return (
    <g>
      <rect
        x={left}
        y={top + 1.5}
        width={width}
        height={h}
        rx={h * 0.3}
        className="fill-slate-200"
      />
      <rect
        x={left}
        y={top}
        width={width}
        height={h}
        rx={h * 0.3}
        className="fill-white stroke-slate-200"
        strokeWidth={1}
      />
      {dividers.map((x) => (
        <line
          key={x}
          x1={x}
          y1={cy - cell * 0.3}
          x2={x}
          y2={cy + cell * 0.3}
          className="stroke-slate-200"
          strokeWidth={1}
        />
      ))}
      {items.map(({ item, x, w, cx }, i) =>
        item.name ? (
          <TitleButton key={i} x={x} cy={cy} name={item.name} on={item.on} Glyph={item.Glyph} />
        ) : (
          <g key={i}>
            {item.on && (
              <rect
                x={x}
                y={cy - cell / 2}
                width={w}
                height={cell}
                rx={cell * 0.25}
                className="fill-brand-100"
              />
            )}
            <g transform={`translate(${cx} ${cy}) scale(${scale})`}>
              <item.Glyph cx={0} cy={0} on={item.on} />
            </g>
          </g>
        ),
      )}
    </g>
  );
}

/** The page's label above its top-left corner as the editor sets it (PageLabelCard.tsx): the page's name (when it has
 *  one) in strong ink, then its size and kind muted, so a row of pages scans by name, on the title bar's card (white,
 *  a hairline border, a soft shadow) from the page's left edge at `x`, centred on `y`. No "Page n": the navigator says
 *  that. */
export function PageLabel({
  x,
  y,
  name,
  rest,
  size = 10,
}: {
  x: number;
  y: number;
  name?: string;
  rest: string;
  size?: number;
}) {
  const text = name ? `${name} · ${rest}` : rest;
  // A system-ui character's mean advance at weight 500, and the card's inner padding and height, in figure units.
  const pad = size * 0.7;
  const width = text.length * size * 0.55 + 2 * pad;
  const h = size * 2;
  return (
    <g>
      <rect
        x={x}
        y={y - h / 2 + 1.5}
        width={width}
        height={h}
        rx={h * 0.3}
        className="fill-slate-200"
      />
      <rect
        x={x}
        y={y - h / 2}
        width={width}
        height={h}
        rx={h * 0.3}
        className="fill-white stroke-slate-200"
        strokeWidth={1}
      />
      <Label x={x + pad} y={y} size={size} weight={500} tone="muted">
        {name ? (
          <tspan className="fill-slate-700" fontWeight={600}>
            {name}
          </tspan>
        ) : null}
        {name ? ' · ' : null}
        {rest}
      </Label>
    </g>
  );
}
