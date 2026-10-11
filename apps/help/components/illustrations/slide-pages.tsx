// Slide page illustrations for the Canvas article on Slide Pages (docs/specs/018-help/help-app.md).
// Draws the real surface with its real labels: two slide pages in a row, each with its label
// ("Page 1 · Slide (16:9) · Slide") and its title-bar buttons (IllustratePages.tsx): the padlock,
// the deck button (PageDeckButton.tsx, its tooltip shown) and the cog, then the + after the last
// page. The first page is in the deck (an open eye, Hide from the presentation); the second is not
// yet (the Slide Deck icon, Add to slide deck). Composed from the shared primitives.

import type { ReactNode } from 'react';
import { Scene, Label, TextBar } from './primitives';

/** The page cog: a small round button with a gear. */
function Cog({ cx, cy }: { cx: number; cy: number }) {
  const spokes = [0, 45, 90, 135, 180, 225, 270, 315];
  return (
    <g transform={`translate(${cx} ${cy})`}>
      <circle r={8} className="fill-white stroke-slate-300" strokeWidth={1.2} />
      {spokes.map((a) => (
        <line
          key={a}
          x1={0}
          y1={-3}
          x2={0}
          y2={-4.8}
          transform={`rotate(${a})`}
          className="stroke-slate-500"
          strokeWidth={1.4}
          strokeLinecap="round"
        />
      ))}
      <circle r={2.5} fill="none" className="stroke-slate-500" strokeWidth={1.3} />
    </g>
  );
}

/** An open padlock: the page's Lock page button. */
function Padlock({ cx, cy }: { cx: number; cy: number }) {
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

/** The deck button: an open eye once the page is in the deck, else the Slide Deck icon. */
function DeckButton({ cx, cy, inDeck }: { cx: number; cy: number; inDeck: boolean }) {
  return (
    <g transform={`translate(${cx} ${cy})`}>
      <rect x={-10} y={-10} width={20} height={20} rx={5} className="fill-white stroke-brand-300" />
      {inDeck ? (
        <g>
          <path
            d="M-6 0 Q0 -6 6 0 Q0 6 -6 0 Z"
            fill="none"
            className="stroke-slate-600"
            strokeWidth={1.3}
            strokeLinejoin="round"
          />
          <circle r={1.8} className="fill-slate-600" />
        </g>
      ) : (
        <g>
          <rect
            x={-6}
            y={-5.5}
            width={12}
            height={8}
            rx={1}
            fill="none"
            className="stroke-slate-600"
            strokeWidth={1.3}
          />
          <path
            d="M0 2.5 v3 M-3 5.5 h6"
            className="stroke-slate-600"
            strokeWidth={1.3}
            strokeLinecap="round"
          />
        </g>
      )}
    </g>
  );
}

/** A dark tooltip pill naming the button under it, joined to it by a short stem. */
function Tip({ cx, y, toY, text }: { cx: number; y: number; toY: number; text: string }) {
  const w = text.length * 5.6 + 16;
  return (
    <g>
      <line x1={cx} y1={y + 18} x2={cx} y2={toY} className="stroke-slate-300" strokeWidth={1} />
      <g className="help-art-as-drawn">
        <rect x={cx - w / 2} y={y} width={w} height={18} rx={5} className="fill-slate-800" />
      </g>
      <Label x={cx} y={y + 9.5} anchor="middle" size={10} weight={500} tone="onAccent">
        {text}
      </Label>
    </g>
  );
}

/** A 16:9 slide on the canvas, with a soft edge. */
function Slide({ x, y, children }: { x: number; y: number; children?: ReactNode }) {
  return (
    <g>
      <rect x={x + 2} y={y + 3} width={200} height={112} rx={2} className="fill-slate-200" />
      <rect
        x={x}
        y={y}
        width={200}
        height={112}
        rx={2}
        className="fill-white stroke-slate-200"
        strokeWidth={1.2}
      />
      {children}
    </g>
  );
}

/** A slide page's title bar: its label on the left, the padlock, deck button and cog on the right. */
function TitleBar({
  x,
  y,
  label,
  inDeck,
}: {
  x: number;
  y: number;
  label: string;
  inDeck: boolean;
}) {
  return (
    <g>
      <Label x={x} y={y} size={8} weight={600} tone="body">
        {label}
      </Label>
      <Padlock cx={x + 150} cy={y} />
      <DeckButton cx={x + 171} cy={y} inDeck={inDeck} />
      <Cog cx={x + 192} cy={y} />
    </g>
  );
}

/** Two slide pages: the first in the deck (its eye), the second not yet (Add to slide deck). */
export function SlidePagesScene() {
  const y = 66;
  const sy = y + 14;
  return (
    <Scene w={480} h={214}>
      <Tip cx={187} y={14} toY={y - 10} text="Hide from the presentation" />
      <Tip cx={403} y={14} toY={y - 10} text="Add to slide deck" />
      {/* Page 1: a Title Slide layout */}
      <TitleBar x={16} y={y} label="Page 1 · Slide (16:9) · Slide" inDeck />
      <Slide x={16} y={sy}>
        <TextBar x={34} y={sy + 30} w={120} h={11} tone="accent" />
        <TextBar x={34} y={sy + 50} w={86} />
        <rect x={34} y={sy + 62} width={28} height={3} rx={1.5} className="fill-brand-500" />
        <TextBar x={34} y={sy + 94} w={46} h={5} tone="faint" />
        <TextBar x={160} y={sy + 94} w={40} h={5} tone="faint" />
      </Slide>
      {/* Page 2: a Title and Bullets layout */}
      <TitleBar x={232} y={y} label="Page 2 · Slide (16:9) · Slide" inDeck={false} />
      <Slide x={232} y={sy}>
        <TextBar x={250} y={sy + 16} w={96} h={9} tone="accent" />
        {[0, 1, 2, 3, 4].map((i) => (
          <g key={i}>
            <circle cx={254} cy={sy + 40 + i * 13} r={2.4} className="fill-brand-500" />
            <TextBar x={262} y={sy + 37.5 + i * 13} w={[110, 92, 120, 80, 100][i]!} h={5} />
          </g>
        ))}
      </Slide>
      {/* The + after the last page */}
      <g>
        <rect
          x={444}
          y={sy + 42}
          width={28}
          height={28}
          rx={8}
          className="fill-white stroke-slate-300"
          strokeWidth={1.3}
          strokeDasharray="3 3"
        />
        <path
          d={`M458 ${sy + 49} v14 M451 ${sy + 56} h14`}
          className="stroke-slate-500"
          strokeWidth={1.8}
          strokeLinecap="round"
        />
      </g>
    </Scene>
  );
}
