// Scenes for the Mind Maps articles (docs/specs/009-elements/mind-node.md): growing a branch from
// the keyboard, the Mind Map menu section's flows, and the Edit Outline dialog. Labels are the
// editor's: MIND_FLOW_LABEL (packages/document/src/mind-flow.ts), the outline toolbar
// (apps/live/components/dialogs/MindOutlineRows.tsx) and the dialog's own copy.

import type { ReactNode } from 'react';
import { Arrow, Label, Scene, Shape } from './primitives';

const tb = {
  className: 'stroke-slate-600',
  strokeWidth: 1.5,
  fill: 'none',
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const;

// The outline toolbar's buttons, icon-only as in the dialog: Bold, Italic, Underline, then
// Outdent, Indent, Move Up, Move Down and Line Break.
const TOOLBAR: { id: string; glyph: ReactNode }[] = [
  {
    id: 'bold',
    glyph: (
      <text
        x={0}
        y={1}
        fontSize={12}
        fontWeight={800}
        textAnchor="middle"
        dominantBaseline="middle"
        className="fill-slate-700"
      >
        B
      </text>
    ),
  },
  {
    id: 'italic',
    glyph: (
      <text
        x={0}
        y={1}
        fontSize={12}
        fontStyle="italic"
        fontWeight={600}
        textAnchor="middle"
        dominantBaseline="middle"
        className="fill-slate-700"
      >
        I
      </text>
    ),
  },
  {
    id: 'underline',
    glyph: (
      <g>
        <text
          x={0}
          y={0}
          fontSize={11}
          fontWeight={600}
          textAnchor="middle"
          dominantBaseline="middle"
          className="fill-slate-700"
        >
          U
        </text>
        <path d="M-4 6 H4" {...tb} />
      </g>
    ),
  },
  { id: 'outdent', glyph: <path d="M-1 -5 H6 M-1 0 H6 M-1 5 H6 M-3 -2 L-6 0 L-3 2" {...tb} /> },
  { id: 'indent', glyph: <path d="M-1 -5 H6 M-1 0 H6 M-1 5 H6 M-6 -2 L-3 0 L-6 2" {...tb} /> },
  { id: 'up', glyph: <path d="M0 6 V-6 M-4 -2 L0 -6 L4 -2" {...tb} /> },
  { id: 'down', glyph: <path d="M0 -6 V6 M-4 2 L0 6 L4 2" {...tb} /> },
  { id: 'break', glyph: <path d="M5 -5 V1 H-5 M-2 -2 L-5 1 L-2 4" {...tb} /> },
];

/** One mind node, a soft box with its label. */
function Node({
  x,
  y,
  w = 84,
  label,
  root = false,
  editing = false,
}: {
  x: number;
  y: number;
  w?: number;
  label: string;
  root?: boolean;
  editing?: boolean;
}) {
  const h = root ? 34 : 28;
  return (
    <g>
      <Shape
        x={x}
        y={y}
        w={w}
        h={h}
        accent={root}
        fill={root ? undefined : editing ? 'fill-brand-50' : 'fill-white'}
        stroke={editing ? 'stroke-brand-500' : undefined}
      />
      <Label
        x={x + 10}
        y={y + h / 2 + 1}
        size={root ? 12 : 11}
        weight={root ? 700 : 500}
        tone={root ? 'onAccent' : 'strong'}
      >
        {label}
      </Label>
      {editing && (
        <line
          x1={x + 12 + label.length * 6.2}
          y1={y + 7}
          x2={x + 12 + label.length * 6.2}
          y2={y + h - 7}
          className="stroke-brand-600"
          strokeWidth={1.5}
        />
      )}
    </g>
  );
}

/** A key cap with a caption beside it. */
function KeyHint({ x, y, k, text }: { x: number; y: number; k: string; text: string }) {
  const w = k.length * 7 + 14;
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={w}
        height={20}
        rx={5}
        className="fill-white stroke-slate-300"
        strokeWidth={1.5}
      />
      <Label x={x + w / 2} y={y + 11} size={10} weight={700} anchor="middle" tone="strong">
        {k}
      </Label>
      <Label x={x + w + 8} y={y + 11} size={10} tone="body">
        {text}
      </Label>
    </g>
  );
}

/** Growing a tree map from the keyboard: Tab put "Budget" under "Venue" one level deeper; Enter
 *  would add the next node beside it. The new node arrives joined, selected and editing. */
export function MindMapGrowth() {
  return (
    <Scene w={420} h={230}>
      <Node x={20} y={86} w={92} label="Offsite" root />
      <Node x={150} y={46} label="Venue" />
      <Node x={150} y={132} label="Agenda" />
      <Node x={290} y={30} w={100} label="Lakes" />
      <Node x={290} y={68} w={100} label="Budget" editing />
      {/* Connectors: elbow-free curves from each parent's right face. */}
      <Arrow from={[112, 103]} to={[150, 60]} kind="curved" head={false} width={2} />
      <Arrow from={[112, 103]} to={[150, 146]} kind="curved" head={false} width={2} />
      <Arrow from={[234, 60]} to={[290, 44]} kind="curved" head={false} width={2} />
      <Arrow from={[234, 60]} to={[290, 82]} kind="straight" head={false} width={2} />
      <KeyHint x={150} y={184} k="Tab" text="adds a child" />
      <KeyHint x={268} y={184} k="Enter" text="adds a sibling" />
    </Scene>
  );
}

/** A tiny map in one flow: the root (solid) and its branches, as the flow tile draws it. */
function FlowGlyph({ flow }: { flow: 'tree' | 'balanced' | 'downward' | 'bubble' }) {
  const st = { className: 'stroke-slate-500', strokeWidth: 1.4, fill: 'none' } as const;
  const leaf = 'fill-white stroke-slate-500';
  const root = 'fill-brand-500';
  switch (flow) {
    case 'tree':
      return (
        <g>
          <path d="M-8 0 H-2 V-8 H4 M-2 0 H4 M-2 0 V8 H4" {...st} />
          <rect x={-16} y={-3} width={8} height={6} rx={1.5} className={root} />
          {[-8, 0, 8].map((y) => (
            <rect key={y} x={4} y={y - 2.5} width={10} height={5} rx={1.5} className={leaf} />
          ))}
        </g>
      );
    case 'balanced':
      return (
        <g>
          <path d="M-4 0 H-8 V-6 H-10 M-8 0 V6 H-10 M4 0 H8 V-6 H10 M8 0 V6 H10" {...st} />
          <rect x={-4} y={-3} width={8} height={6} rx={1.5} className={root} />
          {(
            [
              [-18, -6],
              [-18, 6],
              [10, -6],
              [10, 6],
            ] as const
          ).map(([x, y]) => (
            <rect
              key={`${x}${y}`}
              x={x}
              y={y - 2.5}
              width={8}
              height={5}
              rx={1.5}
              className={leaf}
            />
          ))}
        </g>
      );
    case 'downward':
      return (
        <g>
          <path d="M0 -6 V-1 M-11 -1 H11 M-11 -1 V3 M0 -1 V3 M11 -1 V3" {...st} />
          <rect x={-5} y={-12} width={10} height={6} rx={1.5} className={root} />
          {[-11, 0, 11].map((x) => (
            <rect key={x} x={x - 4.5} y={3} width={9} height={6} rx={1.5} className={leaf} />
          ))}
        </g>
      );
    case 'bubble':
      return (
        <g>
          {[0, 72, 144, 216, 288].map((a) => {
            const r = (a * Math.PI) / 180;
            const x = Math.cos(r) * 11;
            const y = Math.sin(r) * 9;
            return (
              <g key={a}>
                <path d={`M0 0 L${x} ${y}`} {...st} />
                <circle cx={x} cy={y} r={3} className={leaf} strokeWidth={1.2} />
              </g>
            );
          })}
          <circle r={4.5} className={root} />
        </g>
      );
  }
}

/** The node menu's Mind Map section: the four flows (Tree current), the current flow's hint,
 *  Tidy Map, and, on a root, Edit Outline. */
export function MindMapFlows() {
  const flows = [
    { id: 'tree', label: 'Tree' },
    { id: 'balanced', label: 'Balanced' },
    { id: 'downward', label: 'Downward' },
    { id: 'bubble', label: 'Bubble' },
  ] as const;
  return (
    <Scene w={420} h={220} bg="plain">
      <rect
        x={70}
        y={14}
        width={280}
        height={194}
        rx={10}
        className="fill-white stroke-slate-200"
        strokeWidth={1.5}
      />
      <Label x={84} y={32} size={11} weight={700} tone="strong">
        Mind Map
      </Label>
      <Label x={84} y={52} size={10} tone="muted">
        Branches to the right, siblings stacked down
      </Label>
      {flows.map((f, i) => {
        const tx = 84 + i * 64;
        const on = i === 0;
        return (
          <g key={f.id}>
            <rect
              x={tx}
              y={64}
              width={58}
              height={62}
              rx={8}
              className={on ? 'fill-brand-50 stroke-brand-300' : 'fill-slate-50 stroke-slate-200'}
              strokeWidth={1.5}
            />
            <g transform={`translate(${tx + 29} 88)`}>
              <FlowGlyph flow={f.id} />
            </g>
            <Label
              x={tx + 29}
              y={115}
              size={10}
              anchor="middle"
              weight={on ? 700 : 500}
              tone={on ? 'accent' : 'body'}
            >
              {f.label}
            </Label>
          </g>
        );
      })}
      {['Tidy Map', 'Edit Outline'].map((t, i) => (
        <g key={t}>
          <rect
            x={84}
            y={138 + i * 32}
            width={250}
            height={26}
            rx={6}
            className="fill-slate-50 stroke-slate-200"
            strokeWidth={1.5}
          />
          <Label x={209} y={152 + i * 32} size={11} weight={600} anchor="middle" tone="body">
            {t}
          </Label>
        </g>
      ))}
    </Scene>
  );
}

/** The Edit Outline dialog: its toolbar, the map as nested rows (each level in its own colour),
 *  and the footer's count line beside Cancel and Save. */
export function EditOutlineDialog() {
  const rows: { level: number; text: string; bold?: boolean }[] = [
    { level: 0, text: 'Team offsite' },
    { level: 1, text: 'Venue' },
    { level: 2, text: 'Lake District' },
    { level: 1, text: 'Agenda' },
    { level: 2, text: 'Day 1: planning' },
    { level: 2, text: 'Day 2: workshops' },
  ];
  // The level colours ring: violet, sky, emerald (then amber, rose).
  const levelCls = ['fill-slate-800', 'fill-violet-500', 'fill-brand-500', 'fill-emerald-500'];
  return (
    <Scene w={420} h={262} bg="plain">
      <rect
        x={20}
        y={8}
        width={380}
        height={246}
        rx={12}
        className="fill-white stroke-slate-200"
        strokeWidth={2}
      />
      <Label x={36} y={28} size={13} weight={700} tone="strong">
        Edit Outline
      </Label>
      <Label x={36} y={46} size={10} tone="muted">
        One row per node. Tab nests a row under the one above.
      </Label>
      <line x1={20} y1={58} x2={400} y2={58} className="stroke-slate-200" strokeWidth={1.5} />
      {/* Toolbar: Bold, Italic, Underline | Outdent, Indent, Move Up, Move Down, Line Break. */}
      {TOOLBAR.map((b, i) => {
        const bx = 36 + i * 30 + (i >= 3 ? 10 : 0);
        return (
          <g key={b.id}>
            <rect
              x={bx}
              y={66}
              width={26}
              height={24}
              rx={5}
              className="fill-slate-50 stroke-slate-200"
              strokeWidth={1}
            />
            <g transform={`translate(${bx + 13} 78)`}>{b.glyph}</g>
          </g>
        );
      })}
      {rows.map((r, i) => {
        const ry = 104 + i * 21;
        const x = 40 + r.level * 20;
        return (
          <g key={r.text}>
            {r.level > 0 && <circle cx={x} cy={ry} r={3} className={levelCls[r.level]} />}
            <Label
              x={r.level === 0 ? 36 : x + 10}
              y={ry + 1}
              size={r.level === 0 ? 12 : 11}
              weight={r.level === 0 ? 700 : 500}
              className={levelCls[r.level]}
            >
              {r.text}
            </Label>
          </g>
        );
      })}
      <line x1={20} y1={226} x2={400} y2={226} className="stroke-slate-200" strokeWidth={1.5} />
      <Label x={36} y={240} size={10} tone="muted">
        1 added
      </Label>
      <rect
        x={262}
        y={230}
        width={58}
        height={20}
        rx={6}
        className="fill-white stroke-slate-300"
        strokeWidth={1.5}
      />
      <Label x={291} y={241} size={10} weight={600} anchor="middle" tone="body">
        Cancel
      </Label>
      <rect x={328} y={230} width={58} height={20} rx={6} className="fill-brand-500" />
      <Label x={357} y={241} size={10} weight={600} anchor="middle" tone="onAccent">
        Save
      </Label>
    </Scene>
  );
}
