import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import { EditorView } from 'prosemirror-view';
import type { ArticleNotePlace } from '@livedocuments/document';
import { noteArticleLaidOut } from '@/lib/article/article-editor-store';
import { columnAt, flowFrame, pagePlaceOf } from '@/lib/article/article-flow-geometry';
import { publishCardOverflow } from '@/lib/flashcard-overflow-store';
import type { ArticleDrawOp } from '@/lib/article/article-snapshot';
import { writingScale } from './article-editor-handle';
import { measureRepeats } from '@/lib/article/article-table-repeat';
import { measureTocPages } from '@/lib/article/article-toc-view';
import { clearPendingNote, footnoteKey } from '@/lib/article/article-footnotes';
import { FootnoteNotes } from '@/lib/article/article-footnote-notes';
import { layoutFootnotes } from '@/lib/article/article-footnote-layout';
import { measureSplitRows } from '@/lib/article/article-footnote-split-look';
import type { ArticleEditorProps, FlowLayout } from './article-editor-types';

// How many times one change may re-measure for repeated header rows settling (each copy drawn can move
// the rows after it); a guard, two is the most a real layout needs.
const REPEAT_SETTLE_TRIES = 4;
// How long after a local change this person still counts as the writer of its consequences.
const WRITER_WINDOW_MS = 3000;

// What a layout pass reads and writes (ArticleEditor's refs and setters).
export type MeasureContext = {
  barsCache: MutableRefObject<{ ink: string; ops: ArticleDrawOp[] } | null>;
  measureFrame: MutableRefObject<number | null>;
  viewRef: MutableRefObject<EditorView | null>;
  latest: MutableRefObject<ArticleEditorProps>;
  repeatTries: MutableRefObject<number>;
  footLimits: MutableRefObject<ReadonlyMap<number, number>>;
  notesRef: MutableRefObject<FootnoteNotes | null>;
  footTries: MutableRefObject<number>;
  lastLocal: MutableRefObject<number>;
  announced: MutableRefObject<boolean>;
  scheduleMeasure: () => void;
  setCutOff: Dispatch<SetStateAction<boolean>>;
};

// One layout pass of the writing (ArticleEditor's measure, run in a frame after a change): the repeated
// header rows and the footnotes settle first, then where the writing reaches, where each zone and margin
// note landed, and whether it runs past the last page, reported to the host.
export function measureArticleLayout({
  barsCache,
  measureFrame,
  viewRef,
  latest,
  repeatTries,
  footLimits,
  notesRef,
  footTries,
  lastLocal,
  announced,
  scheduleMeasure,
  setCutOff,
}: MeasureContext): void {
  // A new layout: the bars measured from the last one are out of date.
  barsCache.current = null;
  measureFrame.current = null;
  const view = viewRef.current;
  const p = latest.current;
  if (!view || p.pages.length === 0) return;
  const { frame, root, z } = writingScale(view, p);
  // Repeated header rows first: a copy drawn moves the rows after it, so the rest is measured once
  // they have settled (a frame later).
  const foot = {
    colOf: (x: number) => columnAt(frame, (x - root.left) / z),
    limit: (col: number) => footLimits.current.get(col),
  };
  if (measureRepeats(view, root.top, z, foot) && repeatTries.current < REPEAT_SETTLE_TRIES) {
    repeatTries.current++;
    scheduleMeasure();
    return;
  }
  repeatTries.current = 0;
  // Then the footnotes: each page's notes at its foot and its text ended above them, measured again once the
  // breaks have moved (the header rows repeat above the notes).
  const footNotes = notesRef.current;
  if (footNotes && !p.card) {
    const laid = layoutFootnotes(view, { frame, root, z, pages: p.pages, notes: footNotes });
    footLimits.current = laid.limits;
    if (laid.changed && footTries.current < REPEAT_SETTLE_TRIES) {
      footTries.current++;
      scheduleMeasure();
      return;
    }
    footTries.current = 0;
    // A table row split above a page's notes, drawn ending there.
    measureSplitRows(view, laid.splits, { frame, root, z });
    // A footnote just put in: its note takes the caret.
    const fs = footnoteKey.getState(view.state);
    if (fs && fs.pending !== null) {
      const n = fs.refs.indexOf(fs.pending) + 1;
      clearPendingNote(view);
      if (n > 0) footNotes.focus(n);
    }
  }
  // The contents' page numbers, from where each heading landed.
  measureTocPages(view, (x) => Math.min(p.pages.length - 1, columnAt(frame, (x - root.left) / z)));
  let right = 0;
  for (const child of Array.from(view.dom.children)) {
    for (const r of Array.from(child.getClientRects())) {
      if (r.width === 0 && r.height === 0) continue;
      right = Math.max(right, (r.left - root.left) / z + 1);
    }
  }
  const reached = columnAt(frame, Math.max(0, right - 2)) + 1;
  // A card never grows: what runs past its foot waits unseen, and the first block that does not
  // fit whole is where a split would start (docs/specs/007-editor/flashcards.md "Never flows").
  const pagesNeeded = p.card ? 1 : reached;
  if (p.card)
    publishCardOverflow(p.flow, reached > 1 ? firstBlockPastFoot(view, frame, root, z) : null);
  // At the tab's page limit the writing past the last page waits unseen: say so on that page.
  const cut = (p.atPageLimit === true || p.card === true) && reached > p.pages.length;
  setCutOff((was) => (was === cut ? was : cut));
  const zones: FlowLayout['zones'] = [];
  view.dom.querySelectorAll<HTMLElement>('.article-zone').forEach((el) => {
    const r = el.getBoundingClientRect();
    const place = pagePlaceOf(frame, { x: (r.left - root.left) / z, y: (r.top - root.top) / z });
    zones.push({
      id: el.dataset.blockId ?? '',
      index: place.index,
      x: Math.round(place.x * 2) / 2,
      y: Math.round(place.y * 2) / 2,
      width: r.width / z,
      height: r.height / z,
    });
  });
  const notes: ArticleNotePlace[] = [];
  const seen = new Set<string>();
  view.dom.querySelectorAll<HTMLElement>('[data-note-id]').forEach((el) => {
    const id = el.dataset.noteId ?? '';
    const r = el.getClientRects()[0];
    if (!id || seen.has(id) || !r) return;
    seen.add(id);
    const place = pagePlaceOf(frame, { x: (r.left - root.left) / z, y: (r.top - root.top) / z });
    notes.push({ id, index: place.index, y: place.y, height: r.height / z });
  });
  // Only the writer of a change settles its consequences (docs/specs/007-editor/article-pages.md
  // "Collaboration"): a change made here (typing, or a claimLayout from a zone, style or page
  // edit) within the window. Focus alone is not writing: two people with the caret in the same
  // article would both add a page for one of them's overflow.
  const local = Date.now() - lastLocal.current < WRITER_WINDOW_MS;
  p.onLayout({ flow: p.flow, pagesNeeded, zones, notes, local });
  // The first layout (and the one after web fonts land) is news to the Map and the thumbnails.
  if (!announced.current) {
    announced.current = true;
    noteArticleLaidOut();
  }
}

// The id of the first top-level block that does not fit whole on the first page (a box of it in a
// later column), or null.
function firstBlockPastFoot(
  view: EditorView,
  frame: ReturnType<typeof flowFrame>,
  root: DOMRect,
  z: number,
): string | null {
  for (const child of Array.from(view.dom.children)) {
    const id = (child as HTMLElement).dataset.blockId;
    if (!id) continue;
    for (const r of Array.from(child.getClientRects())) {
      if (r.width === 0 && r.height === 0) continue;
      if (columnAt(frame, Math.max(0, (r.right - root.left) / z - 2)) >= 1) return id;
    }
  }
  return null;
}
