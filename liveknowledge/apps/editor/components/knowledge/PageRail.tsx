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
import { pageViewportOf } from '@/lib/page-surface/page-viewport-store';
import { track } from '@/lib/telemetry';
import { TOP_ROW_HEIGHT_VAR } from '@/components/chrome/KnowledgeTopRow';
import { CloseIcon, PageInfoIcon } from './knowledge-icons';
import { OnThisPage } from './OnThisPage';
import { PageActivity, PageHealthCard, type PageStamp } from './PageHealthCard';
import { PageRailAiContext } from './PageAiContext';
import { useKnowledgePeople, usePageKnowledge } from './usePageKnowledge';

/** The rail's width, in px. */
export const PAGE_RAIL_WIDTH = 280;
/** What the page framing measures to centre the page beside the rail (lib/side-chrome-insets.ts). */
export const PAGE_RAIL_ATTR = 'data-page-rail';
/** How far below the window's top a heading counts as the one being read. */
const READING_LINE_PX = 160;

const NO_HEADINGS: readonly PageHeading[] = [];

/** A created or updated stamp, its person named where the editor can. */
const stampOf = (
  stamp: { by: string; at: number } | undefined,
  nameOf: (id: string | undefined) => string | undefined,
): PageStamp | undefined => (stamp ? { at: stamp.at, by: nameOf(stamp.by) } : undefined);

type Writing = { flow: string; headings: readonly PageHeading[] };

// The page's one article: its flow and its headings, read from the committed blocks (page-headings.ts keeps the
// last answer per block list, so a store update that changed no block reads nothing).
function writingOf(tab: { articles?: Record<string, { blocks: readonly unknown[] }> }): Writing {
  const [flow, article] = Object.entries(tab.articles ?? {})[0] ?? [];
  if (!flow || !article) return { flow: '', headings: NO_HEADINGS };
  const blocks = article.blocks as Parameters<typeof pageHeadings>[0];
  return { flow, headings: pageHeadings(blocks) };
}
const sameWriting = (a: Writing, b: Writing) =>
  a.flow === b.flow && sameHeadings(a.headings, b.headings);

const blockEl = (id: string) =>
  document.querySelector<HTMLElement>(`[data-block-id="${CSS.escape(id)}"]`);

// How often, at most, the heading being read is looked for while the page scrolls (ms).
const READING_CHECK_MS = 120;

// The heading being read, found when the headings change and as the page scrolls: one pass over the headings' boxes
// every READING_CHECK_MS at most, outside React. The rail renders only when the heading being read changes, never
// for a scroll that stays under the same heading.
function useCurrentHeading(headings: readonly PageHeading[]): string | undefined {
  const viewport = useEditorChrome((s) => s.viewport);
  const [current, setCurrent] = useState<string | undefined>(undefined);
  useEffect(() => {
    if (headings.length === 0) return;
    const read = () => {
      const tops = headings.flatMap((heading) => {
        const el = blockEl(heading.id);
        return el ? [{ id: heading.id, top: el.getBoundingClientRect().top }] : [];
      });
      setCurrent(currentHeading(tops, READING_LINE_PX));
    };
    let frame = requestAnimationFrame(read);
    let wait = 0;
    const onScroll = () => {
      if (wait) return;
      wait = window.setTimeout(() => {
        wait = 0;
        frame = requestAnimationFrame(read);
      }, READING_CHECK_MS);
    };
    const scroller = pageViewportOf(viewport)?.scroller() ?? null;
    scroller?.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(wait);
      scroller?.removeEventListener('scroll', onScroll);
    };
  }, [headings, viewport]);
  return headings.some((h) => h.id === current) ? current : headings[0]?.id;
}

/** The rail's two sections, for the current page. */
/**
 * The rail's sections. Docked, the week's reads and who made and updated the page sit in a foot held at the rail's
 * bottom while the rest scrolls; in the Page Info card they follow on.
 */
export function PageRailBody({ docked = false }: { docked?: boolean }) {
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
  // Knowledgebase Settings, for an Editor: where the Review Period is changed (the card has no control of its own).
  const activity = (
    <PageActivity
      now={page.now}
      reads={page.health?.reads}
      created={stampOf(page.health?.created, nameOf)}
      updated={stampOf(page.health?.updated, nameOf)}
    />
  );
  const sections = (
    <div className="flex flex-col gap-8">
      <OnThisPage headings={writing.headings} current={current} onGo={go} />
      <PageHealthCard
        trust={page.trust}
        reviewEvery={page.reviewEvery}
        now={page.now}
        people={people}
        nameOf={nameOf}
        onSetOwner={
          rights.editFields ? (owner) => page.setFields(pageId, { owner }, 'owner') : undefined
        }
        onVerify={rights.verify ? () => page.verify(pageId) : undefined}
      />
      <PageRailAiContext page={page} />
      {docked ? null : activity}
    </div>
  );
  if (!docked) return sections;
  return (
    <>
      <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-8 pt-6">{sections}</div>
      <div
        data-page-rail-foot=""
        className="shrink-0 border-t border-slate-200/70 bg-slate-50/70 px-6 pb-4 pt-4 dark:border-slate-800/70 dark:bg-slate-900/40"
      >
        {activity}
      </div>
    </>
  );
}

/** Docked down the canvas's right, from under the top row to its foot. */
export function PageRailDocked() {
  return (
    <aside
      aria-label="Page Info"
      {...{ [PAGE_RAIL_ATTR]: 'docked' }}
      onPointerDown={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.stopPropagation()}
      style={{ top: TOP_ROW_HEIGHT_VAR, width: PAGE_RAIL_WIDTH }}
      className="pointer-events-auto absolute bottom-0 right-0 z-[var(--z-panel)] flex cursor-default flex-col border-l border-slate-200/70 text-slate-900 motion-safe:transition-[opacity,translate] motion-safe:duration-200 motion-safe:ease-out motion-safe:starting:translate-x-3 motion-safe:starting:opacity-0 dark:border-slate-800/70 dark:text-slate-100"
    >
      <PageRailBody docked />
    </aside>
  );
}

/** Below 1,280 px: a Page Info button in the top row, opening the rail's sections under it. */
export function PageRailButton({ sheet }: { sheet: boolean }) {
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
    <div className="relative flex shrink-0 items-center" onPointerDown={(e) => e.stopPropagation()}>
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
          className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-lg text-slate-600 motion-safe:transition-colors motion-safe:duration-micro hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-brand-600 aria-expanded:bg-slate-100 aria-expanded:text-slate-900 phone:h-11 phone:w-11 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100 dark:aria-expanded:bg-slate-800 dark:aria-expanded:text-slate-100"
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
          {/* The sheet runs edge to edge: the sections keep the rail's inset. */}
          <div className="px-5 pb-6 pt-2">
            <PageRailBody />
          </div>
        </BottomSheet>
      ) : null}
      {open && !sheet ? (
        <div
          role="dialog"
          aria-label="Page Info"
          {...{ [PAGE_RAIL_ATTR]: 'card' }}
          style={{ width: PAGE_RAIL_WIDTH }}
          className="absolute right-0 top-full z-[var(--z-toolbar)] mt-2 max-h-[70vh] overflow-y-auto rounded-xl border border-slate-200 bg-white p-5 shadow-lg motion-safe:transition-[opacity,translate] motion-safe:duration-200 motion-safe:ease-out motion-safe:starting:-translate-y-1 motion-safe:starting:opacity-0 dark:border-slate-800 dark:bg-slate-900"
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
