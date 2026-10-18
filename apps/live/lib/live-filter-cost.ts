// Whether this browser runs a live SVG reference filter (`filter: url(#...)`) again on every repaint
// (docs/specs/008-canvas/finish.md "In WebKit"). WebKit does: Safari and every browser on an iPhone or iPad. A Sketch
// pan there repainted the wobble each frame (220-400 ms frames at iPhone resolution), where Chromium caches it. So
// the canvas draws the wobble once into still pictures there, or leaves it out.
//
// `GestureEvent` is WebKit's own (macOS and iOS); Chromium, Firefox and jsdom have none. `navigator.vendor` would not
// do: jsdom answers "Apple Computer, Inc." too.
export function liveFiltersRedrawOnRepaint(): boolean {
  return typeof window !== 'undefined' && 'GestureEvent' in window;
}
