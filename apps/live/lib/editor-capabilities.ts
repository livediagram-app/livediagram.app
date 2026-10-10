// What this session may do in the editor (docs/specs/013-workspace/share-roles.md; blueprint "Editor state").
// Presentation only: the server is the rule, so a flag here decides what renders and what a gesture starts,
// never what is allowed. An Editor holds every flag; a Viewer none; a Participant the content ones.
//
// `isReadOnly` stays true for a Participant, so every structural gate in the editor (the mode switch, tabs, the
// full palette, connectors, frames, layers, templates) stays shut without a change; these flags open the few
// content gestures a Participant has.

import {
  addedByAdder,
  isMindNode,
  isParticipantPlaceable,
  participantWritesOn,
  type Element,
} from '@livediagram/document';
import type { AccessLevel } from '@livediagram/api-schema';

export type EditorCapabilities = {
  level: AccessLevel;
  // Session tools: dots, estimates, temperature checks, the Done check, quizzes, ideas.
  takePart: boolean;
  // Add a sticky, text or image, or grow a mind map (PARTICIPANT_ADDABLE_TYPES, `addableOn`).
  addContent: boolean;
  // Every content flag is an Editor's beyond this point; for a Participant it follows the participant rule.
  writeText: (el: Element) => boolean;
  move: (el: Element) => boolean;
  resize: (el: Element) => boolean;
  recolour: (el: Element) => boolean;
  remove: (el: Element) => boolean;
  // Plan cards (add, edit, move) and Sheet cells.
  planCards: boolean;
  sheetCells: boolean;
};

const never = () => false;
const always = () => true;

const isLocked = (el: Element) => (el as { locked?: boolean }).locked === true;

export function resolveEditorCapabilities(input: {
  // The effective level: a preview reads as view.
  level: AccessLevel;
  // This Participant's adder key, from its room ticket; null until one is held.
  adderKey: string | null;
}): EditorCapabilities {
  const { level, adderKey } = input;
  if (level === 'edit') {
    return {
      level,
      takePart: true,
      addContent: true,
      writeText: always,
      move: always,
      resize: always,
      recolour: always,
      remove: always,
      planCards: true,
      sheetCells: true,
    };
  }
  if (level === 'view') {
    return {
      level,
      takePart: false,
      addContent: false,
      writeText: never,
      move: never,
      resize: never,
      recolour: never,
      remove: never,
      planCards: false,
      sheetCells: false,
    };
  }
  const own = (el: Element) => addedByAdder(el, adderKey);
  return {
    level,
    takePart: true,
    // Nothing added without a key could be proven the Participant's later, so the room refuses it (SR5).
    addContent: adderKey !== null,
    writeText: (el) => !isLocked(el) && participantWritesOn(el),
    move: (el) => !isLocked(el) && (isParticipantPlaceable(el) || isMindNode(el) || own(el)),
    resize: (el) => !isLocked(el) && (isParticipantPlaceable(el) || own(el)),
    recolour: (el) => !isLocked(el) && (el.type === 'sticky' || own(el)),
    // Its own work, and any mind node (its connector goes with it; the room checks that part).
    remove: (el) => !isLocked(el) && (own(el) || isMindNode(el)),
    planCards: true,
    sheetCells: true,
  };
}
