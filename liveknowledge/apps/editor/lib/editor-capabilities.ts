// What this session may do in the editor (docs/specs/013-workspace/share-roles.md; blueprint "Editor state").
// Presentation only: the server is the rule, so a flag here decides what renders and what a gesture starts,
// never what is allowed. An Editor holds every flag; a Viewer none. In liveknowledge a Participant is an Editor minus
// three things (docs/specs/030-knowledgebase/knowledgebases-and-pages.md "Share roles"): the Knowledgebase Settings
// (the Review Period with it), the Knowledgebase Style and automations, which `manageKnowledgebase` gates with the
// knowledgebase's other Editor-only doors (AI Settings, agents' scopes, renaming and deleting the knowledgebase).
// Everything else a Participant writes as an Editor does, so `isReadOnly` is false for it.

import type { Element } from '@liveknowledge/document';
import type { AccessLevel } from '@liveknowledge/api-schema';

export type EditorCapabilities = {
  level: AccessLevel;
  // Take part in the room: comment on elements.
  takePart: boolean;
  // Write the words on an element: its label, a text box, a sticky, a table's cells. An Editor's.
  writeText: (el: Element) => boolean;
  // Write on a page: its article's text, style, zones. An Editor's.
  writeArticle: boolean;
  // Change the page tree: add, rename, move, indent, outdent, duplicate or delete a page. An Editor's.
  editPages: boolean;
  // Replace found text (docs/specs/007-editor/find-and-replace.md "Share roles"): anywhere ('any', an Editor) or not
  // at all. 'text' (only the text a role may write) is kept for the type; no role holds it here.
  replace: ReplaceScope;
  // The knowledgebase's own Editor-only doors: Knowledgebase Settings, Knowledgebase Style, automations, AI Settings,
  // agents' scopes, renaming and deleting the knowledgebase. An Editor's alone; never a Participant's.
  manageKnowledgebase: boolean;
};

export type ReplaceScope = 'any' | 'text' | false;

const never = () => false;
const always = () => true;

export function resolveEditorCapabilities(level: AccessLevel): EditorCapabilities {
  // An Editor and a Participant write the knowledgebase alike; only the Editor manages it.
  if (level === 'edit' || level === 'participate')
    return {
      level,
      takePart: true,
      writeText: always,
      writeArticle: true,
      editPages: true,
      replace: 'any',
      manageKnowledgebase: level === 'edit',
    };
  // A Viewer reads.
  return {
    level,
    takePart: false,
    writeText: never,
    writeArticle: false,
    editPages: false,
    replace: false,
    manageKnowledgebase: false,
  };
}

/** Whether a level writes the knowledgebase (its pages, its tree, its knowledge): an Editor or a Participant. */
export function writesKnowledgebase(level: AccessLevel): boolean {
  return level === 'edit' || level === 'participate';
}
