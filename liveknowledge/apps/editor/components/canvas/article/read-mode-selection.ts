// Reading, the writing selects and copies like any web page (docs/specs/030-knowledgebase/editing.md "Selecting and
// copying"). Read, ProseMirror renders it `contenteditable="false"`, which the canvas's selectstart guard
// (useNoCanvasTextSelection) cancels like the rest of the board: `select-text` is that guard's opt-in. Editing, the
// writing is contenteditable and passes the guard already. `user-select: text` is in app/article-pages.css.

/** The writing's class: read, it opts into text selection over the canvas. */
export function articleFlowClass(editable: boolean): string {
  return editable ? 'article-flow' : 'article-flow select-text';
}
