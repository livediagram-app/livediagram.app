// The keys that scroll a page when the focus is on the page itself, not in its writing or a field
// (docs/specs/030-knowledgebase/page-surface.md "A reading column"): what a web page's own keys do. Inside the
// writing the browser moves the caret and scrolls it into view by itself.

/** Screen px one arrow key moves the page: about three lines. */
export const PAGE_ARROW_STEP = 72;
/** The share of the window a Page Down or a Space moves: a line or two of the last screen stays in sight. */
export const PAGE_STEP_SHARE = 0.88;

export type PageScroll = { to: 'top' | 'bottom' } | { by: number };

/** What a key scrolls, or null for a key that is not a scroll key. `height` is the scrolled window's own. */
export function pageScrollOf(key: string, shift: boolean, height: number): PageScroll | null {
  const page = Math.max(PAGE_ARROW_STEP, Math.round(height * PAGE_STEP_SHARE));
  switch (key) {
    case 'PageDown':
      return { by: page };
    case 'PageUp':
      return { by: -page };
    case ' ':
      return { by: shift ? -page : page };
    case 'Home':
      return { to: 'top' };
    case 'End':
      return { to: 'bottom' };
    case 'ArrowDown':
      return { by: PAGE_ARROW_STEP };
    case 'ArrowUp':
      return { by: -PAGE_ARROW_STEP };
    default:
      return null;
  }
}
