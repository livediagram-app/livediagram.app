// Slide page illustrations for the Canvas article on Slide Pages (docs/specs/018-help/help-app.md).
// Draws the real surface with its real labels: two slide pages in a row, each with its label
// ("Slide (16:9)") and its title bar card (CanvasPages.tsx, PageTitleBar.tsx), its controls as icons at
// this size: Layout and Background (page-title-bar.tsx), then Notes once the page is in the deck
// (PageNotesButton.tsx, its tooltip shown on the second), then the padlock and the cog, then the + after the last page. A
// page's place in the deck (Hide in Slides) is in its Contents menu, not its title bar. Composed from the shared
// primitives.

import type { ReactNode } from 'react';
import { Scene, Label, TextBar } from '@liveworkspace/help-site/art/primitives';
import {
  BackgroundGlyph,
  CogGlyph,
  LayoutGlyph,
  PadlockGlyph,
  PageLabel,
  TitleBarCard,
  titleBarLayout,
  type TitleBarItem,
} from './page-title-bar';

/** Notes: the card stack a slide's note cards wear (NoteCardsIcon.tsx, 16 units drawn at 14). */
function NotesGlyph({ cx, cy }: { cx: number; cy: number; on?: boolean }) {
  return (
    <g
      transform={`translate(${cx - 7} ${cy - 7}) scale(0.875)`}
      fill="none"
      className="stroke-slate-500"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4.5 3.5V3a1 1 0 0 1 1-1h7a1 1 0 0 1 1 1v6.5a1 1 0 0 1-1 1H12" />
      <rect x="2" y="5" width="9.5" height="9" rx="1.2" />
      <path d="M4.5 8.5h4.5M4.5 11h3" />
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

/** A slide page's title bar card: Layout and Background, then Notes (in the deck), then the
 *  padlock and the cog, its right edge at the page's. */
const slideBar = (inDeck: boolean): TitleBarItem[][] => [
  [{ Glyph: LayoutGlyph }, { Glyph: BackgroundGlyph }],
  inDeck ? [{ Glyph: NotesGlyph }] : [],
  [{ Glyph: PadlockGlyph }, { Glyph: CogGlyph }],
];

/** A slide page's label on the left (its size, which says Slide) and its title bar card on the right. */
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
      <PageLabel x={x} y={y} size={8} rest={label} />
      <TitleBarCard right={x + SW} cy={y} groups={slideBar(inDeck)} />
    </g>
  );
}

/** Two slide pages, both in the deck as every slide page is: the second's Notes named. */
export function SlidePagesScene() {
  const y = 66;
  const sy = y + 14;
  // The second page's Notes, which the tooltip names.
  const notesCx = titleBarLayout(252 + SW, slideBar(true)).items[2]!.cx;
  return (
    <Scene w={524} h={220}>
      <Tip cx={notesCx} y={14} toY={y - 10} text="Notes" />
      {/* Page 1: a Title Slide layout */}
      <TitleBar x={16} y={y} label="Slide (16:9)" inDeck />
      <Slide x={16} y={sy}>
        <TextBar x={34} y={sy + 30} w={120} h={11} tone="accent" />
        <TextBar x={34} y={sy + 50} w={86} />
        <rect x={34} y={sy + 62} width={28} height={3} rx={1.5} className="fill-brand-500" />
        <TextBar x={34} y={sy + 106} w={46} h={5} tone="faint" />
        <TextBar x={180} y={sy + 106} w={40} h={5} tone="faint" />
      </Slide>
      {/* Page 2: a Title and Bullets layout */}
      <TitleBar x={252} y={y} label="Slide (16:9)" inDeck />
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
