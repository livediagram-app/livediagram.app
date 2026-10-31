// What this session may do in the editor (docs/specs/013-workspace/share-roles.md; blueprint "Editor state").
// Presentation only: the server is the rule, so a flag here decides what renders and what a gesture starts,
// never what is allowed. An Editor holds every flag; a Viewer none; a Participant the content ones.
//
// `isReadOnly` stays true for a Participant, so every structural gate in the editor (the mode switch, tabs, the
// full palette, connectors, frames, layers, templates) stays shut without a change; these flags open the few
// content gestures a Participant has.

import { addedByAdder, isParticipantPlaceable, type Element } from '@livedesign/design';
import type { AccessLevel } from '@livedesign/api-schema';

export type EditorCapabilities = {
  level: AccessLevel;
  // Take part in the room: comment on elements.
  takePart: boolean;
  // Add a sticky, text or image (PARTICIPANT_ADDABLE_TYPES, `addableOn`).
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
  // Photo pages (docs/specs/031-photo/photo-pages.md "Share roles"): every tool and layer change is an
  // Editor's; a Participant may look closer (the read-only Layers tab, the Eyedropper, the info line).
  photoEdit: boolean;
  photoInspect: boolean;
  // Inspect a wireframe (docs/specs/007-editor/wireframe-pages.md "Inspect"): select any element to read, copy
  // and export it. Every role's: it writes nothing.
  inspect: boolean;
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
      photoEdit: true,
      photoInspect: true,
      inspect: true,
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
      photoEdit: false,
      photoInspect: false,
      inspect: true,
    };
  }
  const own = (el: Element) => addedByAdder(el, adderKey);
  return {
    level,
    takePart: true,
    // Nothing added without a key could be proven the Participant's later, so the room refuses it (SR5).
    addContent: adderKey !== null,
    writeText: (el) => !isLocked(el),
    move: (el) => !isLocked(el) && (isParticipantPlaceable(el) || own(el)),
    resize: (el) => !isLocked(el) && (isParticipantPlaceable(el) || own(el)),
    recolour: (el) => !isLocked(el) && (el.type === 'sticky' || own(el)),
    // Its own work.
    remove: (el) => !isLocked(el) && own(el),
    planCards: true,
    sheetCells: true,
    photoEdit: false,
    photoInspect: true,
    inspect: true,
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
