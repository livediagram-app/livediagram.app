// What the animated GIF export leaves out of a page (docs/specs/020-import-export/animated-gif-export.md "What a
// frame shows"): the editor's own marks inside the canvas's content layer. A node carrying the attribute is dropped
// from the snapshot with everything in it; the selectors name the chrome that already has a marker of its own.
export const GIF_OMIT_ATTR = 'data-gif-omit';

export const GIF_OMIT_SELECTOR = [
  `[${GIF_OMIT_ATTR}]`,
  // Every selection grip, handle and the layer's own selection chrome (SelectionGripsLayer).
  '[data-selection-grips]',
  // Comment pins (indicator-items).
  '[data-comment-trigger]',
].join(',');
