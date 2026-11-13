'use client';

// The element-menu sections for the office pieces that carry a setting: a piece's facing
// (docs/specs/009-elements/furniture-facing.md) and the room's doorway (docs/specs/009-elements/office.md "Room"). The
// Collaborate elements' sections (the estimate card's scale, the agenda's segments, the decision record) left with
// those elements (docs/specs/002-project-scope/not-in-livehuddle.md "Retired elements").
//
// Their own file for the same reason PortalMenuSection has one: each is a small form, and none of it belongs in
// the data-shape sections beside charts and rails.

import {
  CHAIR_FACINGS,
  CHAIR_FACING_LABELS,
  type ChairFacing,
  type ShapeElement,
  elementKindLabel,
  pieceFacing,
  seatsACharacter,
  DEFAULT_ROOM_DOOR,
  ROOM_DOOR_LABELS,
  ROOM_DOORS,
  ROOM_WALLS,
  ROOM_WALLS_LABELS,
  roomWallsOf,
  type RoomWalls,
  type RoomDoor,
} from '@livehuddle/document';
import { Glyph } from '@livehuddle/ui';
import { MenuAccordionSection } from '@liveworkspace/workbench/components/primitives/PortalMenu';
import { MenuTile, MenuTileGrid } from '@liveworkspace/workbench/components/primitives/MenuTiles';
import { ToolsMenuGlyph, WallsMenuGlyph } from '@/components/palette/context-menu-icons';

// Each kind contributes exactly ONE section to the Tools group: a chair has Chair and nothing else.
// `MenuFlyoutSection` promotes a lone section into the host menu (docs/specs/008-canvas/canvas-and-palette.md),
// where it is an ordinary collapsible row like every other one, so the scaffold's `sectionProps` is passed straight
// through.

// --- Facing (docs/specs/009-elements/furniture-facing.md "Turning a placed piece") ------------------------------

const FACING_ARROW: Record<ChairFacing, string> = { n: '↓', e: '←', s: '↑', w: '→' };

// Every piece that turns has this section, titled for the piece (Sofa, Lockers), its four facings as tiles.
export function ChairMenuSection({
  target,
  sectionProps,
  onSetFacing,
}: {
  target: ShapeElement | undefined;
  sectionProps: (id: string) => { open: boolean; onToggle: () => void };
  onSetFacing: (facing: ChairFacing) => void;
}) {
  const facing = target ? pieceFacing(target) : 'n';
  const noun = target ? elementKindLabel(target) : 'Chair';
  // A Podium is stood at, and its speaker faces its front, so it keeps the front's line (venue-pieces.md "Speaking from
  // the Podium").
  const seats = !!target && seatsACharacter(target.shape) && target.shape !== 'podium';
  return (
    <MenuAccordionSection title={noun} icon={<ToolsMenuGlyph />} {...sectionProps('chair')}>
      {/* Tiles rather than a list: the arrow IS the answer here, which is the
          same test the palette applies to its own categories (docs/specs/010-palette/palette-top-level-categories.md). */}
      <MenuTileGrid cols={4}>
        {CHAIR_FACINGS.map((f) => (
          <MenuTile
            key={f}
            icon={
              <span aria-hidden className="text-[15px] leading-none">
                {FACING_ARROW[f]}
              </span>
            }
            label={CHAIR_FACING_LABELS[f].replace('Facing ', '')}
            active={facing === f}
            onClick={() => onSetFacing(f)}
          />
        ))}
      </MenuTileGrid>
      <p className="px-2 pb-1.5 pt-1 text-[10px] leading-snug text-slate-500 dark:text-slate-400">
        {seats ? (
          <>
            Which way somebody sitting here faces. Walk an Avatar-mode character into the{' '}
            {noun.toLowerCase()} to sit down.
          </>
        ) : (
          'Which way its front faces. Rotate Left and Rotate Right on the toolbar turn it a quarter.'
        )}
      </p>
    </MenuAccordionSection>
  );
}

// --- Room (docs/specs/009-elements/office.md "Room") -------------------------------------------------

const DOOR_GLYPH: Record<RoomDoor, string> = { n: '↑', e: '→', s: '↓', w: '←', none: '✕' };

export function RoomMenuSection({
  target,
  sectionProps,
  onSetDoor,
}: {
  target: ShapeElement | undefined;
  sectionProps: (id: string) => { open: boolean; onToggle: () => void };
  onSetDoor: (door: RoomDoor) => void;
}) {
  const door = target?.roomDoor ?? DEFAULT_ROOM_DOOR;
  return (
    <MenuAccordionSection title="Room" icon={<ToolsMenuGlyph />} {...sectionProps('room')}>
      <MenuTileGrid cols={3}>
        {ROOM_DOORS.map((d) => (
          <MenuTile
            key={d}
            icon={
              <span aria-hidden className="text-[13px] leading-none">
                {DOOR_GLYPH[d]}
              </span>
            }
            label={ROOM_DOOR_LABELS[d]}
            active={door === d}
            onClick={() => onSetDoor(d)}
          />
        ))}
      </MenuTileGrid>
      <p className="px-2 pb-1.5 pt-1 text-[10px] leading-snug text-slate-500 dark:text-slate-400">
        Which wall the doorway is in. Avatar-mode characters walk through the doorway and nowhere
        else; with None, only a portal gets you in.
      </p>
    </MenuAccordionSection>
  );
}

// --- A room's walls (docs/specs/009-elements/office.md "Glass walls") ---------------------------------

// Solid: a filled wall; Glass: a pane you see through.
function WallsGlyph({ walls }: { walls: RoomWalls }) {
  return (
    <Glyph size={14} units={16}>
      {walls === 'solid' ? (
        <rect x="2" y="3" width="12" height="10" rx="1" fill="currentColor" fillOpacity={0.35} />
      ) : (
        <>
          <rect x="2" y="3" width="12" height="10" rx="1" />
          <path d="M8 3v10M5 10l2.5-4M9.5 10.5 11 8" strokeWidth={1} />
        </>
      )}
    </Glyph>
  );
}

export function RoomWallsMenuSection({
  target,
  sectionProps,
  onSetWalls,
}: {
  target: ShapeElement | undefined;
  sectionProps: (id: string) => { open: boolean; onToggle: () => void };
  onSetWalls: (walls: RoomWalls) => void;
}) {
  const walls = target ? roomWallsOf(target) : 'solid';
  return (
    <MenuAccordionSection title="Walls" icon={<WallsMenuGlyph />} {...sectionProps('room-walls')}>
      <MenuTileGrid cols={2}>
        {ROOM_WALLS.map((w) => (
          <MenuTile
            key={w}
            icon={<WallsGlyph walls={w} />}
            label={ROOM_WALLS_LABELS[w]}
            active={walls === w}
            onClick={() => onSetWalls(w)}
          />
        ))}
      </MenuTileGrid>
      <p className="px-2 pb-1.5 pt-1 text-[10px] leading-snug text-slate-500 dark:text-slate-400">
        Glass walls let everyone see who is inside. They still block walking, and nobody outside
        hears the room.
      </p>
    </MenuAccordionSection>
  );
}
