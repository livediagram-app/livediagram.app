// Illustrations for the Element Indicators article (docs/specs/008-canvas/element-indicators.md):
// the three styles side by side, where the indicators sit on a box, a round shape and an element
// too small for them, and a mind map root's commands appearing on hover. Glyphs, words and hover
// cards are lifted from apps/live: components/canvas/ElementIndicators.tsx and
// components/canvas/indicator-items.ts. Each glyph is drawn in the element's own text colour at
// half strength, the way the editor draws it at rest.

import type { ReactNode } from 'react';
import { Cursor, Label, Scene, Shape } from './primitives';

type GlyphKind = 'link' | 'note' | 'action' | 'comment' | 'outline' | 'tidy';

/** One indicator glyph, drawn in a 14-unit box centred on (cx, cy). `strength` is the opacity:
 *  0.5 at rest, 0.85 while the element is hovered, 1 under the pointer. */
function Glyph({
  kind,
  cx,
  cy,
  scale = 1,
  strength = 0.5,
}: {
  kind: GlyphKind;
  cx: number;
  cy: number;
  scale?: number;
  strength?: number;
}) {
  const s = {
    className: 'stroke-slate-800',
    strokeWidth: 1.5,
    fill: 'none',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
  } as const;
  let body: ReactNode;
  switch (kind) {
    case 'link':
      body = (
        <g {...s}>
          <path d="M-2 2 L2 -2" />
          <path d="M-0.5 -3.5 L1.2 -5.2 a2.6 2.6 0 0 1 3.7 3.7 L3.2 0.2" />
          <path d="M0.5 3.5 L-1.2 5.2 a2.6 2.6 0 0 1 -3.7 -3.7 L-3.2 -0.2" />
        </g>
      );
      break;
    case 'note':
      body = (
        <g {...s}>
          <rect x={-4.5} y={-5.5} width={9} height={11} rx={1.5} />
          <path d="M-2 -2 H2 M-2 0.8 H2 M-2 3.4 H0.5" />
        </g>
      );
      break;
    case 'action':
      body = (
        <g {...s}>
          <rect x={-4.5} y={-4.5} width={9} height={10.5} rx={1.5} />
          <rect x={-2} y={-6} width={4} height={2.6} rx={0.8} />
          <path d="M-2 1 L-0.5 2.6 L2.4 -0.4" />
        </g>
      );
      break;
    case 'comment':
      body = (
        <path d="M-5.5 -4.5 H5.5 V2.5 H-1 L-4 5.5 V2.5 H-5.5 Z" {...s} strokeLinejoin="round" />
      );
      break;
    case 'outline':
      body = (
        <g {...s}>
          <path d="M-5 -4 H5 M-2 0 H5 M-2 4 H5" />
          <path d="M-5 0 H-4 M-5 4 H-4" />
        </g>
      );
      break;
    case 'tidy':
      body = (
        <g {...s}>
          <circle cx={-4} cy={0} r={1.6} />
          <circle cx={4} cy={-4} r={1.6} />
          <circle cx={4} cy={4} r={1.6} />
          <path d="M-2.4 0 H0 V-4 H2.4 M0 0 V4 H2.4" />
        </g>
      );
      break;
  }
  return (
    <g transform={`translate(${cx} ${cy}) scale(${scale})`} opacity={strength}>
      {body}
    </g>
  );
}

/** The comment glyph with its count beside it, as Top draws it. */
function CommentCount({
  cx,
  cy,
  count,
  strength = 0.5,
}: {
  cx: number;
  cy: number;
  count: number;
  strength?: number;
}) {
  return (
    <g>
      <Glyph kind="comment" cx={cx} cy={cy} strength={strength} />
      <g opacity={strength}>
        <Label x={cx + 8} y={cy + 0.5} size={10} weight={700} tone="strong">
          {count}
        </Label>
      </g>
    </g>
  );
}

// --- The three styles ---------------------------------------------------------------------------

/** One element with a link, a note and two comments, drawn in each of Top, Footer and Off. */
export function IndicatorStylesScene() {
  const y = 44;
  const w = 124;
  const h = 84;
  const cols = [
    { x: 14, title: 'Top', hint: 'Icons near the top' },
    { x: 148, title: 'Footer', hint: 'A row along the bottom' },
    { x: 282, title: 'Off', hint: 'Nothing drawn' },
  ];
  return (
    <Scene w={420} h={190}>
      {cols.map((c, i) => (
        <g key={c.title}>
          <Shape x={c.x} y={y} w={w} h={h} />
          <Label
            x={c.x + w / 2}
            y={i === 1 ? y + 36 : y + h / 2 + (i === 0 ? 6 : 1)}
            anchor="middle"
            size={12}
            weight={500}
            tone="strong"
          >
            Checkout
          </Label>
          <Label
            x={c.x + w / 2}
            y={y + h + 22}
            anchor="middle"
            size={12}
            weight={700}
            tone="strong"
          >
            {c.title}
          </Label>
          <Label x={c.x + w / 2} y={y + h + 38} anchor="middle" size={10} tone="muted">
            {c.hint}
          </Label>
        </g>
      ))}
      {/* Top: link, note, comment along the top-right, the count last */}
      <Glyph kind="link" cx={14 + 60} cy={y + 15} />
      <Glyph kind="note" cx={14 + 78} cy={y + 15} />
      <CommentCount cx={14 + 96} cy={y + 15} count={2} />
      {/* Footer: the same three with their words, along the inside of the bottom edge */}
      {(
        [
          { kind: 'link', x: 160, word: 'Link' },
          { kind: 'note', x: 198, word: 'Note' },
        ] as const
      ).map((it) => (
        <g key={it.kind}>
          <Glyph kind={it.kind} cx={it.x} cy={y + h - 14} scale={0.86} />
          <g opacity={0.5}>
            <Label x={it.x + 9} y={y + h - 13.5} size={10} weight={500} tone="strong">
              {it.word}
            </Label>
          </g>
        </g>
      ))}
      <CommentCount cx={240} cy={y + h - 14} count={2} />
    </Scene>
  );
}

// --- Where they sit -----------------------------------------------------------------------------

/** Top on a box (top-right), on a round shape (centred along the top), and the pip on the edge
 *  of a pill too small for either. */
export function IndicatorPlacementScene() {
  // The pill: 45 degrees in from its top-right corner meets the outline here.
  const pill = { x: 292, y: 82, w: 100, h: 28 };
  const r = pill.h / 2;
  const pipX = pill.x + pill.w - r * (1 - Math.SQRT1_2);
  const pipY = pill.y + r * (1 - Math.SQRT1_2);
  return (
    <Scene w={420} h={190}>
      {/* A box: top-right */}
      <Shape x={18} y={50} w={116} h={72} />
      <Label x={76} y={92} anchor="middle" size={12} weight={500} tone="strong">
        Orders
      </Label>
      <Glyph kind="note" cx={100} cy={64} />
      <CommentCount cx={116} cy={64} count={1} />
      {/* A round shape: centred along the top */}
      <Shape x={158} y={42} w={112} h={88} kind="circle" />
      <Label x={214} y={94} anchor="middle" size={12} weight={500} tone="strong">
        Billing
      </Label>
      <Glyph kind="link" cx={206} cy={62} />
      <Glyph kind="note" cx={223} cy={62} />
      {/* Too small: the pip, a chip centred on the outline */}
      <Shape x={pill.x} y={pill.y} w={pill.w} h={pill.h} kind="stadium" />
      <Label
        x={pill.x + 42}
        y={pill.y + r + 1}
        anchor="middle"
        size={11}
        weight={500}
        tone="strong"
      >
        Done
      </Label>
      <rect
        x={pipX - 22}
        y={pipY - 10}
        width={44}
        height={20}
        rx={10}
        className="fill-white stroke-slate-300"
        strokeWidth={1}
      />
      <Glyph kind="note" cx={pipX - 11} cy={pipY} scale={0.8} />
      <Glyph kind="comment" cx={pipX + 3} cy={pipY} scale={0.8} />
      <g opacity={0.5}>
        <Label x={pipX + 10} y={pipY + 0.5} size={10} weight={700} tone="strong">
          3
        </Label>
      </g>
      <Label x={76} y={152} anchor="middle" size={10.5} tone="muted">
        Box: top-right
      </Label>
      <Label x={214} y={152} anchor="middle" size={10.5} tone="muted">
        Round: centred
      </Label>
      <Label x={342} y={152} anchor="middle" size={10.5} tone="muted">
        Too small: a chip
      </Label>
    </Scene>
  );
}

// --- A mind map root's commands -----------------------------------------------------------------

/** A hovered mind map root: Edit Outline and Tidy Map have appeared ahead of its note, the
 *  pointer rests on Edit Outline and its hover card explains it. */
export function MindRootCommandsScene() {
  const root = { x: 40, y: 92, w: 150, h: 60 };
  const gy = root.y + 15;
  return (
    <Scene w={420} h={210}>
      {/* Two branches off the root */}
      <path
        d={`M${root.x + root.w} ${root.y + root.h / 2} C226 ${root.y + root.h / 2} 226 70 262 70`}
        fill="none"
        className="stroke-brand-300"
        strokeWidth={2}
      />
      <path
        d={`M${root.x + root.w} ${root.y + root.h / 2} C226 ${root.y + root.h / 2} 226 172 262 172`}
        fill="none"
        className="stroke-brand-300"
        strokeWidth={2}
      />
      <Shape x={262} y={52} w={120} h={36} kind="stadium" label="Pricing" />
      <Shape x={262} y={154} w={120} h={36} kind="stadium" label="Launch day" />
      {/* The root, hovered: the commands lead the cluster, then the note */}
      <Shape x={root.x} y={root.y} w={root.w} h={root.h} />
      <Label x={root.x + 54} y={root.y + 40} anchor="middle" size={12} weight={600} tone="strong">
        Launch plan
      </Label>
      <rect x={root.x + 87} y={gy - 9} width={18} height={18} rx={4} className="fill-slate-100" />
      <Glyph kind="outline" cx={root.x + 96} cy={gy} strength={1} />
      <Glyph kind="tidy" cx={root.x + 116} cy={gy} strength={0.85} />
      <Glyph kind="note" cx={root.x + 135} cy={gy} strength={0.85} />
      <Cursor x={root.x + 99} y={gy + 3} />
      {/* The hover card above the command */}
      <rect
        x={root.x + 18}
        y={24}
        width={160}
        height={48}
        rx={8}
        className="fill-white stroke-slate-200"
        strokeWidth={1.2}
      />
      <Label x={root.x + 30} y={40} size={11} weight={700} tone="strong">
        Edit Outline
      </Label>
      <Label x={root.x + 30} y={58} size={10} tone="body">
        Edit the whole map as a list.
      </Label>
    </Scene>
  );
}
