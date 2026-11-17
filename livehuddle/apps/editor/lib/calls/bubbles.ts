// Whose camera and whose screen this viewer receives (docs/specs/012-collaboration/video-and-screen-bubbles.md "Who
// sees what"; blueprint "Choosing bubbles"): pure, so the subscriptions and the tests read one answer. A bubble is
// received only from someone heard, whose character is on screen, while the page is visible, nearest first and
// capped; the one bubble maximised is kept whatever the caps and the viewport say. A hidden tab with the mini view open
// receives the few nearest cameras heard for its tiles, on the small layer, and no screen (Work Tracker 984).
import type { CallTrackLocator } from '@livehuddle/api-schema';
import type { CallMaximised } from './calls-store';
import { distance, type Point } from './hearing';

/** The most camera bubbles received at once: the nearest. */
export const MAX_VIDEO_BUBBLES = 6;
/** The most screen bubbles received at once: a screen is about three bubbles' worth of traffic. */
export const MAX_SCREEN_BUBBLES = 2;
/** The most cameras a hidden tab receives for the mini view's tiles (D142): the nearest, on the small layer. */
export const MAX_MINI_VIEW_VIDEOS = 4;
/** The visible area grows by this before a character counts as off screen, so an edge bubble does not flicker. */
export const BUBBLE_VIEW_MARGIN_PX = 120;

/** The canvas area on screen, in canvas px. */
export type ViewRect = { x: number; y: number; width: number; height: number };

export type SeenInput = {
  self: Point | null;
  // The presence ids heard now (earshot, with hysteresis).
  heard: ReadonlySet<string>;
  // Every other walker's feet on this tab.
  walkers: ReadonlyMap<string, Point>;
  peers: ReadonlyMap<string, { video?: CallTrackLocator | null; screen?: CallTrackLocator | null }>;
  // Null while the canvas has not been measured: nothing counts as off screen.
  view: ViewRect | null;
  // The page is visible (`document.visibilityState`).
  visible: boolean;
  // The mini view's window is open: a hidden tab still receives its tiles' cameras.
  miniView?: boolean;
  // The kill switch allows these media.
  allowVideo: boolean;
  allowScreen: boolean;
  maximised: CallMaximised | null;
};

// `small`: every camera on the small layer, the maximised one too (a hidden tab's mini view tiles).
export type Seen = { video: readonly string[]; screen: readonly string[]; small?: boolean };

const NONE: Seen = { video: [], screen: [] };

export function onView(at: Point, view: ViewRect | null): boolean {
  if (!view) return true;
  const m = BUBBLE_VIEW_MARGIN_PX;
  return (
    at.x >= view.x - m &&
    at.x <= view.x + view.width + m &&
    at.y >= view.y - m &&
    at.y <= view.y + view.height + m
  );
}

// Nearest first; a tie by id, so the pick is stable.
const byDistance = (a: { id: string; d: number }, b: { id: string; d: number }) =>
  a.d - b.d || (a.id < b.id ? -1 : 1);

/**
 * A hidden tab with the mini view open: the nearest cameras heard, wherever they stand (the canvas is not on show), the
 * maximised one no different, and no screen.
 */
function miniViewSeen(input: SeenInput, self: Point): Seen {
  if (!input.allowVideo) return NONE;
  const near: { id: string; d: number }[] = [];
  for (const id of input.heard) {
    const at = input.walkers.get(id);
    if (at && input.peers.get(id)?.video) near.push({ id, d: distance(self, at) });
  }
  near.sort(byDistance);
  return { video: near.slice(0, MAX_MINI_VIEW_VIDEOS).map((n) => n.id), screen: [], small: true };
}

/** The presence ids whose camera and whose screen to receive, nearest first. */
export function pickSeen(input: SeenInput): Seen {
  const { self, heard, walkers, peers, view, maximised } = input;
  if (!self) return NONE;
  if (!input.visible) return input.miniView ? miniViewSeen(input, self) : NONE;
  const pick = (media: 'video' | 'screen', allowed: boolean, cap: number): string[] => {
    if (!allowed) return [];
    const near: { id: string; d: number }[] = [];
    let kept: string | null = null;
    for (const id of heard) {
      const at = walkers.get(id);
      if (!at || !peers.get(id)?.[media]) continue;
      if (maximised?.id === id && maximised.media === media) {
        kept = id;
        continue;
      }
      if (onView(at, view)) near.push({ id, d: distance(self, at) });
    }
    near.sort(byDistance);
    const ids = near.map((n) => n.id);
    return kept ? [kept, ...ids.slice(0, cap - 1)] : ids.slice(0, cap);
  };
  return {
    video: pick('video', input.allowVideo, MAX_VIDEO_BUBBLES),
    screen: pick('screen', input.allowScreen, MAX_SCREEN_BUBBLES),
  };
}
