// Calls `onMove` when an element moves on screen without resizing (docs/specs/007-editor/toolbar-layout.md "Layout
// details"): a toolbar centred in a row shifts when something beside it changes width (the header's tab-name pill, a
// tab switch, the strip going crowded and back), and no ResizeObserver hears that. One IntersectionObserver watches a
// root margin cut to the element's own box: while it stays put it is wholly inside, and a move of a pixel or more
// takes part of it outside, which the observer reports. Nothing runs while it is still: no timer, no frame loop, no
// layout read. After each move the margin is cut afresh to the new box (two rect reads).
export function watchMove(el: Element, onMove: () => void): () => void {
  if (typeof IntersectionObserver === 'undefined') return () => {};
  let observer: IntersectionObserver | null = null;
  const stop = () => {
    observer?.disconnect();
    observer = null;
  };
  const start = (threshold: number) => {
    stop();
    const r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) return;
    const root = document.documentElement;
    const inset = (v: number) => `${-Math.floor(v)}px`;
    const rootMargin = [
      inset(r.top),
      inset(root.clientWidth - r.right),
      inset(root.clientHeight - r.bottom),
      inset(r.left),
    ].join(' ');
    let first = true;
    observer = new IntersectionObserver(
      (entries) => {
        const ratio = entries[entries.length - 1]!.intersectionRatio;
        if (first) {
          first = false;
          // A box on a fraction of a pixel, or partly off screen, never reads wholly inside: its own first ratio is
          // the still state to watch from (once: a second first read is taken as it is).
          if (ratio !== threshold && threshold === 1) start(Math.max(ratio, 1e-7));
          return;
        }
        onMove();
        start(1);
      },
      { root: document, rootMargin, threshold },
    );
    observer.observe(el);
  };
  start(1);
  return stop;
}
