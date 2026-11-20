// livedocuments' editor chrome as it stands on a computer (apps/editor/components/chrome and palette), measured off
// the real editor at 1280 wide and drawn at 0.55 of its size: the logo card and the menu card top-left, the palette
// strip (the selection mode, then the icon-only categories of an infographic page: Shapes, Write · Concepts,
// Components · Icons, Media · Data, then the Library and Search), the corner card top-right (Share, Sign In), the
// corner cluster bottom-right (Undo | Redo, then zoom: this editor has no Theme & Canvas button, Style sits on each
// page's title bar) and the bottom bar (the tab card, +, Tools, Settings, notifications, appearance).
//
// The card, the lucide glyph, the corner card and the bottom bar are the same in livehuddle's editor and drawn once in
// its kit; this file adds what is livedocuments' own. Every card is white with a 0.75 hairline and the soft Lift.

import type { ReactNode } from 'react';
import {
  lucideMenu,
  lucideSquareDashedMousePointer,
  lucideUndo2,
} from '@liveworkspace/icons/lucide';
import { Label } from '@liveworkspace/help-site/art/primitives';
import {
  CARD_H,
  Card,
  CornerCard,
  CORNER_W,
  Icon,
} from '@/editions/livehuddle/components/illustrations/editor-chrome';
import { STRIP_GLYPHS, STRIP_NAMES, StripGlyph, type Prim, type StripItem } from './strip-glyphs';

export { STRIP_GLYPHS, STRIP_NAMES, StripGlyph, type Prim, type StripItem };

export {
  BAR_H,
  BarTab,
  BottomBar,
  CARD_H,
  Card,
  CornerCard,
  CORNER_W,
  Icon,
  ICONS,
} from '@/editions/livehuddle/components/illustrations/editor-chrome';

// --- The logo and menu cards -------------------------------------------------

/** livedocuments' mark: the amber block, its top face lit, drawn about its centre (x, y), `s` across. */
export function Mark({ x, y, s = 13 }: { x: number; y: number; s?: number }) {
  const h = s / 2;
  const q = s / 4;
  return (
    <g className="help-art-as-drawn">
      <path
        d={`M${x - h} ${y - q} L${x} ${y - h} L${x + h} ${y - q} L${x} ${y} Z`}
        className="fill-amber-300"
      />
      <path
        d={`M${x - h} ${y - q} L${x} ${y} V${y + h} L${x - h} ${y + q} Z`}
        className="fill-amber-500"
      />
      <path
        d={`M${x + h} ${y - q} L${x} ${y} V${y + h} L${x + h} ${y + q} Z`}
        className="fill-orange-700"
      />
      <path
        d={`M${x - h} ${y + q * 0.1} L${x} ${y + q} L${x + h} ${y + q * 0.1}`}
        className="stroke-amber-100/70"
        strokeWidth={s / 16}
        fill="none"
      />
    </g>
  );
}

export const LOGO_W = 98;

/** The logo's card at the top left: the mark, then "live" in the brand and "documents" in ink. */
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
        <tspan className="fill-slate-800">documents</tspan>
      </text>
    </Card>
  );
}

export const MENU_W = 28;

/** The menu card beside the logo: the menu button alone. */
export function MenuButtonCard({ x, y }: { x: number; y: number }) {
  return (
    <Card x={x} y={y} w={MENU_W}>
      <Icon prims={lucideMenu} x={x + MENU_W / 2} y={y + CARD_H / 2} />
    </Card>
  );
}

/** The logo card and the menu card side by side from (x, y), TOP_LEFT_W wide. */
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

/** The strip's width. */
export const STRIP_W = 261;

// Each button's centre from the strip's left edge (the real strip at 0.55), and the hairlines between the bands.
const SLOTS: Record<StripItem, number> = {
  shapes: 48,
  write: 70,
  concepts: 97,
  components: 119,
  icons: 146,
  media: 168,
  data: 195,
  library: 223,
  search: 247,
};
const DIVIDERS = [35, 84, 133, 182, 210];

/** The centre of an item's button on a strip drawn at x. */
export function stripSlot(x: number, item: StripItem): number {
  return x + SLOTS[item];
}

/** The selection mode's trigger on the strip, top-left at (x, y): its tool's glyph and a chevron on the pale brand
 *  tile. `prims` swaps the glyph for another tool's (Hand, Format, Laser...). */
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
  /** A tool glyph drawn about the origin (the shared palette-modes-parts glyphs), in place of `prims`. */
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
        <g transform={`translate(${x + 10} ${y + 10}) scale(0.72)`}>{glyph}</g>
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
 *  pressed, its flyout showing), then the Library and Search on their pale brand tiles. `mode` gives the selection
 *  mode another tool's glyph. */
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
          strokeWidth={0.75}
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

export const CLUSTER_W = 133;
const BTN = 24;

/** The corner cluster, top-left at (x, y): Undo | Redo, then the zoom card (minus, the level, plus). `canRedo` lights
 *  Redo, greyed out until there is something to redo; `highlight` rings one part. */
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
  highlight?: 'undo' | 'redo' | 'zoom';
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
      <Card x={x + 53} y={y} w={80} h={BTN}>
        <Icon prims={[{ t: 'path', d: 'M5 12h14' }]} x={x + 65} y={cy} size={8} />
        <Label x={x + 93} y={cy + 0.5} size={9} weight={500} tone="strong" anchor="middle">
          {level}
        </Label>
        <Icon prims={[{ t: 'path', d: 'M5 12h14M12 5v14' }]} x={x + 121} y={cy} size={8} />
      </Card>
      {highlight === 'undo' && ring(x, 24)}
      {highlight === 'redo' && ring(x + 24, 24)}
      {highlight === 'zoom' && ring(x + 53, 80)}
    </g>
  );
}

// --- The whole top row -------------------------------------------------------

/** Where `TopRow` puts the strip in a scene `w` wide: centred in the room right of the menu card, as the editor
 *  centres it, or straight after the menu card when the room is short. */
export function topRowStripX(w: number, noCorner = false): number {
  const after = 8 + TOP_LEFT_W + 8;
  if (noCorner) return Math.round(Math.max(after, (w - STRIP_W) / 2));
  return Math.round(Math.min(Math.max(after, (w - STRIP_W) / 2), w - 8 - CORNER_W - 8 - STRIP_W));
}

/** The top row across a scene `w` wide: the logo and menu cards at the left, the strip, and the corner card at the
 *  right unless `noCorner`. A full row needs a scene about 470 wide. */
export function TopRow({
  w,
  y = 8,
  open,
  mode,
  modeOpen,
  noCorner = false,
  initial,
}: {
  w: number;
  y?: number;
  open?: StripItem;
  mode?: readonly Prim[];
  modeOpen?: boolean;
  noCorner?: boolean;
  initial?: string;
}) {
  return (
    <g>
      <TopLeftCards x={8} y={y} />
      <Strip x={topRowStripX(w, noCorner)} y={y} open={open} mode={mode} modeOpen={modeOpen} />
      {!noCorner && <CornerCard x={w - 8 - CORNER_W} y={y} initial={initial} />}
    </g>
  );
}
