// When a hovered layout is drawn on its page (liveworkspace/docs/specs/011-workbench/page-layout-preview.md "It draws
// the tile the pointer settles on"; Work Tracker 1502, 1507): each preview places the layout and redraws the page, so a sweep
// across the tiles must not pay that for every tile it crosses. A pointer's tile is drawn once the pointer settles on
// it (LAYOUT_PREVIEW_SETTLE_MS without moving to another); a tile reached by keyboard at once; and either way at most
// once an animation frame. A newer ask always replaces one still waiting, so a sweep draws only its last tile.

// How long the pointer rests on a tile before it is drawn: under the ~100 ms a hover reads as immediate, over the
// ~50 ms a sweep spends crossing a tile.
export const LAYOUT_PREVIEW_SETTLE_MS = 70;

// How a tile was reached: hovered by a pointer, or focused (the keyboard, or a press).
export type LayoutPreviewAsk = 'pointer' | 'focus';

export type PreviewSettle = {
  // Runs `run` once the ask settles, dropping any ask still waiting.
  ask: (how: LayoutPreviewAsk, run: () => void) => void;
  // Drops any ask still waiting.
  cancel: () => void;
};

export function createPreviewSettle(): PreviewSettle {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let frame: number | null = null;
  const cancel = () => {
    if (timer !== null) clearTimeout(timer);
    if (frame !== null) cancelAnimationFrame(frame);
    timer = null;
    frame = null;
  };
  const inFrame = (run: () => void) => {
    frame = requestAnimationFrame(() => {
      frame = null;
      run();
    });
  };
  return {
    ask: (how, run) => {
      cancel();
      if (how === 'focus') {
        inFrame(run);
        return;
      }
      timer = setTimeout(() => {
        timer = null;
        inFrame(run);
      }, LAYOUT_PREVIEW_SETTLE_MS);
    },
    cancel,
  };
}
