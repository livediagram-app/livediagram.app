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
import { useSlideOut } from '@/lib/ui/use-slide-out';
import { TOP_ROW_HEIGHT_VAR } from '@/components/chrome/KnowledgeTopRow';
import { CloseIcon, PageInfoIcon } from './knowledge-icons';
import { OnThisPage } from './OnThisPage';
import { PageActivity, PageHealthCard, type PageStamp } from './PageHealthCard';
import { ReviewPeriodButton } from '@/components/knowledge-settings/ReviewPeriodButton';
import { useSettingsOffered } from '@/components/knowledge-settings/useSettingsOffered';
import { PageHealthApproval } from './approval/PageHealthApproval';
import { PageRailAiContext } from './PageAiContext';
import { useKnowledgePeople, usePageKnowledge } from './usePageKnowledge';
import { RailCollapseIcon, RailExpandIcon } from '@/components/page-tree/page-tree-icons';
import { setPageRailCollapsed, usePageRailCollapsed } from '@/lib/page-rail-collapsed';

/** The rail's width, in px. */
// 312 (owner 2026-11-21: slightly wider than 280): with the tree open the rail still docks on a 1,440 px window.
export const PAGE_RAIL_WIDTH = 312;
/** The collapsed rail's strip, as wide as the page tree's (owner 2026-11-21). */
export const PAGE_RAIL_STRIP_WIDTH = 48;
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
  // The pencil beside the Review Period: an Editor of the whole knowledgebase's alone.
  const changesPeriod = useSettingsOffered();
  const activity = (
    <PageActivity
      now={page.now}
      reads={page.health?.reads}
      created={stampOf(page.health?.created, nameOf)}
      updated={stampOf(page.health?.updated, nameOf)}
    />
  );
  const fillActivity = (
    <PageActivity
      now={page.now}
      reads={page.health?.reads}
      created={stampOf(page.health?.created, nameOf)}
      updated={stampOf(page.health?.updated, nameOf)}
      fill
    />
  );
  const sections = (
    <div className="flex flex-col gap-8">
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
        periodControl={changesPeriod ? <ReviewPeriodButton /> : undefined}
      />
      {/* Page Health leads, On This Page under it (owner 2026-11-21). */}
      <OnThisPage headings={writing.headings} current={current} onGo={go} />
      <PageHealthApproval />
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
        {fillActivity}
      </div>
    </>
  );
}

// The rail's collapse and show buttons: the page tree's bordered square (owner 2026-11-21).
const RAIL_TOGGLE =
  'flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700 focus-visible:outline-2 focus-visible:outline-brand-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-brand-400/60 dark:hover:bg-brand-500/20 dark:hover:text-brand-100';

/** Docked down the canvas's right, from under the top row to its foot; collapsed, a narrow strip with the way back.
 *  Hiding it slides the rail out to the right as the strip takes its place, and showing it slides it back in, as the
 *  page tree does on the left (page-surface.md "Sidebars slide"; owner 2026-11-21). */
export function PageRailDocked() {
  const collapsed = usePageRailCollapsed();
  // Open, the rail slides out to the right before the strip takes its place.
  const open = useSlideOut(!collapsed);
  const stop = {
    onPointerDown: (e: React.PointerEvent) => e.stopPropagation(),
    onContextMenu: (e: React.MouseEvent) => e.stopPropagation(),
  };
  const strip = (
    <aside
      key="strip"
      aria-label="Page Info"
      {...{ [PAGE_RAIL_ATTR]: 'strip' }}
      {...stop}
      style={{ top: TOP_ROW_HEIGHT_VAR, width: PAGE_RAIL_STRIP_WIDTH }}
      className="pointer-events-auto absolute bottom-0 right-0 z-[var(--z-panel)] flex cursor-default flex-col border-l border-slate-200/70 text-slate-900 motion-safe:transition-[opacity,translate] motion-safe:duration-200 motion-safe:ease-out motion-safe:starting:translate-x-3 motion-safe:starting:opacity-0 dark:border-slate-800/70 dark:text-slate-100"
    >
      <div className="flex justify-center pt-3">
        <HoverCard
          title="Show Page Info"
          description="Opens Page Health and the rest of this sidebar."
        >
          <button
            type="button"
            aria-label="Show Page Info"
            aria-expanded={false}
            data-page-rail-expand=""
            onClick={() => setPageRailCollapsed(false)}
            className={RAIL_TOGGLE}
          >
            <RailExpandIcon />
          </button>
        </HoverCard>
      </div>
    </aside>
  );
  // One element for the open rail, whether docked or sliding out, so hiding it animates it rather than swapping it.
  // Sliding out it is no longer the docked rail: the page's framing and the edit ripple measure the strip instead.
  const leaving = collapsed;
  const full = (
    <aside
      key="full"
      aria-label={leaving ? undefined : 'Page Info'}
      aria-hidden={leaving ? true : undefined}
      {...(leaving ? { 'data-page-rail-leaving': '' } : { [PAGE_RAIL_ATTR]: 'docked' })}
      {...stop}
      style={{ top: TOP_ROW_HEIGHT_VAR, width: PAGE_RAIL_WIDTH }}
      className={`pointer-events-auto absolute bottom-0 right-0 z-[var(--z-panel)] flex cursor-default flex-col border-l border-slate-200/70 text-slate-900 motion-safe:transition-[translate] motion-safe:duration-200 motion-safe:ease-out motion-safe:starting:translate-x-full dark:border-slate-800/70 dark:text-slate-100 ${
        leaving ? 'pointer-events-none translate-x-full' : ''
      }`}
    >
      {leaving ? null : (
        <div className="absolute right-4 top-4 z-10">
          <HoverCard title="Hide Page Info" description="Collapses this sidebar to a narrow strip.">
            <button
              type="button"
              aria-label="Hide Page Info"
              aria-expanded
              data-page-rail-collapse=""
              onClick={() => setPageRailCollapsed(true)}
              className={RAIL_TOGGLE}
            >
              <RailCollapseIcon />
            </button>
          </HoverCard>
        </div>
      )}
      <PageRailBody docked />
    </aside>
  );
  return (
    <>
      {open.drawn ? full : null}
      {collapsed ? strip : null}
    </>
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
  // Escape closes the card and the sheet alike: BottomSheet leaves Escape to its caller, so skipping the sheet here left
  // nothing to close it (sweep 2026-11-21).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, close]);
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
