'use client';

// Contents docked as a sidebar down the canvas's left (docs/specs/007-editor/pages-mode.md
// "Contents"), the way a slide editor shows its slides: a filmstrip of every page, the page in view
// marked and followed as the view moves, a press gliding there. Where a desktop shows Contents until
// the person minimises it to its cluster button (the editor's lib/contents-placement.ts); a phone never
// has it. Always on the left, with no header: it opens on the first page's row, and its foot is the
// editor's Add Page with Contents Options (Collapse Contents, Stack Pages) to its right. The list itself is the popover's (hooks/ui/usePageContents,
// PageContentsList); the editor hands in its footer and its rows' own marks.
import { useEffect, useEffectEvent, useRef, type ReactNode } from 'react';
import { useUiScale } from '../providers/ui-scale';
import { toSurfacePx, uiScaleStyle } from '../../lib/ui-scale';
import { MenuJoinBand } from './menu-join';
import { ContentsOptions, type ContentsStackOption } from './ContentsOptions';
import { useViewportStoreIfAny } from '../../hooks/canvas/useViewportStore';
import { pageInView, type ContentsPageRect, type ContentsRowBase } from '../../lib/page-contents';
import { CONTENTS_SIDEBAR_WIDTH, restingRect, sideInsetsOf } from '../../lib/contents-sidebar';
import { ContentsList, type ContentsBadges, type ContentsListState } from './PageContentsList';

// The pictures redraw once the tab rests this long (the editor's usePageThumbnails): never on every
// frame of a drag or every key typed, while the sidebar stays on screen beside the work.
export const CONTENTS_SIDEBAR_SETTLE_MS = 250;
// The page in view is read once the view rests this long, not on every frame of a pan or a glide.
export const CONTENTS_FOLLOW_SETTLE_MS = 150;

export function ContentsSidebar<R extends ContentsRowBase>({
  contents,
  pages,
  focusPage,
  footer,
  badges,
  top,
  onMinimise,
  stack,
  joined = false,
}: {
  // Built with the page at the tab's start as here (the sidebar then follows the view).
  contents: ContentsListState<R> & { setCurrent: (id: string | undefined) => void };
  pages: readonly ContentsPageRect[];
  // Frames one page in the view.
  focusPage: (pageId: string) => void;
  // The list's foot: the editor's Add Page, with `end` (Contents Options) to its right in the same row. With
  // no Add Page (a Viewer), the foot still holds `end`.
  footer: (end: ReactNode) => ReactNode;
  badges?: ContentsBadges<R> | undefined;
  // Where it starts, in screen px from the canvas's top: below the Toolbar strip.
  top: number;
  onMinimise: () => void;
  // The tab's Stack Pages switch in Contents Options, where the editor offers it (an Editor's, on a kind that may
  // stand either way).
  stack?: ContentsStackOption | undefined;
  // Joined to the menu box above it (docs/specs/007-editor/pages-mode.md "Joined to the menu box"): it rises to the
  // canvas's top and its first `top` px are the menu box's row, so the list starts where it would.
  joined?: boolean;
}) {
  const scale = useUiScale('panels');
  const px = (v: number) => toSurfacePx(v, scale);
  const self = useRef<HTMLElement>(null);
  const viewport = useViewportStoreIfAny();
  // The page in view, read against what shows beside the sidebar.
  const readHere = () => {
    const el = self.current;
    const canvas = el?.offsetParent?.getBoundingClientRect();
    if (!viewport || !el || !canvas) return pages[0]?.id;
    return pageInView(
      pages,
      viewport.get(),
      { width: canvas.width, height: canvas.height },
      sideInsetsOf(canvas, restingRect(el)),
    );
  };

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

  // Docking it (from the popover, opening the tab) frames the page in view again beside it, so the
  // page never sits under it.
  const reframe = useEffectEvent(() => {
    const id = readHere();
    if (id) focusPage(id);
  });
  useEffect(() => {
    const frame = requestAnimationFrame(reframe);
    return () => cancelAnimationFrame(frame);
  }, []);

  // Contents Options (ContentsOptions): Collapse Contents, and the tab's Stack Pages where the editor offers it.
  const minimise = (
    <ContentsOptions
      onCollapse={() => {
        // The page in view, framed again across the whole canvas once the sidebar has gone.
        const id = readHere();
        onMinimise();
        if (id) requestAnimationFrame(() => requestAnimationFrame(() => focusPage(id)));
      }}
      stack={stack}
    />
  );

  return (
    <aside
      ref={self}
      aria-label="Contents"
      data-contents-sidebar=""
      data-page-contents=""
      data-tour-id="contents"
      onPointerDown={(e) => e.stopPropagation()}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      style={{
        ...uiScaleStyle(scale),
        left: 0,
        top: joined ? 0 : px(top),
        width: CONTENTS_SIDEBAR_WIDTH,
      }}
      // Opaque, flush against its side and down to the canvas's foot, so no page shows round or
      // through it.
      className="pointer-events-auto absolute bottom-0 z-[var(--z-panel)] flex cursor-default flex-col overflow-hidden rounded-tr-2xl border-r border-t border-slate-200 bg-white shadow-[4px_0_16px_-8px_rgb(15_23_42/0.12)] motion-safe:transition-[opacity,translate] motion-safe:duration-200 motion-safe:ease-out motion-safe:starting:-translate-x-3 motion-safe:starting:opacity-0 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
    >
      {joined ? <MenuJoinBand height={px(top)} /> : null}
      <ContentsList
        contents={contents}
        variant="film"
        touch={false}
        badges={badges}
        className="flex-1 gap-0.5 px-1.5 pb-2 pt-2"
      />
      {footer(minimise)}
    </aside>
  );
}
