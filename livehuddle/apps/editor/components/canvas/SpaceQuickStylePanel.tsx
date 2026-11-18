'use client';

// The Quick Style panel (docs/specs/008-canvas/space-quick-style.md): while you edit, selecting a room or a piece with
// a choice of its own (a Door's, Rug's, Corridor's or Meeting Table's type) shows that choice on the canvas's edge, so
// a room's walls and floor are a click away, as livediagram's Quick Style panel has a shape's colours. The same
// choices as the element menu's Tools sections, set through the same editor actions (one undoable change each).
// Editors only: a Participant or a Viewer never sees it. Placed by the workbench's quick-style placement, so it keeps
// clear of the chrome and of what it styles.

import { useCallback, useRef, type PointerEvent as ReactPointerEvent } from 'react';
import {
  ROOM_FLOOR_COLOURS,
  ROOM_FLOOR_LABELS,
  ROOM_FLOORS,
  ROOM_WALLS,
  ROOM_WALLS_LABELS,
  changesType,
  pieceTypeFits,
  pieceVariant,
  roomFloorOf,
  roomWallsOf,
  type Element,
  type ShapeElement,
} from '@livehuddle/document';
import { useSelectionOf } from '@liveworkspace/workbench/hooks/canvas/useSelectionStore';
import {
  sameMembers,
  selectionIds,
  type Selection,
} from '@liveworkspace/workbench/lib/selection-store';
import { useQuickStylePlacement } from '@liveworkspace/workbench/hooks/ui/useQuickStylePlacement';
import { useToolbarObstacle } from '@liveworkspace/workbench/hooks/canvas/toolbar-obstacle';
import { useIsMobileViewport } from '@liveworkspace/workbench/hooks/ui/useIsMobileViewport';
import { useUiScale } from '@liveworkspace/workbench/components/providers/ui-scale';
import { toSurfacePx, uiScaleStyle } from '@liveworkspace/workbench/lib/ui-scale';
import { MenuTile, MenuTileGrid } from '@liveworkspace/workbench/components/primitives/MenuTiles';
import { useEditorContext } from '@/app/document/[id]/EditorContext';
import { FloorTypeSwatch } from '@/components/palette/palette-style-previews';
import { FloorColourSwatch, WallsGlyph } from '@/components/palette/CollabMenuSections';
import { pieceTypeChoices } from '@/components/palette/piece-type-tiles';

const selectionSetOf = (s: Selection) => selectionIds(s.selectedId, s.multiSelectedIds);
const NONE: ReadonlySet<string> = new Set();

/** What the panel styles: every selected room, or every selected piece of one kind with a type; else nothing. */
export type SpaceQuickStyleTarget =
  { kind: 'room'; rooms: ShapeElement[] } | { kind: 'type'; pieces: ShapeElement[] };

export function spaceQuickStyleTarget(
  elements: readonly Element[],
  ids: readonly string[],
): SpaceQuickStyleTarget | null {
  if (ids.length === 0) return null;
  const wanted = new Set(ids);
  const picked = elements.filter((e): e is ShapeElement => wanted.has(e.id) && e.type === 'shape');
  // A selection with anything else in it (a note, a chair beside a room) has no one choice to show.
  if (picked.length !== wanted.size) return null;
  if (picked.every((e) => e.shape === 'room')) return { kind: 'room', rooms: picked };
  const kind = picked[0]!.shape;
  if (changesType(kind) && picked.every((e) => e.shape === kind)) {
    return { kind: 'type', pieces: picked };
  }
  return null;
}

const stop = (e: ReactPointerEvent) => e.stopPropagation();

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      role="group"
      aria-label={title}
      className="flex flex-col gap-0.5 [&+&]:border-t [&+&]:border-slate-200 [&+&]:pt-1.5 dark:[&+&]:border-slate-800"
    >
      <span
        aria-hidden
        className="select-none px-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400"
      >
        {title}
      </span>
      {children}
    </div>
  );
}

/** Shown while you edit (not walking), as an Editor, with nothing dragged and no element menu open. */
export function SpaceQuickStylePanel({ editing }: { editing: boolean }) {
  const {
    activeTab,
    isReadOnly,
    contextMenu,
    setRoomWallsSelected,
    setRoomFloorSelected,
    setRoomFloorColourSelected,
    setPieceTypeSelected,
  } = useEditorContext();
  const on = editing && !isReadOnly && !contextMenu;
  const idSet = useSelectionOf(
    useCallback((s: Selection) => (on ? selectionSetOf(s) : NONE), [on]),
    sameMembers,
  );
  const ids = [...idSet];
  const target = on ? spaceQuickStyleTarget(activeTab.elements, ids) : null;
  const isMobile = useIsMobileViewport();
  const active = target !== null && !isMobile;
  const panelRef = useRef<HTMLDivElement>(null);
  const spot = useQuickStylePlacement(panelRef, active, 'left', ids);
  // A selection's toolbar keeps off it (toolbar-obstacle.ts).
  useToolbarObstacle(panelRef, active);
  const scale = useUiScale('panels');
  if (!active) return null;
  const px = (v: number) => toSurfacePx(v, scale);
  const first = target.kind === 'room' ? target.rooms[0]! : target.pieces[0]!;

  return (
    <div
      ref={panelRef}
      role="region"
      aria-label="Quick style"
      data-quick-style-panel=""
      data-toolbar-obstacle=""
      data-panel-translucent=""
      onPointerDown={stop}
      onDoubleClick={(e) => e.stopPropagation()}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      style={{
        ...uiScaleStyle(scale),
        ...(spot
          ? { left: px(spot.left), top: px(spot.top) }
          : // Measured before paint; hidden until then so it never flashes in the wrong spot.
            { left: 0, top: 0, visibility: 'hidden' as const }),
      }}
      className="pointer-events-auto fixed z-[var(--z-panel)] flex w-[220px] flex-col gap-1.5 rounded-lg border border-slate-200 bg-white p-2 shadow-lg shadow-slate-900/5 motion-safe:animate-fade-in dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 dark:shadow-slate-950/40"
    >
      {target.kind === 'room' ? (
        <>
          <Section title="Walls">
            <MenuTileGrid cols={2}>
              {ROOM_WALLS.map((w) => (
                <MenuTile
                  key={w}
                  icon={<WallsGlyph walls={w} />}
                  label={ROOM_WALLS_LABELS[w]}
                  active={roomWallsOf(first) === w}
                  onClick={() => setRoomWallsSelected(w)}
                />
              ))}
            </MenuTileGrid>
          </Section>
          <Section title="Floor">
            <MenuTileGrid cols={3}>
              {ROOM_FLOORS.map((f) => (
                <MenuTile
                  key={f}
                  icon={
                    <FloorTypeSwatch
                      floor={f}
                      fill={first.fillColor ?? ROOM_FLOOR_COLOURS[0]!.hex}
                    />
                  }
                  label={ROOM_FLOOR_LABELS[f]}
                  active={roomFloorOf(first) === f}
                  onClick={() => setRoomFloorSelected(f)}
                />
              ))}
            </MenuTileGrid>
          </Section>
          <Section title="Floor Colour">
            <MenuTileGrid cols={3}>
              {ROOM_FLOOR_COLOURS.map((c) => (
                <MenuTile
                  key={c.hex}
                  icon={<FloorColourSwatch hex={c.hex} />}
                  label={c.name}
                  active={first.fillColor?.toLowerCase() === c.hex}
                  onClick={() => setRoomFloorColourSelected(c.hex)}
                />
              ))}
            </MenuTileGrid>
          </Section>
        </>
      ) : (
        <Section title="Type">
          <MenuTileGrid cols={pieceTypeChoices(first.shape).length > 4 ? 3 : 2}>
            {pieceTypeChoices(first.shape).map((c) => (
              <MenuTile
                key={c.type}
                icon={c.icon}
                label={c.label}
                active={target.pieces.every((p) => pieceVariant(p) === c.type)}
                // A Door wider than the wall it stands on would stick out past the wall's end.
                disabled={!target.pieces.every((p) => pieceTypeFits(p, c.type, activeTab.elements))}
                onClick={() => setPieceTypeSelected(first.shape, c.type)}
              />
            ))}
          </MenuTileGrid>
        </Section>
      )}
    </div>
  );
}
