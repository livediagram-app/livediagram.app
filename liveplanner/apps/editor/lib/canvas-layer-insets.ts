// Where a maximised or tab-filling Plan element sits in the canvas area (docs/specs/026-plan/plan-board.md "Maximised
// board", "Fill Tab"): clear of the editor's chrome laid over the canvas, measured from that chrome as it is now. The
// top row (the palette strip, topStripInset's, and the menu button with the mode menu) pushes the top down; a layout
// panel (a MovablePanel marked `layoutChrome`; never a passing one like the Trash) pushes its side in; a sheet across
// the canvas pushes the top or bottom. The bottom-right controls are not measured: they float
// over the element, which runs down to the canvas's foot. Pure but for `measureCanvasChrome`, which reads the DOM.
import { topStripInset } from './top-strip-inset';

export type LayerInsets = { top: number; right: number; bottom: number; left: number };
const NO_INSETS: LayerInsets = { top: 0, right: 0, bottom: 0, left: 0 };

type Box = { left: number; top: number; right: number; bottom: number };
type ChromeBox = { kind: 'top' | 'panel' | 'bottom'; box: Box };

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
const WIDE_PANEL_SHARE = 0.6;
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
const COVER_PAD_PX = 12;
// The room the header's content keeps from the menu and the strip.
const BAND_GAP_PX = 12;
// The least room the band needs for a title (its widgets truncating) between the menu and the strip; and the room the
// header's own controls (a Gantt's scale and window, Restore, the cog) are given before they are measured.
export const BAND_MID_MIN_PX = 140;
export const BAND_RIGHT_MIN_PX = 280;
// Below this canvas width the cover's padding is a phone's (p-2) and the strip holds the menu: no band.
const BAND_CANVAS_MIN_PX = 640;

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
  // More room the band must leave before it comes (widgetsToCome); once it has come, nothing more.
  entryWidth = 0,
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
  if (end - Math.max(0, entryWidth) - baseRight - 2 * BAND_GAP_PX < BAND_MID_MIN_PX) return null;
  return {
    height: Math.round(Math.max(menu.bottom, strip?.bottom ?? menu.bottom) - top),
    left: Math.round(menu.right - left + BAND_GAP_PX),
    mid: Math.max(0, Math.round(end - BAND_GAP_PX - menu.right - BAND_GAP_PX)),
    stripEnd: Math.round(canvas.right - stripRight),
  };
}

// The top row shared on a phone (docs/specs/026-plan/plan-board.md "The header holds the top row"): below
// BAND_CANVAS_MIN_PX there is no band, yet the element still starts at the canvas's top rather than leaving a strip of
// canvas beside the menu button. Its header grows to the menu's height and starts after it; its name stays in the
// header (the menu box has no room for it) and its controls stay as they are. In px from the element's box.
export type PhoneRow = { height: number; left: number };

// The cover's padding around the element on a phone (CanvasCover's p-2).
const PHONE_COVER_PAD_PX = 8;
// The least room a phone's header needs after the menu: a short title and the header's controls (Restore, the cog).
export const PHONE_ROW_MIN_PX = 160;

// The phone's shared row for `canvas` with the menu where it is, given the element's side insets; null on a wider
// canvas (a band's), with no menu, a menu that is not in the top row or not inside the element, or too little room
// after it.
export function phoneRow(
  canvas: Box,
  insets: Pick<LayerInsets, 'left' | 'right'>,
  menu: Box | null,
): PhoneRow | null {
  if (!menu || canvas.right - canvas.left >= BAND_CANVAS_MIN_PX) return null;
  if (menu.top > canvas.top + (canvas.bottom - canvas.top) / 2) return null;
  const left = canvas.left + insets.left + PHONE_COVER_PAD_PX;
  const right = canvas.right - insets.right - PHONE_COVER_PAD_PX;
  const top = canvas.top + PHONE_COVER_PAD_PX;
  if (menu.left < left || menu.bottom <= top) return null;
  if (right - menu.right - BAND_GAP_PX < PHONE_ROW_MIN_PX) return null;
  return {
    height: Math.round(menu.bottom - top),
    left: Math.round(menu.right - left + BAND_GAP_PX),
  };
}

// Where a maximised or tab-filling element sits: its insets, and its header band when there is room for one, or the
// row it shares with the menu on a phone (either way the top inset is then 0: the header holds the top row).
export type CanvasLayout = { insets: LayerInsets; band: HeaderBand | null; row?: PhoneRow | null };
export const NO_LAYOUT: CanvasLayout = { insets: NO_INSETS, band: null };

const STRIP_SELECTOR = '[data-toolbar-palette]:not(.hidden)';
// The menu box's slot for the element's name (MenuNameSlot).
const MENU_NAME_SLOT_SELECTOR = '[data-menu-name-slot]';
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

// A board's widgets ride in its controls card only while there is a band (PlanBoardHeader): without one they sit in
// the header, and the card is the cog alone. Judging the band from that narrow card let it on, the widgets moved in,
// the wider card took it away, and the header flipped between the two every frame. So without a band the widgets count
// as they would ride (their run, as wide as the band's zone lets it: PlanBoardHeader's `max-w-[min(56vw,46rem)]`,
// its hairline and padding, and the card's gap), plus BAND_ENTRY_SLACK_PX for the card's larger buttons in the band:
// the band comes only once it fits with them, and stays.
const BAND_ZONE_MAX_VW = 0.56;
const BAND_ZONE_MAX_PX = 736;
// The zone's right padding and hairline, and the card's gap before the next control (PlanBoardHeader, gap-3).
const BAND_ZONE_EDGE_PX = 9 + 12;
export const BAND_ENTRY_SLACK_PX = 24;
function widgetsToCome(canvas: HTMLElement, controls: HTMLElement): number {
  if (canvas.querySelector('[data-header-band]')) return 0;
  const zone = controls
    .closest('[data-board-header]')
    ?.querySelector<HTMLElement>('[data-widget-zone]');
  if (!zone || controls.contains(zone)) return BAND_ENTRY_SLACK_PX;
  // What the zone holds, not the zone (it stretches across the header): its children's run, scrolled out of view or not,
  // and its own 4 px sides.
  const held = unionOfChildren(zone);
  const natural = held ? held.right - held.left + 8 : 0;
  const run = Math.min(natural, window.innerWidth * BAND_ZONE_MAX_VW, BAND_ZONE_MAX_PX);
  return run + BAND_ZONE_EDGE_PX + BAND_ENTRY_SLACK_PX;
}

// The chrome over `canvas` now, read off the screen.
// `withBand` false: never a header band (a Dashboard's page starts below the top row, docs/specs/026-plan/plan-tabs.md).
export function measureCanvasChrome(canvas: HTMLElement, withBand = true): CanvasLayout {
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
  // A Dashboard's slots carry their own boards' controls cards (docs/specs/026-plan/plan-tabs.md): never theirs.
  const controls =
    [...canvas.querySelectorAll<HTMLElement>(BAND_CONTROLS_SELECTOR)].find(
      (el) => !el.closest('[data-dashboard]'),
    ) ?? null;
  const endWidth = controls
    ? controls.offsetWidth +
      (controls.parentElement
        ? parseFloat(getComputedStyle(controls.parentElement).paddingRight) || 0
        : 0)
    : BAND_RIGHT_MIN_PX;
  const entryWidth = controls ? widgetsToCome(canvas, controls) : 0;
  if (!withBand) return { insets, band: null };
  const band = headerBand(
    area,
    insets,
    menu,
    strip ? unionOfChildren(strip) : null,
    nameWidth,
    endWidth,
    entryWidth,
  );
  if (band) return { insets: { ...insets, top: 0 }, band };
  const row = phoneRow(area, insets, menu);
  return row ? { insets: { ...insets, top: 0 }, band: null, row } : { insets, band: null };
}

export function sameLayout(a: CanvasLayout, b: CanvasLayout): boolean {
  const ra = a.row ?? null;
  const rb = b.row ?? null;
  return (
    sameInsets(a.insets, b.insets) &&
    (a.band === b.band ||
      (!!a.band &&
        !!b.band &&
        a.band.height === b.band.height &&
        a.band.left === b.band.left &&
        a.band.mid === b.band.mid &&
        a.band.stripEnd === b.band.stripEnd)) &&
    (ra === rb || (!!ra && !!rb && ra.height === rb.height && ra.left === rb.left))
  );
}

function sameInsets(a: LayerInsets, b: LayerInsets): boolean {
  return a.top === b.top && a.right === b.right && a.bottom === b.bottom && a.left === b.left;
}
