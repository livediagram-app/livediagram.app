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

import { CardMenuSection } from '@/components/palette/CardMenuSection';
import { ChipMenuSection } from '@/components/palette/ChipMenuSection';
import { PointerNoteMenuSection } from '@/components/palette/PointerNoteMenuSection';
import { TagColoursBlock } from '@/components/palette/TagColoursBlock';
import { StackMenuSection } from '@/components/palette/StackMenuSection';
import { BoundaryMenuSection } from '@/components/palette/BoundaryMenuSection';
import { hasBuiltInDoorway, isChipShape, isConceptShape } from '@livehuddle/document';
import { ToolsMenuGlyph } from '@/components/palette/context-menu-icons';
import { AnimationSections } from '@/components/palette/AnimationSections';
import { MenuFlyoutSection } from '@liveworkspace/workbench/components/primitives/MenuFlyoutSection';
import { PortalMenuSection } from '@/components/palette/PortalMenuSection';
import { StageMenuSection } from '@/components/palette/StageMenuSection';
import { JukeboxMenuSection, WorldClockMenuSection } from '@/components/palette/SocialMenuSections';
import { ScreenMenuSection } from '@/components/palette/ScreenMenuSection';
import { ArcadeMenuSection } from '@/components/palette/ArcadeMenuSection';
import {
  // The office pieces' settings: a chair's facing and a room's doorway.
  ChairMenuSection,
  RoomMenuSection,
  RoomWallsMenuSection,
} from '@/components/palette/CollabMenuSections';

import {
  hasWebRowsSection,
  WebRowsMenuSection,
} from '@/components/palette/context-menu-web-editors';
import type { EditorContextMenuProps } from './EditorContextMenu.types';
import { useContextMenuScaffold } from './useContextMenuScaffold';

type Scaffold = ReturnType<typeof useContextMenuScaffold>;

// The element menu's per-kind Tools sections (the Space pieces' settings, the containers' arrangements, a card's
// slots and rows) and its Animation controls. Split out of ElementAppearanceSections; the type flags are passed in
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
  // The Tools flyout (docs/specs/008-canvas/canvas-and-palette.md): the kind-specific controls fold behind one
  // "Tools" row, the same side-flyout pattern as Style and Text, so a piece's menu doesn't grow a band of bespoke
  // rows. Animation stays top-level (every boxed element has it).
  const isChip = shapeTarget ? isChipShape(shapeTarget.shape) : false;
  const showTools =
    hasWebRowsSection(target) ||
    isChip ||
    shapeTarget?.shape === 'boundary' ||
    shapeTarget?.shape === 'pointer-note' ||
    shapeTarget?.shape === 'stack' ||
    (shapeTarget ? isConceptShape(shapeTarget.shape) : false) ||
    isPortal ||
    isChair ||
    (!!shapeTarget && hasBuiltInDoorway(shapeTarget)) ||
    // Every room's Walls, Solid or Glass (docs/specs/009-elements/office.md "Glass walls").
    shapeTarget?.shape === 'room' ||
    shapeTarget?.shape === 'stage' ||
    (shapeTarget?.shape === 'screen' && !!props.onSetScreenUrl) ||
    shapeTarget?.shape === 'world-clock' ||
    shapeTarget?.shape === 'jukebox' ||
    (shapeTarget?.shape === 'arcade-machine' && !!props.onClearArcadeScores);
  return (
    <>
      {showTools ? (
        <MenuFlyoutSection title="Tools" icon={<ToolsMenuGlyph />} {...flyoutProps('tools')}>
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
          {/* A boundary's style (docs/specs/009-elements/boundary.md). */}
          {shapeTarget?.shape === 'boundary' ? (
            <BoundaryMenuSection
              target={shapeTarget}
              ops={props.elementStyle}
              sectionProps={sectionProps}
            />
          ) : null}
          {/* A badge's or step number's look, Detach, Renumber, Play in Order (docs/specs/009-elements/badge.md). */}
          {shapeTarget && isChip ? (
            <ChipMenuSection
              target={shapeTarget}
              ops={props.elementStyle}
              stepsInOrder={props.elements.some(
                (el) => el.type === 'shape' && el.shape === 'step' && el.stepSequence === true,
              )}
              sectionProps={sectionProps}
            />
          ) : null}
          {/* A stack's arrangement (docs/specs/009-elements/stack.md). */}
          {shapeTarget?.shape === 'stack' ? (
            <StackMenuSection
              target={shapeTarget}
              ops={props.elementStyle}
              sectionProps={sectionProps}
            />
          ) : null}
          {/* A pointer note's Detach (docs/specs/009-elements/pointer-note.md). */}
          {shapeTarget?.shape === 'pointer-note' ? (
            <PointerNoteMenuSection
              target={shapeTarget}
              ops={props.elementStyle}
              sectionProps={sectionProps}
            />
          ) : null}
          {/* The card's slots (docs/specs/009-elements/card.md): band, title, meta line, media. */}
          {shapeTarget?.shape === 'card' ? (
            <CardMenuSection
              target={shapeTarget}
              ops={props.elementStyle}
              sectionProps={sectionProps}
              tagColours={
                props.onSetTagColour ? (
                  <TagColoursBlock
                    target={shapeTarget}
                    tagColours={props.tagColours}
                    colourPalette={props.colourPalette}
                    onSetTagColour={props.onSetTagColour}
                  />
                ) : null
              }
            />
          ) : null}
          {shapeTarget && hasWebRowsSection(shapeTarget) ? (
            <WebRowsMenuSection
              target={shapeTarget}
              sectionProps={sectionProps}
              onSetRows={props.onSetWebRows}
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
