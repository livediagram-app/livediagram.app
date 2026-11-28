'use client';

// Right-click context menu for the editor, lifted out of
// editor-page.tsx. Renders one of two menus depending on what was
// clicked: a single-element menu (link / layer order / note /
// comment) or a whole-selection 'multi' menu. The canvas (empty-space)
// right-click opens the tab menu with its canvas sections folded in,
// rendered by the TabBar — not here. Duplicate lives in the selection
// toolbar (SelectionPopover), not here.
//
// Purely presentational: every action is a callback prop, and each
// item closes the menu after firing (the close-then-act pattern the
// inline version used). The page owns the open/closed state + the
// handlers; this component only decides which items to show.

import {
  changesType,
  elementKindLabel,
  hasBuiltInDoorway,
  turnsWithFacing,
} from '@livehuddle/document';
import { ToolsMenuGlyph } from '@liveworkspace/workbench/components/palette/context-menu-icons';
import { MenuToolsSection } from '@liveworkspace/workbench/components/primitives/MenuToolsSection';
import { PortalMenuSection } from '@/components/palette/PortalMenuSection';
import { StageMenuSection } from '@/components/palette/StageMenuSection';
import { ReceptionistMenuSection } from '@/components/palette/ReceptionistMenuSection';
import { receptionistPad } from '@/lib/receptionist/receptionist-day';
import { JukeboxMenuSection } from '@/components/palette/SocialMenuSections';
import { ScreenMenuSection } from '@/components/palette/ScreenMenuSection';
import { ArcadeMenuSection } from '@/components/palette/ArcadeMenuSection';
import { PieceTypeMenuSection } from '@/components/palette/PieceTypeMenuSection';
import {
  // The office pieces' settings: a chair's facing and a room's doorway.
  ChairMenuSection,
  RoomMenuSection,
  RoomFloorMenuSection,
  RoomWallsMenuSection,
} from '@/components/palette/CollabMenuSections';
import { RoomNameMenuSection } from '@/components/palette/RoomNameField';
import type { EditorContextMenuProps } from './EditorContextMenu.types';
import { useContextMenuScaffold } from './useContextMenuScaffold';

type Scaffold = ReturnType<typeof useContextMenuScaffold>;

// The element menu's per-kind section (the Space pieces' settings), titled for the element: the menu's one setting
// besides Size, or laid open in its settings dialog.
type ElementDataSectionsProps = {
  props: EditorContextMenuProps;
  target: EditorContextMenuProps['elements'][number];
  sectionProps: Scaffold['sectionProps'];
  // The menu, or the element's settings dialog (the sections alone, laid open).
  surface?: 'menu' | 'dialog';
};

export function ElementDataSections({
  props,
  target,
  sectionProps: menuSectionProps,
  surface = 'menu',
}: ElementDataSectionsProps) {
  // In the element's settings dialog every section lies open: there is room, and nothing to fold away.
  const sectionProps: typeof menuSectionProps =
    surface === 'dialog'
      ? () => ({ open: true, onToggle: () => {}, flush: true })
      : menuSectionProps;
  const shapeTarget = target.type === 'shape' ? target : null;
  // Portal (docs/specs/009-elements/portal-element.md): its one setting is which portal it leads to.
  const isPortal = shapeTarget?.shape === 'portal';
  // Every piece of furniture that turns has a facing section titled for it
  // (docs/specs/009-elements/furniture-facing.md "Turning a placed piece").
  const isChair = !!shapeTarget && turnsWithFacing(shapeTarget.shape);
  const retypes = !!shapeTarget && changesType(shapeTarget.shape) && !!props.onSetPieceType;
  const showTools = hasOwnSection(props, target);
  return (
    <>
      {showTools ? (
        <MenuToolsSection
          title={elementKindLabel(target)}
          icon={<ToolsMenuGlyph />}
          onOpen={props.onOpenTools}
          inline={surface === 'dialog'}
        >
          {/* First, as the piece's biggest choice: which of its kind it is. */}
          {retypes && shapeTarget ? (
            <PieceTypeMenuSection
              target={shapeTarget}
              elements={props.elements}
              sectionProps={sectionProps}
              onSetType={props.onSetPieceType!}
            />
          ) : null}
          {/* A room's name first, an Editor's (docs/specs/009-elements/office.md "Room name field"). */}
          {shapeTarget?.shape === 'room' && props.onRenameRoom ? (
            <RoomNameMenuSection
              room={shapeTarget}
              sectionProps={sectionProps}
              onRename={props.onRenameRoom}
            />
          ) : null}
          {/* Only an older room keeps a doorway of its own (docs/specs/009-elements/office.md "Older rooms keep their
          built-in doorway"): a new Room's and a custom room's ways in are Door pieces. */}
          {shapeTarget && hasBuiltInDoorway(shapeTarget) ? (
            <RoomMenuSection
              target={shapeTarget}
              sectionProps={sectionProps}
              onSetDoor={props.onSetRoomDoor}
            />
          ) : null}
          {/* Every room's walls, Solid or Glass (docs/specs/009-elements/office.md "Glass walls"). */}
          {shapeTarget?.shape === 'room' ? (
            <RoomWallsMenuSection
              target={shapeTarget}
              sectionProps={sectionProps}
              onSetWalls={props.onSetRoomWalls}
            />
          ) : null}
          {/* And its floor: its type and a floor colour (docs/specs/009-elements/office.md "Floors"). */}
          {shapeTarget?.shape === 'room' ? (
            <RoomFloorMenuSection
              target={shapeTarget}
              sectionProps={sectionProps}
              onSetFloor={props.onSetRoomFloor}
              onSetFloorColour={props.onSetRoomFloorColour}
            />
          ) : null}
          {shapeTarget?.shape === 'stage' ? (
            <StageMenuSection
              target={shapeTarget}
              sectionProps={sectionProps}
              onSetStage={props.onSetStage}
            />
          ) : null}
          {/* The Receptionist's pad, the tab's first (docs/specs/008-canvas/receptionist.md "Asking him to leave"). */}
          {shapeTarget?.shape === 'avatar-pad' &&
          props.onSetPadReceptionist &&
          receptionistPad(props.elements)?.id === shapeTarget.id ? (
            <ReceptionistMenuSection
              target={shapeTarget}
              sectionProps={sectionProps}
              onSetHere={props.onSetPadReceptionist}
            />
          ) : null}
          {shapeTarget?.shape === 'jukebox' && props.onSetJukeboxSource ? (
            <JukeboxMenuSection
              target={shapeTarget}
              sectionProps={sectionProps}
              onSetSource={props.onSetJukeboxSource}
            />
          ) : null}
          {shapeTarget?.shape === 'arcade-machine' && props.onClearArcadeScores ? (
            <ArcadeMenuSection
              target={shapeTarget}
              sectionProps={sectionProps}
              onClear={() => props.onClearArcadeScores!(shapeTarget.id)}
              onCloseMenu={props.onClose}
            />
          ) : null}
          {shapeTarget?.shape === 'screen' && props.onSetScreenSource ? (
            <ScreenMenuSection
              target={shapeTarget}
              sectionProps={sectionProps}
              onSetScreenSource={props.onSetScreenSource}
              onCloseMenu={props.onClose}
            />
          ) : null}
          {isChair ? (
            <ChairMenuSection
              target={shapeTarget ?? undefined}
              sectionProps={sectionProps}
              onSetFacing={props.onSetChairFacing}
            />
          ) : null}
          {/* Portal (docs/specs/009-elements/portal-element.md) — its name, where it leads (any tab), and a
            shortcut to create the far end. See PortalMenuSection. */}
          {isPortal && shapeTarget ? (
            <PortalMenuSection
              portal={shapeTarget}
              tabs={props.tabs}
              activeTabId={props.activeTabId}
              onSetPortalTarget={props.onSetPortalTarget}
              onSetPortalName={props.onSetPortalName}
              onCreateLinkedPortal={props.onCreateLinkedPortal}
              sectionProps={sectionProps('portal-target')}
            />
          ) : null}
        </MenuToolsSection>
      ) : null}
    </>
  );
}

/** Whether the element has a section of its own (its row named for it): the element menu opens only when it has
 *  something to show (docs/specs/002-project-scope/not-in-livehuddle.md "Format Painter and Clear Styles"). */
export function hasOwnSection(
  props: EditorContextMenuProps,
  target: EditorContextMenuProps['elements'][number],
): boolean {
  const shapeTarget = target.type === 'shape' ? target : null;
  const isPortal = shapeTarget?.shape === 'portal';
  const isChair = !!shapeTarget && turnsWithFacing(shapeTarget.shape);
  // A Door's, Rug's, Corridor's or Meeting Table's type (docs/specs/009-elements/office.md "A piece's type").
  const retypes = !!shapeTarget && changesType(shapeTarget.shape) && !!props.onSetPieceType;
  // The kind-specific controls fold behind one row named for the element (canvas-and-palette.md "An element's own
  // settings open in a dialog"), so a piece's menu doesn't grow a band of bespoke rows.
  return (
    isPortal ||
    isChair ||
    retypes ||
    (!!shapeTarget && hasBuiltInDoorway(shapeTarget)) ||
    // Every room's Walls, Solid or Glass (docs/specs/009-elements/office.md "Glass walls").
    shapeTarget?.shape === 'room' ||
    shapeTarget?.shape === 'stage' ||
    (shapeTarget?.shape === 'avatar-pad' && !!props.onSetPadReceptionist) ||
    (shapeTarget?.shape === 'screen' && !!props.onSetScreenSource) ||
    shapeTarget?.shape === 'jukebox' ||
    (shapeTarget?.shape === 'arcade-machine' && !!props.onClearArcadeScores)
  );
}
