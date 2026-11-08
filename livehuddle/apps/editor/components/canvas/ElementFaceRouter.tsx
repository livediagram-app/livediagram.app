'use client';

import type { ReactNode } from 'react';
import {
  DEFAULT_BUTTON_MODE,
  PADDING_PX,
  defaultPadding,
  defaultStrokeColor,
  carriesSharedSettingsMenu,
  elementKindLabel,
  isSelfDrawingShape,
  isRetiredElement,
  type ShapeMarker,
  type TextAlignX,
  type TextAlignY,
  type TextSize,
} from '@livehuddle/document';
import { ElementSettingsButton } from '@/components/canvas/ElementEllipsisMenu';
import { ImageElementView } from '@/components/canvas/ImageElementView';
import { LinkCardView } from '@/components/canvas/LinkCardView';
import { ModeButtonFace } from '@/components/canvas/ModeButtonFace';
import { PARTICIPANT_CANVAS_TOOLS } from '@/components/palette/palette-layouts';
import { FocusButtonFace } from '@/components/canvas/FocusButtonFace';
import { PortalFace } from '@/components/canvas/PortalFace';
import { ShapeInlineIconLayout } from '@/components/canvas/shape-inline-icon-layout';
import { InsetContent } from '@/components/canvas/InsetContent';
import type { ContentInset } from '@/components/canvas/useIndicatorLayout';
import { RetiredElementFace } from '@/components/canvas/RetiredElementFace';
import type { BoxedElementViewProps } from './BoxedElementView.types';
import { DirectoryFace } from '@/components/canvas/wayfinding/DirectoryFace';
import { ElevatorFace } from '@/components/canvas/wayfinding/ElevatorFace';
import { PhotoWallFace } from '@/components/canvas/wayfinding/PhotoWallFace';
import { SignpostFace } from '@/components/canvas/wayfinding/SignpostFace';
import { StairsFace } from '@/components/canvas/wayfinding/StairsFace';
import { useCanvasSurface } from '@/components/canvas/CanvasSurfaceContext';

// WHAT AN ELEMENT SHOWS IN PLACE OF A PLAIN LABEL.
//
// One exclusive chain, ordered from the most specific face to the plain
// label at the end. Nearly every branch is an element kind that draws its own
// interactive face (a mode button, Bring Focus, a reaction pad, a portal),
// and each one falls through to the ordinary label editor while `isEditing`,
// so the title on a face is retyped exactly like the label on a square. A
// retired element (docs/specs/002-project-scope/not-in-livehuddle.md "Retired
// elements") comes before all of them and never falls through: it takes no
// typed label.
//
// Split out of BoxedElementView because it is the one part of that component
// that grows with the palette: every new pressable element adds a branch here
// and nothing else. The host keeps the geometry, the selection chrome and the
// badges; this keeps the faces.

type ElementFaceRouterProps = Pick<
  BoxedElementViewProps,
  | 'element'
  | 'isEditing'
  | 'isSelected'
  | 'readOnly'
  | 'fontFamily'
  | 'activeMode'
  | 'imageContext'
  | 'tabSummaries'
  | 'onEnterPortal'
  | 'onFollowLink'
  | 'onPressModeButton'
  | 'onPressFocusButton'
  | 'onOpenElementSettings'
  | 'onDeleteRetired'
> & {
  // Derived once by the host and shared with the branches here, rather than
  // recomputed per branch: several of them render the same label node.
  label: string;
  labelNode: ReactNode;
  // Where the label (and an inline icon) moves to clear the element's indicators
  // (docs/specs/008-canvas/element-indicators.md); absent or zero leaves it in place.
  contentInset?: ContentInset;
  textColor: string;
  textSize: TextSize;
  alignX: TextAlignX;
  alignY: TextAlignY;
  remoteBorderColor: string | null;
  inlineIcon: string | false | undefined;
  marker: ShapeMarker | undefined;
  iconCaptionBand: string | null;
  // The box the element's indicators take, in its own units (indicatorClusterRect), so a retired element's Delete
  // keeps clear of them; absent or null when it has none.
  indicatorRect?: { x: number; y: number; width: number; height: number } | null;
};

export function ElementFaceRouter(props: ElementFaceRouterProps) {
  // A kind livehuddle no longer has draws its placeholder and nothing else: no settings `…`, no face of its own,
  // and no label editor however it was asked for one.
  if (isRetiredElement(props.element))
    return (
      <RetiredElementFace
        element={props.element}
        fontFamily={props.fontFamily}
        selected={props.isSelected}
        onDelete={props.readOnly ? undefined : props.onDeleteRetired}
        indicators={props.indicatorRect}
      />
    );
  return <KnownElementFace {...props} />;
}

function KnownElementFace({
  element,
  isEditing,
  readOnly,
  fontFamily,
  activeMode,
  imageContext,
  tabSummaries,
  onEnterPortal,
  onFollowLink,
  onPressModeButton,
  onPressFocusButton,
  onOpenElementSettings,
  label,
  labelNode,
  contentInset,
  textColor,
  textSize,
  alignX,
  alignY,
  remoteBorderColor,
  inlineIcon,
  marker,
  iconCaptionBand,
}: ElementFaceRouterProps) {
  // The paper under this face, for colours the element doesn't carry (docs/specs/007-editor/editor-app.md).
  const surface = useCanvasSurface();
  // The shared settings `…` (docs/specs/008-canvas/canvas-and-palette.md), in the same corner on every Behaviours
  // element that has one: see carriesSharedSettingsMenu for who doesn't.
  const settingsButton =
    element.type === 'shape' &&
    !isEditing &&
    !readOnly &&
    onOpenElementSettings &&
    carriesSharedSettingsMenu(element.shape) ? (
      <ElementSettingsButton
        label={`${elementKindLabel(element)} settings`}
        color={textColor}
        onOpen={() => onOpenElementSettings(element.id)}
      />
    ) : null;
  const settingsMenu = settingsButton ? (
    <span className="absolute right-1 top-1 z-10">{settingsButton}</span>
  ) : null;

  return (
    <>
      {settingsMenu}
      {/* Mode button (docs/specs/009-elements/mode-button.md): a pressable face instead of a plain label —
          the mode's glyph plus the author's call to action. Mid-edit it falls
          through to the normal label editor below, so the text is retyped like
          any other shape's. */}
      {element.type === 'shape' && element.shape === 'mode-button' && !isEditing ? (
        <ModeButtonFace
          mode={element.mode ?? DEFAULT_BUTTON_MODE}
          label={label}
          activeMode={activeMode}
          textColor={textColor}
          // A mode a read-only session lacks (the Format Painter) draws an inert face for it.
          onPress={
            onPressModeButton &&
            (!readOnly || PARTICIPANT_CANVAS_TOOLS.includes(element.mode ?? DEFAULT_BUTTON_MODE))
              ? () => onPressModeButton(element)
              : undefined
          }
        />
      ) : element.type === 'shape' && element.shape === 'focus-button' && !isEditing ? (
        /* Bring Focus (docs/specs/012-collaboration/bring-focus.md): asks everyone else in the room to come and
           look at this, on your tab. */
        <FocusButtonFace
          label={label}
          textColor={textColor}
          onPress={onPressFocusButton ? () => onPressFocusButton(element) : undefined}
        />
      ) : element.type === 'shape' && element.shape === 'portal' && !isEditing ? (
        /* Portal (docs/specs/009-elements/portal-element.md): the drawn portal + its label, pressable when paired. */
        <PortalFace
          label={label || 'Portal'}
          strokeColor={
            remoteBorderColor ?? element.strokeColor ?? defaultStrokeColor(element, surface)
          }
          targetName={onEnterPortal?.(element).targetName ?? null}
          onEnter={onEnterPortal?.(element).travel}
        />
      ) : element.type === 'shape' && element.shape === 'directory' ? (
        /* Directory (docs/specs/009-elements/directory.md): a press over the stand opens the space's rooms. */
        <DirectoryFace elementId={element.id} wayfinding={onEnterPortal?.(element).wayfinding} />
      ) : element.type === 'shape' && element.shape === 'signpost' ? (
        /* Signpost (docs/specs/009-elements/team-pieces.md): arrows to the tab's nearest places, each a Walk There. */
        <SignpostFace element={element} wayfinding={onEnterPortal?.(element).wayfinding} />
      ) : element.type === 'shape' && element.shape === 'photo-wall' ? (
        /* Team Photo Wall (team-pieces.md): the people here now, a portrait a frame. */
        <PhotoWallFace element={element} wayfinding={onEnterPortal?.(element).wayfinding} />
      ) : element.type === 'shape' && element.shape === 'stairs' ? (
        /* Stairs (docs/specs/009-elements/stairs.md): a press (or a walk-on) opens Up / Down. */
        <StairsFace element={element} wayfinding={onEnterPortal?.(element).wayfinding} />
      ) : element.type === 'shape' && element.shape === 'elevator' && !isEditing ? (
        /* Elevator (docs/specs/009-elements/elevator.md): a press (or a walk-in) opens the panel; its name under it,
           retyped like any label while editing. */
        <ElevatorFace
          elementId={element.id}
          label={label}
          textColor={textColor}
          wayfinding={onEnterPortal?.(element).wayfinding}
        />
      ) : element.type === 'link-card' ? (
        <LinkCardView
          element={element}
          tabs={tabSummaries}
          onFollow={element.link ? () => onFollowLink(element.link!) : undefined}
        />
      ) : element.type === 'image' && imageContext ? (
        <ImageElementView
          element={element}
          ownerId={imageContext.ownerId}
          documentId={imageContext.documentId}
          shareCode={imageContext.shareCode}
          onOpenPicker={imageContext.onOpenPicker}
          fontFamily={fontFamily}
        />
      ) : element.type === 'shape' && (inlineIcon || marker) ? (
        <InsetContent inset={contentInset}>
          <ShapeInlineIconLayout
            element={element}
            showIcon={!!inlineIcon}
            marker={marker}
            markerSize={element.markerSize ?? 'scale'}
            position={element.iconPosition ?? 'left'}
            iconStroke={textColor}
            isEditing={isEditing}
            editor={labelNode}
            label={label}
            textColor={textColor}
            textSize={textSize}
            alignX={alignX}
            alignY={alignY}
            padding={PADDING_PX[element.padding ?? defaultPadding(element)]}
            fontFamily={fontFamily}
          />
        </InsetContent>
      ) : element.type === 'shape' && isSelfDrawingShape(element.shape) ? (
        // A self-drawing piece (a rail, a sticker, a Space piece) draws its own content, so
        // it renders no standard editable label.
        <></>
      ) : iconCaptionBand ? (
        // Icon caption band (docs/specs/010-palette/technology-icons.md): the label (and the inline editor while
        // typing) fills this positioned container instead of the whole box,
        // so the caption stays clear of the glyph in every alignment combo.
        // The label's own clip is lifted: a band is a fraction of a small icon,
        // and a caption taller than it draws over the art (it paints after the
        // glyph) rather than clipping to a sliver ("A caption never disappears").
        <div className={`absolute ${iconCaptionBand} [&>*]:overflow-visible`}>{labelNode}</div>
      ) : (
        <InsetContent inset={contentInset}>{labelNode}</InsetContent>
      )}
    </>
  );
}
