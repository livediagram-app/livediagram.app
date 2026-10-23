// The page title bar's buttons (docs/specs/007-editor/pages-mode.md "Beside the
// cog"), drawn once for every scene that shows a page: Layout (PageLayoutsButton.tsx, the
// panels-top-left glyph), Background (PageBackgroundButton.tsx, the paint roller) and the page's padlock (PageLockButton.tsx). Each
// glyph is drawn about 12 units square around its centre; `TitleButton` frames one as the title
// bar does, named beside its icon while the page has room, tinted while its popover is open.

import type { ReactElement } from 'react';
import { Label } from './primitives';

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
