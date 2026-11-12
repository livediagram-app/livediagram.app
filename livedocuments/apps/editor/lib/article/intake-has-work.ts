// Whether a local edit leaves the article intake anything to settle (docs/specs/007-editor/blueprints/article-pages.md
// "Zones", step 6). The intake's settle runs in a `tickTabs` updater, and any tick renders the editor again; a typing
// commit on writing with no zones (every flashcard, most articles) has nothing to settle, so asking first spares
// that render on every commit. Linear in the tab's elements and writing; no page is laid out.
import {
  articleNoteIds,
  articlesOf,
  hasZoneBlock,
  type ArticleFlow,
  type Element,
} from '@livedocuments/document';

type Side = { elements: readonly Element[]; articles?: unknown };

export function intakeHasWork({
  was,
  now,
  held,
  pending,
}: {
  // The tab as the last settle saw it, and as it is now.
  was: Side;
  now: Side;
  // Articles held by a locked page: nothing of theirs is fitted.
  held: ReadonlySet<string>;
  // Work the intake already found: objects dragged out, zones gone from the writing, elements taken in.
  pending: number;
}): boolean {
  if (pending > 0) return true;
  // A margin note's marker deleted: its text loses the note's tint.
  if (was.elements !== now.elements) {
    const kept = new Set(now.elements.map((e) => e.id));
    if (was.elements.some((e) => e.type === 'article-note' && !kept.has(e.id))) return true;
  }
  const docsNow: Readonly<Record<string, ArticleFlow>> = articlesOf(now);
  // Text with a margin note deleted: the note's marker goes with it.
  if (was.articles !== now.articles) {
    const notesNow = articleNoteIds(docsNow);
    for (const id of articleNoteIds(articlesOf(was))) if (!notesNow.has(id)) return true;
  }
  // A zone to fit to its elements, in writing a locked page does not hold.
  for (const [flow, doc] of Object.entries(docsNow))
    if (!held.has(flow) && hasZoneBlock(doc)) return true;
  return false;
}
