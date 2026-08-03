'use client';

import type { ReactNode } from 'react';
import {
  DEFAULT_BUTTON_MODE,
  PADDING_PX,
  REACTION_DEFAULT,
  defaultFillColor,
  defaultPadding,
  defaultStrokeColor,
  isCollabPanelShape,
  isSelfDrawingShape,
  type ShapeMarker,
  type TextAlignX,
  type TextAlignY,
  type TextSize,
} from '@livediagram/diagram';
import { AnnotationGlyph } from '@/components/canvas/AnnotationMarker';
import { CollabFaceRouter } from '@/components/canvas/collab/CollabFaceRouter';
import { CommentPanelFace } from '@/components/canvas/CommentPanelFace';
import { FreehandSvg } from '@/components/canvas/boxed-element-overlays';
import { ImageElementView } from '@/components/canvas/ImageElementView';
import { LinkCardView } from '@/components/canvas/LinkCardView';
import { ModeButtonFace } from '@/components/canvas/ModeButtonFace';
import { PageMasthead } from '@/components/canvas/PageMasthead';
import { PickerFace } from '@/components/canvas/PickerFace';
import { PortalFace } from '@/components/canvas/PortalFace';
import { ReactionPadFace } from '@/components/canvas/ReactionPadFace';
import { RevealFace } from '@/components/canvas/RevealFace';
import { SessionButtonFace } from '@/components/canvas/SessionButtonFace';
import { SessionTimerFace } from '@/components/canvas/SessionTimerFace';
import { ShapeInlineIconLayout } from '@/components/canvas/shape-inline-icon-layout';
import { TableView } from '@/components/canvas/TableView';
import { VideoView } from '@/components/canvas/VideoView';
import type { BoxedElementViewProps } from './BoxedElementView.types';

// WHAT AN ELEMENT SHOWS IN PLACE OF A PLAIN LABEL.
//
// One exclusive chain, ordered from the most specific face to the plain
// label at the end. Nearly every branch is an element kind that draws its own
// interactive face — a mode button, a session timer, a reveal cover, a picker,
// a collaboration panel — and each one falls through to the ordinary label
// editor while `isEditing`, so the title on a face is retyped exactly like the
// label on a square.
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
  | 'zoom'
  | 'fontFamily'
  | 'activeMode'
  | 'collab'
  | 'commentActions'
  | 'commentSelfId'
  | 'imageContext'
  | 'tabSummaries'
  | 'tabTimer'
  | 'timerControls'
  | 'timerState'
  | 'sessionStartBlocked'
  | 'revealedForMe'
  | 'onCommitTable'
  | 'onEnterPortal'
  | 'onFireReaction'
  | 'onFollowLink'
  | 'onLinkCell'
  | 'onPressModeButton'
  | 'onPressSessionButton'
  | 'onRollPicker'
  | 'onSetPageHeading'
  | 'onSetSessionConfig'
  | 'onToggleReveal'
> & {
  // Derived once by the host and shared with the branches here, rather than
  // recomputed per branch: several of them render the same label node.
  label: string;
  labelNode: ReactNode;
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
  zoom,
  fontFamily,
  activeMode,
  collab,
  commentActions,
  commentSelfId,
  imageContext,
  tabSummaries,
  tabTimer,
  timerControls,
  timerState,
  sessionStartBlocked,
  revealedForMe,
  onCommitTable,
  onEnterPortal,
  onFireReaction,
  onFollowLink,
  onLinkCell,
  onPressModeButton,
  onPressSessionButton,
  onRollPicker,
  onSetPageHeading,
  onSetSessionConfig,
  onToggleReveal,
  label,
  labelNode,
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
  return (
    <>
      {/* Mode button (spec/103): a pressable face instead of a plain label —
          the mode's glyph plus the author's call to action. Mid-edit it falls
          through to the normal label editor below, so the text is retyped like
          any other shape's. */}
      {element.type === 'shape' && element.shape === 'mode-button' && !isEditing ? (
        <ModeButtonFace
          mode={element.mode ?? DEFAULT_BUTTON_MODE}
          label={label}
          activeMode={activeMode}
          textColor={textColor}
          onPress={onPressModeButton ? () => onPressModeButton(element) : undefined}
        />
      ) : element.type === 'shape' &&
        element.shape === 'session-button' &&
        element.session?.tool === 'timer' &&
        !isEditing &&
        timerControls ? (
        /* A TIMER session element is the timer (spec/105), not a button that
           starts one elsewhere: same TabTimer, same tab field, same pure
           display maths as the top-of-page pill, so pausing here pauses
           there. Falls through to the plain button face when the surface has
           no timer controls (the read-only embed, the export renderer). */
        <SessionTimerFace
          timer={tabTimer ?? null}
          durationMs={(element.session.minutes ?? 5) * 60_000}
          readOnly={!timerControls.pause}
          onStart={
            onPressSessionButton && !sessionStartBlocked
              ? () => onPressSessionButton(element)
              : undefined
          }
          onPause={timerControls.pause}
          onResume={timerControls.resume}
          onReset={timerControls.reset}
          onClear={timerControls.clear}
          minutes={element.session.minutes ?? 5}
          onSetMinutes={
            onSetSessionConfig
              ? (m) => {
                  onSetSessionConfig(element, { ...element.session!, minutes: m });
                  // A timer that is already running or paused restarts at the
                  // new length: leaving it mid-run would show a number from
                  // the old length against the new one.
                  timerControls.setDuration?.(m * 60_000);
                }
              : undefined
          }
        />
      ) : element.type === 'shape' && element.shape === 'session-button' && !isEditing ? (
        /* Session button (spec/105): starts a vote / poll for the room. */
        <SessionButtonFace
          config={element.session}
          label={label}
          textColor={textColor}
          canStart={!!onPressSessionButton && !sessionStartBlocked}
          timerState={timerState}
          onPress={onPressSessionButton ? () => onPressSessionButton(element) : undefined}
          onSetConfig={
            onSetSessionConfig && element.session
              ? (next) => onSetSessionConfig(element, next)
              : undefined
          }
        />
      ) : element.type === 'shape' && element.shape === 'reveal' && !isEditing ? (
        /* Reveal zone (spec/106): a cover, off for me / off for everyone. */
        <RevealFace
          label={label}
          textColor={textColor}
          strokeColor={remoteBorderColor ?? element.strokeColor ?? defaultStrokeColor(element)}
          revealedForAll={element.revealed === true}
          revealedForMe={!!revealedForMe}
          onToggleForMe={onToggleReveal ? () => onToggleReveal(element.id) : undefined}
        />
      ) : element.type === 'shape' && element.shape === 'picker' && !isEditing ? (
        /* Picker (spec/107): rolls a person or an option. */
        <PickerFace
          label={label}
          result={element.pickerResult}
          candidates={onRollPicker?.(element).candidates ?? []}
          textColor={textColor}
          onRoll={onRollPicker ? () => onRollPicker(element).roll() : undefined}
        />
      ) : element.type === 'shape' && isCollabPanelShape(element.shape) && !isEditing ? (
        /* The collaboration panels (spec/123 to spec/129): an estimate card,
           a temperature check, an idea box, an agenda, or a roll call. Like
           every other face above, mid-edit it falls through to the ordinary
           label editor below, so the title is retyped like any shape's. */
        <CollabFaceRouter element={element} label={label} textColor={textColor} collab={collab} />
      ) : element.type === 'shape' && element.shape === 'comment-pin' && !isEditing ? (
        /* Comment pin (spec/136): opens the SAME thread popover an ordinary
           element's comment badge opens — the pin is just an element whose
           only job is to carry a commentThread. */
        <CommentPanelFace
          element={element}
          textColor={textColor}
          selfId={commentSelfId ?? ''}
          onAddComment={commentActions?.add}
          onDeleteComment={commentActions?.remove}
          onResolve={commentActions?.resolve}
          onUnresolve={commentActions?.unresolve}
        />
      ) : element.type === 'shape' && element.shape === 'reaction-pad' && !isEditing ? (
        /* Reaction pad (spec/135): a pressable glyph. The burst it throws is
           rendered OUTSIDE this label stack, below, so it can overflow the
           element's box — a burst confined to the pad is a burst nobody
           notices. */
        <ReactionPadFace
          label={label}
          reaction={element.reaction ?? REACTION_DEFAULT}
          textColor={textColor}
          onFire={onFireReaction ? () => onFireReaction(element) : undefined}
        />
      ) : element.type === 'shape' && element.shape === 'portal' && !isEditing ? (
        /* Portal (spec/104): the drawn portal + its label, pressable when paired. */
        <PortalFace
          label={label || 'Portal'}
          strokeColor={remoteBorderColor ?? element.strokeColor ?? defaultStrokeColor(element)}
          targetName={onEnterPortal?.(element).targetName ?? null}
          onEnter={onEnterPortal?.(element).travel}
        />
      ) : element.type === 'annotation' ? (
        <AnnotationGlyph
          stroke={remoteBorderColor ?? element.strokeColor ?? defaultStrokeColor(element)}
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
        <ImageElementView
          element={element}
          ownerId={imageContext.ownerId}
          diagramId={imageContext.diagramId}
          shareCode={imageContext.shareCode}
          canOpenPicker={!!imageContext.onOpenPicker}
        />
      ) : element.type === 'freehand' ? (
        <>
          <FreehandSvg
            element={element}
            fill={element.fillColor ?? defaultFillColor(element)}
            stroke={remoteBorderColor ?? element.strokeColor ?? defaultStrokeColor(element)}
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
          readOnly={isLocked || readOnly}
          tabSummaries={tabSummaries}
          onCommitTable={onCommitTable}
          onLinkCell={onLinkCell}
          onFollowLink={onFollowLink}
          fontFamily={fontFamily}
          zoom={zoom}
        />
      ) : element.type === 'shape' && (inlineIcon || marker) ? (
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
      ) : element.type === 'shape' && isSelfDrawingShape(element.shape) ? (
        // Progress / rail / rating / chart elements draw their own content, so
        // they render no standard editable label.
        <></>
      ) : element.type === 'shape' && element.shape === 'page' ? (
        // A Page stacks a fixed masthead over its body (spec/100). The body
        // node positions itself `absolute inset-0`, so it gets a `relative`
        // region of its own that starts under the rule rather than the whole
        // box — that is what stops the prose from running up into the title.
        <div
          className="absolute inset-0 flex flex-col"
          style={{ padding: PADDING_PX[element.padding ?? defaultPadding(element)] }}
        >
          <PageMasthead
            element={element}
            readOnly={isLocked || readOnly}
            onSetHeading={onSetPageHeading}
            fontFamily={fontFamily}
            zoom={zoom}
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
      ) : iconCaptionBand ? (
        // Icon caption band (spec/41): the label (and the inline editor while
        // typing) fills this positioned container instead of the whole box,
        // so the caption stays clear of the glyph in every alignment combo.
        <div className={`absolute ${iconCaptionBand}`}>{labelNode}</div>
      ) : (
        labelNode
      )}
    </>
  );
}
