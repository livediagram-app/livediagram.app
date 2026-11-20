// livehuddle's editor chrome as it stands on a computer (apps/editor/components/chrome and palette), measured off the
// real editor at 1280 wide and drawn at 0.55 of its size: the logo card and the menu card top-left, the palette strip
// (Edit | Walk, then the icon-only categories Write, Rooms, Seats, Perks, Play, Garden, Meet, Travel, then Search),
// the corner card top-right (Share, Sign In), the corner cluster bottom-right (Undo | Redo, Theme & Canvas, zoom) and
// the bottom bar (the tab card, +, Tools, Settings, notifications, appearance). Icons are the real lucide glyphs.
// Every card is white with a 0.75 hairline and the kit's soft Lift, as the editor's `shadow-md` cards are.

import type { ReactNode } from 'react';
import {
  lucideArmchair,
  lucideBell,
  lucideBriefcase,
  lucideCircleDot,
  lucideHand,
  lucideMessageCircle,
  lucidePartyPopper,
  lucideScissors,
  lucideUser,
  lucideCoffee,
  lucideFootprints,
  lucideLogIn,
  lucideMenu,
  lucidePalette,
  lucidePanelsTopLeft,
  lucidePencil,
  lucideSearch,
  lucideShare2,
  lucideSlidersHorizontal,
  lucideSquareDashedMousePointer,
  lucideTreePine,
  lucideUndo2,
  lucideWine,
} from '@liveworkspace/icons/lucide';
import { Label, Lift } from '@liveworkspace/help-site/art/primitives';

type Prim =
  | { t: 'path'; d: string }
  | { t: 'circle'; cx: number; cy: number; r: number }
  | { t: 'line'; x1: number; y1: number; x2: number; y2: number }
  | { t: 'rect'; x: number; y: number; w: number; h: number; rx?: number }
  | { t: string; [k: string]: unknown };

// The palette's own glyphs that are not lucide's: Meet's screen (palette-icons-meeting ScreenIcon) and Travel's door
// with its arrow (MoveGroupIcon), in lucide's 24-unit box.
const SCREEN: readonly Prim[] = [
  { t: 'rect', x: 2.5, y: 4, w: 19, h: 12.5, rx: 1.5 },
  { t: 'path', d: 'M6 13l3.5-3.5 2.5 2.5 2-2 4 3' },
  { t: 'path', d: 'M12 16.5V20M8.5 20h7' },
];
const TRAVEL: readonly Prim[] = [
  { t: 'path', d: 'M4 20V6.5a1 1 0 0 1 .8-1l7-1.4a1 1 0 0 1 1.2 1V20' },
  { t: 'path', d: 'M2.6 20h12.8M17 9.5h4.4M19.2 7.3l2.2 2.2-2.2 2.2' },
];
const SHIRT: readonly Prim[] = [
  {
    t: 'path',
    d: 'M20.38 3.46 16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.47a1 1 0 0 0 .99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 0 0 2-2V10h2.15a1 1 0 0 0 .99-.84l.58-3.47a2 2 0 0 0-1.34-2.23z',
  },
];
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

export const ICONS = {
  edit: lucideSquareDashedMousePointer,
  walk: lucideFootprints,
  write: lucidePencil,
  rooms: lucidePanelsTopLeft,
  seats: lucideArmchair,
  perks: lucideCoffee,
  play: lucideWine,
  garden: lucideTreePine,
  meet: SCREEN,
  travel: TRAVEL,
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

/** livehuddle's mark: the green stacked block, its top face lit, drawn about its centre (x, y), `s` across. */
export function Mark({ x, y, s = 13 }: { x: number; y: number; s?: number }) {
  const h = s / 2;
  const q = s / 4;
  return (
    <g className="help-art-as-drawn">
      <path
        d={`M${x - h} ${y - q} L${x} ${y - h} L${x + h} ${y - q} L${x} ${y} Z`}
        className="fill-emerald-300"
      />
      <path
        d={`M${x - h} ${y - q} L${x} ${y} V${y + h} L${x - h} ${y + q} Z`}
        className="fill-emerald-600"
      />
      <path
        d={`M${x + h} ${y - q} L${x} ${y} V${y + h} L${x + h} ${y + q} Z`}
        className="fill-emerald-800"
      />
      <path
        d={`M${x - h} ${y + q * 0.1} L${x} ${y + q} L${x + h} ${y + q * 0.1}`}
        className="stroke-emerald-200/70"
        strokeWidth={s / 16}
        fill="none"
      />
    </g>
  );
}

export const LOGO_W = 80;

/** The logo's card at the top left: the mark, then "live" in the brand green and "huddle" in ink. */
export function LogoCard({ x, y }: { x: number; y: number }) {
  return (
    <Card x={x} y={y} w={LOGO_W}>
      <Mark x={x + 14} y={y + CARD_H / 2} />
      <text
        x={x + 25}
        y={y + CARD_H / 2 + 0.5}
        fontSize={10.5}
        fontWeight={650}
        letterSpacing={-0.3}
        dominantBaseline="middle"
        style={{ fontFamily: 'system-ui, sans-serif' }}
      >
        <tspan className="fill-brand-700">live</tspan>
        <tspan className="fill-slate-900">huddle</tspan>
      </text>
    </Card>
  );
}

export const MENU_W = 28;

/** The menu card beside the logo: the menu button alone. */
export function MenuButtonCard({ x, y }: { x: number; y: number }) {
  return (
    <Card x={x} y={y} w={MENU_W}>
      <Icon prims={ICONS.menu} x={x + MENU_W / 2} y={y + CARD_H / 2} />
    </Card>
  );
}

/** The logo card and the menu card side by side from (x, y); 114 wide. */
export function TopLeftCards({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <LogoCard x={x} y={y} />
      <MenuButtonCard x={x + LOGO_W + 6} y={y} />
    </g>
  );
}
export const TOP_LEFT_W = LOGO_W + 6 + MENU_W;

// --- The palette strip -------------------------------------------------------

export type StripItem =
  'write' | 'rooms' | 'seats' | 'perks' | 'play' | 'garden' | 'meet' | 'travel' | 'search';

/** The strip's width. */
export const STRIP_W = 320;

// Each category button's centre, from the strip's left edge (the real strip at 0.55).
const SLOTS: Record<StripItem, number> = {
  write: 110,
  rooms: 136,
  seats: 159,
  perks: 182,
  play: 204,
  garden: 227,
  meet: 250,
  travel: 276,
  search: 304,
};
const DIVIDERS = [97, 123, 263, 289];

/** The centre of a category's button on a strip drawn at x. */
export function stripSlot(x: number, item: StripItem): number {
  return x + SLOTS[item];
}

/** The Edit | Walk toggle, top-left at (x, y), 90 wide and 20 tall: the side you are on in solid brand green. */
export function EditWalk({
  x,
  y,
  on = 'edit',
  walkDisabled = false,
}: {
  x: number;
  y: number;
  on?: 'edit' | 'walk';
  walkDisabled?: boolean;
}) {
  const side = (key: 'edit' | 'walk', name: string, at: number) => {
    const active = on === key;
    return (
      <g opacity={key === 'walk' && walkDisabled ? 0.4 : 1}>
        {active && (
          <rect x={at} y={y + 1.5} width={44} height={17} rx={4} className="fill-brand-700" />
        )}
        <g className={active ? 'help-art-as-drawn' : undefined}>
          <Icon
            prims={ICONS[key]}
            x={at + 12}
            y={y + 10}
            size={9}
            className={active ? 'stroke-white' : 'stroke-slate-500'}
          />
        </g>
        <Label x={at + 20} y={y + 10.5} size={9} weight={600} tone={active ? 'onAccent' : 'body'}>
          {name}
        </Label>
      </g>
    );
  };
  return (
    <g>
      <rect x={x} y={y} width={90} height={20} rx={5} className="fill-slate-100" />
      {side('edit', 'Edit', x + 1.5)}
      {side('walk', 'Walk', x + 45)}
    </g>
  );
}

/** The walking strip's width. */
export const WALK_STRIP_W = 272;
// While walking the strip carries the walker's own controls: Avatar, Clothes, Hair, Emotes, then Hand and React,
// then Chat on its pale green tile (the real strip at 0.55, from its left edge).
const WALK_SLOTS: [readonly Prim[], number][] = [
  [lucideUser, 110],
  [SHIRT, 133],
  [lucideScissors, 156],
  [lucideCircleDot, 179],
  [lucideHand, 207],
  [lucidePartyPopper, 230],
  [lucideMessageCircle, 258],
];

/** The strip while walking, top-left at (x, y), WALK_STRIP_W wide: Edit | Walk with Walk on, then the walker's
 *  controls. */
export function WalkStrip({ x, y }: { x: number; y: number }) {
  return (
    <Card x={x} y={y} w={WALK_STRIP_W}>
      <EditWalk x={x + 4} y={y + 3} on="walk" />
      {[97, 193, 244].map((d) => (
        <line
          key={d}
          x1={x + d}
          y1={y + 7}
          x2={x + d}
          y2={y + CARD_H - 7}
          className="stroke-slate-200"
          strokeWidth={0.75}
        />
      ))}
      <rect x={x + 247} y={y + 3} width={22} height={20} rx={5} className="fill-brand-50" />
      {WALK_SLOTS.map(([prims, at], i) => (
        <Icon
          key={at}
          prims={prims}
          x={x + at}
          y={y + CARD_H / 2}
          className={i === WALK_SLOTS.length - 1 ? 'stroke-brand-700' : 'stroke-slate-600'}
        />
      ))}
    </Card>
  );
}

/** The palette strip, top-left at (x, y), STRIP_W wide: Edit | Walk, then the categories as icon buttons, `open`
 *  pressed (its flyout showing), Search last on its pale green tile. */
export function Strip({
  x,
  y,
  open,
  on = 'edit',
}: {
  x: number;
  y: number;
  open?: StripItem;
  on?: 'edit' | 'walk';
}) {
  const cy = y + CARD_H / 2;
  return (
    <Card x={x} y={y} w={STRIP_W}>
      <EditWalk x={x + 4} y={y + 3} on={on} />
      {DIVIDERS.map((d) => (
        <line
          key={d}
          x1={x + d}
          y1={y + 7}
          x2={x + d}
          y2={y + CARD_H - 7}
          className="stroke-slate-200"
          strokeWidth={0.75}
        />
      ))}
      {(Object.keys(SLOTS) as StripItem[]).map((item) => {
        const cx = x + SLOTS[item];
        const pressed = item === open;
        const search = item === 'search';
        return (
          <g key={item}>
            {(pressed || search) && (
              <rect
                x={cx - 11}
                y={y + 3}
                width={22}
                height={20}
                rx={5}
                className={pressed && !search ? 'fill-brand-100' : 'fill-brand-50'}
              />
            )}
            {pressed && !search && (
              <rect
                x={cx - 5}
                y={y + 21}
                width={10}
                height={1.5}
                rx={0.75}
                className="fill-brand-600"
              />
            )}
            <Icon
              prims={ICONS[item]}
              x={cx}
              y={cy}
              className={pressed || search ? 'stroke-brand-700' : 'stroke-slate-600'}
            />
          </g>
        );
      })}
    </Card>
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

// --- Bottom right ------------------------------------------------------------

export const CLUSTER_W = 162;
const BTN = 24;

/** The corner cluster, top-left at (x, y): Undo | Redo, Theme & Canvas, then the zoom card (minus, the level, plus).
 *  `canRedo` lights Redo, greyed out until there is something to redo. */
export function CornerCluster({
  x,
  y,
  level = '100%',
  canRedo = false,
  canUndo = true,
  highlight,
}: {
  x: number;
  y: number;
  level?: string;
  canRedo?: boolean;
  canUndo?: boolean;
  highlight?: 'undo' | 'redo' | 'theme' | 'zoom';
}) {
  const cy = y + BTN / 2;
  const ring = (rx: number, w: number) => (
    <rect
      x={rx - 1.5}
      y={y - 1.5}
      width={w + 3}
      height={BTN + 3}
      rx={7}
      className="fill-none stroke-brand-500"
      strokeWidth={1.25}
    />
  );
  return (
    <g>
      <Card x={x} y={y} w={48} h={BTN}>
        <line
          x1={x + 24}
          y1={y}
          x2={x + 24}
          y2={y + BTN}
          className="stroke-slate-100"
          strokeWidth={0.75}
        />
        <Icon
          prims={ICONS.undo}
          x={x + 12}
          y={cy}
          size={8}
          className={canUndo ? 'stroke-slate-600' : 'stroke-slate-300'}
        />
        <Icon
          prims={ICONS.undo}
          x={x + 36}
          y={cy}
          size={8}
          flip
          className={canRedo ? 'stroke-slate-600' : 'stroke-slate-300'}
        />
      </Card>
      <Card x={x + 53} y={y} w={BTN} h={BTN}>
        <Icon prims={ICONS.palette} x={x + 65} y={cy} size={10} />
      </Card>
      <Card x={x + 82} y={y} w={80} h={BTN}>
        <Icon prims={[{ t: 'path', d: 'M5 12h14' }]} x={x + 94} y={cy} size={8} />
        <Label x={x + 122} y={cy + 0.5} size={9} weight={500} tone="strong" anchor="middle">
          {level}
        </Label>
        <Icon prims={[{ t: 'path', d: 'M5 12h14M12 5v14' }]} x={x + 150} y={cy} size={8} />
      </Card>
      {highlight === 'undo' && ring(x, 24)}
      {highlight === 'redo' && ring(x + 24, 24)}
      {highlight === 'theme' && ring(x + 53, BTN)}
      {highlight === 'zoom' && ring(x + 82, 80)}
    </g>
  );
}

// --- The bottom bar ----------------------------------------------------------

export const BAR_H = 26;

/** One tab on the bottom bar from x: the open one a white card standing on the bar's foot with its name in green
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
  let at = x + 8;
  const placed = tabs.map((label, i) => {
    const tw =
      i === 0 && firstTabW ? firstTabW : Math.round(label.length * 5 + (i === active ? 30 : 16));
    const el = <BarTab key={label} x={at} y={y} w={tw} label={label} active={i === active} />;
    at += tw + 2;
    return el;
  });
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

/** The whole top row across a scene `w` wide: the logo and menu cards at the left, the strip centred in the room
 *  left between them and the corner card (or straight after the menu card when `noCorner`). */
export function TopRow({
  w,
  y = 8,
  open,
  on,
  noCorner = false,
  initial,
}: {
  w: number;
  y?: number;
  open?: StripItem;
  on?: 'edit' | 'walk';
  noCorner?: boolean;
  initial?: string;
}) {
  const stripX = noCorner
    ? 8 + TOP_LEFT_W + 8
    : Math.round(Math.max(8 + TOP_LEFT_W + 8, (w - STRIP_W) / 2));
  return (
    <g>
      <TopLeftCards x={8} y={y} />
      <Strip x={stripX} y={y} open={open} on={on} />
      {!noCorner && <CornerCard x={w - 8 - CORNER_W} y={y} initial={initial} />}
    </g>
  );
}

/** Where `TopRow` puts the strip in a scene `w` wide. */
export function topRowStripX(w: number, noCorner = false): number {
  return noCorner
    ? 8 + TOP_LEFT_W + 8
    : Math.round(Math.max(8 + TOP_LEFT_W + 8, (w - STRIP_W) / 2));
}
