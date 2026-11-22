// What a click on an action margin note opens (docs/specs/007-editor/article-pages.md "Comments and actions"): its
// action's popover once one is assigned; while none is, the Assign Action dialog for an Editor and nothing for a
// Viewer or a Participant, who assign nothing (docs/specs/013-workspace/share-roles.md "Nothing offers what a
// session cannot do"). Pure, so the note's text and its marker answer alike.
export function actionNoteOpens(assigned: boolean, readOnly: boolean): 'popover' | 'assign' | null {
  if (assigned) return 'popover';
  return readOnly ? null : 'assign';
}
