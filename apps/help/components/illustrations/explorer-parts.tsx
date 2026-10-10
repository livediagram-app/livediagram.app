// The Explorer illustrations' own building blocks (docs/specs/018-help/help-app.md): a sidebar row and
// its glyph.
//
// Split out of explorer.tsx, which labelled these "Building blocks" and then
// ran 420 lines of them before its first scene. Same split as the marketing
// feature-art files: parts here, complete scenes next door.
//
// Explorer-specific by design. ./primitives holds the house style every
// illustration category shares (Scene, Avatar, Label, TextBar, Button); these
// two are only ever wanted by the Explorer scenes.

import { Label } from './primitives';

/** A single sidebar row: an icon glyph, a label, and an optional count badge.
 *  `active` tints it the selected brand state. */
export function SidebarRow({
  x,
  y,
  w,
  label,
  count,
  active = false,
  indent = 0,
  glyph,
}: {
  x: number;
  y: number;
  w: number;
  label: string;
  count?: number;
  active?: boolean;
  indent?: number;
  glyph?: 'recent' | 'shared' | 'folder' | 'team' | 'image' | 'theme' | 'doc';
}) {
  const rowH = 22;
  const gx = x + 16 + indent;
  return (
    <g>
      {active && (
        <rect x={x + 8} y={y} width={w - 16} height={rowH} rx={7} className="fill-brand-50" />
      )}
      <g transform={`translate(${gx} ${y + rowH / 2})`}>
        <SidebarGlyph kind={glyph ?? 'doc'} active={active} />
      </g>
      <Label
        x={gx + 16}
        y={y + rowH / 2 + 1}
        size={10}
        weight={active ? 700 : 500}
        tone={active ? 'accent' : 'body'}
      >
        {label}
      </Label>
      {count !== undefined && (
        <g>
          <rect
            x={x + w - 30}
            y={y + 4}
            width={22}
            height={14}
            rx={7}
            className={
              active ? 'fill-brand-500' : 'fill-slate-200 dark:fill-(--help-art-slate-800)'
            }
          />
          <Label
            x={x + w - 19}
            y={y + 11}
            anchor="middle"
            size={9}
            weight={700}
            tone={active ? 'onAccent' : 'muted'}
          >
            {count}
          </Label>
        </g>
      )}
    </g>
  );
}

/** Small 14x14 sidebar icon glyphs, centred at the origin. */
export function SidebarGlyph({
  kind,
  active = false,
}: {
  kind: 'recent' | 'shared' | 'folder' | 'team' | 'image' | 'theme' | 'doc';
  active?: boolean;
}) {
  const stroke = active ? 'stroke-brand-600' : 'stroke-slate-400';
  const fill = active ? 'fill-brand-500' : 'fill-slate-400';
  switch (kind) {
    case 'recent':
      return (
        <g className={stroke} strokeWidth={1.6} fill="none" strokeLinecap="round">
          <circle cx={0} cy={0} r={6} />
          <path d="M0 -3 V0 L2.5 2" />
        </g>
      );
    case 'shared':
      return (
        <g
          className={stroke}
          strokeWidth={1.6}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx={-3} cy={-2} r={2.4} />
          <path d="M-6.5 5 a3.5 3 0 0 1 7 0" />
          <circle cx={4} cy={-1} r={2} />
          <path d="M1.5 5 a3 2.6 0 0 1 6 0" />
        </g>
      );
    case 'folder':
      return (
        <path
          d="M-6 -4 h4 l1.5 2 h6.5 v6 h-12 Z"
          className={`${stroke} ${active ? 'fill-brand-100' : 'fill-slate-100'}`}
          strokeWidth={1.6}
          strokeLinejoin="round"
        />
      );
    case 'team':
      return (
        <g
          className={stroke}
          strokeWidth={1.6}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx={0} cy={-3} r={2.4} />
          <path d="M-4 5 a4 3.4 0 0 1 8 0" />
        </g>
      );
    case 'image':
      return (
        <g>
          <rect
            x={-6}
            y={-5}
            width={12}
            height={10}
            rx={1.5}
            className={`${stroke} fill-none`}
            strokeWidth={1.6}
          />
          <circle cx={-2.5} cy={-1.5} r={1.3} className={fill} />
          <path d="M-6 3 L-1 -1 L2 1 L6 -2 V5 h-12 Z" className={fill} />
        </g>
      );
    case 'theme':
      return (
        <g className={stroke} strokeWidth={1.6} fill="none">
          <circle cx={0} cy={0} r={6} />
          <circle cx={-2} cy={-2} r={1.2} className={fill} stroke="none" />
          <circle cx={2.5} cy={-1} r={1.2} className={fill} stroke="none" />
          <circle cx={1} cy={2.5} r={1.2} className={fill} stroke="none" />
        </g>
      );
    default:
      return (
        <g className={stroke} strokeWidth={1.6} fill="none" strokeLinejoin="round">
          <path d="M-4 -6 h6 l3 3 v9 h-9 Z" />
          <path d="M2 -6 v3 h3" />
        </g>
      );
  }
}
