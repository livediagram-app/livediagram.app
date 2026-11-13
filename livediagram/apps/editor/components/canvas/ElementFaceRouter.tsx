'use client';

import dynamic from 'next/dynamic';
import type { CSSProperties, ReactNode } from 'react';
import { BORDER_STROKE_PX, DEFAULT_BORDER_STROKE, isRetiredElement } from '@livediagram/document';
import {
  PADDING_PX,
  defaultFillColor,
  defaultPadding,
  defaultStrokeColor,
  carriesSharedSettingsMenu,
  elementKindLabel,
  isCollabPanelShape,
  isSelfDrawingShape,
  isWebComponentShape,
  isChipShape,
  isConceptShape,
  type ConceptShape,
  type ShapeElement,
  defaultTextColor,
  type ShapeMarker,
  type TextAlignX,
  type TextAlignY,
  type TextSize,
} from '@livediagram/document';
import { AnnotationGlyph } from '@/components/canvas/AnnotationMarker';
import { ElementSettingsButton } from '@/components/canvas/ElementEllipsisMenu';
import { FreehandSvg } from '@/components/canvas/boxed-element-overlays';
import { PathSvg } from '@/components/canvas/path/PathSvg';
import { ImageElementView } from '@/components/canvas/ImageElementView';
import { LinkCardView } from '@/components/canvas/LinkCardView';
import { PageMasthead } from '@/components/canvas/PageMasthead';
import { ShapeInlineIconLayout } from '@/components/canvas/shape-inline-icon-layout';
import {
  InsetContent,
  type ContentInset,
} from '@liveworkspace/workbench/components/canvas/InsetContent';
import { loadTableView } from '@/lib/editor-deferred-code';
import { VideoView } from '@/components/canvas/VideoView';
import { HeroCaptionCard } from '@/components/canvas/web/HeroCaptionCard';
import { ChipFace } from '@/components/canvas/ChipFace';
import { PersonNodeFace } from '@/components/canvas/PersonNodeFace';
import { DiagramKeyFace } from '@/components/canvas/DiagramKeyFace';
import { SequenceFace } from '@/components/canvas/SequenceFace';
import { BoundaryFace } from '@/components/canvas/BoundaryFace';
import { ConceptFace } from '@/components/canvas/ConceptFace';
import { WebComponentFace } from '@/components/canvas/web/WebComponentFace';
import type { BoxedElementViewProps } from './BoxedElementView.types';
import { useCanvasSurface } from '@liveworkspace/workbench/components/canvas/CanvasSurfaceContext';
import { behaviourFace } from './behaviour-faces';

// Tables are on few boards, so their face loads on demand; its code is fetched as the editor mounts
// (lib/editor-deferred-code.ts), so a board that has one finds it already in. The facilitation panels'
// faces load the same way, from behaviour-faces.tsx.
const TableView = dynamic(loadTableView, { ssr: false });

// WHAT AN ELEMENT SHOWS IN PLACE OF A PLAIN LABEL.
//
// One exclusive chain, ordered from the most specific face to the plain
// label at the end. Nearly every branch is an element kind that draws its own
// interactive face (a mode button, a session timer, a reveal cover, a picker,
// a collaboration panel; their branches are behaviour-faces.tsx) and each one falls through to the ordinary label
// editor while `isEditing`, so the title on a face is retyped exactly like the
// label on a square.
//
// Split out of BoxedElementView because it is the one part of that component
// that grows with the palette: every new pressable element adds a branch here
// and nothing else. The host keeps the geometry, the selection chrome and the
// badges; this keeps the faces.

export type ElementFaceRouterProps = Pick<
  BoxedElementViewProps,
  | 'element'
  | 'isEditing'
  | 'isSelected'
  | 'readOnly'
  | 'writable'
  | 'fontFamily'
  | 'activeMode'
  | 'collab'
  | 'commentActions'
  | 'commentSelfId'
  | 'actionActions'
  | 'actionSelfId'
  | 'imageContext'
  | 'tabSummaries'
  | 'tabTimer'
  | 'timerControls'
  | 'timerState'
  | 'sessionStartBlocked'
  | 'sessionRunBy'
  | 'revealedForMe'
  | 'onCommitTable'
  | 'onEnterPortal'
  | 'onFireReaction'
  | 'onFollowLink'
  | 'onLinkCell'
  | 'onPressModeButton'
  | 'onPressFocusButton'
  | 'onPressSessionButton'
  | 'onRollPicker'
  | 'onSetPageHeading'
  | 'onSetWebRows'
  | 'onSetHeroCaptionLine'
  | 'onSetSessionConfig'
  | 'onOpenElementSettings'
  | 'onToggleReveal'
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
  isLocked: boolean;
  remoteBorderColor: string | null;
  inlineIcon: string | false | undefined;
  marker: ShapeMarker | undefined;
  iconCaptionBand: string | null;
  // An upright lane title's turned frame (upright-title.ts), or null.
  labelFrame: CSSProperties | null;
  // A pen stroke or a path is picked by its drawn line (selected, its box catches pointers too).
  hitLine: boolean;
};

export function ElementFaceRouter(props: ElementFaceRouterProps) {
  const {
    hitLine,
    element,
    isEditing,
    isSelected,
    readOnly,
    writable = true,
    fontFamily,
    imageContext,
    tabSummaries,
    onCommitTable,
    onFollowLink,
    onLinkCell,
    onSetPageHeading,
    onSetWebRows,
    onSetHeroCaptionLine,
    onOpenElementSettings,
    label,
    labelNode,
    contentInset,
    textColor,
    textSize,
    alignX,
    alignY,
    isLocked,
    remoteBorderColor,
    inlineIcon,
    marker,
    iconCaptionBand,
    labelFrame,
  } = props;
  // The paper under this face, for colours the element doesn't carry (docs/specs/007-editor/editor-app.md).
  const surface = useCanvasSurface();
  // The shared settings `…` (docs/specs/008-canvas/canvas-and-palette.md), in the same corner on every Behaviours
  // element that has one: see carriesSharedSettingsMenu for who doesn't.
  const settingsButton =
    element.type === 'shape' &&
    !isEditing &&
    !readOnly &&
    onOpenElementSettings &&
    carriesSharedSettingsMenu(element.shape) &&
    // A retired Avatar button is a placeholder, not a Selection Mode button: no `…` (retired-elements.md).
    !isRetiredElement(element) ? (
      <ElementSettingsButton
        label={`${elementKindLabel(element)} settings`}
        color={textColor}
        onOpen={() => onOpenElementSettings(element.id)}
      />
    ) : null;
  // A collaboration panel has a title row, and the `…` leads its title
  // (CollabSettingsSlot); everything else keeps it in the top-right corner.
  const inTitleRow = element.type === 'shape' && isCollabPanelShape(element.shape);
  // A card's own fill, for the modern collab faces' accent scope.
  const cardFill = element.fillColor ?? defaultFillColor(element, surface);
  const settingsMenu =
    settingsButton && !inTitleRow ? (
      <span className="absolute right-1 top-1 z-10">{settingsButton}</span>
    ) : null;

  return (
    <>
      {settingsMenu}
      {/* The pressable faces first (behaviour-faces.tsx), then the content faces and the label. */}
      {behaviourFace({ ...props, surface, cardFill, settingsButton }) ??
        (element.type === 'annotation' ? (
          <AnnotationGlyph
            stroke={
              remoteBorderColor ?? element.strokeColor ?? defaultStrokeColor(element, surface)
            }
          />
        ) : element.type === 'video' ? (
          <VideoView element={element} />
        ) : element.type === 'link-card' ? (
          <LinkCardView
            element={element}
            tabs={tabSummaries}
            onFollow={element.link ? () => onFollowLink(element.link!) : undefined}
          />
        ) : element.type === 'image' && imageContext ? (
          <>
            <ImageElementView
              element={element}
              ownerId={imageContext.ownerId}
              documentId={imageContext.documentId}
              shareCode={imageContext.shareCode}
              onOpenPicker={imageContext.onOpenPicker}
              fontFamily={fontFamily}
            />
            {/* A hero's caption card (docs/specs/009-elements/web-components-and-no-groups.md), over the image. */}
            {element.heroCaption ? (
              <HeroCaptionCard
                element={element}
                caption={element.heroCaption}
                editable={isSelected && !readOnly && !isLocked}
                fontFamily={fontFamily}
                onSetLine={
                  onSetHeroCaptionLine
                    ? (field, value) => onSetHeroCaptionLine(element.id, field, value)
                    : undefined
                }
              />
            ) : null}
          </>
        ) : element.type === 'freehand' ? (
          <>
            <FreehandSvg
              element={element}
              hitPenWidth={hitLine ? (element.penWidth ?? 0) : undefined}
              fill={element.fillColor ?? defaultFillColor(element, surface)}
              stroke={
                remoteBorderColor ?? element.strokeColor ?? defaultStrokeColor(element, surface)
              }
            />
            {/* Render the label on top of the SVG path so a freehand
              can carry text the same way a shape does (the Editor
              panel's Text accordion lights up for it). Both the SVG
              and the label use absolute inset-0 so they overlay
              cleanly inside the element's bounding box. Skipped when
              there's no label AND we're not mid-edit, to avoid the
              empty placeholder taking up space and competing with
              the drawn stroke. */}
            {isEditing || label.length > 0 ? labelNode : null}
          </>
        ) : element.type === 'path' ? (
          // A path (docs/specs/023-draw-mode/path-tool.md) draws its curve and takes no label.
          <PathSvg
            element={element}
            hitPenWidth={
              hitLine ? BORDER_STROKE_PX[element.strokeWidth ?? DEFAULT_BORDER_STROKE] : undefined
            }
            fill={element.fillColor ?? defaultFillColor(element, surface)}
            stroke={
              remoteBorderColor ?? element.strokeColor ?? defaultStrokeColor(element, surface)
            }
          />
        ) : element.type === 'table' ? (
          <TableView
            element={element}
            isSelected={isSelected}
            readOnly={isLocked || (readOnly && !writable)}
            cellsOnly={readOnly}
            tabSummaries={tabSummaries}
            onCommitTable={onCommitTable}
            onLinkCell={onLinkCell}
            onFollowLink={onFollowLink}
            fontFamily={fontFamily}
          />
        ) : element.type === 'shape' && isConceptShape(element.shape) ? (
          // A layer stack, pyramid or cycle (docs/specs/009-elements/concept-graphics.md): its rows in the accent ramp.
          <ConceptFace
            element={element as ShapeElement & { shape: ConceptShape }}
            labelNode={labelNode}
            accent={element.strokeColor ?? defaultStrokeColor(element, surface)}
            fill={element.fillColor ?? defaultFillColor(element, surface)}
            ink={textColor}
            fontFamily={fontFamily}
            editable={isSelected && !readOnly && !isLocked && !!onSetWebRows}
            onSetRows={(rows) => onSetWebRows?.(element.id, rows)}
          />
        ) : element.type === 'shape' &&
          element.shape === 'mind-node' &&
          element.mindLook === 'person' ? (
          // A person node (docs/specs/009-elements/org-chart.md): initials, name and role.
          <PersonNodeFace
            element={element}
            labelNode={labelNode}
            accent={element.strokeColor ?? defaultStrokeColor(element, surface)}
            ink={textColor}
            fontFamily={fontFamily}
            editable={isSelected && !readOnly && !isLocked}
            onSetRole={(value) => onSetPageHeading(element.id, 'pageSubtitle', value)}
          />
        ) : element.type === 'shape' && element.shape === 'sequence' ? (
          // A sequence diagram (docs/specs/009-elements/sequence-diagram.md): the export's picture, fitted.
          <SequenceFace
            element={element}
            paper={cardFill}
            stroke={element.strokeColor ?? defaultStrokeColor(element, surface)}
            ink={textColor}
            fontFamily={fontFamily}
          />
        ) : element.type === 'shape' && element.shape === 'diagram-key' ? (
          // A diagram key (docs/specs/009-elements/diagram-key.md): its title, swatches and meanings.
          <DiagramKeyFace
            element={element}
            labelNode={labelNode}
            accent={element.strokeColor ?? defaultStrokeColor(element, surface)}
            paper={cardFill}
            ink={textColor}
            fontFamily={fontFamily}
            editable={isSelected && !readOnly && !isLocked && !!onSetWebRows}
            onSetRows={(rows) => onSetWebRows?.(element.id, rows)}
          />
        ) : element.type === 'shape' && element.shape === 'boundary' ? (
          // A boundary (docs/specs/009-elements/boundary.md): its tint, and its title in its tab or corner. It draws
          // its own icon, so this sits before the generic inline-icon layout.
          <BoundaryFace
            element={element}
            labelNode={labelNode}
            // Its own accent, never a remote selector's: the tab, tint and title are its content, and the wrapper's
            // outline already shows who has it selected.
            accent={element.strokeColor ?? defaultStrokeColor(element, surface)}
            ink={textColor}
            fontFamily={fontFamily}
            editable={isSelected && !readOnly && !isLocked}
            onSetMeta={(value) => onSetPageHeading(element.id, 'pageSubtitle', value)}
          />
        ) : element.type === 'shape' && isChipShape(element.shape) ? (
          // A badge or step number (docs/specs/009-elements/badge.md): its pill or disc under its own label.
          <ChipFace
            element={element}
            labelNode={labelNode}
            accent={element.strokeColor ?? defaultStrokeColor(element, surface)}
            fill={element.fillColor ?? defaultFillColor(element, surface)}
            ink={element.textColor ?? defaultTextColor(element, surface)}
          />
        ) : element.type === 'shape' && isWebComponentShape(element.shape) ? (
          /* The web components (docs/specs/009-elements/web-components-and-no-groups.md): each lays out its own content and
           places the label in its own region, so it is edited like any
           label; the other lines edit in place once it is selected. They draw
           an inline icon themselves (a header's logo, a callout's badge), so
           this sits before the generic inline-icon layout. */
          <WebComponentFace
            kind={element.shape}
            element={element}
            labelNode={labelNode}
            // Its own accent, never a remote selector's: a card's header band, media and tags (a banner's bar, a stat
            // row's numbers) are its content, so a collaborator's selection recoloured the whole face; the wrapper's
            // outline already shows who has it selected.
            accent={element.strokeColor ?? defaultStrokeColor(element, surface)}
            fill={element.fillColor ?? defaultFillColor(element, surface)}
            textColor={textColor}
            fontFamily={fontFamily}
            editable={isSelected && !readOnly && !isLocked && !!onSetWebRows}
            onSetRows={(rows) => onSetWebRows?.(element.id, rows)}
            onSetHeading={(field, value) => onSetPageHeading(element.id, field, value)}
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
          // Progress / rail / rating / chart elements draw their own content, so
          // they render no standard editable label.
          <></>
        ) : element.type === 'shape' && element.shape === 'page' ? (
          // A Page stacks a fixed masthead over its body (docs/specs/009-elements/page-element.md). The body
          // node positions itself `absolute inset-0`, so it gets a `relative`
          // region of its own that starts under the rule rather than the whole
          // box: that is what stops the prose from running up into the title.
          <div
            className="absolute inset-0 flex flex-col"
            style={{ padding: PADDING_PX[element.padding ?? defaultPadding(element)] }}
          >
            <PageMasthead
              element={element}
              readOnly={isLocked || readOnly}
              onSetHeading={onSetPageHeading}
              fontFamily={fontFamily}
            />
            {/* The body keeps its own padding, which reads as the gap under the
              rule; only the horizontal padding would double up, so the label's
              is left to do the work and this container has none. */}
            <div
              className="relative min-h-0 flex-1"
              style={{ marginInline: -PADDING_PX[element.padding ?? defaultPadding(element)] }}
            >
              {labelNode}
            </div>
          </div>
        ) : labelFrame ? (
          // An upright lane title (docs/specs/009-elements/lane.md "Upright titles"): the label and its
          // editor turn together in the strip.
          <div style={labelFrame}>{labelNode}</div>
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
        ))}
    </>
  );
}
