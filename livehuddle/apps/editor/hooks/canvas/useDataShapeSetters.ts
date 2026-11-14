import {
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
  withPieceType,
} from '@livehuddle/document';
import { track } from '@/lib/telemetry';
import { shapeTelemetryToken } from '@/lib/element-telemetry';
import { makeShapePatcher } from '@/hooks/canvas/shape-patcher';
import type { StagePatch } from '@/components/palette/StageMenuSection';

type DataShapeSetterDeps = {
  currentSelectionIds: () => Set<string>;
  commit: (mapElements: (els: Element[]) => Element[]) => void;
  // The board as it stands.
  elements: () => Element[];
};

// The selection-wide setters for the content-bearing pieces: the
// furniture's turns and the Space pieces' settings. All resolve the selection and commit through the two shared
// handles, so they live together off useElementStyle.

export function useDataShapeSetters({
  currentSelectionIds,
  commit,
  elements,
}: DataShapeSetterDeps) {
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

  // A piece's type (docs/specs/009-elements/office.md "A piece's type"): every selected piece of `kind` changed in
  // place, others left alone. One change, reported once, and nothing at all when no piece changes.
  const setPieceTypeSelected = (kind: string, type: string) => {
    const ids = currentSelectionIds();
    const retype = (el: Element) =>
      ids.has(el.id) && el.type === 'shape' && el.shape === kind ? withPieceType(el, type) : el;
    if (!elements().some((el) => retype(el) !== el)) return;
    commit((els) => els.map(retype));
    track('Element', 'Changed', shapeTelemetryToken(kind));
  };

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
  // An Avatar Pad's Receptionist (docs/specs/008-canvas/receptionist.md "Asking him to leave"): the menu's switch on
  // the selected pad, and Ask Receptionist to Leave on his pad by id. Here clears the flag; leaving sets it.
  const receptionistPatch = (here: boolean) => ({ receptionistLeft: here ? undefined : true });
  const setReceptionistSelected = makeShapePatcher({
    currentSelectionIds,
    commit,
    matches: (kind) => kind === 'avatar-pad',
  });
  const setPadReceptionistSelected = (here: boolean) =>
    setReceptionistSelected(receptionistPatch(here), 'AvatarPad');
  const setPadReceptionistOf = (id: string, here: boolean) =>
    makeShapePatcher({
      currentSelectionIds: () => new Set([id]),
      commit,
      matches: (kind) => kind === 'avatar-pad',
    })(receptionistPatch(here), 'AvatarPad');
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

  return {
    setChairFacingSelected,
    turnSelected,
    setRoomDoorSelected: setRoomDoor,
    setRoomWallsSelected: setRoomWalls,
    setPieceTypeSelected,
    setStageSelected,
    setScreenUrlSelected,
    setScreenUrlOf,
    setPadReceptionistSelected,
    setPadReceptionistOf,
    setClockZonesSelected,
    setJukeboxSourceSelected,
  };
}
