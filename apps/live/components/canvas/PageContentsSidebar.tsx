'use client';

// Contents docked as a sidebar down the canvas's left (docs/specs/007-editor/illustrate-pages.md
// "Contents"), the way a slide editor shows its slides: a filmstrip of every page, the page in view
// marked and followed as the view moves, a press gliding there. Where a desktop shows Contents until
// the person minimises it to its cluster button (lib/contents-placement.ts); a phone never has it.
// The list itself is the popover's (usePageContents, PageContentsList).
import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { lucideListOrdered, lucidePanelLeftClose } from '@livediagram/icons/lucide';
import { HoverCard, lucideGlyph } from '@livediagram/ui';
import { useUiScale } from '@/components/providers/ui-scale';
import { toSurfacePx, uiScaleStyle } from '@/lib/ui-scale';
import type { PageThumbTab } from '@/hooks/ui/usePageThumbnails';
import type { IllustratePagesView } from '@/hooks/editor/useIllustratePages';
import { usePageContents } from '@/hooks/ui/usePageContents';
import { pageInView } from '@/lib/page-contents';
import { useViewportStoreIfAny } from '@/hooks/canvas/useViewportStore';
import { CONTENTS_SIDEBAR_INSET, CONTENTS_SIDEBAR_WIDTH } from '@/lib/contents-placement';
import { ContentsAddPage, ContentsCount, ContentsFind, ContentsList } from './PageContentsList';

const ContentsIcon = lucideGlyph(lucideListOrdered, 14);
const MinimiseIcon = lucideGlyph(lucidePanelLeftClose, 14);

// The pictures redraw once the tab rests this long (usePageThumbnails): never on every frame of a
// drag or every key typed, while the sidebar stays on screen beside the work.
export const CONTENTS_SIDEBAR_SETTLE_MS = 250;
// The page in view is read once the view rests this long, not on every frame of a pan or a glide.
export const CONTENTS_FOLLOW_SETTLE_MS = 150;

export function PageContentsSidebar({
  view,
  tab,
  top,
  onMinimise,
}: {
  view: IllustratePagesView;
  tab: PageThumbTab;
  // Where it starts, in screen px from the canvas's top: below the Toolbar strip.
  top: number;
  onMinimise: () => void;
}) {
  const scale = useUiScale('panels');
  const px = (v: number) => toSurfacePx(v, scale);
  const self = useRef<HTMLElement>(null);
  const viewport = useViewportStoreIfAny();
  // The page in view, read against what shows beside the sidebar.
  const readHere = () => {
    const el = self.current;
    const canvas = el?.offsetParent?.getBoundingClientRect();
    if (!viewport || !el || !canvas) return view.pages[0]?.id;
    const inset = el.getBoundingClientRect().right - canvas.left;
    return pageInView(
      view.pages,
      viewport.get(),
      { width: canvas.width, height: canvas.height },
      inset,
    );
  };
  const [here] = useState<string | undefined>(() => view.pages[0]?.id);
  const contents = usePageContents({ view, tab, here, settleMs: CONTENTS_SIDEBAR_SETTLE_MS });

  // The page in view followed as the view moves on (a pan, a zoom, the pages row's arrows): marked,
  // and its row scrolled into view, once the view rests.
  const { setCurrent } = contents;
  const markHere = useEffectEvent(() => setCurrent(readHere()));
  useEffect(() => {
    markHere();
    if (!viewport) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const off = viewport.subscribe(() => {
      clearTimeout(timer);
      timer = setTimeout(markHere, CONTENTS_FOLLOW_SETTLE_MS);
    });
    return () => {
      clearTimeout(timer);
      off();
    };
  }, [viewport]);

  return (
    <aside
      ref={self}
      aria-label="Contents"
      data-contents-sidebar=""
      data-page-contents=""
      data-tour-id="contents"
      // Panel opacity reaches it, as it does every panel (docs/specs/007-editor/user-preferences.md).
      data-panel-translucent=""
      onPointerDown={(e) => e.stopPropagation()}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      style={{
        ...uiScaleStyle(scale),
        left: px(CONTENTS_SIDEBAR_INSET),
        top: px(top),
        width: CONTENTS_SIDEBAR_WIDTH,
        maxHeight: `calc(100% - ${px(top + CONTENTS_SIDEBAR_INSET)}px)`,
      }}
      className="pointer-events-auto absolute z-[var(--z-panel)] flex cursor-default flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg shadow-slate-900/5 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 dark:shadow-slate-950/40 motion-safe:transition-[opacity,translate] motion-safe:duration-200 motion-safe:ease-out motion-safe:starting:-translate-x-3 motion-safe:starting:opacity-0"
    >
      <div className="flex items-center gap-2 px-3 pb-2 pt-2.5">
        <span
          aria-hidden
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300"
        >
          <ContentsIcon />
        </span>
        <h2 className="min-w-0 truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
          Contents
        </h2>
        <span className="ml-auto flex items-center gap-1">
          <ContentsCount count={contents.pages.length} />
          <HoverCard title="Minimise" description="Tuck Contents into its button, bottom right.">
            <button
              type="button"
              onClick={onMinimise}
              aria-label="Minimise Contents"
              data-contents-minimise=""
              className="relative flex h-6 w-6 touch-target items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 focus-visible:outline-2 focus-visible:outline-brand-600 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100"
            >
              <MinimiseIcon />
            </button>
          </HoverCard>
        </span>
      </div>
      <ContentsFind contents={contents} />
      <ContentsList
        contents={contents}
        variant="film"
        touch={false}
        className="flex-1 gap-0.5 px-1.5 pb-2"
      />
      <ContentsAddPage contents={contents} columns={2} />
    </aside>
  );
}
