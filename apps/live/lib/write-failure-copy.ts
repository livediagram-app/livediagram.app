// What a failed folder or document write says (docs/specs/013-workspace/folders.md "A write that fails says so"):
// one wording per verb, shared by the Explorer page, the editor's Explorer panel and a team's library, so the same
// failure reads the same wherever it happened.

export const FOLDER_FAILURE = {
  create: 'Could not create the folder. Please try again.',
  rename: 'Could not rename the folder. Please try again.',
  move: 'Could not move the folder. Please try again.',
  delete: 'Could not delete the folder. Try again.',
} as const;

export const DOCUMENT_FAILURE = {
  rename: 'Could not rename the document. Please try again.',
  move: 'Could not move the document. Please try again.',
  delete: 'Could not delete the document. Please try again.',
  duplicate: "Couldn't duplicate that document. Try again.",
} as const;
