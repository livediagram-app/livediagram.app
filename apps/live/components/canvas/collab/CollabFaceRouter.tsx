// Routes a collaboration element (spec/123 to spec/129) to its face, and holds
// the one prop the canvas threads for all five.
//
// One router and one prop rather than five branches and six callbacks on
// BoxedElementView: the faces share a viewer context (who am I, who else is
// here, may I write) that would otherwise be passed five times.

import { isCollabPanelShape, type ShapeElement, type TabTimer } from '@livediagram/diagram';
import type { Participant } from '@/lib/identity';
import { EstimateFace } from './EstimateFace';
import { TemperatureFace } from './TemperatureFace';
import { IdeaBoxFace } from './IdeaBoxFace';
import { AgendaFace } from './AgendaFace';
import { RollCallFace } from './RollCallFace';
import { DecisionFace } from './DecisionFace';

// What a collaboration face needs from the editor. Absent entirely on a
// surface with no session behind it (the read-only embed, the export
// renderer), which renders every face inert but still readable — a shared
// estimate card in a PNG should still show what the room said.
export type CollabApi = {
  // Whose answer is "mine".
  selfId: string;
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
  scatterIdeas?: (element: ShapeElement) => void;
  pressAgendaItem?: (element: ShapeElement, index: number) => void;
  takeRoll?: (element: ShapeElement) => void;
};

export function CollabFaceRouter({
  element,
  label,
  textColor,
  collab,
}: {
  element: ShapeElement;
  label: string;
  textColor: string;
  collab: CollabApi | undefined;
}) {
  if (!isCollabPanelShape(element.shape)) return null;
  // No session behind this surface: still render, still readable, inert.
  const api = collab;

  if (element.shape === 'estimate') {
    return (
      <EstimateFace
        element={element}
        label={label}
        textColor={textColor}
        selfId={api?.selfId ?? ''}
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
        selfId={api?.selfId ?? ''}
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
        onAddIdea={api?.addIdea ? (text) => api.addIdea!(element, text) : undefined}
        onReveal={api?.revealIdeas ? () => api.revealIdeas!(element) : undefined}
        onScatter={api?.scatterIdeas ? () => api.scatterIdeas!(element) : undefined}
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
      onTakeRoll={api?.takeRoll ? () => api.takeRoll!(element) : undefined}
    />
  );
}
