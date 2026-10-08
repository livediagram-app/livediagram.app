// Side by side tabs (docs/specs/007-editor/split-view.md): the pure rules behind the split. Two tabs
// of the document share the screen, each keeping its side. The editor (its canvas, toolbars and
// panels) sits in whichever pane holds the active tab; the other pane shows its tab live. Everything
// here is a function of plain numbers and ids so the gesture, the layout and the persistence can be
// tested without a DOM.

// The narrowest either pane may get. Either can hold the editor, so both keep the editor's floor:
// Tailwind's `sm` (640 px), the width its palette, Explorer and canvas are laid out for. Under it
// the floating panels cover most of the canvas.
export const SPLIT_MIN_PANE_PX = 640;

// The smallest window the split is offered on (its inner size, so a browser's own toolbars count
// against it). Wider than two minimum panes, so the even split it opens at gives each pane room to
// spare (700 px), and tall enough that the editor's corner panels leave a canvas between them. 1,440
// px and wider laptops and desktops qualify; 1,280 px and 1,366 px screens, where two editors read as
// cramped, keep one tab at a time.
export const SPLIT_MIN_VIEWPORT_PX = 1400;
export const SPLIT_MIN_VIEWPORT_HEIGHT_PX = 700;

// Where the divider starts out: an even split, the arrangement people reach for first.
export const SPLIT_DEFAULT_FRACTION = 0.5;

// How long the pointer is in the other pane before the editor follows it there: under the ~150 ms
// a person reads as a delay, yet long enough that a pointer skimming a pane's edge doesn't move it.
// (At 400 ms the move felt slow: measured ~470 ms from entering the pane to the chrome landing.)
export const SPLIT_HOVER_FOCUS_MS = 120;

// The drop zone a dragged tab arms on the right edge: this share of the viewport, never under the
// floor (a narrow window still gets a target worth aiming for).
export const SPLIT_DROP_ZONE_FRACTION = 0.28;
export const SPLIT_DROP_ZONE_MIN_PX = 160;

// The bottom band the tab bar owns. A drag there is a reorder, never a split, so the zone stops
// above it and a drop near the last pill still lands as a reorder.
export const SPLIT_TAB_BAR_CLEARANCE_PX = 64;

// Arrow-key nudge on the divider, and the bigger Shift step (a11y: the separator is a slider).
export const SPLIT_KEY_STEP_PX = 24;
export const SPLIT_KEY_STEP_LARGE_PX = 96;

export function splitAvailable(viewportWidth: number, viewportHeight = Infinity): boolean {
  return viewportWidth >= SPLIT_MIN_VIEWPORT_PX && viewportHeight >= SPLIT_MIN_VIEWPORT_HEIGHT_PX;
}

// The right pane's width for a fraction of the viewport, held inside both panes' minimums.
export function rightWidthFor(fraction: number, viewportWidth: number): number {
  return clampRightWidth(Math.round(fraction * viewportWidth), viewportWidth);
}

export function clampRightWidth(width: number, viewportWidth: number): number {
  const max = Math.max(SPLIT_MIN_PANE_PX, viewportWidth - SPLIT_MIN_PANE_PX);
  return Math.min(max, Math.max(SPLIT_MIN_PANE_PX, width));
}

// The fraction a width represents, rounded to keep the stored preference tidy.
export function fractionFor(width: number, viewportWidth: number): number {
  if (viewportWidth <= 0) return SPLIT_DEFAULT_FRACTION;
  return Math.round((width / viewportWidth) * 1000) / 1000;
}

// How wide the drop zone is: the open pane itself when there is one (dropping there replaces the
// tab beside you), else the right-edge band.
export function dropZoneWidth(viewportWidth: number, openRightWidth: number | null): number {
  if (openRightWidth !== null) return openRightWidth;
  return Math.max(SPLIT_DROP_ZONE_MIN_PX, Math.round(viewportWidth * SPLIT_DROP_ZONE_FRACTION));
}

export function inDropZone(
  point: { x: number; y: number },
  viewport: { width: number; height: number },
  openRightWidth: number | null,
): boolean {
  if (!splitAvailable(viewport.width, viewport.height)) return false;
  if (point.y > viewport.height - SPLIT_TAB_BAR_CLEARANCE_PX) return false;
  return point.x >= viewport.width - dropZoneWidth(viewport.width, openRightWidth);
}

// How far into the zone the pointer has travelled, 0 at its inner edge to 1 at the screen edge.
// Drives the edge hint's glow, so the target answers the pointer before it is armed.
export function approachProgress(
  x: number,
  viewportWidth: number,
  openRightWidth: number | null,
): number {
  // The hint starts reacting a zone-width before the zone itself.
  const zone = dropZoneWidth(viewportWidth, openRightWidth);
  const start = viewportWidth - zone * 2;
  if (x <= start) return 0;
  return Math.min(1, (x - start) / (zone * 2));
}

// The tab to keep on the left when the tab sent right IS the active one: the tab you were on
// before, if it still exists, else the neighbour to its left, else to its right.
export function companionTabId(
  tabIds: readonly string[],
  openingId: string,
  previousActiveId: string | null,
): string | null {
  if (previousActiveId && previousActiveId !== openingId && tabIds.includes(previousActiveId))
    return previousActiveId;
  const at = tabIds.indexOf(openingId);
  if (at === -1) return null;
  return tabIds[at - 1] ?? tabIds[at + 1] ?? null;
}

// Which tab is on which side. The active tab is always one of them: the editor sits on its side.
export type SplitPair = { leftId: string; rightId: string };

// Where the tabs land when `openingId` is dropped on the right (or opened from its menu).
// - No split yet: the active tab stays on the left, the dropped one goes right. Sending the active
//   tab itself right puts its companion on the left; the editor goes right with it.
// - A split already open: the dropped tab takes the right pane; dropping the left tab trades sides.
// Null when there is no second tab to pair it with.
export function placeOpening(
  tabIds: readonly string[],
  activeId: string,
  openingId: string,
  previousActiveId: string | null,
  current: SplitPair | null,
): SplitPair | null {
  if (!tabIds.includes(openingId)) return null;
  if (current) {
    if (openingId === current.rightId) return null;
    if (openingId === current.leftId) return { leftId: current.rightId, rightId: openingId };
    return { leftId: current.leftId, rightId: openingId };
  }
  if (openingId !== activeId) return { leftId: activeId, rightId: openingId };
  const companion = companionTabId(tabIds, openingId, previousActiveId);
  return companion ? { leftId: companion, rightId: openingId } : null;
}

// The pair after the editor moves from `prevActiveId` to `nextActiveId`. Moving between the two
// panes changes nothing (the editor just follows); opening a third tab from the tab bar puts it in
// the pane the editor was in, so the other pane keeps what it shows.
export function pairAfterActivation(
  pair: SplitPair,
  prevActiveId: string,
  nextActiveId: string,
): SplitPair {
  if (nextActiveId === pair.leftId || nextActiveId === pair.rightId) return pair;
  if (prevActiveId === pair.rightId) return { ...pair, rightId: nextActiveId };
  return { ...pair, leftId: nextActiveId };
}

// The persisted shape: which tabs a document was split on and on which side, and the width people chose
// (one fraction for every document, because it is about their screen, not the document).
const PAIR_KEY_PREFIX = 'livediagram:v2:split-view-pair:';
const FRACTION_KEY = 'livediagram:v2:split-view-fraction';

export function readStoredPair(documentId: string): SplitPair | null {
  try {
    const raw = JSON.parse(window.localStorage.getItem(PAIR_KEY_PREFIX + documentId) ?? 'null');
    return raw && typeof raw.leftId === 'string' && typeof raw.rightId === 'string'
      ? { leftId: raw.leftId, rightId: raw.rightId }
      : null;
  } catch {
    return null;
  }
}

export function writeStoredPair(documentId: string, pair: SplitPair | null): void {
  try {
    if (pair) window.localStorage.setItem(PAIR_KEY_PREFIX + documentId, JSON.stringify(pair));
    else window.localStorage.removeItem(PAIR_KEY_PREFIX + documentId);
  } catch {
    // Storage blocked (private mode): the split still works, it just isn't remembered.
  }
}

// The split to show when a document reopens on `activeId`: the stored pair, each tab on its side,
// when the page lands on one of them; landing on a third tab puts it where the left tab was. Null
// when a tab is gone (or the pair would hold one tab twice).
export function restoredPair(
  stored: SplitPair | null,
  activeId: string,
  tabIds: readonly string[],
): SplitPair | null {
  if (!stored) return null;
  const pair =
    activeId === stored.leftId || activeId === stored.rightId
      ? stored
      : { leftId: activeId, rightId: stored.rightId };
  return pair.leftId !== pair.rightId &&
    tabIds.includes(pair.leftId) &&
    tabIds.includes(pair.rightId)
    ? pair
    : null;
}

export function readStoredFraction(): number {
  try {
    const raw = Number(window.localStorage.getItem(FRACTION_KEY));
    return raw > 0 && raw < 1 ? raw : SPLIT_DEFAULT_FRACTION;
  } catch {
    return SPLIT_DEFAULT_FRACTION;
  }
}

export function writeStoredFraction(fraction: number): void {
  try {
    window.localStorage.setItem(FRACTION_KEY, String(fraction));
  } catch {
    // As above: unremembered, not broken.
  }
}
