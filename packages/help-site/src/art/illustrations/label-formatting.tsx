// The label editing toolbar, for the Canvas article on Formatting Label Text
// (docs/specs/018-help/help-app.md). Draws the real toolbar with its real labels
// (canvas/RichTextToolbar.tsx): Bold, Italic, Underline and Strikethrough, the block type dropdown
// open on its six entries (rich-text/block-type.ts), the alignment dropdown and the text colour
// swatch, floating above the shape whose label is being edited. Composed from the shared primitives.

import type { ReactNode } from 'react';
import { Scene, Label } from '../primitives';

/** One square toolbar button; `on` marks a toggle that is pressed. */
function ToolButton({
  x,
  y,
  on = false,
  children,
}: {
  x: number;
  y: number;
  on?: boolean;
  children: ReactNode;
}) {
  return (
    <g>
      {on && <rect x={x} y={y} width={28} height={28} rx={6} className="fill-brand-100" />}
      <g transform={`translate(${x + 14} ${y + 14})`}>{children}</g>
    </g>
  );
}

/** A small down chevron, as every toolbar dropdown trigger ends with. */
function Chevron({ x, y }: { x: number; y: number }) {
  return (
    <path
      d={`M${x - 3} ${y - 1.5} l3 3 l3 -3`}
      fill="none"
      className="stroke-slate-500"
      strokeWidth={1.3}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  );
}

/** The thin divider between the toolbar's groups. */
function Divider({ x, y }: { x: number; y: number }) {
  return <line x1={x} y1={y} x2={x} y2={y + 20} className="stroke-slate-200" strokeWidth={1} />;
}

const BLOCK_TYPES = [
  'Paragraph',
  'Heading 1',
  'Heading 2',
  'Heading 3',
  'Bullet point',
  'Numbered point',
];

/** The label toolbar above a shape being edited, with its block type dropdown open. */
export function LabelEditingToolbar() {
  const tx = 30;
  const ty = 18;
  const by = ty + 6;
  return (
    <Scene w={420} h={250}>
      {/* The toolbar: one row of plain buttons in a white card. */}
      <rect
        x={tx}
        y={ty}
        width={334}
        height={40}
        rx={9}
        className="fill-white stroke-slate-200"
        strokeWidth={1.5}
      />
      <ToolButton x={tx + 6} y={by} on>
        <Label x={0} y={1} anchor="middle" size={14} weight={800} tone="accent">
          B
        </Label>
      </ToolButton>
      <ToolButton x={tx + 38} y={by}>
        <text
          x={0}
          y={1}
          fontSize={14}
          fontStyle="italic"
          fontWeight={600}
          textAnchor="middle"
          dominantBaseline="middle"
          className="fill-slate-600"
          style={{ fontFamily: 'Georgia, serif' }}
        >
          I
        </text>
      </ToolButton>
      <ToolButton x={tx + 70} y={by}>
        <Label x={0} y={0} anchor="middle" size={13} weight={600} tone="body">
          U
        </Label>
        <line x1={-5} y1={8} x2={5} y2={8} className="stroke-slate-600" strokeWidth={1.4} />
      </ToolButton>
      <ToolButton x={tx + 102} y={by}>
        <Label x={0} y={1} anchor="middle" size={13} weight={600} tone="body">
          S
        </Label>
        <line x1={-6} y1={1} x2={6} y2={1} className="stroke-slate-600" strokeWidth={1.4} />
      </ToolButton>
      <Divider x={tx + 136} y={ty + 10} />
      {/* Block type: the current type's name and a chevron, pressed while its menu is open. */}
      <rect x={tx + 142} y={by} width={92} height={28} rx={6} className="fill-slate-100" />
      <Label x={tx + 150} y={by + 14.5} size={11} weight={500} tone="strong">
        Paragraph
      </Label>
      <Chevron x={tx + 222} y={by + 14} />
      <Divider x={tx + 240} y={ty + 10} />
      {/* Alignment: stacked lines whose ends follow the horizontal alignment, then a chevron. */}
      <g>
        {[14, 9, 14].map((lw, i) => (
          <line
            key={i}
            x1={tx + 260 - lw / 2}
            y1={by + 9 + i * 5}
            x2={tx + 260 + lw / 2}
            y2={by + 9 + i * 5}
            className="stroke-slate-600"
            strokeWidth={1.5}
            strokeLinecap="round"
          />
        ))}
        <Chevron x={tx + 278} y={by + 14} />
      </g>
      <Divider x={tx + 292} y={ty + 10} />
      {/* Text colour: a swatch button showing the selection's colour. */}
      <g className="help-art-as-drawn">
        <rect
          x={tx + 304}
          y={by + 5}
          width={18}
          height={18}
          rx={4}
          className="fill-rose-600 stroke-slate-900/10"
          strokeWidth={1}
        />
      </g>
      {/* The block type menu, under its trigger. */}
      <rect
        x={tx + 142}
        y={ty + 46}
        width={124}
        height={BLOCK_TYPES.length * 24 + 8}
        rx={8}
        className="fill-white stroke-slate-200"
        strokeWidth={1.5}
      />
      {BLOCK_TYPES.map((t, i) => {
        const ry = ty + 50 + i * 24;
        const on = i === 0;
        return (
          <g key={t}>
            {on && (
              <rect x={tx + 146} y={ry} width={116} height={24} rx={5} className="fill-brand-50" />
            )}
            <Label
              x={tx + 156}
              y={ry + 12.5}
              size={11}
              tone={on ? 'accent' : 'body'}
              weight={on ? 600 : 400}
            >
              {t}
            </Label>
          </g>
        );
      })}
      {/* The shape being edited: a caret in its label and a word selected and made bold. */}
      <rect
        x={tx + 2}
        y={84}
        width={130}
        height={86}
        rx={8}
        className="fill-brand-50 stroke-brand-500"
        strokeWidth={2}
      />
      <rect x={tx + 18} y={118} width={36} height={18} rx={2} className="fill-brand-200" />
      <text
        x={tx + 67}
        y={127.5}
        fontSize={13}
        textAnchor="middle"
        dominantBaseline="middle"
        className="fill-slate-800"
        style={{ fontFamily: 'system-ui, sans-serif' }}
      >
        <tspan fontWeight={800}>Ship</tspan>
        <tspan dx={4} className="fill-rose-600">
          on Friday
        </tspan>
      </text>
    </Scene>
  );
}
