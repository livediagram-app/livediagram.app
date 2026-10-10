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

// The header band (docs/specs/026-plan/plan-board.md "Maximised board", "The header holds the top row"): when the
// top row leaves room beside it, the element starts at the canvas's top and its header grows to the row's height, the
// menu and the palette strip floating inside it. In px from the element's box (inside the cover's padding): the
// header's height, where its content starts (after the menu), and how wide that content may run (to the strip).
// `stripEnd`: how far the strip's right edge sits from the canvas's right edge, in screen px (the strip moves there).
export type HeaderBand = { height: number; left: number; mid: number; stripEnd: number };

// The cover's padding around the element on a desktop (CanvasCover's sm:p-3); a band is only laid out that wide.
export const COVER_PAD_PX = 12;
// The room the header's content keeps from the menu and the strip.
export const BAND_GAP_PX = 12;
// The least room the band needs for a title (its widgets truncating) between the menu and the strip; and the room the
// header's own controls (a Gantt's scale and window, Restore, the cog) are given before they are measured.
export const BAND_MID_MIN_PX = 140;
export const BAND_RIGHT_MIN_PX = 280;
// Below this canvas width the cover's padding is a phone's (p-2) and the strip holds the menu: no band.
export const BAND_CANVAS_MIN_PX = 640;

// The band for `canvas` with the menu and strip where they are, given the element's side insets; null when the menu
// is missing, the menu or strip is not in the top row, or they leave too little room (the element then starts below
// the row). The strip moves to the header's right end, BAND_GAP_PX before the element's controls (`endWidth`: the
// controls card and the header's right padding, BAND_RIGHT_MIN_PX until measured), so only its width and height count,
// never where it is now: moving it cannot take the band away. No strip (the palette hidden or absent): the header holds
// the menu alone. `nameWidth` is the element's name riding in the menu box (docs/specs/026-plan/plan-board.md "The
// name rides in the menu box"): the room is judged from the box without it, so the name coming or going never takes
// the band away, while the content still starts after the box as it is.
export function headerBand(
  canvas: Box,
  insets: Pick<LayerInsets, 'left' | 'right'>,
  menu: Box | null,
  strip: Box | null,
  nameWidth = 0,
  endWidth = BAND_RIGHT_MIN_PX,
): HeaderBand | null {
  if (!menu || canvas.right - canvas.left < BAND_CANVAS_MIN_PX) return null;
  const half = canvas.top + (canvas.bottom - canvas.top) / 2;
  const baseRight = menu.right - Math.max(0, nameWidth);
  // A strip starting before the menu ends holds the menu (a phone).
  if (menu.top > half || (strip && (strip.top > half || strip.left < menu.left))) return null;
  const left = canvas.left + insets.left + COVER_PAD_PX;
  const right = canvas.right - insets.right - COVER_PAD_PX;
  const top = canvas.top + COVER_PAD_PX;
  if (menu.left < left) return null;
  // Where the strip's right edge goes, and its left edge then.
  const stripRight = right - Math.max(0, endWidth) - BAND_GAP_PX;
  const end = strip ? stripRight - (strip.right - strip.left) : stripRight;
  if (end - baseRight - 2 * BAND_GAP_PX < BAND_MID_MIN_PX) return null;
  return {
    height: Math.round(Math.max(menu.bottom, strip?.bottom ?? menu.bottom) - top),
    left: Math.round(menu.right - left + BAND_GAP_PX),
    mid: Math.max(0, Math.round(end - BAND_GAP_PX - menu.right - BAND_GAP_PX)),
    stripEnd: Math.round(canvas.right - stripRight),
  };
}

// Where a maximised or tab-filling element sits: its insets, and its header band when there is room for one (the
// top inset is then 0: the header holds the top row).
export type CanvasLayout = { insets: LayerInsets; band: HeaderBand | null };
export const NO_LAYOUT: CanvasLayout = { insets: NO_INSETS, band: null };

const STRIP_SELECTOR = '[data-toolbar-palette]:not(.hidden)';
// The menu box's slot for the element's name (MenuNameSlot).
export const MENU_NAME_SLOT_SELECTOR = '[data-menu-name-slot]';
// A covering element's header controls (band-controls.ts), the only ones measured.
export const BAND_CONTROLS_SELECTOR = '[data-canvas-cover] [data-band-controls]';

// The box round what `el` holds (its children that take up room), or null when it holds nothing shown.
function unionOfChildren(el: HTMLElement): Box | null {
  let out: Box | null = null;
  for (const child of el.children) {
    const b = child.getBoundingClientRect();
    if (b.width <= 0 || b.height <= 0) continue;
    out = out
      ? {
          left: Math.min(out.left, b.left),
          top: Math.min(out.top, b.top),
          right: Math.max(out.right, b.right),
          bottom: Math.max(out.bottom, b.bottom),
        }
      : { left: b.left, top: b.top, right: b.right, bottom: b.bottom };
  }
  return out;
}

// The chrome over `canvas` now, read off the screen.
export function measureCanvasChrome(canvas: HTMLElement): CanvasLayout {
  const boxes: ChromeBox[] = [];
  const read = (selector: string, kind: ChromeBox['kind']) => {
    for (const el of document.querySelectorAll<HTMLElement>(selector)) {
      if (getComputedStyle(el).visibility === 'hidden') continue;
      boxes.push({ kind, box: el.getBoundingClientRect() });
    }
  };
  read(TOP_ROW_SELECTOR, 'top');
  read(PANEL_SELECTOR, 'panel');
  const area = canvas.getBoundingClientRect();
  const insets = layerInsets(area, boxes, topStripInset(canvas));
  const shown = (selector: string) => {
    const el = document.querySelector<HTMLElement>(selector);
    return el && getComputedStyle(el).visibility !== 'hidden' ? el : null;
  };
  const menuEl = shown(TOP_ROW_SELECTOR);
  const menu = menuEl?.getBoundingClientRect() ?? null;
  // The element's name riding in the menu box, left out of the room the band needs.
  const name = menuEl?.querySelector<HTMLElement>(MENU_NAME_SLOT_SELECTOR);
  const nameWidth = name ? name.getBoundingClientRect().width : 0;
  // The strip's root runs the canvas's width to centre it: the strip is what it holds (on a phone, the menu too).
  const strip = shown(STRIP_SELECTOR);
  // The covering element's controls card (BAND_CONTROLS_SELECTOR) and its header's right padding: what the strip stops
  // short of. offsetWidth, so a maximise's grow (a transform) does not shrink it.
  const controls = canvas.querySelector<HTMLElement>(BAND_CONTROLS_SELECTOR);
  const endWidth = controls
    ? controls.offsetWidth +
      (controls.parentElement
        ? parseFloat(getComputedStyle(controls.parentElement).paddingRight) || 0
        : 0)
    : BAND_RIGHT_MIN_PX;
  const band = headerBand(
    area,
    insets,
    menu,
    strip ? unionOfChildren(strip) : null,
    nameWidth,
    endWidth,
  );
  return { insets: band ? { ...insets, top: 0 } : insets, band };
}

export function sameLayout(a: CanvasLayout, b: CanvasLayout): boolean {
  return (
    sameInsets(a.insets, b.insets) &&
    (a.band === b.band ||
      (!!a.band &&
        !!b.band &&
        a.band.height === b.band.height &&
        a.band.left === b.band.left &&
        a.band.mid === b.band.mid &&
        a.band.stripEnd === b.band.stripEnd))
  );
}

export function sameInsets(a: LayerInsets, b: LayerInsets): boolean {
  return a.top === b.top && a.right === b.right && a.bottom === b.bottom && a.left === b.left;
}
