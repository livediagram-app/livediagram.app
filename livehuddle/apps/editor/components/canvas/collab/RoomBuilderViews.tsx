'use client';

import { roomFloorOf } from '@livehuddle/document';
import { RoomFloorPattern } from './RoomFloorPattern';
import type { SVGProps } from 'react';
import {
  corridorPaths,
  doorArt,
  FURNITURE_PANEL_STROKE,
  FURNITURE_RAIL_OPACITY,
  FURNITURE_RAIL_STROKE,
  outlinedRoomPaths,
  ROOM_TONES,
  ROOM_WALL,
  WALL_EDGE,
  type DoorArtPart,
  type ShapeElement,
} from '@livehuddle/document';
import { useDoorOnBackWall } from './back-wall-doors-store';

// A room drawn with the Room Builder (docs/specs/009-elements/room-builder.md "The custom room"): the floor polygon
// in the element's fill and the walls a fixed ROOM_WALL thick along the outline, edged in plaster's deeper shade and mitred
// at the corners. Drawn at the element's own size so the walls keep their thickness. The walls also block walking
// (@livehuddle/avatar collision, broken where a Door stands).
export function OutlinedRoomView({
  element,
  outline,
  floor,
  animClass,
}: {
  element: ShapeElement;
  outline: readonly { x: number; y: number }[];
  stroke: string;
  floor: string;
  animClass?: string;
}) {
  const { width, height } = element;
  const { floor: area, walls } = outlinedRoomPaths({ width, height, roomOutline: outline });
  return (
    <div className={`pointer-events-none absolute inset-0 ${animClass ?? ''}`}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        className="absolute inset-0 h-full w-full overflow-visible"
        role="img"
        aria-label={`Room${element.label ? `, ${element.label}` : ''}`}
      >
        <path d={area} fill={floor} />
        <RoomFloorPattern floor={roomFloorOf(element)} d={area} />
        <PlasterWalls d={walls} />
      </svg>
    </div>
  );
}

// A glass pane's wash of the stroke (the export's GLASS_OPACITY).
const GLASS_OPACITY = 0.16;

// A door part's paint (svg-render-doors doorPaintAttrs, as React props).
function doorPaint(p: DoorArtPart, floor: string, stroke: string): SVGProps<SVGElement> {
  switch (p.paint) {
    case 'floor':
      return { fill: floor };
    case 'jamb':
      return {
        fill: p.tag === 'path' ? 'none' : floor,
        stroke,
        strokeWidth: FURNITURE_PANEL_STROKE,
      };
    case 'leaf':
      return { fill: floor, stroke, strokeWidth: FURNITURE_PANEL_STROKE };
    case 'glass':
      return {
        fill: stroke,
        fillOpacity: GLASS_OPACITY,
        stroke,
        strokeWidth: FURNITURE_RAIL_STROKE,
      };
    case 'pane':
      return { fill: stroke, fillOpacity: GLASS_OPACITY };
    case 'wing':
      return { fill: 'none', stroke, strokeWidth: 3, strokeLinecap: 'round' };
    case 'swing':
      return {
        fill: 'none',
        stroke,
        strokeWidth: FURNITURE_RAIL_STROKE,
        opacity: FURNITURE_RAIL_OPACITY,
        strokeDasharray: '4 4',
      };
    case 'track':
      return { fill: 'none', stroke, strokeWidth: 1, opacity: FURNITURE_RAIL_OPACITY };
    case 'ink':
      return { fill: stroke };
  }
}

function DoorPartView({ part, props }: { part: DoorArtPart; props: SVGProps<SVGElement> }) {
  switch (part.tag) {
    case 'rect':
      return (
        <rect
          x={part.x}
          y={part.y}
          width={part.w}
          height={part.h}
          rx={part.rx}
          {...(props as SVGProps<SVGRectElement>)}
        />
      );
    case 'circle':
      return (
        <circle cx={part.cx} cy={part.cy} r={part.r} {...(props as SVGProps<SVGCircleElement>)} />
      );
    case 'path':
      return <path d={part.d} {...(props as SVGProps<SVGPathElement>)} />;
  }
}

// A Door (docs/specs/009-elements/room-builder.md "Door", "Door types"): the gap it paints over its wall in the floor's
// colour, its jambs, and its type's leaves, panes or wings, open or shut. Turned onto its wall by the element's
// rotation. A moving part eases between its open and shut poses (the 180 ms door transition in canvas-motion.css),
// and a swing arc fades. On a rectangular room's back wall (room-builder.md "On a back wall") the room draws the
// doorway, broken through its tall band while open and the shut leaf in its face, so the Door draws only its open
// leaf and swing there, no gap or jambs of its own, and nothing while shut.
export function DoorView({
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
  const closed = element.doorClosed === true;
  const onBackWall = useDoorOnBackWall(element.id);
  const parts = doorArt(width, height, element.variant).filter(
    (p) => !onBackWall || (!closed && p.paint !== 'floor' && p.paint !== 'jamb'),
  );
  return (
    <div className={`pointer-events-none absolute inset-0 ${animClass ?? ''}`}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        className="absolute inset-0 h-full w-full overflow-visible"
        role="img"
        aria-label={`${closed ? 'Closed' : 'Open'} door`}
      >
        {parts.map((p, i) => {
          const pose = p.motion ? (closed ? p.motion.shut : p.motion.open) : null;
          const moving: SVGProps<SVGElement> & { 'data-door-closed'?: string } = p.motion
            ? {
                className: 'lh-door-leaf',
                'data-door-closed': closed ? '' : undefined,
                style: {
                  transformBox: 'view-box',
                  transformOrigin: `${p.motion.origin.x}px ${p.motion.origin.y}px`,
                  transform:
                    pose && (pose.dx !== 0 || pose.rotate !== 0)
                      ? `translateX(${pose.dx}px) rotate(${pose.rotate}deg)`
                      : 'none',
                },
              }
            : p.openOnly
              ? { className: 'lh-door-swing', opacity: closed ? 0 : FURNITURE_RAIL_OPACITY }
              : {};
          return (
            <g key={i}>
              <DoorPartView part={p} props={{ ...doorPaint(p, floor, stroke), ...moving }} />
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// A Corridor (docs/specs/009-elements/corridor.md): its floor in the element's fill and the walls down its sides
// ROOM_WALL thick, plaster as a room's are, open at its ends. Drawn at its own size so the walls keep
// their thickness; the walls also block walking (@livehuddle/avatar collision, cut where a Door stands).
export function CorridorView({
  element,
  floor,
  animClass,
}: {
  element: ShapeElement;
  stroke: string;
  floor: string;
  animClass?: string;
}) {
  const { width, height } = element;
  const { floor: area, walls: runs } = corridorPaths(width, height, element.variant);
  return (
    <div className={`pointer-events-none absolute inset-0 ${animClass ?? ''}`}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        className="absolute inset-0 h-full w-full overflow-visible"
        role="img"
        aria-label="Corridor"
      >
        <path d={area} fill={floor} />
        <PlasterWalls d={runs} />
      </svg>
    </div>
  );
}

// A run of plaster wall (furniture-art-style.md "Rooms"): the plaster, edged in its deeper shade, as a room's walls.
function PlasterWalls({ d }: { d: string }) {
  return (
    <>
      <path
        d={d}
        fill="none"
        stroke={ROOM_TONES.wallEdge}
        strokeWidth={ROOM_WALL + WALL_EDGE}
        strokeLinejoin="miter"
      />
      <path
        d={d}
        fill="none"
        stroke={ROOM_TONES.wallTop}
        strokeWidth={ROOM_WALL}
        strokeLinejoin="miter"
      />
    </>
  );
}
