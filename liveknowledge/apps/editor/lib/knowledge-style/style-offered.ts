// Who may change the Knowledgebase Style (docs/specs/030-knowledgebase/page-surface.md "Share roles"): an Editor of
// the whole knowledgebase. Never a Participant, a Viewer, a link confined to one page, an embed, a workbench pane or
// a Community visitor. A knowledgebase kept Offline is its one person's to style. Pure, so the editor's slice, the
// menu row and the dialog's host all ask the same question.
export type StyleOfferedInput = {
  can: { editPages: boolean };
  isStructureReadOnly: boolean;
  hydrated: boolean;
  embedMode: boolean;
  workbench: unknown;
  sessionCommunity: unknown;
  documentId: string | null;
};

export function styleOfferedOf(s: StyleOfferedInput): boolean {
  const editor = s.can.editPages && !s.isStructureReadOnly;
  const plain = s.hydrated && !s.embedMode && !s.workbench && !s.sessionCommunity;
  return !!s.documentId && editor && plain;
}
