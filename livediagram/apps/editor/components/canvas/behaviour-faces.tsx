'use client';

import dynamic from 'next/dynamic';
import type { ReactNode } from 'react';
import {
  BORDER_STROKE_PX,
  DEFAULT_BORDER_STROKE,
  isButtonMode,
  isRetiredElement,
  reactionOf,
  defaultStrokeColor,
  isCollabPanelShape,
  ownColours,
  type CanvasSurface,
} from '@livediagram/document';
import { CollabSettingsSlot } from '@/components/canvas/collab/collab-chrome';
import { CommentPanelFace } from '@/components/canvas/CommentPanelFace';
import { ActionPanelFace } from '@/components/canvas/ActionPanelFace';
import { ModeButtonFace } from '@/components/canvas/ModeButtonFace';
import { RetiredElementFace } from '@/components/canvas/RetiredElementFace';
import { PARTICIPANT_CANVAS_TOOLS } from '@/components/palette/palette-layouts';
import { FocusButtonFace } from '@/components/canvas/FocusButtonFace';
import { PickerFace } from '@/components/canvas/PickerFace';
import { PortalFace } from '@/components/canvas/PortalFace';
import { ReactionPadFace } from '@/components/canvas/ReactionPadFace';
import { RevealFace } from '@/components/canvas/RevealFace';
import { SessionButtonFace } from '@/components/canvas/SessionButtonFace';
import { SessionTimerFace } from '@/components/canvas/SessionTimerFace';
import { loadCollabFaceRouter } from '@/lib/editor-deferred-code';
import type { ElementFaceRouterProps } from './ElementFaceRouter';

// Facilitation panels are on few boards, so their faces load on demand; their code is fetched as the editor
// mounts (lib/editor-deferred-code.ts), so a board that has one finds it already in.
const CollabFaceRouter = dynamic(loadCollabFaceRouter, { ssr: false });

// The pressable faces at the head of ElementFaceRouter's chain: a retired piece's card, then every element
// that draws its own interactive face (a mode button, a session timer or button, Bring Focus, a reveal cover,
// a picker, a collaboration panel, a comment or action panel, a reaction pad, a portal). Each one falls
// through, mid-edit, to the router's ordinary label editor. Called as a function, not rendered as a component,
// so the router's tree is what it always was; undefined when none of these is the element's face.
export type BehaviourFaceProps = Omit<ElementFaceRouterProps, 'writable'> & {
  surface: CanvasSurface;
  // A card's own fill, for the modern collab faces' accent scope.
  cardFill: string;
  // The shared settings `…`, which a collaboration panel leads its title row with.
  settingsButton: ReactNode;
};

export function behaviourFace({
  element,
  isEditing,
  readOnly,
  activeMode,
  collab,
  commentActions,
  commentSelfId,
  actionActions,
  actionSelfId,
  tabTimer,
  timerControls,
  timerState,
  sessionStartBlocked,
  sessionRunBy,
  revealedForMe,
  onEnterPortal,
  onFireReaction,
  onPressModeButton,
  onPressFocusButton,
  onPressSessionButton,
  onRollPicker,
  onSetSessionConfig,
  onOpenElementSettings,
  onToggleReveal,
  label,
  textColor,
  remoteBorderColor,
  surface,
  cardFill,
  settingsButton,
}: BehaviourFaceProps): ReactNode | undefined {
  return (
    // A retired piece (docs/specs/009-elements/retired-elements.md): its placeholder card. Mid-edit it falls
    // through to the label editor like any shape, and the new label becomes the card's title.
    element.type === 'shape' && isRetiredElement(element) && !isEditing ? (
      <RetiredElementFace element={element} label={label} />
    ) : /* Mode button (docs/specs/009-elements/mode-button.md): a pressable face instead of a plain label:
          the mode's glyph plus the author's call to action. Mid-edit it falls
          through to the normal label editor below, so the text is retyped like
          any other shape's. */
    element.type === 'shape' &&
      element.shape === 'mode-button' &&
      isButtonMode(element.mode) &&
      !isEditing ? (
      <ModeButtonFace
        mode={element.mode}
        label={label}
        activeMode={activeMode}
        textColor={textColor}
        // A mode a read-only session lacks (the Eraser, Format Painter) draws an inert face for it.
        onPress={
          onPressModeButton && (!readOnly || PARTICIPANT_CANVAS_TOOLS.includes(element.mode))
            ? () => onPressModeButton(element)
            : undefined
        }
      />
    ) : element.type === 'shape' &&
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
        runBy={sessionRunBy ?? null}
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
        onOpenSettings={onOpenElementSettings ? () => onOpenElementSettings(element.id) : undefined}
      />
    ) : element.type === 'shape' && element.shape === 'session-button' && !isEditing ? (
      /* Session button (docs/specs/012-collaboration/session-button.md): starts a vote / poll for the room. */
      <SessionButtonFace
        config={element.session}
        label={label}
        textColor={textColor}
        canStart={!!onPressSessionButton && !sessionStartBlocked}
        runBy={sessionRunBy ?? null}
        timerState={timerState}
        onPress={onPressSessionButton ? () => onPressSessionButton(element) : undefined}
        onSetConfig={
          onSetSessionConfig && element.session
            ? (next) => onSetSessionConfig(element, next)
            : undefined
        }
        onOpenSettings={onOpenElementSettings ? () => onOpenElementSettings(element.id) : undefined}
      />
    ) : element.type === 'shape' && element.shape === 'focus-button' && !isEditing ? (
      /* Bring Focus (docs/specs/012-collaboration/bring-focus.md): asks everyone else in the room to come and
           look at this, on your tab. */
      <FocusButtonFace
        label={label}
        textColor={textColor}
        onPress={onPressFocusButton ? () => onPressFocusButton(element) : undefined}
      />
    ) : element.type === 'shape' && element.shape === 'reveal' && !isEditing ? (
      /* Reveal zone (docs/specs/009-elements/reveal-zone.md): a cover, off for me / off for everyone. */
      <RevealFace
        label={label}
        textColor={textColor}
        strokeColor={
          remoteBorderColor ?? ownColours(element).stroke ?? defaultStrokeColor(element, surface)
        }
        revealedForAll={element.revealed === true}
        revealedForMe={!!revealedForMe}
        onToggleForMe={onToggleReveal ? () => onToggleReveal(element.id) : undefined}
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
      /* The collaboration panels (docs/specs/012-collaboration/estimate-card.md to docs/specs/012-collaboration/roll-call.md): an estimate card,
           a temperature check, an idea box, an agenda, or a roll call. Like
           every other face above, mid-edit it falls through to the ordinary
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
           element's comment badge opens; the pin is just an element whose
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
      />
    ) : element.type === 'shape' && element.shape === 'reaction-pad' && !isEditing ? (
      /* Reaction pad (docs/specs/009-elements/reaction-pad.md): a pressable glyph. The burst it throws is
           rendered OUTSIDE this label stack, below, so it can overflow the
           element's box: a burst confined to the pad is a burst nobody
           notices. */
      <ReactionPadFace
        label={label}
        reaction={reactionOf(element.reaction)}
        textColor={textColor}
        onFire={onFireReaction ? () => onFireReaction(element) : undefined}
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
    ) : undefined
  );
}
