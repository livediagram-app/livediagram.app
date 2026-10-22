// Routes a collaboration element (docs/specs/012-collaboration/temperature-check.md, decision-record.md) to its
// face, and holds the one prop the canvas threads for them.
//
// One router and one prop rather than a branch and callbacks each on BoxedElementView: the faces share a viewer
// context (who am I, may I write) that would otherwise be passed once a face.

import { isCollabPanelShape, type ShapeElement } from '@liveplanner/project';
import { TemperatureFace } from './TemperatureFace';
import { DecisionFace } from './DecisionFace';

// What a collaboration face needs from the editor. Absent entirely on a
// surface with no session behind it (the read-only embed, the export
// renderer), which renders every face inert but still readable — a shared
// temperature check in a PNG should still show what the room said.
export type CollabApi = {
  // Whose answer is "mine" — our `participantKey`, the id these faces are
  // recorded under in the project (docs/specs/012-collaboration/participant-responses.md), not our owner id. See the
  // note on Participant.key: the owner id is unpublishable and the room's
  // presence id is per-socket, so neither can join a saved answer to a face.
  selfKey: string;
  // Absent when this viewer may not write (view role, locked tab): the faces
  // render their controls disabled rather than lying about what a press does.
  respond?: (element: ShapeElement, value: string) => void;
  clearResponses?: (element: ShapeElement) => void;
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
  // The Temperature check draws its own `…` (its round controls), so the shared settings button is suppressed
  // for it and this is how its menu still reaches the element's full settings
  // (docs/specs/008-canvas/canvas-and-palette.md). Every other card here takes the shared button and never sees this.
  onOpenSettings?: () => void;
}) {
  if (!isCollabPanelShape(element.shape)) return null;
  // No session behind this surface: still render, still readable, inert.
  const api = collab;
  if (element.shape === 'temperature') {
    return (
      <TemperatureFace
        element={element}
        label={label}
        textColor={textColor}
        selfKey={api?.selfKey ?? ''}
        onRespond={api?.respond ? (value) => api.respond!(element, value) : undefined}
        onClear={api?.clearResponses ? () => api.clearResponses!(element) : undefined}
        onOpenSettings={onOpenSettings}
      />
    );
  }
  // Nothing to press: a decision is set from its menu. It routes here anyway
  // because it draws its own card (see DecisionFace).
  return <DecisionFace element={element} label={label} textColor={textColor} />;
}
