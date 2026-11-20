// The editor chrome every app's help art shares (liveworkspace/docs/specs/017-help/help-centre.md "Figures"): the
// floating white card with its hairline and soft lift, the lucide glyph renderer, the top-right corner card (Share,
// Sign In) and the bottom tab bar (tabs, +, Tools, Settings, notifications, appearance), measured off the real
// editors at 1280 wide and drawn at 0.55 of their size. Each edition's editor-chrome.tsx adds its own logo, menu,
// strip and corner cluster on top.

import type { ReactNode } from 'react';
import {
  lucideBell,
  lucideBriefcase,
  lucideLogIn,
  lucideMenu,
  lucidePalette,
  lucideSearch,
  lucideShare2,
  lucideSlidersHorizontal,
  lucideUndo2,
} from '@liveworkspace/icons/lucide';
import { Label, Lift } from './primitives';

/** One drawing instruction of a glyph in lucide's 24-unit box. */
export type Prim =
  | { t: 'path'; d: string }
  | { t: 'circle'; cx: number; cy: number; r: number }
  | { t: 'line'; x1: number; y1: number; x2: number; y2: number }
  | { t: 'rect'; x: number; y: number; w: number; h: number; rx?: number }
  | { t: string; [k: string]: unknown };

const MONITOR: readonly Prim[] = [
  { t: 'rect', x: 2, y: 3, w: 20, h: 14, rx: 2 },
  { t: 'path', d: 'M8 21h8M12 17v4' },
];

/** A lucide glyph centred on (x, y), `size` units square, stroked in `className`. */
export function Icon({
  prims,
  x,
  y,
  size = 10,
  className = 'stroke-slate-600',
  flip = false,
}: {
  prims: readonly Prim[];
  x: number;
  y: number;
  size?: number;
  className?: string;
  flip?: boolean;
}) {
  const k = size / 24;
  return (
    <g
      transform={`translate(${x - size / 2 + (flip ? size : 0)} ${y - size / 2}) scale(${flip ? -k : k} ${k})`}
      className={className}
      fill="none"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {prims.map((p, i) => {
        if (p.t === 'path') return <path key={i} d={p.d as string} />;
        if (p.t === 'circle')
          return <circle key={i} cx={p.cx as number} cy={p.cy as number} r={p.r as number} />;
        if (p.t === 'line')
          return (
            <line
              key={i}
              x1={p.x1 as number}
              y1={p.y1 as number}
              x2={p.x2 as number}
              y2={p.y2 as number}
            />
          );
        if (p.t === 'rect')
          return (
            <rect
              key={i}
              x={p.x as number}
              y={p.y as number}
              width={p.w as number}
              height={p.h as number}
              rx={(p.rx as number) ?? 0}
            />
          );
        return null;
      })}
    </g>
  );
}

/** The glyphs every editor's chrome draws. */
export const CHROME_ICONS = {
  search: lucideSearch,
  menu: lucideMenu,
  share: lucideShare2,
  signIn: lucideLogIn,
  undo: lucideUndo2,
  palette: lucidePalette,
  tools: lucideBriefcase,
  settings: lucideSlidersHorizontal,
  bell: lucideBell,
  monitor: MONITOR,
} as const;
const ICONS = CHROME_ICONS;

/** The chrome's card height and corner radius (the editor's 46px cards, rounded-xl). */
export const CARD_H = 26;
const R = 6;

/** A floating chrome card: white, a hairline border, the soft lift. */
export function Card({
  x,
  y,
  w,
  h = CARD_H,
  r = R,
  children,
}: {
  x: number;
  y: number;
  w: number;
  h?: number;
  r?: number;
  children?: ReactNode;
}) {
  return (
    <g>
      <Lift x={x} y={y} w={w} h={h} r={r} />
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={r}
        className="fill-white stroke-slate-200"
        strokeWidth={0.75}
      />
      {children}
    </g>
  );
}

// --- Top right ---------------------------------------------------------------

export const CORNER_W = 54;

/** The corner card at the top right: Share, then Sign In (or the account's initial once signed in). */
export function CornerCard({ x, y, initial }: { x: number; y: number; initial?: string }) {
  const cy = y + CARD_H / 2;
  return (
    <Card x={x} y={y} w={CORNER_W}>
      <Icon prims={ICONS.share} x={x + 14} y={cy} size={9} />
      {initial ? (
        <g>
          <circle cx={x + 40} cy={cy} r={7} className="fill-brand-600" />
          <Label x={x + 40} y={cy + 0.5} size={8} weight={700} anchor="middle" tone="onAccent">
            {initial}
          </Label>
        </g>
      ) : (
        <Icon prims={ICONS.signIn} x={x + 40} y={cy} size={9} />
      )}
    </Card>
  );
}

// --- The bottom bar ----------------------------------------------------------

export const BAR_H = 26;

/** One tab on the bottom bar from x: the open one a white card standing on the bar's foot with its name in the brand colour
 *  and its ⋯, the others bare names. Returns nothing about width: pass `w`. */
export function BarTab({
  x,
  y,
  w,
  label,
  active = false,
}: {
  x: number;
  y: number;
  w: number;
  label: string;
  active?: boolean;
}) {
  return (
    <g>
      {active && (
        <path
          d={`M${x} ${y + BAR_H} V${y + 9} a5 5 0 0 1 5 -5 H${x + w - 5} a5 5 0 0 1 5 5 V${y + BAR_H}`}
          className="fill-white stroke-slate-200"
          strokeWidth={0.75}
        />
      )}
      <Label
        x={x + 8}
        y={y + 15.5}
        size={9}
        weight={active ? 600 : 500}
        tone={active ? 'accent' : 'body'}
        className={active ? 'fill-brand-700' : undefined}
      >
        {label}
      </Label>
      {active && (
        <g className="fill-brand-700">
          <circle cx={x + w - 14} cy={y + 15} r={0.9} />
          <circle cx={x + w - 11} cy={y + 15} r={0.9} />
          <circle cx={x + w - 8} cy={y + 15} r={0.9} />
        </g>
      )}
    </g>
  );
}

/** The bottom bar across a scene `w` wide with its top at y: the tabs (`tabs`, the first open unless `active`
 *  says), +, then Tools, Settings, notifications and the appearance switch at the right. `compact` drops the
 *  Tools and Settings names, as a narrow window does. */
export function BottomBar({
  y,
  w,
  x = 0,
  tabs = ['Tab 1'],
  active = 0,
  compact = false,
  firstTabW,
  plusGap = 0,
}: {
  y: number;
  w: number;
  x?: number;
  tabs?: string[];
  active?: number;
  compact?: boolean;
  /** The open tab's width when it carries more than its name (who is on it). */
  firstTabW?: number;
  /** Room left before the + for what a scene draws there (a tab folder). */
  plusGap?: number;
}) {
  const widths = tabs.map((label, i) =>
    i === 0 && firstTabW ? firstTabW : Math.round(label.length * 5 + (i === active ? 30 : 16)),
  );
  // Each tab's left edge, the tabs laid end to end 2 apart; the last entry is where the + goes.
  const lefts = widths.reduce<number[]>((acc, tw) => [...acc, acc.at(-1)! + tw + 2], [x + 8]);
  const at = lefts.at(-1)!;
  const placed = tabs.map((label, i) => (
    <BarTab key={label} x={lefts[i]!} y={y} w={widths[i]!} label={label} active={i === active} />
  ));
  const cy = y + 15;
  const right = x + w;
  return (
    <g>
      <rect x={x} y={y} width={w} height={BAR_H} className="fill-slate-100" />
      <line x1={x} y1={y} x2={right} y2={y} className="stroke-slate-200" strokeWidth={0.75} />
      {placed}
      <Icon
        prims={[{ t: 'path', d: 'M5 12h14M12 5v14' }]}
        x={at + plusGap + 8}
        y={cy}
        size={8}
        className="stroke-slate-500"
      />
      {compact ? (
        <>
          <Icon prims={ICONS.tools} x={right - 70} y={cy} size={8} />
          <Icon prims={ICONS.settings} x={right - 52} y={cy} size={8} />
        </>
      ) : (
        <>
          <Icon prims={ICONS.tools} x={right - 133} y={cy} size={8} />
          <Label x={right - 126} y={cy + 0.5} size={9} tone="body">
            Tools
          </Label>
          <Icon prims={ICONS.settings} x={right - 90} y={cy} size={8} />
          <Label x={right - 83} y={cy + 0.5} size={9} tone="body">
            Settings
          </Label>
        </>
      )}
      <Icon prims={ICONS.bell} x={right - 34} y={cy} size={8} />
      <Icon prims={ICONS.monitor} x={right - 13} y={cy} size={8} />
    </g>
  );
}
