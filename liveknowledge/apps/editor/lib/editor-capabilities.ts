// What this session may do in the editor (docs/specs/013-workspace/share-roles.md; blueprint "Editor state").
// Presentation only: the server is the rule, so a flag here decides what renders and what a gesture starts,
// never what is allowed. An Editor holds every flag; a Viewer none; a Participant takes part (it comments) and
// writes nothing: in a knowledgebase, writing on a page and every change to the page tree are an Editor's alone
// (docs/specs/030-knowledgebase/knowledgebases-and-pages.md "Share roles").
//
// `isReadOnly` stays true for a Participant, so every structural gate in the editor (adding, moving, resizing,
// styling, deleting, the palette, pages, themes) stays shut without a change.

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
};

export type ReplaceScope = 'any' | 'text' | false;

const never = () => false;
const always = () => true;

export function resolveEditorCapabilities(level: AccessLevel): EditorCapabilities {
  if (level === 'edit')
    return {
      level,
      takePart: true,
      writeText: always,
      writeArticle: true,
      editPages: true,
      replace: 'any',
    };
  // A Participant comments and a Viewer reads; neither writes or changes the tree.
  return {
    level,
    takePart: level === 'participate',
    writeText: never,
    writeArticle: false,
    editPages: false,
    replace: false,
  };
}
