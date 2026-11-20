// livediagram's editor chrome as it stands on a computer (apps/editor/components/chrome and palette), measured off the
// real editor at 1280 wide and drawn at 0.55 of its size: the logo card and the menu card top-left (the menu button
// and the mode switch, Diagram / Draw / Workshop), the palette strip (the selection mode with its chevron, then the
// icon-only categories Shapes, Write, Draw · Concepts, Layout · Icons, Tech · Library and Search), the corner card
// top-right (Share, Sign In), the corner cluster bottom-right (Undo | Redo, Cleanup · Layers · Theme, zoom) and the
// bottom bar (the tab card, +, Get Started, Tools, Settings, notifications, appearance).
//
// The card, the lucide glyph, the corner card and the bottom bar's tabs and right-hand buttons are the same as
// livehuddle's and drawn once in its kit; this file adds what is livediagram's own. A whole top row needs a scene
// about 540 wide. Every card is white with a 0.75 hairline and the kit's soft Lift.

import type { ReactNode } from 'react';
import {
  lucideBrushCleaning,
  lucideLayers,
  lucideMenu,
  lucidePalette,
  lucideSquareDashedMousePointer,
  lucideUndo2,
} from '@liveworkspace/icons/lucide';
import { Label } from '@liveworkspace/help-site/art/primitives';
import {
  BottomBar as HuddleBottomBar,
  CARD_H,
  Card,
  CornerCard,
  CORNER_W,
  Icon,
} from '@/editions/livehuddle/components/illustrations/editor-chrome';
import { ModeMark, type Mode } from './mode-mark';
import { STRIP_GLYPHS, STRIP_NAMES, StripGlyph, type Prim, type StripItem } from './strip-glyphs';

export { STRIP_GLYPHS, STRIP_NAMES, StripGlyph, type Prim, type StripItem };
export {
  BAR_H,
  BarTab,
  CARD_H,
  Card,
  CornerCard,
  CORNER_W,
  Icon,
} from '@/editions/livehuddle/components/illustrations/editor-chrome';

const HAIR = 0.75;
const PLUS: readonly Prim[] = [{ t: 'path', d: 'M5 12h14M12 5v14' }];
const MINUS: readonly Prim[] = [{ t: 'path', d: 'M5 12h14' }];

// --- The logo and menu cards -------------------------------------------------

/** livediagram's mark: the blue stacked block, its top face lit, drawn about its centre (x, y), `s` across. */
export function Mark({ x, y, s = 13 }: { x: number; y: number; s?: number }) {
  const h = s / 2;
  const q = s / 4;
  return (
    <g className="help-art-as-drawn">
      <path
        d={`M${x - h} ${y - q} L${x} ${y - h} L${x + h} ${y - q} L${x} ${y} Z`}
        className="fill-sky-300"
      />
      <path
        d={`M${x - h} ${y - q} L${x} ${y} V${y + h} L${x - h} ${y + q} Z`}
        className="fill-sky-600"
      />
      <path
        d={`M${x + h} ${y - q} L${x} ${y} V${y + h} L${x + h} ${y + q} Z`}
        className="fill-indigo-900"
      />
      <path
        d={`M${x - h} ${y + q * 0.1} L${x} ${y + q} L${x + h} ${y + q * 0.1}`}
        className="stroke-sky-200/70"
        strokeWidth={s / 16}
        fill="none"
      />
    </g>
  );
}

export const LOGO_W = 83;

/** The logo's card at the top left: the mark, then "live" in the brand blue and "diagram" in ink. */
export function LogoCard({ x, y }: { x: number; y: number }) {
  return (
    <Card x={x} y={y} w={LOGO_W}>
      <Mark x={x + 13} y={y + CARD_H / 2} />
      <text
        x={x + 23}
        y={y + CARD_H / 2 + 0.5}
        fontSize={10.5}
        fontWeight={650}
        letterSpacing={-0.35}
        dominantBaseline="middle"
        style={{ fontFamily: 'system-ui, sans-serif' }}
      >
        <tspan className="fill-brand-700">live</tspan>
        <tspan className="fill-slate-800">diagram</tspan>
      </text>
    </Card>
  );
}

export const MENU_W = 97;

/** The mode switch, top-left at (x, y), 66 wide and 20 tall: the mode's mark and name in brand on its pale tile, then
 *  the chevron. `open` deepens the tile, as while its menu is showing. */
export function ModeSwitch({
  x,
  y,
  mode = 'Diagram',
  open = false,
}: {
  x: number;
  y: number;
  mode?: Mode;
  open?: boolean;
}) {
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={66}
        height={20}
        rx={5}
        className={open ? 'fill-brand-100' : 'fill-brand-50'}
      />
      <g transform={`translate(${x + 9} ${y + 10})`}>
        <ModeMark mode={mode} scale={0.36} className="stroke-brand-700" />
      </g>
      <Label x={x + 17} y={y + 10.5} size={9} weight={600} className="fill-brand-700">
        {mode}
      </Label>
      <path
        d={`M${x + 57} ${y + 9} l2 2 l2 -2`}
        className="fill-none stroke-brand-700"
        strokeWidth={1}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </g>
  );
}

/** The menu card beside the logo: the menu button, then the mode switch. */
export function MenuCard({
  x,
  y,
  mode = 'Diagram',
  modeOpen = false,
}: {
  x: number;
  y: number;
  mode?: Mode;
  modeOpen?: boolean;
}) {
  return (
    <Card x={x} y={y} w={MENU_W}>
      <Icon prims={lucideMenu} x={x + 14} y={y + CARD_H / 2} />
      <ModeSwitch x={x + 27} y={y + 3} mode={mode} open={modeOpen} />
    </Card>
  );
}

/** The logo card and the menu card side by side from (x, y), TOP_LEFT_W wide. */
export function TopLeftCards({
  x,
  y,
  mode,
  modeOpen,
}: {
  x: number;
  y: number;
  mode?: Mode;
  modeOpen?: boolean;
}) {
  return (
    <g>
      <LogoCard x={x} y={y} />
      <MenuCard x={x + LOGO_W + 6} y={y} mode={mode} modeOpen={modeOpen} />
    </g>
  );
}
export const TOP_LEFT_W = LOGO_W + 6 + MENU_W;

// --- The palette strip -------------------------------------------------------

/** The strip's width. */
export const STRIP_W = 258;

// Each button's centre from the strip's left edge (the real strip at 0.55), and the hairlines between the bands.
const SLOTS: Record<StripItem, number> = {
  shapes: 48,
  write: 71,
  draw: 94,
  concepts: 120,
  layout: 143,
  icons: 169,
  tech: 191,
  library: 220,
  search: 244,
};
const DIVIDERS = [35, 107, 156, 206];

/** The centre of an item's button on a strip drawn at x. */
export function stripSlot(x: number, item: StripItem): number {
  return x + SLOTS[item];
}

/** The selection mode's trigger on the strip, top-left at (x, y), 29 wide: its tool's glyph and a chevron on the pale
 *  brand tile. `prims` or `glyph` swaps in another tool's glyph (Hand, Laser, Eraser...). */
export function ModeTrigger({
  x,
  y,
  prims = lucideSquareDashedMousePointer,
  glyph,
  open = false,
}: {
  x: number;
  y: number;
  prims?: readonly Prim[];
  /** A tool glyph drawn about the origin (palette-modes-parts' glyphs), in place of `prims`. */
  glyph?: ReactNode;
  open?: boolean;
}) {
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={29}
        height={20}
        rx={5}
        className={open ? 'fill-brand-100' : 'fill-brand-50'}
      />
      {glyph ? (
        <g transform={`translate(${x + 10} ${y + 10}) scale(0.62)`}>{glyph}</g>
      ) : (
        <Icon prims={prims} x={x + 10} y={y + 10} size={9.5} className="stroke-brand-700" />
      )}
      <path
        d={`M${x + 20} ${y + 9} l2 2 l2 -2`}
        className="fill-none stroke-brand-700"
        strokeWidth={1}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </g>
  );
}

/** The palette strip, top-left at (x, y), STRIP_W wide: the selection mode, the categories as icon buttons (`open`
 *  pressed, its flyout showing), then Library and Search on their pale brand tiles. */
export function Strip({
  x,
  y,
  open,
  mode,
  modeGlyph,
  modeOpen = false,
}: {
  x: number;
  y: number;
  open?: StripItem;
  mode?: readonly Prim[];
  modeGlyph?: ReactNode;
  modeOpen?: boolean;
}) {
  const cy = y + CARD_H / 2;
  return (
    <Card x={x} y={y} w={STRIP_W}>
      <ModeTrigger x={x + 3} y={y + 3} prims={mode} glyph={modeGlyph} open={modeOpen} />
      {DIVIDERS.map((d) => (
        <line
          key={d}
          x1={x + d}
          y1={y + 7}
          x2={x + d}
          y2={y + CARD_H - 7}
          className="stroke-slate-200"
          strokeWidth={HAIR}
        />
      ))}
      {(Object.keys(SLOTS) as StripItem[]).map((item) => {
        const cx = x + SLOTS[item];
        const pressed = item === open;
        const tinted = item === 'library' || item === 'search';
        return (
          <g key={item}>
            {(pressed || tinted) && (
              <rect
                x={cx - 11}
                y={y + 3}
                width={22}
                height={20}
                rx={5}
                className={pressed ? 'fill-brand-100' : 'fill-brand-50'}
              />
            )}
            {pressed && (
              <rect
                x={cx - 5}
                y={y + 21}
                width={10}
                height={1.5}
                rx={0.75}
                className="fill-brand-600"
              />
            )}
            <StripGlyph
              item={item}
              x={cx}
              y={cy}
              className={pressed || tinted ? 'stroke-brand-700' : 'stroke-slate-600'}
            />
          </g>
        );
      })}
    </Card>
  );
}

// --- Bottom right ------------------------------------------------------------

/** The corner cluster's width. */
export const CLUSTER_W = 211;
const BTN = 24;

/** The corner cluster, top-left at (x, y): Undo | Redo, then Cleanup, Layers and Theme & Canvas, then the zoom card
 *  (minus, the level, plus). `canRedo` lights Redo, greyed out until there is something to redo; `highlight` rings
 *  one part. */
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
  highlight?: 'undo' | 'redo' | 'cleanup' | 'layers' | 'theme' | 'zoom';
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
  const tools = x + 53;
  const zoom = x + 131;
  return (
    <g>
      <Card x={x} y={y} w={48} h={BTN}>
        <line
          x1={x + 24}
          y1={y}
          x2={x + 24}
          y2={y + BTN}
          className="stroke-slate-100"
          strokeWidth={HAIR}
        />
        <Icon
          prims={lucideUndo2}
          x={x + 12}
          y={cy}
          size={8}
          className={canUndo ? 'stroke-slate-600' : 'stroke-slate-300'}
        />
        <Icon
          prims={lucideUndo2}
          x={x + 36}
          y={cy}
          size={8}
          flip
          className={canRedo ? 'stroke-slate-600' : 'stroke-slate-300'}
        />
      </Card>
      <Card x={tools} y={y} w={73} h={BTN}>
        {[24, 49].map((d) => (
          <line
            key={d}
            x1={tools + d}
            y1={y}
            x2={tools + d}
            y2={y + BTN}
            className="stroke-slate-100"
            strokeWidth={HAIR}
          />
        ))}
        <Icon prims={lucideBrushCleaning} x={tools + 12} y={cy} size={10} />
        <Icon prims={lucideLayers} x={tools + 36.5} y={cy} size={10} />
        <Icon prims={lucidePalette} x={tools + 61} y={cy} size={10} />
      </Card>
      <Card x={zoom} y={y} w={80} h={BTN}>
        <Icon prims={MINUS} x={zoom + 12} y={cy} size={8} />
        <Label x={zoom + 40} y={cy + 0.5} size={9} weight={500} tone="strong" anchor="middle">
          {level}
        </Label>
        <Icon prims={PLUS} x={zoom + 68} y={cy} size={8} />
      </Card>
      {highlight === 'undo' && ring(x, 24)}
      {highlight === 'redo' && ring(x + 24, 24)}
      {highlight === 'cleanup' && ring(tools, 24)}
      {highlight === 'layers' && ring(tools + 24, 25)}
      {highlight === 'theme' && ring(tools + 49, 24)}
      {highlight === 'zoom' && ring(zoom, 80)}
    </g>
  );
}

// --- The bottom bar ----------------------------------------------------------

/** The Get Started pill, its left edge at x and its middle on cy: the brand play disc and the name on a white pill. */
export function GetStarted({ x, cy }: { x: number; cy: number }) {
  return (
    <g>
      <rect
        x={x}
        y={cy - 7.5}
        width={58}
        height={15}
        rx={7.5}
        className="fill-white stroke-slate-200"
        strokeWidth={HAIR}
      />
      <circle cx={x + 7.5} cy={cy} r={5} className="fill-brand-600" />
      <path
        d={`M${x + 6.2} ${cy - 2.3} L${x + 9.6} ${cy} L${x + 6.2} ${cy + 2.3} Z`}
        className="fill-white stroke-white"
        strokeWidth={0.6}
        strokeLinejoin="round"
      />
      <Label x={x + 15} y={cy + 0.5} size={9} tone="body">
        Get Started
      </Label>
    </g>
  );
}

/** The bottom bar across a scene `w` wide with its top at y: the tabs (`tabs`, the first open unless `active`
 *  says), +, then Get Started, Tools, Settings, notifications and the appearance switch at the right. `compact` drops
 *  Get Started and the Tools and Settings names, as a narrow window does. */
export function BottomBar({
  y,
  w,
  x = 0,
  tabs = ['Tab 1'],
  active = 0,
  compact = false,
}: {
  y: number;
  w: number;
  x?: number;
  tabs?: string[];
  active?: number;
  compact?: boolean;
}) {
  return (
    <g>
      <HuddleBottomBar y={y} w={w} x={x} tabs={tabs} active={active} compact={compact} />
      {!compact && <GetStarted x={x + w - 206} cy={y + 15} />}
    </g>
  );
}

// --- The whole top row -------------------------------------------------------

/** Where `TopRow` puts the strip in a scene `w` wide: centred between the menu card and the corner card, as the editor
 *  centres it, or straight after the menu card when the room is short. */
export function topRowStripX(w: number, noCorner = false): number {
  const left = 8 + TOP_LEFT_W;
  const right = noCorner ? w : w - 8 - CORNER_W;
  return Math.round(Math.max(left + 8, (left + right) / 2 - STRIP_W / 2));
}

/** The top row across a scene `w` wide: the logo and menu cards at the left, the strip, and the corner card at the
 *  right unless `noCorner`. A full row needs a scene about 540 wide. */
export function TopRow({
  w,
  y = 8,
  open,
  mode,
  modeOpen,
  editorMode,
  noCorner = false,
  initial,
}: {
  w: number;
  y?: number;
  open?: StripItem;
  mode?: readonly Prim[];
  modeOpen?: boolean;
  /** The mode the switch shows (Diagram unless said). */
  editorMode?: Mode;
  noCorner?: boolean;
  initial?: string;
}) {
  return (
    <g>
      <TopLeftCards x={8} y={y} mode={editorMode} />
      <Strip x={topRowStripX(w, noCorner)} y={y} open={open} mode={mode} modeOpen={modeOpen} />
      {!noCorner && <CornerCard x={w - 8 - CORNER_W} y={y} initial={initial} />}
    </g>
  );
}

/** The whole editor frame around a scene `w` by `h`: the top row, the corner cluster bottom-right and the bottom bar.
 *  The canvas between (from y 42 to h - 62) is the scene's own. */
export function EditorFrame({
  w,
  h,
  open,
  tabs,
  initial,
}: {
  w: number;
  h: number;
  open?: StripItem;
  tabs?: string[];
  initial?: string;
}) {
  return (
    <g>
      <TopRow w={w} open={open} initial={initial} />
      <CornerCluster x={w - 8 - CLUSTER_W} y={h - 26 - 8 - 24} />
      <BottomBar y={h - 26} w={w} tabs={tabs} />
    </g>
  );
}
