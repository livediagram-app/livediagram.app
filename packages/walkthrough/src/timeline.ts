// A walkthrough's events as something to play (liveworkspace/docs/specs/006-media/walkthroughs.md "Playing"): where the
// camera, the pointer, the tab and the slide stand at any moment, the scrubber's marks, and a recorded view fitted to
// the viewer's own canvas. Pure: the player reads it every frame, so each read is a binary search, never a scan.

import type { WalkthroughEvent, WalkthroughEvents } from '@liveworkspace/media/walkthrough';

export type CanvasView = { readonly zoom: number; readonly offset: { x: number; y: number } };
export type RecordedView = { cx: number; cy: number; zoom: number; w: number; h: number };
export type Point = { x: number; y: number };

/** How long a press's ring shows after it. */
export const POINT_RING_MS = 900;
/** Two samples further apart than this are a jump (a tab change, a fit), not a glide: no easing between them. */
const GLIDE_MAX_MS = 400;

/**
 * The view a canvas shows, as a record: the canvas point at its centre, the zoom, and its size. The canvas content is
 * drawn `scale(zoom) translate(offset)` about its own centre, so the point at the centre is the size's half less the
 * offset, whatever the zoom.
 */
export function recordView(view: CanvasView, w: number, h: number): RecordedView {
  return { cx: w / 2 - view.offset.x, cy: h / 2 - view.offset.y, zoom: view.zoom, w, h };
}

/** A recorded view on a canvas of another size: the same centre, the zoom scaled so all it showed still shows. */
export function fitView(rec: RecordedView, w: number, h: number): CanvasView {
  const scale = Math.min(w / rec.w, h / rec.h);
  return { zoom: rec.zoom * scale, offset: { x: w / 2 - rec.cx, y: h / 2 - rec.cy } };
}

type Timed<T> = { t: number; value: T };
type SlideAt = { slide: string | null; label: string | null };

export type PlayState = {
  view: RecordedView | null;
  // Null while the pointer was off the canvas (or over a hidden element).
  cursor: Point | null;
  tab: string;
  // Null outside a deck.
  slide: SlideAt | null;
  // Presses whose ring still shows: their element and how far through the ring (0 to 1).
  points: { id: string; t: number; progress: number }[];
};

export type Mark = { t: number; kind: 'tab' | 'slide'; label: string };

export type Timeline = {
  durationMs: number;
  at: (t: number) => PlayState;
  marks: Mark[];
};

/** The last entry at or before `t`, by binary search: -1 when none is. */
function lastAt<T>(list: readonly Timed<T>[], t: number): number {
  let lo = 0;
  let hi = list.length - 1;
  let found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (list[mid]!.t <= t) {
      found = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return found;
}

const mix = (a: number, b: number, f: number) => a + (b - a) * f;

/** The sample at `t`, eased toward the next one when they are close enough to be one movement. */
function glide<T>(
  list: readonly Timed<T>[],
  t: number,
  blend: (a: T, b: T, f: number) => T,
): T | null {
  const i = lastAt(list, t);
  if (i < 0) return null;
  const a = list[i]!;
  const b = list[i + 1];
  if (!b || b.t - a.t > GLIDE_MAX_MS) return a.value;
  return blend(a.value, b.value, (t - a.t) / (b.t - a.t));
}

const blendView = (a: RecordedView, b: RecordedView, f: number): RecordedView =>
  a.w !== b.w || a.h !== b.h
    ? a
    : {
        cx: mix(a.cx, b.cx, f),
        cy: mix(a.cy, b.cy, f),
        zoom: mix(a.zoom, b.zoom, f),
        w: a.w,
        h: a.h,
      };

const blendCursor = (a: Point | null, b: Point | null, f: number): Point | null =>
  a && b ? { x: mix(a.x, b.x, f), y: mix(a.y, b.y, f) } : a;

export function buildTimeline(
  recording: WalkthroughEvents,
  tabName: (tab: string) => string = (tab) => tab,
): Timeline {
  const views: Timed<RecordedView>[] = [];
  const cursors: Timed<Point | null>[] = [];
  const tabs: Timed<string>[] = [{ t: 0, value: recording.startTab }];
  const slides: Timed<SlideAt | null>[] = [];
  const points: Timed<string>[] = [];
  const marks: Mark[] = [];
  for (const e of recording.events as WalkthroughEvent[]) {
    switch (e.k) {
      case 'view':
        views.push({ t: e.t, value: { cx: e.cx, cy: e.cy, zoom: e.zoom, w: e.w, h: e.h } });
        break;
      case 'cursor':
        cursors.push({ t: e.t, value: { x: e.x, y: e.y } });
        break;
      case 'cursor-out':
        cursors.push({ t: e.t, value: null });
        break;
      case 'point':
        points.push({ t: e.t, value: e.id });
        break;
      case 'tab':
        tabs.push({ t: e.t, value: e.tab });
        // A new tab ends any deck on the last one.
        slides.push({ t: e.t, value: null });
        marks.push({ t: e.t, kind: 'tab', label: tabName(e.tab) });
        break;
      case 'slide':
        slides.push({ t: e.t, value: e.slide ? { slide: e.slide, label: e.label ?? null } : null });
        if (e.slide) marks.push({ t: e.t, kind: 'slide', label: e.label ?? 'Slide' });
        break;
    }
  }
  return {
    durationMs: recording.durationMs,
    marks,
    at: (t) => {
      const slide = slides[lastAt(slides, t)]?.value ?? null;
      const recent: PlayState['points'] = [];
      for (let i = lastAt(points, t); i >= 0 && t - points[i]!.t < POINT_RING_MS; i--) {
        const p = points[i]!;
        recent.push({ id: p.value, t: p.t, progress: (t - p.t) / POINT_RING_MS });
      }
      return {
        view: glide(views, t, blendView),
        cursor: glide(cursors, t, blendCursor),
        tab: tabs[lastAt(tabs, t)]!.value,
        slide,
        points: recent,
      };
    },
  };
}

/** The tabs whose content changed since the walkthrough was recorded: a tab gone counts as changed, a tab that can't
 *  be told yet (undefined) does not. */
export function editedSince(
  recorded: Readonly<Record<string, string>>,
  now: (tab: string) => string | null | undefined,
): string[] {
  return Object.keys(recorded).filter((tab) => {
    const print = now(tab);
    return print !== undefined && print !== recorded[tab];
  });
}

/**
 * A short fingerprint of a tab's content, for "Edited since recording": FNV-1a over its JSON, with its length.
 * Read once when recording starts and once when a walkthrough opens, never per frame.
 */
export function fingerprintOf(value: unknown): string {
  const text = JSON.stringify(value) ?? '';
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return `${(hash >>> 0).toString(16)}-${text.length.toString(36)}`;
}

/** A length as the player and the list show it: `m:ss`. */
export function formatClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}
