// Infographic mode draws only on its pages (docs/specs/007-editor/editor-modes.md "The pages"): a
// draw, tap-to-place or double-click-to-add that starts off every page is swallowed. Elements
// already on the canvas move freely; only making something new is confined to the pages.
import type { RefObject } from 'react';
import { infographicPageAt } from '@livediagram/document';
import { pointerToCanvas } from '@/lib/canvas';
import { debugLog } from '@/lib/debug-log';
import type { InfographicPagesView } from '@/hooks/editor/useInfographicPage';

/** True when Infographic mode's pages are up and the press lands off all of them. */
export function pressIsOffPage(
  view: InfographicPagesView | null | undefined,
  press: { clientX: number; clientY: number },
  wrapperRef: RefObject<HTMLElement | null>,
  zoom: number,
): boolean {
  if (!view) return false;
  const rect = wrapperRef.current?.getBoundingClientRect();
  if (!rect) return false;
  const at = pointerToCanvas(press.clientX, press.clientY, rect, zoom);
  const off = !infographicPageAt(view.pages, at);
  if (off) debugLog('[infographic-page] press off the pages ignored', at);
  return off;
}
