// The cards a face's take skipped (useFaceFinishPass's offScreenCard: a busy board's card the browser is not drawing),
// watched until they come into view (docs/specs/026-plan/plan-board.md "Marker draws what is in view"). A card that
// scrolls into view changes nothing in the DOM, so the settle watch never hears it: without this it kept its plain
// line until the next edit. One IntersectionObserver watches only the skipped cards, so scrolling costs nothing until
// one of them crosses into view; arrivals then re-take once they pause, never on every frame of the scroll.
import {
  SKETCH_INK_MAX_WAIT_MS,
  SKETCH_INK_SETTLE_MS,
} from '@liveworkspace/workbench/components/canvas/settle-watch';

export type FaceArrivals = {
  /** Watches these cards (the last take's skipped ones) in place of the ones watched before. */
  watch: (cards: readonly Element[]) => void;
  stop: () => void;
};

/** Calls `arrive` once skipped cards have come into view and the arrivals have paused (SKETCH_INK_SETTLE_MS after the
 *  last, at most SKETCH_INK_MAX_WAIT_MS after the first). */
export function watchFaceArrivals(arrive: () => void): FaceArrivals {
  if (typeof IntersectionObserver === 'undefined') return { watch: () => {}, stop: () => {} };
  // A card counts once per arrival: one the next take still skips in view (the browser not drawing it yet) is not
  // counted again until it has left the view, so a take never follows a take in a loop.
  const arrived = new WeakSet<Element>();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let since = 0;
  const schedule = () => {
    const now = Date.now();
    if (!since) since = now;
    if (timer) clearTimeout(timer);
    timer = setTimeout(
      () => {
        timer = undefined;
        since = 0;
        arrive();
      },
      Math.max(0, Math.min(SKETCH_INK_SETTLE_MS, SKETCH_INK_MAX_WAIT_MS - (now - since))),
    );
  };
  // The implicit root: the view, clipped by the board's own scroll box. Made on the first card to watch, so a face that
  // never skips one (every face but a busy board) holds no observer.
  let observer: IntersectionObserver | undefined;
  const seen = (entries: IntersectionObserverEntry[]) => {
    let any = false;
    for (const entry of entries) {
      if (!entry.isIntersecting) arrived.delete(entry.target);
      else if (!arrived.has(entry.target)) {
        arrived.add(entry.target);
        any = true;
      }
    }
    if (any) schedule();
  };
  return {
    watch: (cards) => {
      observer?.disconnect();
      if (!cards.length) return;
      observer ??= new IntersectionObserver(seen);
      for (const card of cards) observer.observe(card);
    },
    stop: () => {
      observer?.disconnect();
      if (timer) clearTimeout(timer);
      timer = undefined;
    },
  };
}
