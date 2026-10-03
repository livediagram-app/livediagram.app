// What this person's edits do to the articles' zones (docs/specs/007-editor/article-pages.md
// "Zones"), settled right after each of their edits, into the same undo step (tick):
// - elements just added onto an article page outside every zone go into a new zone of the writing,
//   at the block boundary nearest them (a palette tile, a paste, a drop, Insert);
// - a zone that left the writing takes its elements with it;
// - zones are fitted to their elements (an object zone hugs its object; a drawing zone grows to
//   keep its elements inside).
// Only after a local edit: a collaborator's client settles their own, and an undo restores a whole
// step that was already settled.
import { useLayoutEffect, useRef, type RefObject } from 'react';
import {
  articleMarginPx,
  articlesOf,
  illustratePagesOf,
  layOutIllustratePages,
  looseOnDocuments,
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
import { articleHandleOf } from '@/lib/article/article-editor-store';
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

  useLayoutEffect(() => {
    const was = seen.current;
    const seq = localEditSeq.current ?? 0;
    seen.current = { tabId, elements: activeTab.elements, articles: activeTab.articles, seq };
    if (was.tabId !== tabId || !on || !editable || !pages) return;
    if (seq === was.seq) return;
    if (was.elements === activeTab.elements && was.articles === activeTab.articles) return;

    const docsBefore = articlesOf({ articles: was.articles });
    const docsNow = articlesOf(activeTab);
    // Zones that left the writing in this edit.
    const goneZones = new Map<string, ArticleZoneBlock[]>();
    for (const [flow, before] of Object.entries(docsBefore)) {
      const now = new Set((docsNow[flow]?.blocks ?? []).map((b) => b.id));
      const gone = before.blocks.filter(
        (b): b is ArticleZoneBlock => b.type === 'zone' && !now.has(b.id),
      );
      if (gone.length) goneZones.set(flow, gone);
    }
    // Elements just added, and of them the ones loose on an article page.
    const before = new Set(was.elements.map((e) => e.id));
    const added = activeTab.elements.filter((e) => !before.has(e.id)).map((e) => e.id);
    const loose = added.length
      ? looseOnDocuments(activeTab.elements, added, pages, docsNow)
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
        for (const [flow, gone] of goneZones) next = withZoneContentsRemoved(next, flow, gone);
        for (const { flow, ids, plan, res } of intakes) {
          const landed = withZoneLanded(next, flow, res);
          if (!landed.rect) continue;
          next = {
            ...landed.tab,
            elements: withElementsIntoZone(landed.tab.elements, new Set(ids), plan, landed.rect),
          };
          track('Element', 'Added', plan.zone === 'drawing' ? 'ArticleDrawing' : 'ArticleObject');
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
    // The writing's editors are told of the new blocks through the tab, like any change.
  }, [activeTab, tabId, on, editable, pages, localEditSeq, tickTabs]);
}
