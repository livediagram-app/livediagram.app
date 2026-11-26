'use client';

// What a page's comments and actions on its words add around the writing (docs/specs/030-knowledgebase/
// page-comments.md "Comments on the writing"): the one small style sheet (a closed note's words read plain, a
// detached note's marker leaves the margin), drawn only when some note needs it, and the reading selection bar.
import { ReadingNoteBar } from './ReadingNoteBar';
import { useNoteMarkStyles } from './usePageNotes';

export function PageNotesLook() {
  const css = useNoteMarkStyles();
  return (
    <>
      {css ? <style data-note-marks="">{css}</style> : null}
      <ReadingNoteBar />
    </>
  );
}
