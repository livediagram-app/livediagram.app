'use client';

// A page link's hover card (docs/specs/030-knowledgebase/links-and-embeds.md "Page links"): the page's current
// title, its verified state and its first lines. Listens on the writing's own element, as the ordinary link's card
// does; shown after a short dwell, gone when the pointer leaves. It reads nothing from the network: the state comes
// from the page list, and the first lines from the page's writing when this editor already holds it.
import { savedArticlesOf } from '@liveknowledge/document';
import { useEffect, useState, type RefObject } from 'react';
import type { EditorView } from 'prosemirror-view';
import { Portal } from '@liveknowledge/ui';
import type { EditorChromeStore } from '@/app/document/[id]/EditorContext';
import { firstLines } from '@/lib/knowledge/page-link-pick';
import { knowledgeSettingsStore } from '@/lib/knowledge-settings/knowledge-settings-store';
import { pageKnowledgeStore } from '@/lib/knowledge/page-knowledge-store';
import { pageTrust, trustMark, type TrustMark } from '@/lib/knowledge/page-trust';
import { TrustBadge } from './TrustBadge';

/** How long the pointer rests on a link before its card shows (ms). */
export const PAGE_LINK_CARD_DWELL_MS = 350;
const WIDTH = 288;

// What the card shows, read from the page list when the pointer settles (never in render).
type Hover = {
  left: number;
  top: number;
  // Absent for a link to a page that is gone.
  page: { title: string; mark: TrustMark | undefined; lines: string } | undefined;
};

export function PageLinkHoverCard({
  viewRef,
  store,
}: {
  viewRef: RefObject<EditorView | null>;
  store: EditorChromeStore;
}) {
  const [hover, setHover] = useState<Hover | null>(null);
  useEffect(() => {
    const dom = viewRef.current?.dom;
    if (!dom) return;
    let timer: number | null = null;
    const clear = () => {
      if (timer !== null) window.clearTimeout(timer);
      timer = null;
    };
    const linkAt = (target: EventTarget | null) =>
      target instanceof Element ? target.closest<HTMLElement>('a.article-page-link') : null;
    const over = (e: MouseEvent) => {
      const link = linkAt(e.target);
      const page = link?.dataset.page;
      if (!link || !page) return;
      clear();
      timer = window.setTimeout(() => {
        const r = link.getBoundingClientRect();
        const tab = store.get().tabs.find((t) => t.id === page);
        setHover({
          left: Math.max(8, Math.min(r.left, window.innerWidth - WIDTH - 8)),
          top: r.bottom + 6,
          page: tab && {
            title: tab.name || 'Untitled Page',
            mark: trustMark(
              pageTrust(
                pageKnowledgeStore.fieldsOf(tab),
                knowledgeSettingsStore.reviewEveryOf(store.get().documentId),
                Date.now(),
              ).state,
            ),
            lines: firstLines(Object.values(savedArticlesOf(tab))[0]?.blocks ?? []),
          },
        });
      }, PAGE_LINK_CARD_DWELL_MS);
    };
    const out = (e: MouseEvent) => {
      if (!linkAt(e.target)) return;
      clear();
      setHover(null);
    };
    dom.addEventListener('mouseover', over);
    dom.addEventListener('mouseout', out);
    return () => {
      clear();
      dom.removeEventListener('mouseover', over);
      dom.removeEventListener('mouseout', out);
    };
  }, [viewRef, store]);
  if (!hover) return null;
  const { page } = hover;
  return (
    <Portal>
      <div
        role="tooltip"
        data-page-link-card=""
        style={{ left: hover.left, top: hover.top, width: WIDTH }}
        className="pointer-events-none fixed z-[var(--z-overlay)] animate-fade-in rounded-xl border border-slate-200 bg-white p-3 text-[13px] leading-5 shadow-xl shadow-slate-900/15 dark:border-slate-700 dark:bg-slate-900"
      >
        {page ? (
          <>
            <div className="flex items-start justify-between gap-2">
              <p className="min-w-0 font-semibold text-slate-900 dark:text-slate-100">
                {page.title}
              </p>
              {page.mark ? <TrustBadge mark={page.mark} compact /> : null}
            </div>
            {page.lines ? (
              <p className="mt-1 line-clamp-3 text-slate-600 dark:text-slate-300">{page.lines}</p>
            ) : null}
          </>
        ) : (
          <p className="font-medium text-slate-600 dark:text-slate-300">Deleted Page</p>
        )}
      </div>
    </Portal>
  );
}
