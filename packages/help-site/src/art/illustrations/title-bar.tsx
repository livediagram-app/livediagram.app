// The editor's top corners for the User Interface › The Top Corners article (liveworkspace/docs/specs/017-help/help-centre.md; the
// article keeps its `title-bar` slug). There is no bar across the top: two cards float over the canvas. Drawn from the
// live chrome: the menu card at the top left (the editor's components/chrome/ToolbarExplorerButton.tsx: the logo, the
// Explorer menu button and, in livediagram, the mode switch), the palette strip between them, and the actions card at
// the top right (@liveworkspace/workbench's EditorCornerActions: Share, solid once shared, and the account). Labels
// are the real UI strings.

import type { ReactNode } from 'react';
import { Avatar, Label, Scene } from '../primitives';

const STROKE = {
  fill: 'none',
  strokeWidth: 1.3,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const;

function Glyph({
  x,
  y,
  cls,
  children,
}: {
  x: number;
  y: number;
  cls: string;
  children: ReactNode;
}) {
  return (
    <g transform={`translate(${x} ${y})`} className={cls} {...STROKE}>
      {children}
    </g>
  );
}

function ShareGlyph({ x, y }: { x: number; y: number }) {
  return (
    <Glyph x={x} y={y} cls="stroke-white help-art-as-drawn">
      <circle cx={-3.5} cy={0} r={1.5} />
      <circle cx={3.5} cy={-4} r={1.5} />
      <circle cx={3.5} cy={4} r={1.5} />
      <path d="M-2.2 -0.7 l4.4 -2.6 M-2.2 0.7 l4.4 2.6" />
    </Glyph>
  );
}

// The cards' row: 12 from the top, 40 tall, as the editor draws them (12px from the corner, the strip's height).
const TOP = 12;
const H = 40;
const MID = TOP + H / 2;
const CARD = 'fill-white stroke-slate-200';

/** A callout under the cards: a thin leader from their foot down to its words. */
function Callout({
  x,
  row,
  text,
  anchor = 'middle',
  labelX,
}: {
  x: number;
  row: 1 | 2;
  text: string;
  anchor?: 'start' | 'middle' | 'end';
  labelX?: number;
}) {
  const labelY = row === 1 ? 80 : 102;
  return (
    <g>
      <line
        x1={x}
        y1={TOP + H + 4}
        x2={x}
        y2={labelY - 9}
        className="stroke-slate-300"
        strokeWidth={1}
        strokeDasharray="2 2"
      />
      <circle cx={x} cy={TOP + H + 4} r={1.8} className="fill-slate-400" />
      <Label x={labelX ?? x} y={labelY} size={10} weight={600} tone="body" anchor={anchor}>
        {text}
      </Label>
    </g>
  );
}

/** The top of the editor as the owner of a shared piece of work sees it: the menu card (the product's logo, the
 *  Explorer menu button and, where the app has one, the mode switch reading `mode`), the palette strip, and the
 *  actions card with a solid Share button and the account. */
export function TitleBarParts({ product, mode }: { product: string; mode?: string }) {
  const menuX = mode ? 126 : 122;
  const leftW = mode ? 206 : 136;
  const stripX = 8 + leftW + 10;
  const rightX = 318;
  const stripW = rightX - 10 - stripX;
  const tiles = Math.max(3, Math.floor((stripW - 16) / 22));
  return (
    <Scene w={420} h={114}>
      {/* The canvas behind the cards. */}
      <rect x={0} y={0} width={420} height={114} rx={8} className="fill-slate-50" />

      {/* The menu card: the logo, then the Explorer menu button, then the mode switch. */}
      <rect x={8} y={TOP} width={leftW} height={H} rx={10} className={CARD} strokeWidth={1.2} />
      <rect x={16} y={TOP + 10} width={20} height={20} rx={5} className="fill-brand-500" />
      <path
        d={`M21 ${TOP + 23} l4 -6 l3 4 l3 -3`}
        className="stroke-white help-art-as-drawn"
        fill="none"
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Label x={42} y={MID + 1} size={10} weight={600} tone="body">
        {product}
      </Label>
      <Glyph x={menuX} y={MID} cls="stroke-slate-600">
        <path d="M-6 -4 h12 M-6 0 h12 M-6 4 h12" />
      </Glyph>
      {mode ? (
        <>
          <rect x={144} y={TOP + 7} width={64} height={26} rx={6} className="fill-brand-50" />
          <Label x={152} y={MID + 1} size={9.5} weight={600} tone="accent">
            {mode}
          </Label>
          <path
            d={`M198 ${MID - 1.5} l2.5 2.5 l2.5 -2.5`}
            className="stroke-brand-600"
            fill="none"
            strokeWidth={1.2}
            strokeLinecap="round"
          />
        </>
      ) : null}

      {/* The palette strip between the two cards (its own article). */}
      <rect
        x={stripX}
        y={TOP}
        width={stripW}
        height={H}
        rx={10}
        className={CARD}
        strokeWidth={1.2}
      />
      {Array.from({ length: tiles }, (_, i) => (
        <rect
          key={i}
          x={stripX + 10 + i * 22}
          y={TOP + 11}
          width={18}
          height={18}
          rx={4}
          className="fill-slate-100"
        />
      ))}

      {/* The actions card: Share, solid once the work has a live link, then the account. */}
      <rect x={rightX} y={TOP} width={94} height={H} rx={10} className={CARD} strokeWidth={1.2} />
      <rect x={rightX + 5} y={TOP + 5} width={54} height={30} rx={7} className="fill-brand-700" />
      <ShareGlyph x={rightX + 17} y={MID} />
      <Label x={rightX + 26} y={MID + 1} size={10.5} weight={600} tone="onAccent">
        Share
      </Label>
      <Avatar cx={rightX + 76} cy={MID} r={9} initial="S" />

      <Callout x={26} row={2} text="Logo" />
      <Callout x={menuX} row={1} text="Menu" />
      {mode ? <Callout x={176} row={2} text="Mode switch" /> : null}
      <Callout x={stripX + stripW / 2} row={mode ? 1 : 2} text="Palette" />
      <Callout x={rightX + 32} row={2} text="Share" />
      <Callout x={rightX + 76} row={1} text="Account" anchor="end" labelX={414} />
    </Scene>
  );
}
