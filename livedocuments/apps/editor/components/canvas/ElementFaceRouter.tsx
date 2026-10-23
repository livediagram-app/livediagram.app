'use client';

import dynamic from 'next/dynamic';
import { TabWindowFace } from './tab-window/TabWindowFace';
import type { ReactNode } from 'react';
import {
  PADDING_PX,
  defaultFillColor,
  defaultPadding,
  defaultStrokeColor,
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
} from '@livedocuments/document';
import { ArticleNoteFace } from '@/components/canvas/article/ArticleNoteFace';
import { FreehandSvg } from '@/components/canvas/boxed-element-overlays';
import { ImageElementView } from '@/components/canvas/ImageElementView';
import { LinkCardView } from '@/components/canvas/LinkCardView';
import { ShapeInlineIconLayout } from '@/components/canvas/shape-inline-icon-layout';
import { InsetContent } from '@/components/canvas/InsetContent';
import type { ContentInset } from '@/components/canvas/useIndicatorLayout';
import { loadTableView } from '@/lib/editor-deferred-code';
import { VideoView } from '@/components/canvas/VideoView';
import { HeroCaptionCard } from '@/components/canvas/web/HeroCaptionCard';
import { ChipFace } from '@/components/canvas/ChipFace';
import { ConceptFace } from '@/components/canvas/ConceptFace';
import { WebComponentFace } from '@/components/canvas/web/WebComponentFace';
import type { BoxedElementViewProps } from './BoxedElementView.types';
import { useElementSurface } from '@/components/canvas/CanvasSurfaceContext';

// Tables are on few boards, so their face loads on demand; its code is fetched as the editor mounts
// (lib/editor-deferred-code.ts), so a board that has one finds it already in.
const TableView = dynamic(loadTableView, { ssr: false });

// WHAT AN ELEMENT SHOWS IN PLACE OF A PLAIN LABEL.
//
// One exclusive chain, ordered from the most specific face to the plain
// label at the end. Most branches are an element kind that draws its own
// face — a tab window, a link card, a chart, a concept graphic, a web
// component.
//
// Split out of BoxedElementView because it is the one part of that component
// that grows with the palette: every new self-drawing element adds a branch here
// and nothing else. The host keeps the geometry, the selection chrome and the
// badges; this keeps the faces.

type ElementFaceRouterProps = Pick<
  BoxedElementViewProps,
  | 'element'
  | 'isEditing'
  | 'isSelected'
  | 'readOnly'
  | 'writable'
  | 'fontFamily'
  | 'imageContext'
  | 'tabSummaries'
  | 'onCommitTable'
  | 'onFollowLink'
  | 'onLinkCell'
  | 'onSetPageHeading'
  | 'onSetWebRows'
  | 'onSetHeroCaptionLine'
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
};

export function ElementFaceRouter({
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
}: ElementFaceRouterProps) {
  // The paper under this face, for colours the element doesn't carry (docs/specs/007-editor/editor-app.md):
  // its page's when the page has a fill of its own (pages-mode.md "A dark page has
  // light ink"), as the label's ink already is, else the canvas's.
  const surface = useElementSurface(element.id);
  return (
    <>
      {element.type === 'shape' && element.shape === 'tab-window' ? (
        /* Tab window (docs/specs/009-elements/tab-window.md): another tab of the document, live, fitted inside it. */
        <TabWindowFace
          element={element}
          surface={surface}
          selected={isSelected}
          // A locked window, or a read-only canvas (presenting, a viewer), keeps its tab: no Choose a Tab.
          canChoose={!readOnly && !isLocked}
        />
      ) : element.type === 'article-note' ? (
        <ArticleNoteFace element={element} />
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
