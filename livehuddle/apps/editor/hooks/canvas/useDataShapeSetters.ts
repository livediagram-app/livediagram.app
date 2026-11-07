import {
  addTableColumn,
  addTableRow,
  type ChairFacing,
  type Element,
  turnsWithFacing,
  turnPiece,
  turnPieceBy,
  type ShapeElement,
  type RoomDoor,
  type RoomWalls,
  GLASS_ROOM_VARIANT,
  type ClockZone,
} from '@livehuddle/document';
import { track } from '@/lib/telemetry';
import { shapeTelemetryToken } from '@/lib/element-telemetry';
import { useWebComponentSetters } from '@/hooks/canvas/useWebComponentSetters';
import { makeShapePatcher } from '@/hooks/canvas/shape-patcher';
import type { StagePatch } from '@/components/palette/StageMenuSection';

// The kinds carrying masthead lines (see setPageHeading).
const MASTHEAD_SHAPES = new Set<string>(['callout', 'card', 'boundary']);

type DataShapeSetterDeps = {
  currentSelectionIds: () => Set<string>;
  commit: (mapElements: (els: Element[]) => Element[]) => void;
  // The board as it stands (useWebComponentSetters).
  elements: () => Element[];
};

// The selection-wide setters for the content-bearing pieces: a table's rows and columns, the masthead lines, the
// furniture's turns and the Space pieces' settings. All resolve the selection and commit through the two shared
// handles, so they live together off useElementStyle.

export function useDataShapeSetters({
  currentSelectionIds,
  commit,
  elements,
}: DataShapeSetterDeps) {
  // Append a row / column to each selected table — the table quick-connect
  // ring's structural adds (docs/specs/008-canvas/canvas-and-palette.md). The helper returns the spliced cells
  // PLUS the realigned side arrays; apply them together so pinned sizes and
  // per-cell styles can't drift onto the wrong track.
  const appendTableRowSelected = () => {
    const ids = currentSelectionIds();
    if (ids.size === 0) return;
    track('Element', 'Added', 'TableRow');
    commit((els) =>
      els.map((el) => {
        if (!(ids.has(el.id) && el.type === 'table')) return el;
        const next = addTableRow(el, el.cells.length);
        return {
          ...el,
          cells: next.cells,
          ...(next.rowHeights ? { rowHeights: next.rowHeights } : {}),
          ...(next.cellStyles ? { cellStyles: next.cellStyles } : {}),
        };
      }),
    );
  };
  const appendTableColumnSelected = () => {
    const ids = currentSelectionIds();
    if (ids.size === 0) return;
    track('Element', 'Added', 'TableColumn');
    commit((els) =>
      els.map((el) => {
        if (!(ids.has(el.id) && el.type === 'table')) return el;
        const next = addTableColumn(el, el.cells[0]?.length ?? 0);
        return {
          ...el,
          cells: next.cells,
          ...(next.colWidths ? { colWidths: next.colWidths } : {}),
          ...(next.cellStyles ? { cellStyles: next.cellStyles } : {}),
        };
      }),
    );
  };

  // The masthead lines: a callout's or card's heading and subtitle and a boundary's
  // (docs/specs/009-elements/web-components-and-no-groups.md). One setter for both lines rather than two
  // near-identical ones, since the only difference is which field.
  const setPageHeading = (
    elementId: string,
    field: 'pageTitle' | 'pageSubtitle',
    value: string,
  ) => {
    commit((els) =>
      els.map((el) => {
        if (el.id !== elementId || el.type !== 'shape') return el;
        if (!MASTHEAD_SHAPES.has(el.shape)) return el;
        // An empty line stores as undefined rather than '', so a line that was
        // typed into and cleared serialises the same as one never touched.
        return { ...el, [field]: value.trim() ? value : undefined };
      }),
    );
  };

  // Every piece of furniture that turns (docs/specs/009-elements/furniture-facing.md "A turn"): a facing picked from
  // the element menu, or a quarter turn from the Rotate buttons, the command palette or a multi-selection. Each piece
  // turns about its own centre, its box taking the turned drawing's proportions; a piece that does not turn stays as
  // it is. One change, so one undo step, reported once under the first piece turned.
  const turnSelection = (turn: (el: ShapeElement) => ShapeElement) => {
    const ids = currentSelectionIds();
    if (ids.size === 0) return;
    const turns = (el: Element): el is ShapeElement =>
      ids.has(el.id) && el.type === 'shape' && turnsWithFacing(el.shape);
    const first = elements().find(turns);
    if (!first) return;
    commit((els) => els.map((el) => (turns(el) ? turn(el) : el)));
    track('Element', 'Changed', shapeTelemetryToken(first.shape));
  };
  const setChairFacingSelected = (facing: ChairFacing) =>
    turnSelection((el) => turnPiece(el, facing));
  const turnSelected = (quarters: number) => turnSelection((el) => turnPieceBy(el, quarters));

  // Room (docs/specs/009-elements/office.md "Room"): which wall the doorway is in.
  const setRoomDoorSelected = makeShapePatcher({
    currentSelectionIds,
    commit,
    matches: (kind) => kind === 'room',
  });
  const setRoomDoor = (door: RoomDoor) => setRoomDoorSelected({ roomDoor: door }, 'Room');
  // And its walls (office.md "Glass walls"): Glass stores `variant: 'glass'`, Solid clears it.
  const setRoomWalls = (walls: RoomWalls) =>
    setRoomDoorSelected({ variant: walls === 'glass' ? GLASS_ROOM_VARIANT : undefined }, 'Room');

  // Stage (docs/specs/012-collaboration/meeting-rooms-and-stage.md "The stage's way in"): Who Can Speak and Show
  // Cameras, on every selected stage and nothing else.
  const patchStages = makeShapePatcher({
    currentSelectionIds,
    commit,
    matches: (kind) => kind === 'stage',
  });
  const setStageSelected = (patch: StagePatch) => patchStages(patch, 'Stage');
  // A Screen's Video Link (docs/specs/009-elements/screen-and-room-sign.md "Screen"); undefined clears it.
  const patchScreens = makeShapePatcher({
    currentSelectionIds,
    commit,
    matches: (kind) => kind === 'screen',
  });
  const setScreenUrlSelected = (url: string | undefined) =>
    patchScreens({ screenUrl: url }, 'Screen');
  // The same patch on one Screen by id: the walking reader's Set Link (docs/specs/008-canvas/avatar-mode.md "The
  // reader"), which edits the Screen it opened, not the selection.
  const setScreenUrlOf = (id: string, url: string | undefined) =>
    makeShapePatcher({
      currentSelectionIds: () => new Set([id]),
      commit,
      matches: (kind) => kind === 'screen',
    })({ screenUrl: url }, 'Screen');
  // A World Clock's zones and a Jukebox's source (docs/specs/009-elements/social-pieces.md); undefined clears them.
  const patchClocks = makeShapePatcher({
    currentSelectionIds,
    commit,
    matches: (kind) => kind === 'world-clock',
  });
  const setClockZonesSelected = (zones: ClockZone[] | undefined) =>
    patchClocks({ clockZones: zones }, 'World-clock');
  const patchJukeboxes = makeShapePatcher({
    currentSelectionIds,
    commit,
    matches: (kind) => kind === 'jukebox',
  });
  const setJukeboxSourceSelected = (source: string | undefined) =>
    patchJukeboxes({ jukeboxSource: source }, 'Jukebox');

  // The web components (docs/specs/009-elements/web-components-and-no-groups.md): see useWebComponentSetters.
  const webSetters = useWebComponentSetters({ currentSelectionIds, commit, elements });

  return {
    ...webSetters,
    appendTableRowSelected,
    appendTableColumnSelected,
    setPageHeading,
    setChairFacingSelected,
    turnSelected,
    setRoomDoorSelected: setRoomDoor,
    setRoomWallsSelected: setRoomWalls,
    setStageSelected,
    setScreenUrlSelected,
    setScreenUrlOf,
    setClockZonesSelected,
    setJukeboxSourceSelected,
  };
}
