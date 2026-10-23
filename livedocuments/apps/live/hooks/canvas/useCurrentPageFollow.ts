'use client';

// The page someone is on in Pages mode (docs/specs/007-editor/pages-mode.md "The palette's kind"),
// followed for the palette, whose kind is that page's (lib/palette-kind.ts), and for Select All
// (lib/current-page-kind.ts). They move onto a page when they go to it with its label or the page
// navigator (`pageShown`), press on a page other than the page pressed last, add one, or bring the
// view to rest on it (a pan, a scroll, a zoom); on opening, the page in view is the one they are
// on.
import { useEffect, useRef } from 'react';
import { pageKindOf, type LaidOutPage, type PageKind } from '@livedocuments/document';
import { setCurrentPageKind } from '@/lib/current-page-kind';
import { CANVAS_ROOT_SELECTOR } from '@/lib/canvas-selectors';
import { useViewportStoreIfAny } from '@/hooks/canvas/useViewportStore';

// How long the view rests before the page under its centre counts as the page someone is on.
const VIEW_FOLLOW_SETTLE_MS = 250;

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

export function useCurrentPageFollow(
  pages: readonly LaidOutPage[],
  active: boolean,
): { pageShown: (page: LaidOutPage) => void } {
  // The page someone was last on (pressed, gone to, or in view on opening), and its kind.
  const last = useRef<string | null>(null);
  const currentKind = useRef<PageKind | null>(null);
  const onPage = (page: LaidOutPage | null) => {
    // Off every page (the bare canvas) keeps the page last on, so coming back changes nothing.
    if (page) {
      last.current = page.id;
      currentKind.current = pageKindOf(page);
      setCurrentPageKind(currentKind.current, page.id);
    }
  };

  // The pages as now, for what runs later (a press, a view at rest).
  const latest = useRef(pages);
  useEffect(() => {
    latest.current = pages;
  });

  // A new page: one not here before (the first render with pages only records what is there, and
  // looks at the page in view).
  const known = useRef<Set<string> | null>(null);
  useEffect(() => {
    const before = known.current;
    known.current = pages.length ? new Set(pages.map((p) => p.id)) : null;
    if (!active || !pages.length) return;
    if (before === null) {
      onPage(pageInView(pages));
      return;
    }
    // A page added: the view goes to it, so the palette follows it.
    const added = pages.find((p) => !before.has(p.id));
    if (added) {
      onPage(added);
      return;
    }
    // The page someone is on changed kind in place (the first page's kind chosen keeps its id).
    const here = pages.find((p) => p.id === last.current);
    if (here && pageKindOf(here) !== currentKind.current) {
      currentKind.current = pageKindOf(here);
      setCurrentPageKind(currentKind.current, here.id);
    }
  }, [pages, active]);

  useEffect(() => {
    if (!active) return;
    const press = (e: PointerEvent) => {
      // Only a press on the canvas itself (its pages and elements, or the bare canvas), never the
      // palette or other chrome floating over a page.
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
