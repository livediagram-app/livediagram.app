'use client';

// The right rail of a knowledgebase page (docs/specs/030-knowledgebase/verification.md "Page Health"): On This Page
// and the Page Health card. Docked down the canvas's right on a window at least 1,280 px wide; below that the same
// two sections open from a Page Info button, in a card on a desktop and in the shared bottom sheet on a phone.
import { useCallback, useEffect, useRef, useState } from 'react';
import { HoverCard } from '@liveknowledge/ui';
import { BottomSheet } from '@liveworkspace/workbench/components/primitives/BottomSheet';
import { useEditorChrome, useEditorChromeStore } from '@/app/document/[id]/EditorContext';
import { articleHandleOf } from '@/lib/article/article-editor-store';
import {
  currentHeading,
  pageHeadings,
  sameHeadings,
  type PageHeading,
} from '@/lib/knowledge/page-headings';
import { track } from '@/lib/telemetry';
import { CloseIcon, PageInfoIcon } from './knowledge-icons';
import { OnThisPage } from './OnThisPage';
import { PageHealthCard } from './PageHealthCard';
import { useKnowledgePeople, usePageKnowledge } from './usePageKnowledge';

/** The rail's width, in px. */
export const PAGE_RAIL_WIDTH = 280;
/** What the page framing measures to centre the page beside the rail (lib/side-chrome-insets.ts). */
export const PAGE_RAIL_ATTR = 'data-page-rail';
/** How far below the window's top a heading counts as the one being read. */
const READING_LINE_PX = 160;

const NO_HEADINGS: readonly PageHeading[] = [];

type Writing = { flow: string; headings: readonly PageHeading[] };

// The page's one article: its flow and its headings, read from the committed blocks (page-headings.ts keeps the
// last answer per block list, so a store update that changed no block reads nothing).
function writingOf(tab: { articles?: Record<string, { blocks: readonly unknown[] }> }): Writing {
  const [flow, article] = Object.entries(tab.articles ?? {})[0] ?? [];
  if (!flow || !article) return { flow: '', headings: NO_HEADINGS };
  return { flow, headings: pageHeadings(article.blocks as Parameters<typeof pageHeadings>[0]) };
}
const sameWriting = (a: Writing, b: Writing) =>
  a.flow === b.flow && sameHeadings(a.headings, b.headings);

const blockEl = (id: string) =>
  document.querySelector<HTMLElement>(`[data-block-id="${CSS.escape(id)}"]`);

// The heading being read, found when the view moves or the headings change: one pass over the headings' boxes a
// frame at most, and none while nothing moved.
function useCurrentHeading(headings: readonly PageHeading[]): string | undefined {
  const viewport = useEditorChrome((s) => s.viewport);
  const [current, setCurrent] = useState<string | undefined>(undefined);
  useEffect(() => {
    if (headings.length === 0) return;
    const frame = requestAnimationFrame(() => {
      const tops = headings.flatMap((heading) => {
        const el = blockEl(heading.id);
        return el ? [{ id: heading.id, top: el.getBoundingClientRect().top }] : [];
      });
      setCurrent(currentHeading(tops, READING_LINE_PX));
    });
    return () => cancelAnimationFrame(frame);
  }, [headings, viewport]);
  return headings.some((h) => h.id === current) ? current : headings[0]?.id;
}

/** The rail's two sections, for the current page. */
export function PageRailBody() {
  const chrome = useEditorChromeStore();
  const writing = useEditorChrome((s) => writingOf(s.activeTab), sameWriting);
  const page = usePageKnowledge();
  const { people, nameOf } = useKnowledgePeople();
  const current = useCurrentHeading(writing.headings);
  const go = useCallback(
    (id: string) => {
      track('UI', 'Used', 'OnThisPage');
      const rect = articleHandleOf(writing.flow)?.rangeRect(id, 0, 0);
      if (rect) chrome.get().scrollIntoView(rect.x, rect.y, rect.w, rect.h);
    },
    [chrome, writing.flow],
  );
  const { rights, pageId } = page;
  return (
    <div className="flex flex-col gap-6">
      <OnThisPage headings={writing.headings} current={current} onGo={go} />
      <PageHealthCard
        trust={page.trust}
        now={page.now}
        reads={page.health?.reads}
        people={people}
        nameOf={nameOf}
        onSetOwner={
          rights.editFields ? (owner) => page.setFields(pageId, { owner }, 'owner') : undefined
        }
        onSetReviewEvery={
          rights.editFields
            ? (reviewEvery) => page.setFields(pageId, { reviewEvery }, 'interval')
            : undefined
        }
        onVerify={rights.verify ? () => page.verify(pageId) : undefined}
      />
    </div>
  );
}

/** Docked down the canvas's right, from `top` px (the toolbar's row) to its foot. */
export function PageRailDocked({ top }: { top: number }) {
  return (
    <aside
      aria-label="Page Info"
      {...{ [PAGE_RAIL_ATTR]: 'docked' }}
      onPointerDown={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.stopPropagation()}
      style={{ top, width: PAGE_RAIL_WIDTH }}
      className="pointer-events-auto absolute bottom-0 right-0 z-[var(--z-panel)] cursor-default overflow-y-auto rounded-tl-xl border-l border-t border-slate-200 bg-slate-50 px-5 pb-24 pt-5 text-slate-900 motion-safe:transition-[opacity,translate] motion-safe:duration-200 motion-safe:ease-out motion-safe:starting:translate-x-3 motion-safe:starting:opacity-0 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
    >
      <PageRailBody />
    </aside>
  );
}

/** Below 1,280 px: a Page Info button under the toolbar's row, opening the rail's sections. */
export function PageRailButton({ top, sheet }: { top: number; sheet: boolean }) {
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const close = useCallback(() => {
    setOpen(false);
    button.current?.focus();
  }, []);
  useEffect(() => {
    if (!open || sheet) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, sheet, close]);
  return (
    <div
      className="pointer-events-none absolute right-3 z-[var(--z-panel)] flex flex-col items-end gap-2"
      style={{ top }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <HoverCard title="Page Info" description="On This Page and this page's health.">
        <button
          ref={button}
          type="button"
          aria-label="Page Info"
          aria-haspopup="dialog"
          aria-expanded={open}
          data-page-rail-button=""
          onClick={() => {
            if (!open) track('UI', 'Opened', 'PageInfo');
            setOpen((was) => !was);
          }}
          className="pointer-events-auto flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm motion-safe:transition-colors motion-safe:duration-micro hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-brand-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          <PageInfoIcon />
        </button>
      </HoverCard>
      {open && sheet ? (
        <BottomSheet
          role="dialog"
          aria-label="Page Info"
          {...{ [PAGE_RAIL_ATTR]: 'sheet' }}
          onClose={close}
          zClassName="z-[var(--z-modal)]"
        >
          <PageRailBody />
        </BottomSheet>
      ) : null}
      {open && !sheet ? (
        <div
          role="dialog"
          aria-label="Page Info"
          {...{ [PAGE_RAIL_ATTR]: 'card' }}
          style={{ width: PAGE_RAIL_WIDTH }}
          className="pointer-events-auto max-h-[70vh] overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-4 shadow-lg motion-safe:transition-[opacity,translate] motion-safe:duration-200 motion-safe:ease-out motion-safe:starting:-translate-y-1 motion-safe:starting:opacity-0 dark:border-slate-800 dark:bg-slate-900"
        >
          <div className="mb-2 flex justify-end">
            <button
              type="button"
              aria-label="Close Page Info"
              onClick={close}
              className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-slate-500 hover:bg-slate-200/70 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-brand-600 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
            >
              <CloseIcon />
            </button>
          </div>
          <PageRailBody />
        </div>
      ) : null}
    </div>
  );
}
