'use client';

// The element-menu sections for the office pieces that carry a setting: the chair's facing
// (docs/specs/009-elements/chair.md) and the room's doorway (docs/specs/009-elements/office.md "Room"). The
// Collaborate elements' sections (the estimate card's scale, the agenda's segments, the decision record) left with
// those elements (docs/specs/002-project-scope/not-in-livehuddle.md "Retired elements").
//
// Their own file for the same reason BehaviourMenuSections has one: each is a small form, and none of it belongs in
// the data-shape sections beside charts and rails.

import {
  CHAIR_FACINGS,
  CHAIR_FACING_LABELS,
  type ChairFacing,
  type ShapeElement,
  isSeatingShape,
  seatingFacing,
  type SeatingKind,
  DEFAULT_ROOM_DOOR,
  ROOM_DOOR_LABELS,
  ROOM_DOORS,
  type RoomDoor,
} from '@livehuddle/document';
import { MenuAccordionSection } from '@liveworkspace/workbench/components/primitives/PortalMenu';
import { MenuTile, MenuTileGrid } from '@liveworkspace/workbench/components/primitives/MenuTiles';
import { ToolsMenuGlyph } from '@/components/palette/context-menu-icons';

// Each kind contributes exactly ONE section to the Tools group: a chair has Chair and nothing else.
// `MenuFlyoutSection` promotes a lone section into the host menu (docs/specs/008-canvas/canvas-and-palette.md),
// where it is an ordinary collapsible row like every other one, so the scaffold's `sectionProps` is passed straight
// through.

// --- Chair (docs/specs/009-elements/chair.md) ------------------------------------------------------

const FACING_ARROW: Record<ChairFacing, string> = { n: '↓', e: '←', s: '↑', w: '→' };

// The section's title and hint name the furniture it is on (docs/specs/009-elements/chair.md).
const SEATING_NOUN: Record<SeatingKind, string> = {
  chair: 'Chair',
  desk: 'Desk',
  sofa: 'Sofa',
  'meeting-table': 'Meeting Table',
};

export function ChairMenuSection({
  target,
  sectionProps,
  onSetFacing,
}: {
  target: ShapeElement | undefined;
  sectionProps: (id: string) => { open: boolean; onToggle: () => void };
  onSetFacing: (facing: ChairFacing) => void;
}) {
  const kind = target && isSeatingShape(target.shape) ? target.shape : 'chair';
  const facing = seatingFacing({ shape: kind, chairFacing: target?.chairFacing });
  const noun = SEATING_NOUN[kind];
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
        Which way somebody sitting here faces. Walk an Avatar-mode character into the{' '}
        {noun.toLowerCase()} to sit down.
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
