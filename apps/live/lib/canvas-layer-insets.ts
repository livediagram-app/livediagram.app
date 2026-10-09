// Where a maximised or tab-filling Plan element sits in the canvas area (docs/specs/026-plan/plan-board.md "Maximised
// board", "Fill Tab"): clear of the editor's chrome laid over the canvas, measured from that chrome as it is now. The
// top row (the palette strip, topStripInset's, and the menu button with the mode menu) pushes the top down; a layout
// panel (a MovablePanel marked `layoutChrome`; never a passing one like the Trash) pushes its side in; a sheet across
// the canvas pushes the top or bottom. The bottom-right controls are not measured: they float
// over the element, which runs down to the canvas's foot. Pure but for `measureCanvasChrome`, which reads the DOM.
import { topStripInset } from './top-strip-inset';

export type LayerInsets = { top: number; right: number; bottom: number; left: number };
export const NO_INSETS: LayerInsets = { top: 0, right: 0, bottom: 0, left: 0 };

type Box = { left: number; top: number; right: number; bottom: number };
export type ChromeBox = { kind: 'top' | 'panel' | 'bottom'; box: Box };

// The top row's menu button and mode menu (ToolbarExplorerButton); the strip itself is read by topStripInset.
export const TOP_ROW_SELECTOR = '[data-toolbar-menu]';
// The panels that are part of the layout (MovablePanel `layoutChrome`). The editor has none since the Palette and the
// Explorer became the strip and a popover (docs/specs/007-editor/toolbar-layout.md); the rule stays for a panel that
// joins the layout. A panel opened for a moment (the Trash, the item panel, a card search) is not one: it floats
// over the board, which never moves for it.
export const PANEL_SELECTOR = '[data-layout-chrome]';
// The bottom-right controls (undo, the dock, zoom) are not measured: they float over the element, which runs down
// to the canvas's foot.
// A panel wider than this share of the canvas is a sheet across it (a phone), not a side panel: it pushes the top or
// bottom instead. Half of the canvas plus a margin: no side panel is ever that wide on a desktop (they are 18-24rem).
export const WIDE_PANEL_SHARE = 0.6;
// At most this share of the canvas is given up on each axis, so the element always keeps most of the screen even
// with every panel open on a small one.
export const MAX_INSET_SHARE = 0.45;

// The insets for `canvas` given the chrome over it (boxes in screen px). Only chrome over the canvas counts.
export function layerInsets(
  canvas: Box,
  chrome: readonly ChromeBox[],
  stripInset = 0,
): LayerInsets {
  const width = canvas.right - canvas.left;
  const height = canvas.bottom - canvas.top;
  const out = { ...NO_INSETS, top: Math.max(0, stripInset) };
  for (const { kind, box } of chrome) {
    const over =
      box.right > canvas.left &&
      box.left < canvas.right &&
      box.bottom > canvas.top &&
      box.top < canvas.bottom &&
      box.right > box.left &&
      box.bottom > box.top;
    if (!over) continue;
    const midY = (box.top + box.bottom) / 2;
    const low = midY > canvas.top + height / 2;
    if (kind === 'top' && !low) out.top = Math.max(out.top, box.bottom - canvas.top);
    else if (
      kind === 'bottom' ||
      (kind === 'panel' && box.right - box.left > width * WIDE_PANEL_SHARE)
    ) {
      if (low) out.bottom = Math.max(out.bottom, canvas.bottom - box.top);
      else out.top = Math.max(out.top, box.bottom - canvas.top);
    } else if (kind === 'panel') {
      if (box.left - canvas.left <= canvas.right - box.right)
        out.left = Math.max(out.left, box.right - canvas.left);
      else out.right = Math.max(out.right, canvas.right - box.left);
    }
  }
  const cap = (v: number, of: number) => Math.round(Math.min(v, of * MAX_INSET_SHARE));
  return {
    top: cap(out.top, height),
    bottom: cap(out.bottom, height),
    left: cap(out.left, width),
    right: cap(out.right, width),
  };
}

// The chrome over `canvas` now, read off the screen.
export function measureCanvasChrome(canvas: HTMLElement): LayerInsets {
  const boxes: ChromeBox[] = [];
  const read = (selector: string, kind: ChromeBox['kind']) => {
    for (const el of document.querySelectorAll<HTMLElement>(selector)) {
      if (getComputedStyle(el).visibility === 'hidden') continue;
      boxes.push({ kind, box: el.getBoundingClientRect() });
    }
  };
  read(TOP_ROW_SELECTOR, 'top');
  read(PANEL_SELECTOR, 'panel');
  return layerInsets(canvas.getBoundingClientRect(), boxes, topStripInset(canvas));
}

export function sameInsets(a: LayerInsets, b: LayerInsets): boolean {
  return a.top === b.top && a.right === b.right && a.bottom === b.bottom && a.left === b.left;
}
