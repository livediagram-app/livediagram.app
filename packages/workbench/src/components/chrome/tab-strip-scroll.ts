// The tab strip's scroll that brings the active tab into view (docs/specs/007-editor/editor-app.md "Tabs"): the
// least movement that shows all of it, `pad` px clear of the strip's edges; unchanged when it already shows. Rects
// are on-screen (getBoundingClientRect), the result a scrollLeft.

// The strip's edge fade while a scroll button shows (edgeMask): clear under the button, then rising to full over
// this span, so a tab's text has faded out before it reaches the button. The button sits 4 to 32px in.
export const TAB_FADE_CLEAR = 24;
export const TAB_FADE_FULL = 44;

// A revealed tab stops this far in, clear of the fade and its button, so it is never half hidden. At 8px a tapped tab
// on a phone stopped inside the old fade and read as still behind the edge.
export const TAB_REVEAL_PAD = 48;

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

// Which of the strip's edges have tabs beyond them, so a scroll button shows over that edge alone. A pixel of slack
// absorbs fractional widths, which left a right button showing at the very end of the row.
export function scrollEdges(strip: {
  scrollLeft: number;
  clientWidth: number;
  scrollWidth: number;
}): {
  left: boolean;
  right: boolean;
} {
  return {
    left: strip.scrollLeft > 1,
    right: strip.scrollLeft + strip.clientWidth < strip.scrollWidth - 1,
  };
}

// Where a scroll button's click takes the strip: about one strip width on, less the pads, stopping on the edge of
// the tab that would straddle the far side so none is left half hidden under the other button. A tab wider than
// the page moves a full page. `items` are the tabs and folder chips, on screen (getBoundingClientRect).
export function pageScrollLeft(
  direction: 'left' | 'right',
  strip: { left: number; width: number; scrollLeft: number; scrollWidth: number },
  items: readonly { left: number; right: number }[],
  pad = TAB_REVEAL_PAD,
): number {
  const { scrollLeft, width } = strip;
  const max = Math.max(0, strip.scrollWidth - width);
  const page = Math.max(width - 2 * pad, width / 2);
  const inContent = (x: number) => x - strip.left + scrollLeft;
  let to: number;
  if (direction === 'right') {
    to = scrollLeft + page;
    // The line the next view's first whole tab must start after.
    const line = to + pad;
    const cut = items.find((i) => inContent(i.left) < line && inContent(i.right) > line);
    if (cut && inContent(cut.left) - pad > scrollLeft) to = inContent(cut.left) - pad;
  } else {
    to = scrollLeft - page;
    const line = to + width - pad;
    const cut = items.find((i) => inContent(i.left) < line && inContent(i.right) > line);
    if (cut && inContent(cut.right) + pad - width < scrollLeft)
      to = inContent(cut.right) + pad - width;
  }
  return Math.min(max, Math.max(0, to));
}

// The strip's mask: each edge with tabs beyond it fades out under its scroll button; an edge with nothing beyond
// stays sharp, and a row that fits has no mask at all. Driven by scrollEdges, so it costs one style change when an
// edge turns, and works in every browser (the CSS scroll-edge-fade needs scroll-driven animations).
export function edgeMask(edges: { left: boolean; right: boolean }): string | undefined {
  if (!edges.left && !edges.right) return undefined;
  const start = edges.left ? `transparent ${TAB_FADE_CLEAR}px, #000 ${TAB_FADE_FULL}px` : '#000 0';
  const end = edges.right
    ? `#000 calc(100% - ${TAB_FADE_FULL}px), transparent calc(100% - ${TAB_FADE_CLEAR}px)`
    : '#000 100%';
  return `linear-gradient(to right, ${start}, ${end})`;
}
