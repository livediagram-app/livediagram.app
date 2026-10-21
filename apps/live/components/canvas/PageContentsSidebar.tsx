'use client';

// Contents docked as a sidebar down the canvas's left (docs/specs/007-editor/pages-mode.md
// "Contents"), the way a slide editor shows its slides: a filmstrip of every page, the page in view
// marked and followed as the view moves, a press gliding there. Where a desktop shows Contents until
// the person minimises it to its cluster button (lib/contents-placement.ts); a phone never has it.
// The list itself is the popover's (usePageContents, PageContentsList).
import { useEffect, useEffectEvent, useRef, useState } from 'react';
import {
  lucideListOrdered,
  lucidePanelLeftClose,
  lucidePanelRightClose,
} from '@liveplanner/icons/lucide';
import { HoverCard, lucideGlyph } from '@liveplanner/ui';
import { useUiScale } from '@/components/providers/ui-scale';
import { toSurfacePx, uiScaleStyle } from '@/lib/ui-scale';
import type { PageThumbTab } from '@/hooks/ui/usePageThumbnails';
import type { PagesModeView } from '@/hooks/editor/usePagesMode';
import { usePageContents } from '@/hooks/ui/usePageContents';
import { pageInView } from '@/lib/page-contents';
import { useViewportStoreIfAny } from '@/hooks/canvas/useViewportStore';
import { CONTENTS_SIDEBAR_WIDTH, type ContentsSide } from '@/lib/contents-placement';
import { restingRect, sideInsetsOf } from '@/lib/side-chrome-insets';
import { ContentsAddPage } from './ContentsAddPage';
import { ContentsFind, ContentsList } from './PageContentsList';

const ContentsIcon = lucideGlyph(lucideListOrdered, 14);
const MinimiseLeftIcon = lucideGlyph(lucidePanelLeftClose, 14);
const MinimiseRightIcon = lucideGlyph(lucidePanelRightClose, 14);

// The pictures redraw once the tab rests this long (usePageThumbnails): never on every frame of a
// drag or every key typed, while the sidebar stays on screen beside the work.
const CONTENTS_SIDEBAR_SETTLE_MS = 250;
// The page in view is read once the view rests this long, not on every frame of a pan or a glide.
export const CONTENTS_FOLLOW_SETTLE_MS = 150;

export function PageContentsSidebar({
  view,
  tab,
  top,
  side,
  onMoveToSide,
  onMinimise,
}: {
  view: PagesModeView;
  tab: PageThumbTab;
  // Where it starts, in screen px from the canvas's top: below the Toolbar strip.
  top: number;
  // The side of the canvas it is pinned to, flush against the edge.
  side: ContentsSide;
  onMoveToSide: (side: ContentsSide) => void;
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
    return pageInView(
      view.pages,
      viewport.get(),
      { width: canvas.width, height: canvas.height },
      sideInsetsOf(canvas, restingRect(el)),
    );
  };
  const [here] = useState<string | undefined>(() => view.pages[0]?.id);
  const contents = usePageContents({
    view,
    tab,
    here,
    settleMs: CONTENTS_SIDEBAR_SETTLE_MS,
  });

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
  }, [viewport, side]);

  // Docking it (from the popover, opening the tab, moving it to the other side) frames the page in
  // view again beside it, so the page never sits under it.
  const reframe = useEffectEvent(() => {
    const id = readHere();
    if (id) view.focusPage(id);
  });
  useEffect(() => {
    const frame = requestAnimationFrame(reframe);
    return () => cancelAnimationFrame(frame);
  }, [side]);

  // Dragging the header carries the sidebar across: it follows the pointer, the side it would pin
  // to lit, and pins there on release.
  const [drag, setDrag] = useState<{ from: number; dx: number; to: ContentsSide } | null>(null);
  const sideAt = (clientX: number): ContentsSide => {
    const canvas = self.current?.offsetParent?.getBoundingClientRect();
    if (!canvas) return side;
    return clientX < canvas.left + canvas.width / 2 ? 'left' : 'right';
  };
  const MinimiseIcon = side === 'left' ? MinimiseLeftIcon : MinimiseRightIcon;

  return (
    <>
      {drag && drag.to !== side ? (
        <div
          aria-hidden
          data-contents-drop=""
          style={{ ...uiScaleStyle(scale), top: px(top), width: CONTENTS_SIDEBAR_WIDTH }}
          className={`pointer-events-none absolute bottom-0 z-[var(--z-panel)] border-2 border-dashed border-brand-400 bg-brand-500/10 ${
            drag.to === 'left' ? 'left-0 rounded-r-2xl' : 'right-0 rounded-l-2xl'
          }`}
        />
      ) : null}
      <aside
        ref={self}
        aria-label="Contents"
        data-contents-sidebar=""
        data-contents-side={side}
        data-page-contents=""
        data-tour-id="contents"
        onPointerDown={(e) => e.stopPropagation()}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
        style={{
          ...uiScaleStyle(scale),
          [side]: 0,
          top: px(top),
          width: CONTENTS_SIDEBAR_WIDTH,
          ...(drag ? { translate: `${px(drag.dx)}px 0` } : {}),
        }}
        // Opaque, flush against its side and down to the canvas's foot, so no page shows round or
        // through it.
        className={`pointer-events-auto absolute bottom-0 z-[var(--z-panel)] flex cursor-default flex-col overflow-hidden border-t border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 ${
          side === 'left'
            ? 'rounded-tr-2xl border-r shadow-[4px_0_16px_-8px_rgb(15_23_42/0.12)] motion-safe:starting:-translate-x-3'
            : 'rounded-tl-2xl border-l shadow-[-4px_0_16px_-8px_rgb(15_23_42/0.12)] motion-safe:starting:translate-x-3'
        } ${drag ? 'opacity-90 shadow-xl' : 'motion-safe:transition-[opacity,translate] motion-safe:duration-200 motion-safe:ease-out motion-safe:starting:opacity-0'}`}
      >
        <div
          data-contents-handle=""
          onPointerDown={(e) => {
            if (e.button !== 0 || (e.target as HTMLElement).closest('button')) return;
            e.currentTarget.setPointerCapture(e.pointerId);
            setDrag({ from: e.clientX, dx: 0, to: side });
          }}
          onPointerMove={(e) => {
            if (!drag) return;
            setDrag({ ...drag, dx: e.clientX - drag.from, to: sideAt(e.clientX) });
          }}
          onPointerUp={(e) => {
            if (!drag) return;
            const to = sideAt(e.clientX);
            setDrag(null);
            if (to !== side) onMoveToSide(to);
          }}
          onPointerCancel={() => setDrag(null)}
          className={`flex touch-none items-center gap-2 px-3 pb-2 pt-2.5 ${drag ? 'cursor-grabbing' : 'cursor-grab'}`}
        >
          <span
            aria-hidden
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300"
          >
            <ContentsIcon />
          </span>
          <h2 className="min-w-0 truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
            Contents
          </h2>
          <span className="ml-auto flex items-center gap-0.5">
            <HoverCard title="Minimise" description="Tuck Contents into its button, bottom right.">
              <button
                type="button"
                onClick={() => {
                  // The page in view, framed again across the whole canvas once the sidebar has gone.
                  const id = readHere();
                  onMinimise();
                  if (id)
                    requestAnimationFrame(() => requestAnimationFrame(() => view.focusPage(id)));
                }}
                aria-label="Minimise Contents"
                data-contents-minimise=""
                className={HEADER_BUTTON}
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
        <ContentsAddPage contents={contents} />
      </aside>
    </>
  );
}

const HEADER_BUTTON =
  'relative flex h-6 w-6 touch-target items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 focus-visible:outline-2 focus-visible:outline-brand-600 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100';
