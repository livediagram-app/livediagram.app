// On This Page's jump (docs/specs/030-knowledgebase/page-surface.md "On This Page"): a page reads in its own scrolled
// column (`data-page-scroller`), not by panning the canvas, so a heading is brought to the top of that column, under
// the sticky top row with a little room. Smooth, or a jump under reduced motion.

/** Room left above the heading once it lands (px). */
export const HEADING_LANDING_GAP = 24;

/** The scrollTop that puts `heading` HEADING_LANDING_GAP below the column's top edge plus `topInset`, never below 0
 *  and never past the column's end. Pure. */
export function headingScrollTop(
  scroller: { scrollTop: number; scrollHeight: number; clientHeight: number; top: number },
  headingTop: number,
  topInset: number,
): number {
  const wanted = scroller.scrollTop + (headingTop - scroller.top) - topInset - HEADING_LANDING_GAP;
  const end = Math.max(0, scroller.scrollHeight - scroller.clientHeight);
  return Math.round(Math.min(end, Math.max(0, wanted)));
}

/** Scrolls the page's column to the heading; false when there is no column or no heading to scroll to. */
export function scrollToHeading(
  scroller: HTMLElement | null,
  heading: HTMLElement | null,
): boolean {
  if (!scroller || !heading) return false;
  const box = scroller.getBoundingClientRect();
  const inset = parseFloat(getComputedStyle(scroller).scrollPaddingTop) || 0;
  const top = headingScrollTop(
    {
      scrollTop: scroller.scrollTop,
      scrollHeight: scroller.scrollHeight,
      clientHeight: scroller.clientHeight,
      top: box.top,
    },
    heading.getBoundingClientRect().top,
    inset,
  );
  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  scroller.scrollTo({ top, behavior: reduced ? 'auto' : 'smooth' });
  return true;
}
