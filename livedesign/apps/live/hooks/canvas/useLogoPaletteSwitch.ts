'use client';

// The palette follows the page someone is on (docs/specs/007-editor/logo-pages.md "The Logo
// palette"): Logo on a logo page, Popular on any other. Asked when they move to another page: one
// gone to with its label or the page navigator (`pageShown`), a press on a page other than the page
// pressed last, and a logo page added; on opening, only a logo page in view asks (any other keeps
// the category remembered). Asked just after, so a palette re-rendered with the category (Logo shows
// only while the tab has a logo page) is there to answer. A view that comes to rest on another page
// (a pan, a scroll, a zoom) moves onto it too. Staying on the same page never asks again, so another
// category chosen meanwhile is kept.
import { useEffect, useRef } from 'react';
import { pageKindOf, type LaidOutPage, type PageKind } from '@livedesign/design';
import { requestPaletteCategory } from '@/lib/palette-category-request';
import { setCurrentPageKind } from '@/lib/current-page-kind';
import { PALETTE_KIND_LANDING, paletteKindForPage } from '@/lib/palette-kind';
import { CANVAS_ROOT_SELECTOR } from '@liveworkspace/workbench/lib/canvas-selectors';
import { useViewportStoreIfAny } from '@liveworkspace/workbench/hooks/canvas/useViewportStore';

// After the current event (React has rendered the add by then); a timeout, not a frame, so a tab in
// the background still answers.
const ask = (category: string) => window.setTimeout(() => requestPaletteCategory(category), 0);
// A page kind whose palette opens on its own category (lib/palette-kind.ts PALETTE_KIND_LANDING):
// Draw on a logo page, Elements on a wireframe page.
const ownCategory = (page: Pick<LaidOutPage, 'kind'>): string | null => {
  const landing = PALETTE_KIND_LANDING[paletteKindForPage(pageKindOf(page))];
  return landing === 'popular' ? null : landing;
};
// How long the view rests before the page under its centre counts as the page someone is on.
const VIEW_FOLLOW_SETTLE_MS = 250;
// On opening, asked again a little later too: the palette may mount after the pages.
const LOGO_PALETTE_OPEN_RETRY_MS = 400;

const sheetRect = (pageId: string) =>
  document.querySelector(`[data-page-id="${CSS.escape(pageId)}"]`)?.getBoundingClientRect();

// A press target on the canvas: inside its content layer, or the bare canvas itself.
function onCanvas(target: EventTarget | null): boolean {
  const el = target as Element | null;
  if (!el?.closest) return false;
  return !!el.closest('[data-canvas-content]') || el.hasAttribute('data-canvas-a11y-root');
}

// The page whose sheet holds the screen point, if any.
function pageAtPoint(pages: readonly LaidOutPage[], x: number, y: number): LaidOutPage | null {
  for (const page of pages) {
    const r = sheetRect(page.id);
    if (r && x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return page;
  }
  return null;
}

// The page in view: the one under the canvas's centre, else the first.
function pageInView(pages: readonly LaidOutPage[]): LaidOutPage | null {
  const canvas = document.querySelector(CANVAS_ROOT_SELECTOR)?.getBoundingClientRect();
  const centred = canvas
    ? pageAtPoint(pages, canvas.left + canvas.width / 2, canvas.top + canvas.height / 2)
    : null;
  return centred ?? pages[0] ?? null;
}

export function useLogoPaletteSwitch(
  pages: readonly LaidOutPage[],
  active: boolean,
): { pageShown: (page: LaidOutPage) => void } {
  // The page someone was last on (pressed, gone to, or in view on opening), and its kind.
  const last = useRef<string | null>(null);
  const currentKind = useRef<PageKind | null>(null);
  const onPage = (page: LaidOutPage | null, opening = false) => {
    if (page && page.id !== last.current) {
      const own = ownCategory(page);
      if (own) ask(own);
      else if (!opening) ask('popular');
    }
    // Off every page (the bare canvas) keeps the page last on, so coming back asks nothing.
    if (page) {
      last.current = page.id;
      currentKind.current = pageKindOf(page);
      setCurrentPageKind(currentKind.current, page.id);
    }
  };

  // The pages as now, for what runs later (a press, a view at rest, the opening's second look).
  const latest = useRef(pages);
  useEffect(() => {
    latest.current = pages;
  });

  // A new logo page: one not here before (the first render with pages only records what is there,
  // and looks at the page in view).
  const known = useRef<Set<string> | null>(null);
  useEffect(() => {
    const before = known.current;
    known.current = pages.length ? new Set(pages.map((p) => p.id)) : null;
    if (!active || !pages.length) return;
    if (before === null) {
      const opened = pageInView(pages);
      onPage(opened, true);
      const own = opened && ownCategory(opened);
      // A little later, the page in view again (the view may have framed the page last on after
      // opening) and its category again (the palette may mount after the pages).
      // Only while nothing has moved them on meanwhile (a page added, a press, a page gone to).
      const openedId = opened?.id ?? null;
      window.setTimeout(() => {
        if (last.current !== openedId) return;
        const again = pageInView(latest.current);
        if (again && again.id !== openedId) onPage(again);
        else if (own) requestPaletteCategory(own);
      }, LOGO_PALETTE_OPEN_RETRY_MS);
      return;
    }
    // A page added: the view goes to it, so the palette follows it (to Logo or Wireframe, or back
    // to Popular from one).
    const added = pages.find((p) => !before.has(p.id));
    if (added) {
      onPage(added);
      return;
    }
    // The page someone is on changed kind in place (the first page chosen as a wireframe keeps its
    // id): the palette follows it as if they had just moved onto it.
    const here = pages.find((p) => p.id === last.current);
    if (here && pageKindOf(here) !== currentKind.current) {
      const own = ownCategory(here);
      if (own) ask(own);
      currentKind.current = pageKindOf(here);
      setCurrentPageKind(currentKind.current, here.id);
    }
  }, [pages, active]);

  useEffect(() => {
    if (!active) return;
    const press = (e: PointerEvent) => {
      // Only a press on the canvas itself (its pages and elements, or the bare canvas), never the
      // palette or other chrome floating over a page, which would undo a category just chosen.
      if (!onCanvas(e.target)) return;
      onPage(pageAtPoint(latest.current, e.clientX, e.clientY));
    };
    window.addEventListener('pointerdown', press, true);
    return () => window.removeEventListener('pointerdown', press, true);
  }, [active]);

  // A view that moves onto another page (a pan, a scroll, a zoom) is a page moved onto too, once
  // it rests: the page under the canvas's centre, if any (between pages keeps the last one).
  const viewport = useViewportStoreIfAny();
  useEffect(() => {
    if (!active || !viewport) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const off = viewport.subscribe(() => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        const canvas = document.querySelector(CANVAS_ROOT_SELECTOR)?.getBoundingClientRect();
        if (!canvas) return;
        const here = pageAtPoint(
          latest.current,
          canvas.left + canvas.width / 2,
          canvas.top + canvas.height / 2,
        );
        if (here) onPage(here);
      }, VIEW_FOLLOW_SETTLE_MS);
    });
    return () => {
      clearTimeout(timer);
      off();
    };
  }, [active, viewport]);

  return { pageShown: (page) => active && onPage(page) };
}
