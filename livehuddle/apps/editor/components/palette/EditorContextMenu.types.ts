import type { ChairFacing, Element } from '@livehuddle/document';

export type EditorContextMenuState =
  // `tools`: the element's own settings are open in their dialog, in the menu's place.
  | { mode: 'element'; elementId: string; x: number; y: number; tools?: boolean }
  // A whole multi-selection or group was right-clicked — actions apply to
  // everything selected.
  // `elementId` is the member right-clicked, when one was (the selection toolbar's ⋯ names none): its kind picks the
  // Type section the menu offers (docs/specs/009-elements/office.md "A piece's type").
  | { mode: 'multi'; x: number; y: number; elementId?: string }
  // `openUp` grows the menu upward from y (for the footer canvas-menu button,
  // so it opens above the footer rather than over it).
  | {
      mode: 'canvas';
      x: number;
      y: number;
      openUp?: boolean;
    };

export type EditorContextMenuProps = {
  menu: EditorContextMenuState;
  // The active tab's elements — used to resolve the clicked element
  // (for the element menu) and read its link / note state.
  elements: Element[];
  onClose: () => void;
  // Opens the element's own settings in their dialog (MenuToolsSection).
  onOpenTools: () => void;
  // Open the link picker for a stored link card's destination (its own Link category), optionally pre-selecting a
  // mode (webpage / tab / document) so the modal lands on the right tab. No other element takes a link
  // (docs/specs/002-project-scope/not-in-livehuddle.md "Comments, actions, links and notes").
  onLinkElement: (elementId: string, mode?: 'url' | 'tab' | 'document') => void;
  // Image element actions (docs/specs/009-elements/images.md): open the picker (select / change) and
  // clear the picked image back to a placeholder.
  onOpenImagePicker: (elementId: string) => void;
  onRemoveImage: (elementId: string) => void;
  // A Poster's picture (docs/specs/009-elements/poster.md "Choosing its picture"): the same picker and clear, offered
  // only to an Editor. Absent, a poster's menu has no Picture section.
  onChoosePosterPicture?: (elementId: string) => void;
  // Clear the link off the selected element (docs/specs/009-elements/link-cards.md link-card "Remove Link").
  onRemoveLink: () => void;
  // Toggle aspect-ratio lock + set opacity on the clicked element (boxed
  // only). Read the current values off the target below.
  onToggleAspectLock: () => void;
  // Portal (docs/specs/009-elements/portal-element.md): which portal this one leads to; null unpairs it.
  onSetPortalTarget: (targetId: string | null) => void;
  // Portal (docs/specs/009-elements/portal-element.md): its name (menu-only — the canvas ring stays clean), and
  // "create the far end for me" for the common case where it doesn't exist yet.
  onSetPortalName: (name: string) => void;
  onCreateLinkedPortal: () => void;
  onSetChairFacing: (facing: ChairFacing) => void;
  // A Room's name (docs/specs/009-elements/office.md "Room name field"): the canvas's in-place rename. Passed only
  // where the session may rename the menu's room (`roomNameEditable`); absent, no Name section.
  onRenameRoom?: (elementId: string, name: string) => void;
  // Room (docs/specs/009-elements/office.md): which wall its doorway is in.
  onSetRoomDoor: (door: import('@livehuddle/document').RoomDoor) => void;
  // And its walls (docs/specs/009-elements/office.md "Glass walls"): Solid or Glass.
  onSetRoomWalls: (walls: import('@livehuddle/document').RoomWalls) => void;
  // A room's floor type and floor colour (docs/specs/009-elements/office.md "Floors").
  onSetRoomFloor: (floor: import('@livehuddle/document').RoomFloor) => void;
  onSetRoomFloorColour: (hex: string) => void;
  // A Door's, Rug's, Corridor's or Meeting Table's type, changed in place (docs/specs/009-elements/office.md "A piece's
  // type"): every selected piece of `kind` becomes `type`.
  onSetPieceType?: (kind: string, type: string) => void;
  // Stage (docs/specs/012-collaboration/meeting-rooms-and-stage.md): Who Can Speak and Show Cameras.
  onSetStage: (patch: import('./StageMenuSection').StagePatch) => void;
  // The Receptionist on the tab's first Avatar Pad (docs/specs/008-canvas/receptionist.md "Asking him to leave").
  onSetPadReceptionist?: (here: boolean) => void;
  // Screen (docs/specs/009-elements/screen-and-room-sign.md "Choosing what it shows"): its source, a file, a video
  // or none.
  onSetScreenSource?: (source: import('@livehuddle/document').ScreenSource) => void;
  // The social pieces (docs/specs/009-elements/social-pieces.md): a Jukebox's source.
  onSetJukeboxSource?: (source: string | undefined) => void;
  // An Arcade Machine's High Scores (social-pieces.md "Clearing"): an Editor's Clear, given only at `can.level` edit.
  onClearArcadeScores?: (elementId: string) => void;
  // Every tab, because a portal link can cross tabs, plus which one is active
  // so the picker can mark the off-tab candidates.
  tabs: import('@livehuddle/document').Tab[];
  activeTabId: string;
  // Reset the shape back to its kind's default aspect ratio (keeps area,
  // snaps the width:height proportion back to the canonical look).
  onResetAspectRatio: () => void;
  // Set the selection's exact size in canvas pixels (docs/specs/008-canvas/element-size.md). Either
  // dimension alone is allowed: the omitted one is left as-is, or carried by
  // the aspect lock when that is on.
  onSetSize: (size: { width?: number; height?: number }) => void;
  // The selected elements (multi-selection members), so the 'multi' menu can offer Size and the piece Type that
  // match them. Duplicate / Export / Delete are NOT here: the selection toolbar carries those.
  selectionElements: Element[];
};
