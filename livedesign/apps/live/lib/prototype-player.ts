// Prototype mode's state (docs/specs/007-editor/wireframe-pages.md "Prototype mode"): which screen is shown, the
// screens shown before it (what a back link returns to), the last change and how it moves, and the hotspots on a
// screen. Pure: the player component draws it; every link resolves through resolveScreenLink, so a broken one is no
// hotspot and never throws.
import {
  contentBounds,
  describeScreenLink,
  elementIdsOnPage,
  isScreenLink,
  pageLinkTransitionOf,
  pageScreenRect,
  resolveScreenLink,
  visibleLayerElements,
  type LaidOutPage,
  type PageLinkTransition,
  type ScreenLink,
  type Tab,
} from '@livedesign/design';

// How long a screen change moves (within the motion budget's 250 ms), and how long the hotspots stay lit after a press
// off them before their 150 ms fade.
export const PROTOTYPE_TRANSITION_MS = 250;
export const PROTOTYPE_FLASH_MS = 500;

export type ScreenChange = {
  fromId: string;
  transition: PageLinkTransition;
  // A back link's slide runs the other way.
  direction: 'forward' | 'back';
  // Counts the changes, so the stage keys each one's motion.
  seq: number;
};

export type PlayerState = {
  shownId: string;
  // The screens shown before, oldest first: a back link returns to the last.
  history: readonly string[];
  change: ScreenChange | null;
};

export type HotspotRect = { x: number; y: number; width: number; height: number };

export type Hotspot = {
  elementId: string;
  // The element's drawn box cut to the screen, in canvas coords.
  rect: HotspotRect;
  link: ScreenLink;
  // What the hotspot does, for its accessible name ("Goes to Checkout").
  label: string;
};

/** The player as it opens: on `startId` when it is a screen of the tab, else the first screen. */
export function startPlayer(pages: readonly LaidOutPage[], startId: string | null): PlayerState {
  const start = pages.find((p) => p.id === startId) ?? pages[0];
  return { shownId: start?.id ?? '', history: [], change: null };
}

/** The screen shown: the page with `shownId`, else the first (the one shown was deleted). */
export function shownScreen(
  state: PlayerState,
  pages: readonly LaidOutPage[],
): LaidOutPage | undefined {
  return pages.find((p) => p.id === state.shownId) ?? pages[0];
}

function goTo(
  state: PlayerState,
  pages: readonly LaidOutPage[],
  toId: string,
  transition: PageLinkTransition,
  direction: ScreenChange['direction'],
  history: readonly string[],
): PlayerState {
  const fromId = shownScreen(state, pages)?.id ?? state.shownId;
  return {
    shownId: toId,
    history,
    change: { fromId, transition, direction, seq: (state.change?.seq ?? 0) + 1 },
  };
}

/** Following a hotspot's link: a screen link goes to its screen, a back link to the screen shown before; a broken
 *  link, a link to the screen already shown and a back link with nothing before change nothing. */
export function followHotspot(
  state: PlayerState,
  link: ScreenLink,
  pages: readonly LaidOutPage[],
): PlayerState {
  const from = shownScreen(state, pages);
  if (!from) return state;
  const transition = pageLinkTransitionOf(link);
  const target = resolveScreenLink(link, pages);
  if (target.state === 'broken') return state;
  if (target.state === 'back') {
    // The last screen before that is still on the tab.
    const history = state.history.filter((id) => pages.some((p) => p.id === id));
    const back = history.at(-1);
    if (back === undefined) return state;
    return goTo(state, pages, back, transition, 'back', history.slice(0, -1));
  }
  if (target.page.id === from.id) return state;
  return goTo(state, pages, target.page.id, transition, 'forward', [...state.history, from.id]);
}

/** Previous and Next (and the arrow keys): the screen beside in the tab's order, at once; nothing past the ends. */
export function stepScreen(
  state: PlayerState,
  pages: readonly LaidOutPage[],
  by: 1 | -1,
): PlayerState {
  const from = shownScreen(state, pages);
  if (!from) return state;
  const next = pages[pages.indexOf(from) + by];
  if (!next) return state;
  return goTo(state, pages, next.id, 'instant', by > 0 ? 'forward' : 'back', [
    ...state.history,
    from.id,
  ]);
}

function intersect(a: HotspotRect, b: HotspotRect): HotspotRect | null {
  const x = Math.max(a.x, b.x);
  const y = Math.max(a.y, b.y);
  const right = Math.min(a.x + a.width, b.x + b.width);
  const bottom = Math.min(a.y + a.height, b.y + b.height);
  return right > x && bottom > y ? { x, y, width: right - x, height: bottom - y } : null;
}

/** The hotspots on a screen, in paint order (the last drawn on top): its visible elements with a screen link that is
 *  not broken, each its drawn box cut to the screen; one wholly off the screen is left out. */
export function prototypeHotspots(
  tab: Pick<Tab, 'elements' | 'layers'>,
  page: LaidOutPage,
  pages: readonly LaidOutPage[],
): Hotspot[] {
  const linked = tab.elements.filter((el) => isScreenLink(el.link));
  if (linked.length === 0) return [];
  const on = elementIdsOnPage(tab.elements, pages, page.id);
  const screen = pageScreenRect(page);
  const out: Hotspot[] = [];
  for (const el of visibleLayerElements(tab.elements, tab.layers)) {
    const link = el.link;
    if (!isScreenLink(link) || !on.has(el.id)) continue;
    if (resolveScreenLink(link, pages).state === 'broken') continue;
    const b = contentBounds([el], undefined, tab.elements);
    const rect = intersect({ x: b.x, y: b.y, width: b.w, height: b.h }, screen);
    if (rect) out.push({ elementId: el.id, rect, link, label: describeScreenLink(link, pages) });
  }
  return out;
}
