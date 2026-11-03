// What this session may do in the editor (docs/specs/013-workspace/share-roles.md; blueprint "Editor state").
// Presentation only: the server is the rule, so a flag here decides what renders and what a gesture starts,
// never what is allowed. An Editor holds every flag; a Viewer none; a Participant the content ones.
//
// `isReadOnly` stays true for a Participant, so every structural gate in the editor (the mode switch, tabs, the
// full palette, connectors, frames, layers, templates) stays shut without a change; these flags open the few
// content gestures a Participant has.

import {
  addedByAdder,
  isParticipantPlaceable,
  participantWritesOn,
  type Element,
} from '@livehuddle/document';
import { levelAtLeast, parseStoredLevel, type AccessLevel } from '@livehuddle/api-schema';

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
    };
  }
  const own = (el: Element) => addedByAdder(el, adderKey);
  return {
    level,
    takePart: true,
    // Nothing added without a key could be proven the Participant's later, so the room refuses it (SR5).
    addContent: adderKey !== null,
    writeText: (el) => !isLocked(el) && participantWritesOn(el),
    move: (el) => !isLocked(el) && (isParticipantPlaceable(el) || own(el)),
    resize: (el) => !isLocked(el) && (isParticipantPlaceable(el) || own(el)),
    recolour: (el) => !isLocked(el) && (el.type === 'sticky' || own(el)),
    // Its own work.
    remove: (el) => !isLocked(el) && own(el),
  };
}

/**
 * The guard a content-adding hook takes (images, the placement helpers a dragged palette
 * tile lands through): a Participant that may add content is held only by the session's own guard (`blocked`: a
 * locked tab or layer, a tab still loading); every other read-only session stays shut (`structureBlocked`).
 */
export function contentAddBlocked(input: {
  participating: boolean;
  canAddContent: boolean;
  blocked: boolean;
  structureBlocked: boolean;
}): boolean {
  return input.participating ? input.blocked || !input.canAddContent : input.structureBlocked;
}

/** The canvas's role gates (docs/specs/013-workspace/share-roles.md "Tests"), read from `can`. */
export type RoleGates = {
  // Start, end, reveal or configure a session tool; press Bring Focus. An Editor's, and only the facilitator's
  // while someone holds the baton (`runBlocked`).
  run: boolean;
  // Reshape the board: the template start, an estimate's scale. An Editor's.
  shape: boolean;
  // Answer, react, speak, comment. An Editor's or a Participant's.
  takePart: boolean;
};

/**
 * The canvas's role gates from the session's `can`, never from `isReadOnly` alone: avatar mode makes the canvas
 * read-only for everyone in it, so only the level tells a walking Editor from a Viewer.
 */
export function roleGates(
  can: Pick<EditorCapabilities, 'level' | 'takePart'>,
  runBlocked: boolean,
): RoleGates {
  const shape = can.level === 'edit';
  return { run: shape && !runBlocked, shape, takePart: can.takePart };
}

/**
 * Whether a session at `level` may hold the facilitator baton: an Editor's alone, as the room's `canHold` decides
 * (apps/api/src/facilitator.ts). Compared through the ladder, an unknown level reading as a Viewer's.
 */
export function mayHoldBaton(level: unknown): boolean {
  return levelAtLeast(parseStoredLevel(level), 'edit');
}
