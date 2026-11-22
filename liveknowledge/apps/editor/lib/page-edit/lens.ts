// The lens the editor works on a page through (docs/specs/030-knowledgebase/blueprints/editing.md "The choice"): in
// edit mode the page as its draft, the draft's writing under the saved flow's id and the page as tall as the draft, so
// nothing in the article engine knows a draft exists; in read mode the page as it is saved, locked for an Editor so
// nothing of it can change. Every commit and tick on the page being edited is lifted into the lens before its map
// runs and lowered back after it (useEditorDocument), which is how the draft is written. Pure.
import {
  DRAFT_FLOW,
  draftOf,
  holdsDraft,
  pagesOf,
  savedFlowOf,
  touchedDraft,
  withArticlePageHeight,
  withDraftMade,
  withoutDraft,
  type ArticleFlow,
  type Tab,
} from '@liveknowledge/document';

const editLenses = new WeakMap<Tab, Tab>();
const readLenses = new WeakMap<Tab, Tab>();
const lockedReadLenses = new WeakMap<Tab, Tab>();

const heightOf = (tab: Tab, flow: string): number | undefined =>
  pagesOf(tab).find((p) => p.flow === flow)?.fit?.height;

/** The page as its draft: the real tab itself while it has none, so entering edit mode lays nothing out again. */
export function pageEditLens(tab: Tab): Tab {
  const cached = editLenses.get(tab);
  if (cached) return cached;
  const draft = draftOf(tab);
  const flow = savedFlowOf(tab);
  let lens = tab;
  if (draft && flow) {
    const { [DRAFT_FLOW]: _draft, ...saved } = tab.articles ?? {};
    void _draft;
    const { draft: _record, ...rest } = tab;
    void _record;
    const drafted: Tab = { ...rest, articles: { ...saved, [flow]: draft.flow } };
    lens =
      draft.record.height !== undefined
        ? withArticlePageHeight(drafted, flow, draft.record.height)
        : drafted;
  } else if (holdsDraft(tab)) {
    // Half a draft: it is not shown, and the next change makes a whole one.
    lens = withoutDraft(tab);
  }
  editLenses.set(tab, lens);
  return lens;
}

/** The page as it is saved: no draft, and locked for a person who could otherwise change it (read mode). */
export function pageReadLens(tab: Tab, lock: boolean): Tab {
  const cache = lock ? lockedReadLenses : readLenses;
  const cached = cache.get(tab);
  if (cached) return cached;
  const saved = withoutDraft(tab);
  const lens = lock && saved.locked !== true ? { ...saved, locked: true } : saved;
  cache.set(tab, lens);
  return lens;
}

/** Who is changing the draft, and when, for its record. */
export type LensWriter = { by: string; now: () => number };

/**
 * The real tab after a change made through the edit lens. The saved writing and the saved page's height are put
 * back; what the change wrote under the saved flow's id and the page height it laid out go to the draft, which the
 * first such change makes. Everything else the change made (a rename, an element) is kept as made. The real tab
 * itself when the change made nothing.
 */
export function lowerPage(real: Tab, lifted: Tab, mapped: Tab, writer: LensWriter): Tab {
  if (mapped === lifted) return real;
  const flow = savedFlowOf(real);
  if (!flow) return mapped;
  const was = lifted.articles?.[flow];
  const now = mapped.articles?.[flow];
  const writingChanged = now !== undefined && now !== was;
  const heightBefore = heightOf(lifted, flow);
  const heightAfter = heightOf(mapped, flow);
  const heightChanged = heightAfter !== undefined && heightAfter !== heightBefore;
  const draft = draftOf(real);
  // No draft and only the saved page's own height settled: that is the saved page's, as it always was.
  if (!draft && !writingChanged) return mapped;
  const savedHeight = heightOf(real, flow);
  const keptPages =
    savedHeight !== undefined
      ? withArticlePageHeight(mapped, flow, savedHeight).pages
      : mapped.pages;
  const { [DRAFT_FLOW]: _lensDraft, ...mappedFlows } = mapped.articles ?? {};
  void _lensDraft;
  const savedWriting = real.articles?.[flow];
  const base: Tab = {
    ...mapped,
    ...(keptPages ? { pages: keptPages } : {}),
    articles: { ...mappedFlows, ...(savedWriting ? { [flow]: savedWriting } : {}) },
  };
  delete base.draft;
  if (!draft) {
    return withDraftMade(
      base,
      now!,
      writer.by,
      writer.now(),
      heightChanged ? heightAfter : undefined,
    );
  }
  // The record moves only as far as the change asks: a typing stream within a minute keeps it as it is.
  const touched = writingChanged
    ? touchedDraft(draft.record, writer.by, writer.now())
    : draft.record;
  // Unmoved, the stored record itself, so the sync sees nothing to send for it.
  const record = heightChanged
    ? { ...touched, height: heightAfter }
    : touched === draft.record
      ? real.draft!
      : touched;
  return {
    ...base,
    articles: {
      ...base.articles,
      [DRAFT_FLOW]: writingChanged ? now : (real.articles![DRAFT_FLOW] as ArticleFlow),
    },
    draft: record,
  };
}

/** The tabs with the page being edited through its edit lens. The same array when that page is not among them. */
export function liftTabs(ts: Tab[], editing: string): Tab[] {
  const i = ts.findIndex((t) => t.id === editing);
  if (i < 0) return ts;
  const lens = pageEditLens(ts[i]!);
  if (lens === ts[i]) return ts;
  const out = ts.slice();
  out[i] = lens;
  return out;
}

/** The real tabs after a map over the lifted ones: the edited page lowered (lowerPage), the rest as mapped. The real
 *  array itself when nothing changed. */
export function lowerTabs(
  real: Tab[],
  lifted: Tab[],
  mapped: Tab[],
  editing: string,
  writer: LensWriter,
): Tab[] {
  if (mapped === lifted) return real;
  const lens = lifted.find((t) => t.id === editing);
  const out = mapped.map((t) => {
    if (t.id !== editing || !lens) return t;
    const before = real.find((r) => r.id === editing);
    return before ? lowerPage(before, lens, t, writer) : t;
  });
  return out.length === real.length && out.every((t, i) => t === real[i]) ? real : out;
}
