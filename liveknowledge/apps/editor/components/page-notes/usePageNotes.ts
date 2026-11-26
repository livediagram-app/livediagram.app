'use client';

// The page's comments and actions on its words for the Comments list and the writing's look
// (docs/specs/030-knowledgebase/page-comments.md "Comments on the writing"): derived from the page as this editor draws
// it, once a change of its elements or its writing (an idle commit, never a keystroke), and the verb a card's press
// runs: the words brought into view, then the thread or the action opened.
import { useCallback, useMemo } from 'react';
import { useEditorChrome, useEditorChromeStore } from '@/app/document/[id]/EditorContext';
import { noteMarkStyles, pageNotesOf, type PageNote } from '@/lib/page-notes/page-notes';
import { track } from '@/lib/telemetry';

// Read in a press's handler, never in render.
const reducedMotion = () =>
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;

/** The page's notes holding a comment or an action, and what opening one does. */
export function usePageNotes(): { notes: PageNote[]; open: (note: PageNote) => void } {
  const store = useEditorChromeStore();
  const elements = useEditorChrome((s) => s.activeTab.elements);
  const articles = useEditorChrome((s) => s.activeTab.articles);
  const notes = useMemo(() => pageNotesOf({ elements, articles }), [elements, articles]);
  const open = useCallback(
    (note: PageNote) => {
      track('UI', 'Used', 'OpenNoteFromComments');
      const words = document.querySelector(`.article-flow [data-note-id="${CSS.escape(note.id)}"]`);
      words?.scrollIntoView({ block: 'center', behavior: reducedMotion() ? 'auto' : 'smooth' });
      store.get().pagesMode.articles?.openNote(note.id, note.kind);
    },
    [store],
  );
  return { notes, open };
}

/** The style sheet that takes a closed note's tint off and a detached note's marker out of the margin. */
export function useNoteMarkStyles(): string {
  const elements = useEditorChrome((s) => s.activeTab.elements);
  const articles = useEditorChrome((s) => s.activeTab.articles);
  return useMemo(() => noteMarkStyles({ elements, articles }), [elements, articles]);
}
