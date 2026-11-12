// What this session may do in the editor (docs/specs/013-workspace/share-roles.md; blueprint "Editor state").
// Presentation only: the server is the rule, so a flag here decides what renders and what a gesture starts,
// never what is allowed. An Editor holds every flag; a Viewer none but walking, always; a Participant takes part,
// uses the pieces and always walks, and changes no content (docs/specs/013-workspace/share-roles.md "A Participant
// walks", "Always walking").
//
// `isReadOnly` stays true for a Participant, so every structural gate in the editor (the mode switch, tabs, the
// palette, connectors, frames, layers, templates) stays shut without a change.

import type { Element } from '@livehuddle/document';
import { levelAtLeast, parseStoredLevel, type AccessLevel } from '@livehuddle/api-schema';

export type EditorCapabilities = {
  level: AccessLevel;
  // Session tools: dots, estimates, temperature checks, the Done check, quizzes, ideas.
  takePart: boolean;
  // Add anything: an Editor's alone.
  addContent: boolean;
  // Every content flag is an Editor's: a Participant changes no content.
  writeText: (el: Element) => boolean;
  move: (el: Element) => boolean;
  resize: (el: Element) => boolean;
  recolour: (el: Element) => boolean;
  remove: (el: Element) => boolean;
  // Open or close a Door (docs/specs/009-elements/room-builder.md "Opening and closing").
  swingDoor: (el: Element) => boolean;
  // Open a tab's Attendance, who was in it and when (docs/specs/012-collaboration/tab-attendance.md "Who sees it"):
  // an Editor's and a Participant's, never a Viewer's.
  seeAttendance: boolean;
  // Held in Avatar mode with no way out: a Participant's and a Viewer's, never an Editor's (useCanvasTool
  // `alwaysWalking`; share-roles.md "Always walking").
  alwaysWalks: boolean;
};

const never = () => false;
const always = () => true;

export function resolveEditorCapabilities(input: {
  // The effective level: a preview reads as view.
  level: AccessLevel;
  // This Participant's adder key, from its room ticket. No flag reads it any more (a Participant changes no content);
  // the session still holds it for its notes on a Notice Board.
  adderKey: string | null;
}): EditorCapabilities {
  const { level } = input;
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
      swingDoor: always,
      seeAttendance: true,
      alwaysWalks: false,
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
      swingDoor: never,
      seeAttendance: false,
      alwaysWalks: true,
    };
  }
  return {
    level,
    takePart: true,
    addContent: false,
    writeText: never,
    move: never,
    resize: never,
    recolour: never,
    remove: never,
    swingDoor: always,
    seeAttendance: true,
    alwaysWalks: true,
  };
}

/**
 * The guard a content-adding hook takes (images, the placement helpers a dragged palette
 * tile lands through): a Participant that may add content is held only by the session's own guard (`blocked`: a
 * locked layer, a tab still loading); every other read-only session stays shut (`structureBlocked`).
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

/**
 * Whether a session at `level` may nudge someone (docs/specs/012-collaboration/nudge.md "Share roles"): an Editor's
 * or a Participant's, the rule of `can.takePart` and of the room's gate. A Viewer is nudged, never nudges.
 */
export function mayNudge(level: unknown): boolean {
  return levelAtLeast(parseStoredLevel(level), 'participate');
}
