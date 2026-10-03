// What this person's edits do to the articles' zones (docs/specs/007-editor/article-pages.md
// "Zones"), settled right after each of their edits, into the same undo step (tick):
// - elements just added onto an article page outside every zone go into a new zone of the writing,
//   at the block boundary nearest them (a palette tile, a paste, a drop, Insert);
// - an object dragged off its zone and dropped on its own article's pages moves its zone there in
//   the writing (to the block boundary nearest the drop), rather than leaving it;
// - a zone that left the writing takes its elements with it;
// - zones are fitted to their elements (an object zone hugs its object; a drawing zone grows to
//   keep its elements inside).
// Only after a local edit: a collaborator's client settles their own, and an undo restores a whole
// step that was already settled. A drag, resize or reshape lands frame by frame without counting as
// an edit, so the end of this person's element gesture counts as one, measured from its start.
import { useLayoutEffect, useRef, type RefObject } from 'react';
import {
  articleMarginPx,
  articlesOf,
  illustratePagesOf,
  layOutIllustratePages,
  looseOnArticles,
  objectsDraggedOut,
  withNoteMarksRemoved,
  withNoteMarkersRemoved,
  articleNoteIds,
  zoneCanvasRect,
  type Element,
  withElementsIntoZone,
  withZoneLanded,
  withZoneContentsRemoved,
  withZonesFitted,
  zonePlanFor,
  type ArticleFlow,
  type ArticleZoneBlock,
  type LaidOutPage,
  type Tab,
} from '@livediagram/document';
import { articleHandleOf, takeZoneReleased } from '@/lib/article/article-editor-store';
import { ELEMENT_GESTURES, useCanvasGesture } from '@/lib/canvas-gesture';
import { flowFrame } from '@/lib/article/article-flow-geometry';
import { debugLog } from '@/lib/debug-log';
import { track } from '@/lib/telemetry';

const textWidthOf = (pages: readonly LaidOutPage[], flow: string, doc: ArticleFlow): number => {
  const own = pages.filter((p) => p.flow === flow);
  return own.length ? flowFrame(own, articleMarginPx(doc.style)).columnWidth : 600;
};

export function useArticleIntake({
  activeTab,
  on,
  editable,
  pages,
  localEditSeq,
  tickTabs,
}: {
  activeTab: Tab;
  on: boolean;
  editable: boolean;
  pages: readonly LaidOutPage[] | null;
  localEditSeq: RefObject<number>;
  tickTabs: (map: (ts: Tab[]) => Tab[]) => void;
}): void {
  const tabId = activeTab.id;
  const seen = useRef({
    tabId,
    elements: activeTab.elements,
    articles: activeTab.articles,
    seq: 0,
  });

  const gesture = useCanvasGesture();
  const gestureEdit = useRef(false);
  useLayoutEffect(() => {
    // Mid-gesture: hold what was seen at its start, to settle against when it ends.
    if (gesture !== 'idle' && ELEMENT_GESTURES.has(gesture)) {
      gestureEdit.current = true;
      return;
    }
    const was = seen.current;
    const seq = localEditSeq.current ?? 0;
    const local = seq !== was.seq || gestureEdit.current;
    gestureEdit.current = false;
    seen.current = { tabId, elements: activeTab.elements, articles: activeTab.articles, seq };
    if (was.tabId !== tabId || !on || !editable || !pages) return;
    if (!local) return;
    if (was.elements === activeTab.elements && was.articles === activeTab.articles) return;

    // Objects dragged off their zones onto their own article: the writing moves their zones there.
    // Only an edit that moved elements can drag one out (a typing commit changes the writing alone).
    const relocations =
      was.elements === activeTab.elements
        ? []
        : objectsDraggedOut(
            { ...activeTab, elements: was.elements, articles: was.articles },
            activeTab,
          ).map((d) => ({ ...d, res: articleHandleOf(d.flow)?.moveZone(d.zoneId, d.at) ?? null }));
    const docsBefore = articlesOf({ articles: was.articles });
    const docsNow = articlesOf(activeTab);
    // Zones that left the writing in this edit.
    const goneZones = new Map<string, ArticleZoneBlock[]>();
    for (const [flow, before] of Object.entries(docsBefore)) {
      const now = new Set((docsNow[flow]?.blocks ?? []).map((b) => b.id));
      const gone = before.blocks.filter(
        (b): b is ArticleZoneBlock =>
          b.type === 'zone' && !now.has(b.id) && !takeZoneReleased(b.id),
      );
      if (gone.length) goneZones.set(flow, gone);
    }
    // Elements just added, and of them the ones loose on an article page.
    const before = new Set(was.elements.map((e) => e.id));
    const added = activeTab.elements.filter((e) => !before.has(e.id)).map((e) => e.id);
    const loose = added.length
      ? looseOnArticles(activeTab.elements, added, pages, docsNow)
      : new Map();
    // Each loose group starts a zone in its article's writing (the editor places it), measured now.
    const intakes: {
      flow: string;
      ids: string[];
      plan: ReturnType<typeof zonePlanFor>;
      res: NonNullable<ReturnType<NonNullable<ReturnType<typeof articleHandleOf>>['insertZone']>>;
    }[] = [];
    for (const [flow, ids] of loose) {
      const handle = articleHandleOf(flow);
      const doc = docsNow[flow];
      if (!handle || !doc) continue;
      const els = activeTab.elements.filter((e) => ids.includes(e.id));
      const plan = zonePlanFor(els, activeTab.elements, textWidthOf(pages, flow, doc));
      const near = {
        x: plan.bounds.x + plan.bounds.width / 2,
        y: plan.bounds.y + plan.bounds.height / 2,
      };
      const res = handle.insertZone(
        { zone: plan.zone, width: plan.width, height: plan.height },
        near,
      );
      if (res) intakes.push({ flow, ids, plan, res });
    }
    tickTabs((ts) => {
      const out = ts.map((t) => {
        if (t.id !== tabId || t.locked === true) return t;
        let next = t;
        for (const r of relocations) {
          // Moved in the writing: the object goes to its zone's new place. Not moved (dropped by
          // its own place in the writing): back into its zone.
          const landed = r.res ? withZoneLanded(next, r.flow, r.res) : null;
          if (landed) next = landed.tab;
          const zone = articlesOf(next)[r.flow]?.blocks.find(
            (b): b is ArticleZoneBlock => b.id === r.zoneId && b.type === 'zone',
          );
          const own = layOutIllustratePages(illustratePagesOf(next)).filter(
            (p) => p.flow === r.flow,
          );
          const rect = landed?.rect ?? (zone ? zoneCanvasRect(own, zone) : null);
          if (!rect) continue;
          next = {
            ...next,
            elements: next.elements.map((el) =>
              el.id === r.elementId ? ({ ...el, x: rect.x, y: rect.y } as Element) : el,
            ),
          };
          debugLog('[article] object dropped in the writing', {
            tabId,
            flow: r.flow,
            zoneId: r.zoneId,
            moved: !!r.res,
          });
        }
        // Margin notes whose markers were deleted leave their text untinted.
        const goneNotes = new Set(
          was.elements
            .filter(
              (e) =>
                e.type === 'annotation' &&
                e.articleNote &&
                !next.elements.some((n) => n.id === e.id),
            )
            .map((e) => e.id),
        );
        next = withNoteMarksRemoved(next, goneNotes);
        // Text with a margin note deleted takes its marker, and so its comment or action, with it.
        const kept = articleNoteIds(articlesOf(next));
        const textGone = new Set(
          [...articleNoteIds(articlesOf({ articles: was.articles }))].filter((id) => !kept.has(id)),
        );
        next = withNoteMarkersRemoved(next, textGone);
        for (const [flow, gone] of goneZones) next = withZoneContentsRemoved(next, flow, gone);
        for (const { flow, ids, plan, res } of intakes) {
          const landed = withZoneLanded(next, flow, res);
          if (!landed.rect) continue;
          next = {
            ...landed.tab,
            elements: withElementsIntoZone(landed.tab.elements, new Set(ids), plan, landed.rect),
          };
          debugLog('[article] zone took elements in', {
            tabId,
            flow,
            zone: plan.zone,
            count: ids.length,
          });
        }
        const laid = layOutIllustratePages(illustratePagesOf(next));
        for (const [flow, doc] of Object.entries(articlesOf(next)))
          next = withZonesFitted(next, flow, textWidthOf(laid, flow, doc));
        return next;
      });
      // Nothing to settle: the same tabs back, so the tick changes nothing.
      return out.every((t, i) => t === ts[i]) ? ts : out;
    });
    // Counted once, outside the updater (which React may run twice).
    for (const r of relocations) if (r.res) track('Element', 'Changed', 'ArticleZoneMoved');
    for (const { plan } of intakes)
      track('Element', 'Added', plan.zone === 'drawing' ? 'ArticleDrawing' : 'ArticleObject');
    // The writing's editors are told of the new blocks through the tab, like any change.
  }, [activeTab, tabId, on, editable, pages, localEditSeq, tickTabs, gesture]);
}
