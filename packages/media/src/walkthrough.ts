// Walkthroughs (liveworkspace/docs/specs/006-media/walkthroughs.md): the narrated recordings the canvas apps keep in
// the media service. What one may be, the timeline it carries, and the rules the recorder, each app's door and the
// service all apply, so none of them can drift. Pure: no DOM, no Worker globals.

import { MEDIA_ID_MAX } from './limits';

// Ten minutes: a walkthrough explains a canvas; past ten minutes it is a meeting.
export const WALKTHROUGH_MAX_MS = 10 * 60 * 1000;
// The recorder's bit rates: the bubble shows the camera at most 240 px across, and Opus speech is clear from 32 kbit/s.
export const WALKTHROUGH_VIDEO_BPS = 400_000;
export const WALKTHROUGH_AUDIO_BPS = 48_000;
// Ten minutes at both rates is 33.6 MB; 40 MiB leaves a quarter for an encoder that overshoots, far under the 100 MB a
// Worker request may carry. Audio alone is about 3.6 MB.
export const WALKTHROUGH_MEDIA_MAX_BYTES = 40 * 1024 * 1024;
export const WALKTHROUGH_MEDIA_MAX_MB = WALKTHROUGH_MEDIA_MAX_BYTES / (1024 * 1024);
// The view and the pointer are sampled at most ten times a second each: ten minutes is about 12,000 events (0.7 MB).
export const WALKTHROUGH_EVENTS_MAX_BYTES = 2 * 1024 * 1024;
export const WALKTHROUGH_EVENTS_MAX = 20_000;
// A start's body: the events and a little more for the title and the numbers.
export const WALKTHROUGH_START_MAX_BYTES = WALKTHROUGH_EVENTS_MAX_BYTES + 16 * 1024;
export const WALKTHROUGH_HIDDEN_MAX = 2_000;
export const WALKTHROUGH_TITLE_MAX = 120;
export const WALKTHROUGH_AUTHOR_MAX = 80;
export const WALKTHROUGH_FINGERPRINT_MAX = 128;
export const WALKTHROUGH_TABS_MAX = 500;
export const WALKTHROUGHS_PER_ITEM_MAX = 50;
// A start whose media never arrives is swept after an hour.
export const WALKTHROUGH_PENDING_MS = 60 * 60 * 1000;
export const WALKTHROUGH_DEFAULT_TITLE = 'Walkthrough';

// Chrome, Edge and Firefox record WebM; Safari records MP4. Video when the camera was on, audio when it was off.
export const ACCEPTED_WALKTHROUGH_TYPES = [
  'video/webm',
  'video/mp4',
  'audio/webm',
  'audio/mp4',
] as const;
export type WalkthroughMediaType = (typeof ACCEPTED_WALKTHROUGH_TYPES)[number];

export const WALKTHROUGH_CORNERS = [
  'bottom-left',
  'bottom-right',
  'top-left',
  'top-right',
] as const;
export type WalkthroughCorner = (typeof WALKTHROUGH_CORNERS)[number];

export type WalkthroughEvent =
  // The canvas point at the screen's centre, the zoom, and the canvas's size on screen then.
  | { t: number; k: 'view'; cx: number; cy: number; zoom: number; w: number; h: number }
  // The pointer, in canvas coordinates.
  | { t: number; k: 'cursor'; x: number; y: number }
  // The pointer left the canvas, or went over a hidden element.
  | { t: number; k: 'cursor-out' }
  // A press on an element: the player rings it.
  | { t: number; k: 'point'; id: string }
  | { t: number; k: 'tab'; tab: string }
  // A deck's slide, or null when the deck ends.
  | { t: number; k: 'slide'; slide: string | null; label?: string };

export type WalkthroughEvents = {
  v: 1;
  durationMs: number;
  camera: boolean;
  corner: WalkthroughCorner;
  startTab: string;
  hidden: string[];
  fingerprints: Record<string, string>;
  events: WalkthroughEvent[];
};

/** One walkthrough as the service keeps it. The owner travels beside it, never in it. */
export type Walkthrough = {
  id: string;
  item: string;
  title: string;
  author: string | null;
  durationMs: number;
  mediaType: WalkthroughMediaType;
  mediaBytes: number;
  camera: boolean;
  createdAt: number;
  ready: boolean;
};

/** One walkthrough as an app's door tells its editor. */
export type WalkthroughSummary = Omit<Walkthrough, 'item' | 'ready'> & {
  mine: boolean;
  canDelete: boolean;
};

/** What a recorder sends to start one. */
export type WalkthroughStart = {
  item: string;
  title: string;
  author: string | null;
  mediaType: WalkthroughMediaType;
  mediaBytes: number;
  events: WalkthroughEvents;
};

/** A refusal, as each layer answers it: the status and the body. */
export type WalkthroughRefusal = {
  status: number;
  body: { error: string } & Record<string, unknown>;
};

/** The base type of a recorder's MIME type (`video/webm;codecs=vp8,opus` is `video/webm`), or null when not accepted. */
export function walkthroughMediaType(value: unknown): WalkthroughMediaType | null {
  if (typeof value !== 'string') return null;
  const base = value.split(';')[0]!.trim().toLowerCase();
  return (ACCEPTED_WALKTHROUGH_TYPES as readonly string[]).includes(base)
    ? (base as WalkthroughMediaType)
    : null;
}

/** The container a file's first bytes say it is: WebM's EBML header, or MP4's `ftyp` box. */
export function sniffWalkthroughContainer(bytes: Uint8Array): 'webm' | 'mp4' | null {
  if (bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3)
    return 'webm';
  if (bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70)
    return 'mp4';
  return null;
}

export function containerOf(type: WalkthroughMediaType): 'webm' | 'mp4' {
  return type.endsWith('webm') ? 'webm' : 'mp4';
}

const collapse = (value: string) => value.replace(/\s+/g, ' ').trim();
const cut = (value: string, max: number) => Array.from(value).slice(0, max).join('');

/** A title as stored: collapsed, cut to WALKTHROUGH_TITLE_MAX, "Walkthrough" when empty. */
export function normaliseWalkthroughTitle(value: unknown): string {
  const title = typeof value === 'string' ? cut(collapse(value), WALKTHROUGH_TITLE_MAX) : '';
  return title || WALKTHROUGH_DEFAULT_TITLE;
}

/** The recorder's name as stored, or null. */
export function normaliseWalkthroughAuthor(value: unknown): string | null {
  const author = typeof value === 'string' ? cut(collapse(value), WALKTHROUGH_AUTHOR_MAX) : '';
  return author || null;
}

const isId = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0 && value.length <= MEDIA_ID_MAX;
const isNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);
const isSize = (value: unknown): value is number => isNumber(value) && value > 0 && value < 1e6;

// One event, checked; null when it is not one.
function parseEvent(value: unknown): WalkthroughEvent | null {
  if (typeof value !== 'object' || value === null) return null;
  const e = value as Record<string, unknown>;
  if (!isNumber(e.t)) return null;
  const t = e.t;
  switch (e.k) {
    case 'view':
      return isNumber(e.cx) && isNumber(e.cy) && isSize(e.zoom) && isSize(e.w) && isSize(e.h)
        ? { t, k: 'view', cx: e.cx, cy: e.cy, zoom: e.zoom, w: e.w, h: e.h }
        : null;
    case 'cursor':
      return isNumber(e.x) && isNumber(e.y) ? { t, k: 'cursor', x: e.x, y: e.y } : null;
    case 'cursor-out':
      return { t, k: 'cursor-out' };
    case 'point':
      return isId(e.id) ? { t, k: 'point', id: e.id } : null;
    case 'tab':
      return isId(e.tab) ? { t, k: 'tab', tab: e.tab } : null;
    case 'slide': {
      if (e.slide !== null && !isId(e.slide)) return null;
      const label = typeof e.label === 'string' ? cut(e.label, WALKTHROUGH_TITLE_MAX) : undefined;
      return label === undefined
        ? { t, k: 'slide', slide: e.slide }
        : { t, k: 'slide', slide: e.slide, label };
    }
    default:
      return null;
  }
}

/**
 * The events as they may be stored: in time order, inside the recording, and with nothing naming a hidden element.
 * Run by the recorder before the upload and by the service when the events arrive, so a hidden element stays out of
 * what is stored whoever sent it.
 */
export function sealWalkthroughEvents(input: WalkthroughEvents): WalkthroughEvents {
  const hidden = [...new Set(input.hidden)].slice(0, WALKTHROUGH_HIDDEN_MAX);
  const hiddenSet = new Set(hidden);
  const durationMs = Math.max(0, Math.min(Math.round(input.durationMs), WALKTHROUGH_MAX_MS));
  const events = input.events
    .filter((e) => !(e.k === 'point' && hiddenSet.has(e.id)))
    .map((e) => ({ ...e, t: Math.max(0, Math.min(Math.round(e.t), durationMs)) }))
    // A stable sort: two events at the same moment keep the order they were made in.
    .sort((a, b) => a.t - b.t)
    .slice(0, WALKTHROUGH_EVENTS_MAX);
  return { ...input, v: 1, durationMs, hidden, events };
}

/** The events from the wire, checked and sealed, or null when they are not a walkthrough's. */
export function parseWalkthroughEvents(value: unknown): WalkthroughEvents | null {
  if (typeof value !== 'object' || value === null) return null;
  const v = value as Record<string, unknown>;
  if (v.v !== 1 || !isNumber(v.durationMs) || v.durationMs < 0) return null;
  if (typeof v.camera !== 'boolean') return null;
  if (!(WALKTHROUGH_CORNERS as readonly unknown[]).includes(v.corner)) return null;
  if (!isId(v.startTab)) return null;
  if (!Array.isArray(v.hidden) || v.hidden.length > WALKTHROUGH_HIDDEN_MAX) return null;
  if (!v.hidden.every(isId)) return null;
  if (typeof v.fingerprints !== 'object' || v.fingerprints === null) return null;
  const prints = Object.entries(v.fingerprints as Record<string, unknown>);
  if (prints.length > WALKTHROUGH_TABS_MAX) return null;
  const fingerprints: Record<string, string> = {};
  for (const [tab, print] of prints) {
    if (!isId(tab) || typeof print !== 'string' || print.length > WALKTHROUGH_FINGERPRINT_MAX) {
      return null;
    }
    fingerprints[tab] = print;
  }
  if (!Array.isArray(v.events) || v.events.length > WALKTHROUGH_EVENTS_MAX) return null;
  const events: WalkthroughEvent[] = [];
  for (const raw of v.events) {
    const event = parseEvent(raw);
    if (!event || event.t < 0 || event.t > v.durationMs) return null;
    events.push(event);
  }
  return sealWalkthroughEvents({
    v: 1,
    durationMs: v.durationMs,
    camera: v.camera,
    corner: v.corner as WalkthroughCorner,
    startTab: v.startTab,
    hidden: v.hidden as string[],
    fingerprints,
    events,
  });
}

const refuse = (status: number, error: string, extra: Record<string, unknown> = {}) =>
  ({ ok: false, refusal: { status, body: { error, ...extra } } }) as const;

/** A start's body, checked cheapest first, or the refusal to answer (the spec's "Refusals"). */
export function parseWalkthroughStart(
  value: unknown,
): { ok: true; start: WalkthroughStart } | { ok: false; refusal: WalkthroughRefusal } {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return refuse(400, 'invalid_body');
  }
  const body = value as Record<string, unknown>;
  if (!isId(body.item)) return refuse(400, 'invalid_item');
  const mediaType = walkthroughMediaType(body.mediaType);
  if (!mediaType)
    return refuse(415, 'unsupported_type', { acceptedTypes: ACCEPTED_WALKTHROUGH_TYPES });
  const mediaBytes = body.mediaBytes;
  if (!Number.isInteger(mediaBytes) || (mediaBytes as number) <= 0) {
    return refuse(400, 'invalid_size');
  }
  if ((mediaBytes as number) > WALKTHROUGH_MEDIA_MAX_BYTES) {
    return refuse(413, 'file_too_large', { limitBytes: WALKTHROUGH_MEDIA_MAX_BYTES });
  }
  const raw = body.events as { durationMs?: unknown } | null | undefined;
  if (isNumber(raw?.durationMs) && raw.durationMs > WALKTHROUGH_MAX_MS) {
    return refuse(413, 'too_long', { limitMs: WALKTHROUGH_MAX_MS });
  }
  const events = parseWalkthroughEvents(body.events);
  if (!events) return refuse(400, 'invalid_events');
  return {
    ok: true,
    start: {
      item: body.item,
      title: normaliseWalkthroughTitle(body.title),
      author: normaliseWalkthroughAuthor(body.author),
      mediaType,
      mediaBytes: mediaBytes as number,
      events,
    },
  };
}

/** A refusal in words a person can act on, for the recorder's save card. */
export function walkthroughRefusalMessage(
  body: { error?: unknown } & Record<string, unknown>,
): string {
  switch (body.error) {
    case 'file_too_large':
      return `This walkthrough is over ${WALKTHROUGH_MEDIA_MAX_MB} MB, the most one may be.`;
    case 'too_long':
      return 'This walkthrough is over 10 minutes, the longest one may be.';
    case 'item_full':
      return `This already has ${WALKTHROUGHS_PER_ITEM_MAX} walkthroughs. Delete one to save another.`;
    case 'walkthroughs_full':
      return body.reason === 'bytes'
        ? 'Your walkthroughs have used all the space you have for them. Delete one to save another.'
        : `You have ${String(body.limit)} walkthroughs already. Delete one to save another.`;
    case 'unsupported_type':
      return "This browser recorded in a format that can't be kept. Try Chrome, Edge, Firefox or Safari.";
    case 'forbidden':
      return 'Only an Editor can save a walkthrough here.';
    case 'walkthroughs_unavailable':
      return "Walkthroughs can't be saved right now. Try again in a moment.";
    default:
      return "The walkthrough couldn't be saved. Try again.";
  }
}
