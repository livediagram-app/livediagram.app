'use client';

import { useId } from 'react';
import {
  FURNITURE_PANEL_STROKE,
  FURNITURE_RAIL_STROKE,
  GLASS_WALL,
  glassRoomArt,
  ROOM_WALL,
  WINDOW_LIGHT,
  windowArt,
  type ShapeElement,
} from '@livehuddle/document';
import { useCanvasSurface } from '@/components/canvas/CanvasSurfaceContext';
import { WindowMoment } from './WalkUpMoments';

// A glass pane's wash of the stroke (RoomBuilderViews' GLASS_OPACITY, the export's).
const GLASS_OPACITY = 0.16;

// An id usable in `url(#...)`: React's ids carry colons.
function svgId(prefix: string, raw: string): string {
  return `${prefix}-${raw.replace(/[^a-zA-Z0-9_-]/g, '')}`;
}

// A Window (docs/specs/009-elements/room-builder.md "Window"): a frame in its wall's band, a pane with a mullion, a sill
// inside, and the patch of light it casts on the floor inside, sunlight on light paper and moonlight on dark (DEFAULTS.md
// D228). Turned onto its wall by the element's rotation, its light on its +y side (the snap turns it to face in). The
// light is drawn past the box and never takes a pointer.
export function WindowView({
  element,
  stroke,
  floor,
  animClass,
}: {
  element: ShapeElement;
  stroke: string;
  floor: string;
  animClass?: string;
}) {
  const { width, height } = element;
  const art = windowArt(width, height);
  const surface = useCanvasSurface();
  const light = WINDOW_LIGHT[surface === 'dark' ? 'dark' : 'light'];
  const gradient = svgId('lh-window-light', useId());
  return (
    <div className={`pointer-events-none absolute inset-0 ${animClass ?? ''}`}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        className="absolute inset-0 h-full w-full overflow-visible"
        role="img"
        aria-label="Window"
      >
        <defs>
          <linearGradient
            id={gradient}
            gradientUnits="userSpaceOnUse"
            x1={0}
            y1={art.fade.from}
            x2={0}
            y2={art.fade.to}
          >
            <stop offset={0} stopColor={light.colour} stopOpacity={light.opacity} />
            <stop offset={1} stopColor={light.colour} stopOpacity={0} />
          </linearGradient>
        </defs>
        <path d={art.light} fill={`url(#${gradient})`} data-window-light="" />
        <rect
          x={art.frame.x}
          y={art.frame.y}
          width={art.frame.w}
          height={art.frame.h}
          fill={floor}
          stroke={stroke}
          strokeWidth={FURNITURE_PANEL_STROKE}
        />
        <rect
          x={art.pane.x}
          y={art.pane.y}
          width={art.pane.w}
          height={art.pane.h}
          fill={stroke}
          fillOpacity={GLASS_OPACITY}
          stroke={stroke}
          strokeWidth={FURNITURE_RAIL_STROKE}
        />
        <path d={art.mullion} stroke={stroke} strokeWidth={FURNITURE_RAIL_STROKE} />
        <rect
          x={art.sill.x}
          y={art.sill.y}
          width={art.sill.w}
          height={art.sill.h}
          fill={floor}
          stroke={stroke}
          strokeWidth={FURNITURE_RAIL_STROKE}
        />
        {/* Walking up brightens its light (docs/specs/009-elements/piece-moments.md). */}
        <WindowMoment id={element.id} light={art.light} gradient={gradient} pane={art.pane} />
      </svg>
    </div>
  );
}

// A Room with glass walls (docs/specs/009-elements/office.md "Glass walls"): its floor, the walls as a see-through band
// of the stroke with a pane line and mullions, and a rectangle's back wall face as a tall pane with glints (DEFAULTS.md
// D229). The walls stand where a solid room's do, so walking and the room's call are unchanged.
export function GlassRoomView({
  element,
  stroke,
  floor,
  animClass,
}: {
  element: ShapeElement;
  stroke: string;
  floor: string;
  animClass?: string;
}) {
  const { width, height } = element;
  const art = glassRoomArt(element);
  const surface = useCanvasSurface();
  return (
    <div className={`pointer-events-none absolute inset-0 ${animClass ?? ''}`}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        className="absolute inset-0 h-full w-full overflow-visible"
        role="img"
        aria-label={`Glass room${element.label ? `, ${element.label}` : ''}`}
      >
        <path d={art.floor} fill={floor} />
        {art.faces.map((f, i) => (
          <rect
            key={i}
            x={f.x}
            y={f.y}
            width={f.w}
            height={f.h}
            rx={2}
            fill={stroke}
            fillOpacity={GLASS_WALL.face}
            stroke={stroke}
            strokeOpacity={GLASS_WALL.pane}
            strokeWidth={1}
          />
        ))}
        {art.glints ? (
          <path
            d={art.glints}
            fill="none"
            stroke="#ffffff"
            strokeOpacity={surface === 'dark' ? GLASS_WALL.glintDark : GLASS_WALL.glint}
            strokeWidth={2}
            strokeLinecap="round"
          />
        ) : null}
        <path
          d={art.walls}
          fill="none"
          stroke={stroke}
          strokeOpacity={GLASS_WALL.band}
          strokeWidth={ROOM_WALL + 2 * FURNITURE_PANEL_STROKE}
          strokeLinejoin="miter"
          data-glass-walls=""
        />
        <path
          d={art.walls}
          fill="none"
          stroke={stroke}
          strokeOpacity={GLASS_WALL.pane}
          strokeWidth={1}
          strokeLinejoin="miter"
        />
        {art.mullions ? (
          <path
            d={art.mullions}
            fill="none"
            stroke={stroke}
            strokeOpacity={GLASS_WALL.mullion}
            strokeWidth={GLASS_WALL.mullionWidth}
          />
        ) : null}
      </svg>
    </div>
  );
}
