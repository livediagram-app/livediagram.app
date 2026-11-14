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

import { changesType, hasBuiltInDoorway } from '@livehuddle/document';
import { ToolsMenuGlyph } from '@/components/palette/context-menu-icons';
import { AnimationSections } from '@/components/palette/AnimationSections';
import { MenuFlyoutSection } from '@liveworkspace/workbench/components/primitives/MenuFlyoutSection';
import { PortalMenuSection } from '@/components/palette/PortalMenuSection';
import { StageMenuSection } from '@/components/palette/StageMenuSection';
import { ReceptionistMenuSection } from '@/components/palette/ReceptionistMenuSection';
import { receptionistPad } from '@/lib/receptionist/receptionist-day';
import { JukeboxMenuSection, WorldClockMenuSection } from '@/components/palette/SocialMenuSections';
import { ScreenMenuSection } from '@/components/palette/ScreenMenuSection';
import { ArcadeMenuSection } from '@/components/palette/ArcadeMenuSection';
import { PieceTypeMenuSection } from '@/components/palette/PieceTypeMenuSection';
import {
  // The office pieces' settings: a chair's facing and a room's doorway.
  ChairMenuSection,
  RoomMenuSection,
  RoomWallsMenuSection,
} from '@/components/palette/CollabMenuSections';
import type { EditorContextMenuProps } from './EditorContextMenu.types';
import { useContextMenuScaffold } from './useContextMenuScaffold';

type Scaffold = ReturnType<typeof useContextMenuScaffold>;

// The element menu's per-kind Tools sections (the Space pieces' settings) and its Animation controls. Split out of ElementAppearanceSections; the type flags are passed in
// (the parent already derives them) and the shape narrowing is re-derived off target.
type ElementDataSectionsProps = {
  props: EditorContextMenuProps;
  target: EditorContextMenuProps['elements'][number];
  isPortal: boolean;
  isChair: boolean;
  sectionProps: Scaffold['sectionProps'];
  flyoutProps: Scaffold['flyoutProps'];
};

export function ElementDataSections({
  props,
  target,
  isPortal,
  isChair,
  sectionProps,
  flyoutProps,
}: ElementDataSectionsProps) {
  const shapeTarget = target.type === 'shape' ? target : null;
  // A Door's, Rug's, Corridor's or Meeting Table's type (docs/specs/009-elements/office.md "A piece's type").
  const retypes = !!shapeTarget && changesType(shapeTarget.shape) && !!props.onSetPieceType;
  // The Tools flyout (docs/specs/008-canvas/canvas-and-palette.md): the kind-specific controls fold behind one
  // "Tools" row, the same side-flyout pattern as Style and Text, so a piece's menu doesn't grow a band of bespoke
  // rows. Animation stays top-level (every boxed element has it).
  const showTools =
    isPortal ||
    isChair ||
    retypes ||
    (!!shapeTarget && hasBuiltInDoorway(shapeTarget)) ||
    // Every room's Walls, Solid or Glass (docs/specs/009-elements/office.md "Glass walls").
    shapeTarget?.shape === 'room' ||
    shapeTarget?.shape === 'stage' ||
    (shapeTarget?.shape === 'avatar-pad' && !!props.onSetPadReceptionist) ||
    (shapeTarget?.shape === 'screen' && !!props.onSetScreenUrl) ||
    shapeTarget?.shape === 'world-clock' ||
    shapeTarget?.shape === 'jukebox' ||
    (shapeTarget?.shape === 'arcade-machine' && !!props.onClearArcadeScores);
  return (
    <>
      {showTools ? (
        <MenuFlyoutSection title="Tools" icon={<ToolsMenuGlyph />} {...flyoutProps('tools')}>
          {/* First, as the piece's biggest choice: which of its kind it is. */}
          {retypes && shapeTarget ? (
            <PieceTypeMenuSection
              target={shapeTarget}
              sectionProps={sectionProps}
              onSetType={props.onSetPieceType!}
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
          {shapeTarget?.shape === 'world-clock' && props.onSetClockZones ? (
            <WorldClockMenuSection
              target={shapeTarget}
              sectionProps={sectionProps}
              onSetZones={props.onSetClockZones}
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
          {shapeTarget?.shape === 'screen' && props.onSetScreenUrl ? (
            <ScreenMenuSection
              target={shapeTarget}
              sectionProps={sectionProps}
              onSetScreenUrl={props.onSetScreenUrl}
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
        </MenuFlyoutSection>
      ) : null}
      {/* Animation (docs/specs/028-animation/element-animations.md): one category per animation set the
            element takes, such as Shape Animation and Text Animation for a labelled shape. */}
      <AnimationSections
        elements={[target]}
        keyPrefix=""
        sectionProps={sectionProps}
        flyoutProps={flyoutProps}
        handlers={props}
      />
    </>
  );
}
