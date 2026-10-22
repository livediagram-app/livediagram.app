'use client';

import dynamic from 'next/dynamic';
import type { ReactNode } from 'react';
import { BORDER_STROKE_PX, DEFAULT_BORDER_STROKE } from '@liveplanner/project';
import {
  PADDING_PX,
  defaultFillColor,
  defaultPadding,
  carriesSharedSettingsMenu,
  elementKindLabel,
  isCollabPanelShape,
} from '@liveplanner/project';
import { ElementSettingsButton } from '@/components/canvas/ElementEllipsisMenu';
import { CollabSettingsSlot } from '@/components/canvas/collab/collab-chrome';
import { CommentPanelFace } from '@/components/canvas/CommentPanelFace';
import { ActionPanelFace } from '@/components/canvas/ActionPanelFace';
import { PageMasthead } from '@/components/canvas/PageMasthead';
import { PickerFace } from '@/components/canvas/PickerFace';
import { SessionButtonFace } from '@/components/canvas/SessionButtonFace';
import { SessionTimerFace } from '@/components/canvas/SessionTimerFace';
import { InsetContent } from '@/components/canvas/InsetContent';
import type { ContentInset } from '@/components/canvas/useIndicatorLayout';
import { loadCollabFaceRouter } from '@/lib/editor-deferred-code';
import type { BoxedElementViewProps } from './BoxedElementView.types';
import { useCanvasSurface } from '@/components/canvas/CanvasSurfaceContext';

// Collaboration panels are on few boards, so their faces load on demand; their code is fetched
// as the editor mounts (lib/editor-deferred-code.ts), so a board that has one finds it already in.
const CollabFaceRouter = dynamic(loadCollabFaceRouter, { ssr: false });

// WHAT AN ELEMENT SHOWS IN PLACE OF A PLAIN LABEL.
//
// One exclusive chain, ordered from the most specific face to the plain
// label at the end. Nearly every branch is an element kind that draws its own
// interactive face — a session timer, a picker, a collaboration panel — and each one falls through to the ordinary label
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
  | 'readOnly'
  | 'fontFamily'
  | 'collab'
  | 'commentActions'
  | 'commentSelfId'
  | 'actionActions'
  | 'actionSelfId'
  | 'tabTimer'
  | 'timerControls'
  | 'timerState'
  | 'sessionStartBlocked'
  | 'onPressSessionButton'
  | 'onRollPicker'
  | 'onSetPageHeading'
  | 'onSetSessionConfig'
  | 'onOpenElementSettings'
> & {
  // Derived once by the host and shared with the branches here, rather than
  // recomputed per branch: several of them render the same label node.
  label: string;
  labelNode: ReactNode;
  // Where the label (and an inline icon) moves to clear the element's indicators
  // (docs/specs/008-canvas/element-indicators.md); absent or zero leaves it in place.
  contentInset?: ContentInset;
  textColor: string;
  isLocked: boolean;
};

export function ElementFaceRouter({
  element,
  isEditing,
  readOnly,
  fontFamily,
  collab,
  commentActions,
  commentSelfId,
  actionActions,
  actionSelfId,
  tabTimer,
  timerControls,
  timerState,
  sessionStartBlocked,
  onPressSessionButton,
  onRollPicker,
  onSetPageHeading,
  onSetSessionConfig,
  onOpenElementSettings,
  label,
  labelNode,
  contentInset,
  textColor,
  isLocked,
}: ElementFaceRouterProps) {
  // The paper under this face, for colours the element doesn't carry (docs/specs/007-editor/live-app.md).
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
      {element.type === 'shape' &&
      element.shape === 'session-button' &&
      element.session?.tool === 'timer' &&
      !isEditing &&
      timerControls ? (
        /* A TIMER session element is the timer (docs/specs/012-collaboration/session-button.md), not a button that
           starts one elsewhere: same TabTimer, same tab field, same pure
           display maths as the top-of-page pill, so pausing here pauses
           there. Falls through to the plain button face when the surface has
           no timer controls (the read-only embed, the export renderer). */
        <SessionTimerFace
          timer={tabTimer ?? null}
          durationMs={(element.session.minutes ?? 5) * 60_000}
          readOnly={!timerControls.pause}
          borderPx={BORDER_STROKE_PX[element.strokeWidth ?? DEFAULT_BORDER_STROKE]}
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
          onOpenSettings={
            onOpenElementSettings ? () => onOpenElementSettings(element.id) : undefined
          }
        />
      ) : element.type === 'shape' && element.shape === 'session-button' && !isEditing ? (
        /* Session button (docs/specs/012-collaboration/session-button.md): starts a vote or a stopwatch for the room. */
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
          onOpenSettings={
            onOpenElementSettings ? () => onOpenElementSettings(element.id) : undefined
          }
        />
      ) : element.type === 'shape' && element.shape === 'picker' && !isEditing ? (
        /* Picker (docs/specs/012-collaboration/picker.md): rolls a person or an option. */
        <PickerFace
          label={label}
          result={element.pickerResult}
          candidates={onRollPicker?.(element).candidates ?? []}
          textColor={textColor}
          shared={onRollPicker?.(element).shared ?? false}
          // Rolling is running the session (docs/specs/013-workspace/share-roles.md): an Editor's alone.
          onRoll={onRollPicker && !readOnly ? () => onRollPicker(element).roll() : undefined}
        />
      ) : element.type === 'shape' && isCollabPanelShape(element.shape) && !isEditing ? (
        /* The collaboration panels (docs/specs/012-collaboration/temperature-check.md, decision-record.md): a
           temperature check or a decision record. Like every other face above, mid-edit it falls through to the ordinary
           label editor below, so the title is retyped like any shape's. */
        <CollabSettingsSlot.Provider value={settingsButton}>
          <CollabFaceRouter
            element={element}
            label={label}
            textColor={textColor}
            collab={collab}
            onOpenSettings={
              onOpenElementSettings ? () => onOpenElementSettings(element.id) : undefined
            }
          />
        </CollabSettingsSlot.Provider>
      ) : element.type === 'shape' && element.shape === 'comment-pin' && !isEditing ? (
        /* Comment pin (docs/specs/012-collaboration/comment-pin.md): opens the SAME thread popover an ordinary
           element's comment badge opens — the pin is just an element whose
           only job is to carry a commentThread. */
        <CommentPanelFace
          element={element}
          label={label}
          textColor={textColor}
          surface={cardFill}
          selfId={commentSelfId ?? ''}
          onAddComment={commentActions?.add}
          onDeleteComment={commentActions?.remove}
          onResolve={commentActions?.resolve}
          onUnresolve={commentActions?.unresolve}
        />
      ) : element.type === 'shape' && element.shape === 'action-card' && !isEditing ? (
        /* Action panel (docs/specs/012-collaboration/action-panel.md): the Comment panel's sibling. It drives the
           SAME action machinery the popover and the Assign Action dialog do. */
        <ActionPanelFace
          element={element}
          label={label}
          textColor={textColor}
          surface={cardFill}
          selfId={actionSelfId ?? null}
          onAdd={actionActions?.add}
          onEdit={actionActions?.edit}
          onComplete={actionActions?.complete}
          onReopen={actionActions?.reopen}
          onOpenBoard={actionActions?.openBoard}
        />
      ) : element.type === 'shape' && element.shape === 'page' ? (
        // A Page stacks a fixed masthead over its body (docs/specs/009-elements/page-element.md). The body
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
      ) : (
        <InsetContent inset={contentInset}>{labelNode}</InsetContent>
      )}
    </>
  );
}
