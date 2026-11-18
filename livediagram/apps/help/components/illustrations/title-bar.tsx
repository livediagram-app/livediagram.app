// The editor's top corners for the User Interface › The Top Corners article (docs/specs/018-help/help-app.md).
// Drawn from the live chrome: the logo card and the menu card at the top left (ToolbarExplorerButton, with the
// editor mode switch beside the menu button), and the corner card at the top right (EditorCornerActions: Present,
// Share and the account). There is no header bar: the canvas runs to the top of the screen and these cards float on
// it. Labels are the real UI strings.

import type { ReactNode } from 'react';
import { Avatar, Label, Scene, Shape } from '@liveworkspace/help-site/art/primitives';

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

function PlayGlyph({ x, y }: { x: number; y: number }) {
  return (
    <Glyph x={x} y={y} cls="stroke-slate-600">
      <path d="M-2.5 -4 v8 l6.5 -4 z" />
    </Glyph>
  );
}

function MenuGlyph({ x, y }: { x: number; y: number }) {
  return (
    <Glyph x={x} y={y} cls="stroke-slate-600">
      <path d="M-5 -3.5 h10 M-5 0 h10 M-5 3.5 h10" />
    </Glyph>
  );
}

/** A thin leader from a card down to its words. */
function Callout({
  x,
  from,
  labelY,
  text,
  anchor = 'middle',
  labelX,
}: {
  x: number;
  from: number;
  labelY: number;
  text: string;
  anchor?: 'start' | 'middle' | 'end';
  labelX?: number;
}) {
  return (
    <g>
      <line
        x1={x}
        y1={from}
        x2={x}
        y2={labelY - 9}
        className="stroke-slate-300"
        strokeWidth={1}
        strokeDasharray="2 2"
      />
      <circle cx={x} cy={from} r={1.8} className="fill-slate-400" />
      <Label x={labelX ?? x} y={labelY} size={10} weight={600} tone="body" anchor={anchor}>
        {text}
      </Label>
    </g>
  );
}

/** The top of the canvas as the owner of a shared canvas sees it on a computer: the logo card and the menu card
 *  (the Explorer's menu button and the Diagram mode switch) at the left, and the corner card at the right with
 *  Present, a solid Share (the canvas has a live link) and the account. */
export function TopCorners() {
  const y = 12;
  const h = 32;
  return (
    <Scene w={420} h={150}>
      {/* The logo, in a card of its own. */}
      <rect
        x={10}
        y={y}
        width={34}
        height={h}
        rx={8}
        className="fill-white stroke-slate-200"
        strokeWidth={1.2}
      />
      <rect x={17} y={y + 6} width={20} height={20} rx={5} className="fill-brand-500" />
      <path
        d={`M22 ${y + 19} l4 -6 l3 4 l3 -3`}
        className="stroke-white help-art-as-drawn"
        fill="none"
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* The menu card: the menu button and the mode switch. */}
      <rect
        x={50}
        y={y}
        width={98}
        height={h}
        rx={8}
        className="fill-white stroke-slate-200"
        strokeWidth={1.2}
      />
      <MenuGlyph x={66} y={y + 16} />
      <rect x={80} y={y + 6} width={62} height={20} rx={6} className="fill-slate-100" />
      <Label x={88} y={y + 17} size={10} weight={600} tone="body">
        Diagram
      </Label>
      <path
        d={`M131 ${y + 15} l3 3 l3 -3`}
        className="stroke-slate-400"
        fill="none"
        strokeWidth={1.3}
        strokeLinecap="round"
      />

      {/* The corner card: Present, Share (solid: a live link) and the account. */}
      <rect
        x={226}
        y={y}
        width={184}
        height={h}
        rx={8}
        className="fill-white stroke-slate-200"
        strokeWidth={1.2}
      />
      <PlayGlyph x={240} y={y + 16} />
      <Label x={248} y={y + 17} size={10} weight={500} tone="body">
        Present
      </Label>
      <rect x={292} y={y + 4} width={58} height={24} rx={6} className="fill-brand-700" />
      <ShareGlyph x={305} y={y + 16} />
      <Label x={315} y={y + 17} size={10} weight={600} tone="onAccent">
        Share
      </Label>
      <Avatar cx={366} cy={y + 16} r={8} initial="S" />
      <Label x={378} y={y + 17} size={10} weight={500} tone="body">
        Sam
      </Label>

      {/* The canvas runs up underneath them. */}
      <Shape x={150} y={78} w={100} h={40} label="Checkout" />

      <Callout x={27} from={y + h} labelY={72} text="Logo" />
      <Callout x={66} from={y + h} labelY={92} text="Explorer" />
      <Callout x={111} from={y + h} labelY={134} text="Editor mode" />
      <Callout x={258} from={y + h} labelY={134} text="Present" />
      <Callout x={321} from={y + h} labelY={72} text="Share" />
      <Callout x={380} from={y + h} labelY={92} text="Account" anchor="end" labelX={410} />
    </Scene>
  );
}
