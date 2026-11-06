// The meeting pieces (docs/specs/009-elements/screen-and-room-sign.md): a Screen that shows a share from someone in
// its room, and a Room Sign that says whether its room is free. What both stand for, the room each belongs to, the
// Screen's video link and the Sign's words. Pure: no React, no DOM. Who is inside a room and who is sharing are
// presence and the call, read by the editor; nothing here is stored about them.

import { embedTargetFor, type EmbedTarget } from './youtube';
import type { CallZone } from './call-geometry';

export type MeetingPieceKind = 'screen' | 'room-sign';
export const MEETING_PIECE_KINDS: readonly MeetingPieceKind[] = ['screen', 'room-sign'];

export function isMeetingPieceShape(kind: string): kind is MeetingPieceKind {
  return kind === 'screen' || kind === 'room-sign';
}

/** Each piece's design box, the size a new one is placed at; both are aspect locked. */
export const MEETING_PIECE_SIZE: Readonly<
  Record<MeetingPieceKind, { width: number; height: number }>
> = {
  screen: { width: 192, height: 120 },
  'room-sign': { width: 136, height: 72 },
};

/** A piece outside every room belongs to the nearest one whose floor is within this many canvas px of its centre. */
export const MEETING_PIECE_REACH_PX = 64;

type Box = {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
};

// How far a point is from a zone's box: 0 inside it.
function gapTo(x: number, y: number, z: CallZone): number {
  const dx = Math.max(z.x0 - x, 0, x - z.x1);
  const dy = Math.max(z.y0 - y, 0, y - z.y1);
  return Math.hypot(dx, dy);
}

/**
 * The room (or Office Pod) a Screen or Room Sign belongs to (the spec's "A piece's room"): the innermost zone its
 * centre is inside, else the nearest within MEETING_PIECE_REACH_PX (ties to the smaller, then the lower id), else null.
 */
export function meetingPieceRoom(el: Box, zones: readonly CallZone[]): string | null {
  const x = el.x + el.width / 2;
  const y = el.y + el.height / 2;
  let best: CallZone | null = null;
  let bestGap = Infinity;
  for (const z of zones) {
    let gap = gapTo(x, y, z);
    // A Room Builder room's box can hold corners outside its outline; the box is close enough for "beside it".
    if (gap > MEETING_PIECE_REACH_PX) continue;
    // Inside counts as 0, and among those inside the innermost (smallest) wins.
    gap = gap === 0 ? -1 / z.area : gap;
    if (
      !best ||
      gap < bestGap ||
      (gap === bestGap && (z.area < best.area || (z.area === best.area && z.id < best.id)))
    ) {
      best = z;
      bestGap = gap;
    }
  }
  return best?.id ?? null;
}

// --- The Screen ----------------------------------------------------------------

/** The longest Video Link a Screen keeps. */
export const SCREEN_URL_MAX = 2048;

/** What `screenUrl` may hold: an http(s) address of at most SCREEN_URL_MAX characters. */
export function isScreenUrl(v: unknown): v is string {
  return typeof v === 'string' && v.length <= SCREEN_URL_MAX && /^https?:\/\/\S+$/i.test(v);
}

const SCREEN_PROVIDERS: ReadonlySet<string> = new Set(['youtube', 'vimeo', 'loom']);

/** A Screen's video: the embed for a YouTube, Vimeo or Loom link (the embeds' own parser), or null for anything else. */
export function screenVideoTarget(url: string | undefined): EmbedTarget | null {
  if (!url) return null;
  const target = embedTargetFor(url);
  return target && SCREEN_PROVIDERS.has(target.provider) ? target : null;
}

/**
 * The Screen's drawing on its 192 × 120 design box: the bezel, the panel inside it and the status light on the
 * bezel's lower edge, shared by the canvas and the export so both draw the same screen.
 */
export const SCREEN_ART = {
  bezel: { x: 0, y: 0, w: 192, h: 120, rx: 8 },
  panel: { x: 6, y: 6, w: 180, h: 104, rx: 3 },
  light: { cx: 96, cy: 115, r: 1.8 },
  // A soft shadow on the wall behind, offset down and right.
  shadow: { dx: 3, dy: 5, opacity: 0.18 },
  tones: {
    bezel: '#1f2937',
    bezelEdge: '#4b5563',
    panel: '#0f172a',
    panelLit: '#111827',
    ink: '#94a3b8',
  },
} as const;

/** The idle face's words. */
export const SCREEN_IDLE_TEXT = 'No one is sharing';

// --- The Room Sign -------------------------------------------------------------

export type RoomSignStatus = 'free' | 'in-use' | 'dnd';

/** The status dot's colour, per status, the same on light and dark paper. */
export const ROOM_SIGN_TONES: Readonly<Record<RoomSignStatus, string>> = {
  free: '#22c55e',
  'in-use': '#f59e0b',
  dnd: '#ef4444',
};

/**
 * The Room Sign's drawing on its 136 × 72 design box: a plaque with a status stripe down its left edge, two screws,
 * the name on the first line, the status dot and line on the second, and the Knock button at the lower right. Shared
 * by the canvas and the export. The plaque is light on light paper and slate on dark.
 */
export const ROOM_SIGN_ART = {
  plaque: { w: 136, h: 72, rx: 8 },
  stripe: 5,
  screws: [
    { cx: 128, cy: 8 },
    { cx: 128, cy: 64 },
  ],
  name: { x: 16, y: 25, size: 14 },
  status: { dotX: 20, y: 44, size: 11 },
  knock: { x: 74, y: 50, w: 50, h: 16 },
  tones: {
    light: {
      plaque: '#ffffff',
      edge: '#cbd5e1',
      ink: '#0f172a',
      soft: '#475569',
      screw: '#cbd5e1',
    },
    dark: { plaque: '#1e293b', edge: '#475569', ink: '#f1f5f9', soft: '#cbd5e1', screw: '#64748b' },
  },
} as const;

/** How long a room has been in use, as the sign says it: "Just now", "5 min", "1 h 20 min". */
export function inUseFor(ms: number): string {
  const minutes = Math.floor(Math.max(0, ms) / 60_000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

/** The sign's status line: "Free", "In Use · 3 · 12 min" or "Do Not Disturb". */
export function roomSignLine(status: RoomSignStatus, count: number, inUseMs: number): string {
  if (status === 'free') return 'Free';
  if (status === 'dnd') return 'Do Not Disturb';
  return `In Use · ${count} · ${inUseFor(inUseMs)}`;
}

/** The sign's name: its room's label, an Office Pod's label or "Office Pod", or "No Room". */
export function roomSignName(room: { shape?: string; label?: string } | null): string {
  if (!room) return 'No Room';
  const label = (room.label ?? '').trim();
  if (label) return label;
  return room.shape === 'office-pod' ? 'Office Pod' : 'Room';
}
