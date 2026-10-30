// The tab strip's scroll that brings the active tab into view (docs/specs/007-editor/editor-app.md "Tabs"): the
// least movement that shows all of it, `pad` px clear of the strip's edges; unchanged when it already shows. Rects
// are on-screen (getBoundingClientRect), the result a scrollLeft.

// Clear of the strip's 20px edge fade (scroll-edge-fade.css), so a revealed tab is never half faded out. At 8px a
// tapped tab on a phone stopped inside the fade and read as still behind the edge.
export const TAB_REVEAL_PAD = 28;

export function scrollLeftToReveal(
  strip: { left: number; right: number; scrollLeft: number },
  tab: { left: number; right: number },
  pad = TAB_REVEAL_PAD,
): number {
  if (tab.left < strip.left + pad)
    return Math.max(0, strip.scrollLeft - (strip.left + pad - tab.left));
  if (tab.right > strip.right - pad) return strip.scrollLeft + (tab.right - (strip.right - pad));
  return strip.scrollLeft;
}
