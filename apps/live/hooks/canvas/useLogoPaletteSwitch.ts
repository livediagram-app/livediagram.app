'use client';

// The palette follows the page someone is on (docs/specs/007-editor/logo-pages.md "The Logo
// palette"): Logo on a logo page, Popular on any other. Asked when they move to another page: one
// gone to with its label or the page navigator (`pageShown`), a press on a page other than the page
// pressed last, and a logo page added; on opening, only a logo page in view asks (any other keeps
// the category remembered). Asked just after, so a palette re-rendered with the category (Logo shows
// only while the tab has a logo page) is there to answer. Staying on the same page never asks
// again, so another category chosen meanwhile is kept.
import { useEffect, useRef } from 'react';
import type { LaidOutPage } from '@livediagram/document';
import { requestPaletteCategory } from '@/lib/palette-category-request';

// After the current event (React has rendered the add by then); a timeout, not a frame, so a tab in
// the background still answers.
const ask = (category: 'logo' | 'popular') =>
  window.setTimeout(() => requestPaletteCategory(category), 0);
const askForLogo = () => ask('logo');
// On opening, asked again a little later too: the palette may mount after the pages.
export const LOGO_PALETTE_OPEN_RETRY_MS = 400;

const sheetRect = (pageId: string) =>
  document
    .querySelector(`[data-illustrate-page-id="${CSS.escape(pageId)}"]`)
    ?.getBoundingClientRect();

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
  const canvas = document.querySelector('[data-canvas-a11y-root]')?.getBoundingClientRect();
  const centred = canvas
    ? pageAtPoint(pages, canvas.left + canvas.width / 2, canvas.top + canvas.height / 2)
    : null;
  return centred ?? pages[0] ?? null;
}

export function useLogoPaletteSwitch(
  pages: readonly LaidOutPage[],
  active: boolean,
): { pageShown: (page: LaidOutPage) => void } {
  // The page someone was last on (pressed, gone to, or in view on opening).
  const last = useRef<string | null>(null);
  const onPage = (page: LaidOutPage | null, opening = false) => {
    if (page && page.id !== last.current) {
      if (page.kind === 'logo') askForLogo();
      else if (!opening) ask('popular');
    }
    // Off every page (the bare canvas) keeps the page last on, so coming back asks nothing.
    if (page) last.current = page.id;
  };

  // A new logo page: one not here before (the first render with pages only records what is there,
  // and looks at the page in view).
  const known = useRef<Set<string> | null>(null);
  useEffect(() => {
    const logos = pages.filter((p) => p.kind === 'logo').map((p) => p.id);
    const before = known.current;
    known.current = pages.length ? new Set(logos) : null;
    if (!active || !pages.length) return;
    if (before === null) {
      const opened = pageInView(pages);
      onPage(opened, true);
      if (opened?.kind === 'logo')
        window.setTimeout(() => requestPaletteCategory('logo'), LOGO_PALETTE_OPEN_RETRY_MS);
      return;
    }
    if (logos.some((id) => !before.has(id))) askForLogo();
  }, [pages, active]);

  const latest = useRef(pages);
  useEffect(() => {
    latest.current = pages;
  });
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

  return { pageShown: (page) => active && onPage(page) };
}
