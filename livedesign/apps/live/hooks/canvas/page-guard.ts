// Pages mode draws only on its pages (docs/specs/007-editor/pages-mode.md "The pages"): a
// draw, tap-to-place or double-click-to-add that starts off every page is swallowed. Elements
// already on the canvas move freely; only making something new is confined to the pages.
import type { RefObject } from 'react';
import { pageAt } from '@livedesign/design';
import { pointerToCanvas } from '@/lib/canvas';
import { debugLog } from '@/lib/debug-log';
import type { PagesModeView } from '@/hooks/editor/usePagesMode';

/** True when Pages mode's pages are up and the press lands off all of them. */
export function pressIsOffPage(
  view: PagesModeView | null | undefined,
  press: { clientX: number; clientY: number },
  wrapperRef: RefObject<HTMLElement | null>,
  zoom: number,
): boolean {
  if (!view) return false;
  const rect = wrapperRef.current?.getBoundingClientRect();
  if (!rect) return false;
  const at = pointerToCanvas(press.clientX, press.clientY, rect, zoom);
  const off = !pageAt(view.pages, at);
  if (off) debugLog('[page] press off the pages ignored', at);
  return off;
}

/** The page a press lands on (its paper or anything on it), or null off every page. */
export function pageIdAtPress(
  view: PagesModeView | null | undefined,
  press: { clientX: number; clientY: number },
  wrapperRef: RefObject<HTMLElement | null>,
  zoom: number,
): string | null {
  if (!view) return null;
  const rect = wrapperRef.current?.getBoundingClientRect();
  if (!rect) return null;
  return pageAt(view.pages, pointerToCanvas(press.clientX, press.clientY, rect, zoom))?.id ?? null;
}
