// A knowledgebase's name before anyone names it (docs/specs/030-knowledgebase/knowledgebases-and-pages.md "A
// knowledgebase"; the code keeps the platform's word, document). Its own leaf module, apart from the template catalogue in
// templates.ts: the editor reads it on every load, and importing it from there drew the whole catalogue and
// its builders into the editor's first load.
export const UNTITLED_DOCUMENT_NAME = 'Untitled Knowledgebase';

export function isUntitledDocumentName(name: string): boolean {
  return name === UNTITLED_DOCUMENT_NAME;
}
