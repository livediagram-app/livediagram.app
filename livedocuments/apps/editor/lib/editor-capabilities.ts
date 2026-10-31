// What this session may do in the editor (docs/specs/013-workspace/share-roles.md; blueprint "Editor state").
// Presentation only: the server is the rule, so a flag here decides what renders and what a gesture starts,
// never what is allowed. An Editor holds every flag; a Viewer none; a Participant the text ones.
//
// `isReadOnly` stays true for a Participant, so every structural gate in the editor (adding, moving, resizing,
// styling, deleting, the palette, tabs, pages, themes) stays shut without a change; these flags open the few text
// gestures a Participant has.

import type { Element } from '@livedocuments/document';
import type { AccessLevel } from '@livedocuments/api-schema';

export type EditorCapabilities = {
  level: AccessLevel;
  // Take part in the room: comment on elements.
  takePart: boolean;
  // Write the words on an element: its label, a text box, a sticky, a table's cells (PARTICIPANT_TEXT_FIELDS).
  writeText: (el: Element) => boolean;
  // Write in an article on the tab (participant-article.ts): its text, never its style, zones or pages.
  writeArticle: boolean;
  // Replace found text (docs/specs/007-editor/find-and-replace.md "Share roles"): anywhere ('any', an Editor), only in
  // the text it may write ('text', a Participant: its article writing and PARTICIPANT_TEXT_FIELDS), or not at all.
  replace: ReplaceScope;
};

export type ReplaceScope = 'any' | 'text' | false;

const never = () => false;
const always = () => true;

const isLocked = (el: Element) => (el as { locked?: boolean }).locked === true;

export function resolveEditorCapabilities(level: AccessLevel): EditorCapabilities {
  if (level === 'edit')
    return { level, takePart: true, writeText: always, writeArticle: true, replace: 'any' };
  if (level === 'view')
    return { level, takePart: false, writeText: never, writeArticle: false, replace: false };
  return {
    level,
    takePart: true,
    writeText: (el) => !isLocked(el),
    writeArticle: true,
    replace: 'text',
  };
}
