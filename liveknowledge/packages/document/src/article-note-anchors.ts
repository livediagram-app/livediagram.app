// A margin note's anchor (docs/specs/030-knowledgebase/page-comments.md "Comments on the writing", Work Tracker 1484):
// the words a comment or an action is on carry its `note` mark, so the anchor moves with the text through any edit.
// When every word it was on is deleted, a note that holds a conversation (a comment or an action) is kept, detached,
// rather than lost; one holding nothing yet goes with its words, as before. Pure.
import { articlesOf, normaliseRuns, type ArticleRun } from '@liveworkspace/article/article-flow';
import { articleNoteIds } from './article-notes';
import { elementActions } from './element-action';
import type { CommentThread } from './comments';
import type { Element } from './index';

/** The most of a note's words an anchor quotes (the MCP's `anchor.text`, the Comments list). */
export const NOTE_ANCHOR_MAX = 280;

type Articles = Readonly<Record<string, { blocks: readonly unknown[] }>>;
type Run = { text?: string; note?: string; nk?: string };
type NotesTab = { elements: readonly Element[]; articles?: unknown };

/** Whether a margin note holds anything a person would miss: a comment, or an action. */
export function noteHoldsConversation(el: object): boolean {
  const thread = (el as { commentThread?: CommentThread }).commentThread;
  return (thread?.comments.length ?? 0) > 0 || elementActions(el).length > 0;
}

/** The tab without the markers of notes whose words are gone (`ids`), but for those holding a conversation, which
 *  stay detached. The same tab when none goes. */
export function withEmptyNoteMarkersRemoved<T extends NotesTab>(
  tab: T,
  ids: ReadonlySet<string>,
): T {
  if (ids.size === 0) return tab;
  const elements = tab.elements.filter(
    (el) => !(el.type === 'article-note' && ids.has(el.id) && !noteHoldsConversation(el)),
  );
  return elements.length === tab.elements.length ? tab : { ...tab, elements };
}

/** The margin notes whose words no writing of the tab carries: detached. Empty when every note is anchored. */
export function detachedNoteIds(tab: NotesTab): Set<string> {
  const out = new Set<string>();
  let anchored: Set<string> | null = null;
  for (const el of tab.elements) {
    if (el.type !== 'article-note') continue;
    anchored ??= articleNoteIds(articlesOf(tab));
    if (!anchored.has(el.id)) out.add(el.id);
  }
  return out;
}

/** Every note's words in the writing, in the writing's order, each cut to NOTE_ANCHOR_MAX. One pass. */
export function noteAnchorTexts(articles: Articles): Map<string, string> {
  const out = new Map<string, string>();
  for (const doc of Object.values(articles))
    for (const b of doc.blocks as { runs?: Run[] }[])
      for (const r of b.runs ?? []) {
        if (!r.note || !r.text) continue;
        const was = out.get(r.note) ?? '';
        if (was.length >= NOTE_ANCHOR_MAX) continue;
        out.set(r.note, (was + r.text).slice(0, NOTE_ANCHOR_MAX));
      }
  return out;
}

/** The writing without its notes' marks: what a reader reads, for telling an edit from a comment. With `only`, just
 *  that note's marks go. The same object when no mark goes. */
export function articlesWithoutNoteMarks(articles: Articles, only?: string): Articles {
  const marked = (r: Run) =>
    only === undefined ? r.note !== undefined || r.nk !== undefined : r.note === only;
  let changed = false;
  const out: Record<string, unknown> = {};
  for (const [flow, doc] of Object.entries(articles)) {
    let flowChanged = false;
    const blocks = (doc.blocks as { runs?: Run[] }[]).map((b) => {
      if (!b.runs?.some(marked)) return b;
      flowChanged = true;
      // Joined again where the mark had split a run, so the words read as they did before it.
      return {
        ...b,
        runs: normaliseRuns(
          b.runs.map((r) => {
            if (!marked(r)) return r;
            const { note: _n, nk: _k, ...rest } = r;
            void _n;
            void _k;
            return rest;
          }) as ArticleRun[],
        ),
      };
    });
    if (flowChanged) changed = true;
    out[flow] = flowChanged ? { ...doc, blocks } : doc;
  }
  return changed ? (out as Articles) : articles;
}

/**
 * The tab without a note left with nothing in it (page-comments.md "Comments on the writing"): Comment or Add Action
 * pressed, then the thread closed with nothing posted or the Assign dialog cancelled. Its mark and its marker go
 * together, so no tint stays that nobody can take off. The same tab when the note holds a conversation or is gone.
 */
export function withAbandonedNoteDropped<T extends NotesTab>(tab: T, id: string): T {
  const el = tab.elements.find((e) => e.id === id && e.type === 'article-note');
  if (!el || noteHoldsConversation(el)) return tab;
  const elements = tab.elements.filter((e) => e !== el);
  const articles = 'articles' in tab ? (tab.articles as Articles | undefined) : undefined;
  const stripped = articles ? articlesWithoutNoteMarks(articles, id) : articles;
  return stripped === articles ? { ...tab, elements } : { ...tab, elements, articles: stripped };
}

/**
 * The tab a restore writes, with every note the page has now that the version lacks and that holds a conversation
 * kept (docs/specs/030-knowledgebase/page-comments.md "Versions"): detached unless the version's writing carries its
 * mark. The same tab when there is none to keep.
 */
export function withHeldNotesKept<T extends NotesTab>(restored: T, stored: NotesTab): T {
  const have = new Set(restored.elements.map((e) => e.id));
  const kept = stored.elements.filter(
    (e) => e.type === 'article-note' && !have.has(e.id) && noteHoldsConversation(e),
  );
  return kept.length === 0 ? restored : { ...restored, elements: [...restored.elements, ...kept] };
}
