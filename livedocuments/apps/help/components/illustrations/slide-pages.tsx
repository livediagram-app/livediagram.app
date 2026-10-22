// Slide page illustrations for the Canvas article on Slide Pages (docs/specs/018-help/help-app.md).
// Draws the real surface with its real labels: two slide pages in a row, each with its label
// ("Page 1 · Slide (16:9)") and its title-bar buttons (CanvasPages.tsx), as icons at
// this size: the deck button first (PageDeckButton.tsx, its tooltip shown), Add Notes once the page is in the deck
// (PageNotesButton.tsx), Layout, Background (page-title-bar.tsx), the padlock and the cog, then the + after the
// last page. The first page is in the deck (an open eye, Hide in Slides); the second is not yet (the Slide Deck
// icon, Add to Slides). Composed from the shared primitives.

import type { ReactNode } from 'react';
import { Scene, Label, TextBar } from './primitives';
import { BackgroundGlyph, LayoutGlyph, PadlockGlyph, TitleIcon } from './page-title-bar';

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

/** Add Notes: a page with three lines of writing (PageNotesButton.tsx). */
function NotesGlyph({ cx, cy }: { cx: number; cy: number }) {
  return (
    <g
      transform={`translate(${cx} ${cy})`}
      fill="none"
      className="stroke-slate-500"
      strokeWidth={1.3}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M-4.5 -5.5 h6 l3 3 v8 h-9 Z" />
      <path d="M-2.5 -0.5 h5 M-2.5 2.5 h5" />
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

// A 16:9 slide's size in the scene.
const SW = 220;
const SH = 124;

/** A 16:9 slide on the canvas, with a soft edge. */
function Slide({ x, y, children }: { x: number; y: number; children?: ReactNode }) {
  return (
    <g>
      <rect x={x + 2} y={y + 3} width={SW} height={SH} rx={2} className="fill-slate-200" />
      <rect
        x={x}
        y={y}
        width={SW}
        height={SH}
        rx={2}
        className="fill-white stroke-slate-200"
        strokeWidth={1.2}
      />
      {children}
    </g>
  );
}

/** A slide page's title bar: its label on the left; the deck button, Add Notes (in the deck),
 *  Layout, Background, the padlock and the cog on the right. */
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
      <DeckButton cx={x + SW - (inDeck ? 92 : 74)} cy={y} inDeck={inDeck} />
      {inDeck ? <TitleIcon cx={x + SW - 72} cy={y} Glyph={NotesGlyph} /> : null}
      <TitleIcon cx={x + SW - 56} cy={y} Glyph={LayoutGlyph} />
      <TitleIcon cx={x + SW - 40} cy={y} Glyph={BackgroundGlyph} />
      <TitleIcon cx={x + SW - 24} cy={y} Glyph={PadlockGlyph} />
      <Cog cx={x + SW - 8} cy={y} />
    </g>
  );
}

/** Two slide pages, both in the deck as every slide page is: the first's eye, the second's Add Notes. */
export function SlidePagesScene() {
  const y = 66;
  const sy = y + 14;
  return (
    <Scene w={524} h={220}>
      <Tip cx={144} y={14} toY={y - 10} text="Hide in Slides" />
      <Tip cx={400} y={14} toY={y - 10} text="Add Notes" />
      {/* Page 1: a Title Slide layout */}
      <TitleBar x={16} y={y} label="Page 1 · Slide (16:9)" inDeck />
      <Slide x={16} y={sy}>
        <TextBar x={34} y={sy + 30} w={120} h={11} tone="accent" />
        <TextBar x={34} y={sy + 50} w={86} />
        <rect x={34} y={sy + 62} width={28} height={3} rx={1.5} className="fill-brand-500" />
        <TextBar x={34} y={sy + 106} w={46} h={5} tone="faint" />
        <TextBar x={180} y={sy + 106} w={40} h={5} tone="faint" />
      </Slide>
      {/* Page 2: a Title and Bullets layout */}
      <TitleBar x={252} y={y} label="Page 2 · Slide (16:9)" inDeck />
      <Slide x={252} y={sy}>
        <TextBar x={270} y={sy + 16} w={96} h={9} tone="accent" />
        {[0, 1, 2, 3, 4].map((i) => (
          <g key={i}>
            <circle cx={274} cy={sy + 40 + i * 13} r={2.4} className="fill-brand-500" />
            <TextBar x={282} y={sy + 37.5 + i * 13} w={[110, 92, 120, 80, 100][i]!} h={5} />
          </g>
        ))}
      </Slide>
      {/* The + after the last page */}
      <g>
        <rect
          x={486}
          y={sy + 48}
          width={28}
          height={28}
          rx={8}
          className="fill-white stroke-slate-300"
          strokeWidth={1.3}
          strokeDasharray="3 3"
        />
        <path
          d={`M500 ${sy + 55} v14 M493 ${sy + 62} h14`}
          className="stroke-slate-500"
          strokeWidth={1.8}
          strokeLinecap="round"
        />
      </g>
    </Scene>
  );
}
