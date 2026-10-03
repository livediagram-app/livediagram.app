// Infographic mode draws only on the page (docs/specs/007-editor/editor-modes.md "The page"): a
// draw, tap-to-place or double-click-to-add that starts on the surround is swallowed. Elements
// already on the canvas move freely; only making something new is confined to the page.
import type { RefObject } from 'react';
import { isOnInfographicPage } from '@livediagram/document';
import { pointerToCanvas } from '@/lib/canvas';
import { debugLog } from '@/lib/debug-log';
import type { InfographicPageView } from '@/hooks/editor/useInfographicPage';

/** True when Infographic mode's page is up and the press lands off it. */
export function pressIsOffPage(
  page: InfographicPageView | null | undefined,
  press: { clientX: number; clientY: number },
  wrapperRef: RefObject<HTMLElement | null>,
  zoom: number,
): boolean {
  if (!page) return false;
  const rect = wrapperRef.current?.getBoundingClientRect();
  if (!rect) return false;
  const at = pointerToCanvas(press.clientX, press.clientY, rect, zoom);
  const off = !isOnInfographicPage(page.orientation, at);
  if (off) debugLog('[infographic-page] press off the page ignored', at);
  return off;
}
