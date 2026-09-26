// Routes a collaboration element (spec/123 to spec/129) to its face, and holds
// the one prop the canvas threads for all five.
//
// One router and one prop rather than five branches and six callbacks on
// BoxedElementView: the faces share a viewer context (who am I, who else is
// here, may I write) that would otherwise be passed five times.

import {
  DONE_VALUE,
  defaultFillColor,
  isCollabPanelShape,
  type ShapeElement,
  type TabTimer,
} from '@livediagram/diagram';
import type { Participant } from '@/lib/identity';
import { useCanvasSurface } from '@/components/canvas/CanvasSurfaceContext';
import { EstimateFace } from './EstimateFace';
import { TemperatureFace } from './TemperatureFace';
import { IdeaBoxFace } from './IdeaBoxFace';
import { AgendaFace } from './AgendaFace';
import { RollCallFace } from './RollCallFace';
import { DecisionFace } from './DecisionFace';
import { DoneCheckFace } from './DoneCheckFace';
import { QaBoardFace } from './qa/QaBoardFace';

// What a collaboration face needs from the editor. Absent entirely on a
// surface with no session behind it (the read-only embed, the export
// renderer), which renders every face inert but still readable — a shared
// estimate card in a PNG should still show what the room said.
export type CollabApi = {
  // Whose answer is "mine" — our `participantKey`, the id these faces are
  // recorded under in the document (spec/122), not our owner id. See the
  // note on Participant.key: the owner id is unpublishable and the room's
  // presence id is per-socket, so neither can join a saved answer to a face.
  selfKey: string;
  // The room, for the estimate card's avatars. Includes ourselves.
  participants: Participant[];
  // The tab's timer, so an agenda can show the live remaining time on the
  // segment the room is in. Undefined when no timer is running.
  tabTimer?: TabTimer;
  // Absent when this viewer may not write (view role, locked tab): the faces
  // render their controls disabled rather than lying about what a press does.
  respond?: (element: ShapeElement, value: string) => void;
  setResponsesRevealed?: (element: ShapeElement, revealed: boolean) => void;
  clearResponses?: (element: ShapeElement) => void;
  addIdea?: (element: ShapeElement, text: string) => void;
  revealIdeas?: (element: ShapeElement) => void;
  clearIdeas?: (element: ShapeElement) => void;
  scatterIdeas?: (element: ShapeElement) => void;
  pressAgendaItem?: (element: ShapeElement, index: number) => void;
  takeRoll?: (element: ShapeElement) => void;
  // The Q&A board (spec/151). Our OWNER id, only so the board can compute our
  // voter id the way the server does (qaVoterId) and know which notes we
  // voted for; the face never renders or sends it. And our name, for the
  // composer's "As …" toggle.
  selfOwnerId?: string;
  selfName?: string;
  // Present for anyone in a live session, view links included: the server
  // owns the board and gates these on read access.
  addQaNote?: (element: ShapeElement, text: string, anonymous: boolean) => void;
  voteQaNote?: (element: ShapeElement, noteId: string, on: boolean) => void;
  // Whoever is running the board (spec/149): absent for everyone else.
  discussQaNote?: (element: ShapeElement, noteId: string | null) => void;
  closeQaNote?: (element: ShapeElement, noteId: string) => void;
  reopenQaNote?: (element: ShapeElement, noteId: string) => void;
  removeQaNote?: (element: ShapeElement, noteId: string) => void;
  clearQaBoard?: (element: ShapeElement) => void;
};

export function CollabFaceRouter({
  element,
  label,
  textColor,
  collab,
  onOpenSettings,
}: {
  element: ShapeElement;
  label: string;
  textColor: string;
  collab: CollabApi | undefined;
  // The Done check and the Idea box draw their own `…` (their round
  // controls), so the shared settings button is suppressed for them and this
  // is how their menus still reach the element's full settings (spec/09).
  // Every other card here takes the shared button and never sees this.
  onOpenSettings?: () => void;
}) {
  // Which paper the canvas is, for a card that carries no fill of its own.
  // Called `paper` here because `surface` is already this file's word for the
  // card's own colour, four lines below.
  const paper = useCanvasSurface();
  if (!isCollabPanelShape(element.shape)) return null;
  // No session behind this surface: still render, still readable, inert.
  const api = collab;
  // The colour showing THROUGH a card's holes and tears (spec/122's paper
  // kit): its own fill, so a punch reads as an opening rather than a dot.
  const surface = element.fillColor ?? defaultFillColor(element, paper);

  if (element.shape === 'done-check') {
    return (
      <DoneCheckFace
        element={element}
        label={label}
        textColor={textColor}
        selfKey={api?.selfKey ?? ''}
        participants={api?.participants ?? []}
        // `respond` already withdraws when you send the value you already
        // sent (spec/122), so marking and unmarking are the same call.
        onToggleMine={api?.respond ? () => api.respond!(element, DONE_VALUE) : undefined}
        onResetAll={api?.clearResponses ? () => api.clearResponses!(element) : undefined}
        onOpenSettings={onOpenSettings}
      />
    );
  }
  if (element.shape === 'estimate') {
    return (
      <EstimateFace
        element={element}
        label={label}
        textColor={textColor}
        selfKey={api?.selfKey ?? ''}
        participants={api?.participants ?? []}
        onRespond={api?.respond ? (value) => api.respond!(element, value) : undefined}
        onSetRevealed={
          api?.setResponsesRevealed
            ? (revealed) => api.setResponsesRevealed!(element, revealed)
            : undefined
        }
        onClear={api?.clearResponses ? () => api.clearResponses!(element) : undefined}
      />
    );
  }
  if (element.shape === 'temperature') {
    return (
      <TemperatureFace
        element={element}
        label={label}
        textColor={textColor}
        selfKey={api?.selfKey ?? ''}
        onRespond={api?.respond ? (value) => api.respond!(element, value) : undefined}
      />
    );
  }
  if (element.shape === 'idea-box') {
    return (
      <IdeaBoxFace
        element={element}
        label={label}
        textColor={textColor}
        surface={surface}
        onAddIdea={api?.addIdea ? (text) => api.addIdea!(element, text) : undefined}
        onReveal={api?.revealIdeas ? () => api.revealIdeas!(element) : undefined}
        onClear={api?.clearIdeas ? () => api.clearIdeas!(element) : undefined}
        onScatter={api?.scatterIdeas ? () => api.scatterIdeas!(element) : undefined}
        onOpenSettings={onOpenSettings}
      />
    );
  }
  if (element.shape === 'qa-board') {
    // Bind each verb to this element once, so the face deals in note ids.
    const bind = <A extends unknown[]>(fn?: (el: ShapeElement, ...args: A) => void) =>
      fn ? (...args: A) => fn(element, ...args) : undefined;
    return (
      <QaBoardFace
        element={element}
        label={label}
        textColor={textColor}
        surface={surface}
        selfOwnerId={api?.selfOwnerId ?? ''}
        selfName={api?.selfName ?? ''}
        actions={{
          add: bind(api?.addQaNote),
          vote: bind(api?.voteQaNote),
          discuss: bind(api?.discussQaNote),
          close: bind(api?.closeQaNote),
          reopen: bind(api?.reopenQaNote),
          remove: bind(api?.removeQaNote),
          clear: bind(api?.clearQaBoard),
        }}
        onOpenSettings={onOpenSettings}
      />
    );
  }
  if (element.shape === 'decision') {
    // Nothing to press: a decision is set from its menu. It routes here anyway
    // because it draws its own card (see DecisionFace).
    return <DecisionFace element={element} label={label} textColor={textColor} />;
  }
  if (element.shape === 'agenda') {
    return (
      <AgendaFace
        element={element}
        label={label}
        textColor={textColor}
        timer={api?.tabTimer}
        onPressItem={
          api?.pressAgendaItem ? (index) => api.pressAgendaItem!(element, index) : undefined
        }
      />
    );
  }
  return (
    <RollCallFace
      element={element}
      label={label}
      textColor={textColor}
      surface={surface}
      onTakeRoll={api?.takeRoll ? () => api.takeRoll!(element) : undefined}
    />
  );
}
