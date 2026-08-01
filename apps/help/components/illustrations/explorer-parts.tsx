// The Explorer illustrations' own building blocks (spec/55): a sidebar row and
// its glyph, a diagram card and its thumbnail, a list row, and the assembled
// sidebar the wider scenes drop in whole.
//
// Split out of explorer.tsx, which labelled these "Building blocks" and then
// ran 420 lines of them before its first scene. Same split as the marketing
// feature-art files: parts here, complete scenes next door.
//
// Explorer-specific by design. ./primitives holds the house style every
// illustration category shares (Scene, Avatar, Label, TextBar, Button); these
// six are only ever wanted by the Explorer scenes.

import { Avatar, Label, TextBar } from './primitives';

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
            className={active ? 'fill-brand-500' : 'fill-slate-200'}
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

/** A diagram card: a small canvas thumbnail above a title bar and meta line.
 *  Optional owner avatar badge for "shared" cards. */
export function DiagramCard({
  x,
  y,
  w = 96,
  h = 80,
  title,
  thumb = 'flow',
  owner,
  shared = false,
}: {
  x: number;
  y: number;
  w?: number;
  h?: number;
  title?: string;
  thumb?: 'flow' | 'tree' | 'grid';
  owner?: { initial: string; colour: 'emerald' | 'violet' | 'amber' | 'rose' | 'brand' };
  shared?: boolean;
}) {
  const thumbH = h - 28;
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={8}
        className="fill-white stroke-slate-200"
        strokeWidth={1.5}
      />
      <rect x={x} y={y} width={w} height={thumbH} rx={8} className="fill-slate-50" />
      <rect x={x} y={y + thumbH - 8} width={w} height={8} className="fill-slate-50" />
      <CardThumb x={x} y={y} w={w} h={thumbH} kind={thumb} />
      {title && (
        <Label x={x + 9} y={y + thumbH + 11} size={9.5} weight={600} tone="strong">
          {title}
        </Label>
      )}
      <TextBar x={x + 9} y={y + thumbH + 18} w={w - 40} h={4} tone="faint" />
      {shared && (
        <g>
          <rect
            x={x + w - 30}
            y={y + 6}
            width={24}
            height={13}
            rx={6.5}
            className="fill-emerald-100"
          />
          <Label
            x={x + w - 18}
            y={y + 13}
            anchor="middle"
            size={7.5}
            weight={700}
            className="fill-emerald-600"
          >
            shared
          </Label>
        </g>
      )}
      {owner && (
        <Avatar
          cx={x + w - 13}
          cy={y + thumbH + 13}
          r={8}
          initial={owner.initial}
          colour={owner.colour}
        />
      )}
    </g>
  );
}

/** Miniature diagram motif drawn inside a card thumbnail. */
function CardThumb({
  x,
  y,
  w,
  h,
  kind,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  kind: 'flow' | 'tree' | 'grid';
}) {
  const cx = x + w / 2;
  const cy = y + h / 2;
  if (kind === 'tree') {
    return (
      <g>
        <rect x={cx - 9} y={y + 8} width={18} height={9} rx={2} className="fill-brand-300" />
        <rect x={x + 12} y={cy + 6} width={16} height={9} rx={2} className="fill-brand-200" />
        <rect x={x + w - 28} y={cy + 6} width={16} height={9} rx={2} className="fill-brand-200" />
        <path
          d={`M${cx} ${y + 17} V${cy + 2} M${x + 20} ${cy + 2} H${x + w - 20} M${x + 20} ${cy + 2} V${cy + 6} M${x + w - 20} ${cy + 2} V${cy + 6}`}
          className="stroke-slate-300"
          strokeWidth={1.4}
          fill="none"
        />
      </g>
    );
  }
  if (kind === 'grid') {
    return (
      <g>
        {[0, 1, 2, 3].map((i) => (
          <rect
            key={i}
            x={x + 12 + (i % 2) * 24}
            y={y + 9 + Math.floor(i / 2) * 18}
            width={18}
            height={12}
            rx={2}
            className={i % 3 === 0 ? 'fill-brand-300' : 'fill-brand-100'}
          />
        ))}
      </g>
    );
  }
  return (
    <g>
      <rect x={x + 11} y={cy - 6} width={18} height={12} rx={2} className="fill-brand-300" />
      <ellipse cx={x + w - 18} cy={cy} rx={9} ry={6} className="fill-brand-100" />
      <path
        d={`M${x + 29} ${cy} H${x + w - 28}`}
        className="stroke-brand-400"
        strokeWidth={1.6}
        fill="none"
      />
    </g>
  );
}

/** A diagram list row: thumbnail dot, title, meta, and a kebab menu affordance. */
export function DiagramRow({
  x,
  y,
  w,
  title,
  meta,
  active = false,
}: {
  x: number;
  y: number;
  w: number;
  title: string;
  meta?: string;
  active?: boolean;
}) {
  const h = 30;
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={7}
        className={active ? 'fill-brand-50 stroke-brand-200' : 'fill-white stroke-slate-200'}
        strokeWidth={1.5}
      />
      <rect
        x={x + 8}
        y={y + 7}
        width={22}
        height={16}
        rx={3}
        className="fill-slate-100 stroke-slate-200"
        strokeWidth={1}
      />
      <rect x={x + 11} y={y + 11} width={9} height={8} rx={1.5} className="fill-brand-300" />
      <Label x={x + 40} y={y + 12} size={10} weight={600} tone="strong">
        {title}
      </Label>
      {meta && (
        <Label x={x + 40} y={y + 22} size={8} tone="muted">
          {meta}
        </Label>
      )}
      <g className="fill-slate-300">
        <circle cx={x + w - 12} cy={y + h / 2 - 4} r={1.4} />
        <circle cx={x + w - 12} cy={y + h / 2} r={1.4} />
        <circle cx={x + w - 12} cy={y + h / 2 + 4} r={1.4} />
      </g>
    </g>
  );
}

/** The Explorer sidebar column with its three groups of sections. Reused by the
 *  full-page overview. */
export function ExplorerSidebar({
  x,
  y,
  w,
  h,
  active = 0,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  active?: number;
}) {
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={10}
        className="fill-slate-50 stroke-slate-200"
        strokeWidth={1.5}
      />
      {/* Brand mark */}
      <circle cx={x + 22} cy={y + 20} r={6} className="fill-brand-500" />
      <Label x={x + 34} y={y + 21} size={11} weight={700} tone="strong">
        Explorer
      </Label>
      <SidebarRow
        x={x}
        y={y + 40}
        w={w}
        label="Recent"
        count={8}
        active={active === 0}
        glyph="recent"
      />
      <SidebarRow
        x={x}
        y={y + 66}
        w={w}
        label="Shared with you"
        count={3}
        active={active === 1}
        glyph="shared"
      />
      <Label x={x + 18} y={y + 100} size={8} weight={700} tone="muted">
        MY WORK
      </Label>
      <SidebarRow x={x} y={y + 108} w={w} label="Unsorted" active={active === 2} glyph="folder" />
      <SidebarRow x={x} y={y + 134} w={w} label="Projects" active={active === 3} glyph="folder" />
      <Label x={x + 18} y={y + 168} size={8} weight={700} tone="muted">
        TEAMS
      </Label>
      <SidebarRow
        x={x}
        y={y + 176}
        w={w}
        label="Design"
        count={4}
        active={active === 4}
        glyph="team"
      />
    </g>
  );
}
