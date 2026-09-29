// The small parts the modern Collaborate cards are built from, for the
// headless render (docs/specs/020-import-export/export-fidelity.md): the same parts the canvas composes its
// cards from (apps/live collab/qa/qa-parts, CollabComposer, CollabPanel), at
// the canvas's own sizes, so a card built from them exports the way it looks.
// Every size here is a canvas class, noted beside it.

import type { QaNote } from './qa-board';
import { r2, xmlEscape } from './svg-render-primitives';
import { PAD_Y, personDisc, text, type CollabAccent } from './svg-render-face-kit';

// Where a CollabPanel's body starts: the 14px padding, the header row (as
// tall as its 24px settings button, not the 13px title alone), and the 10px
// gap under it.
export const BODY_TOP = PAD_Y + 31;
export const BODY_GAP = 10;

// ── Glyphs: the canvas's own 16-unit paths, dropped in at size ────────────

export const GLYPH = {
  up: 'M3.5 10 8 5.5l4.5 4.5',
  check: 'm3.5 8.5 3 3 6-7',
  send: 'M8 13V3.5M3.8 7.5 8 3.3l4.2 4.2',
  plus: 'M8 3.5v9M3.5 8h9',
  bubble:
    'M3 2.8h10a1.2 1.2 0 0 1 1.2 1.2v6.2a1.2 1.2 0 0 1-1.2 1.2H7.4L4.2 14v-2.6H3a1.2 1.2 0 0 1-1.2-1.2V4A1.2 1.2 0 0 1 3 2.8Z',
  clipboard:
    'M5.5 2.8h5M5.5 2.8a1 1 0 0 0-1 1v.2h7v-.2a1 1 0 0 0-1-1M4.5 3.4H3.6a1 1 0 0 0-1 1v8.6a1 1 0 0 0 1 1h8.8a1 1 0 0 0 1-1V4.4a1 1 0 0 0-1-1h-.9M5.6 9.2l1.7 1.7 3.2-3.6',
  eye: 'M1.8 8S4.2 3.8 8 3.8 14.2 8 14.2 8 11.8 12.2 8 12.2 1.8 8 1.8 8Z M9.8 8a1.8 1.8 0 1 1-3.6 0 1.8 1.8 0 0 1 3.6 0Z',
  scatter:
    'M3 6h3a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1Z M10 3h3a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-3a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z M9 10h2a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1v-2a1 1 0 0 1 1-1Z',
  reopen: 'M4 6.5A4.5 4.5 0 1 1 3.5 10M4 3v3.5h3.5',
  // RollCallFace's ClipboardGlyph: a board with a tick on it.
  roll: 'M5.3 3h5.4a1.8 1.8 0 0 1 1.8 1.8v7.4a1.8 1.8 0 0 1-1.8 1.8H5.3a1.8 1.8 0 0 1-1.8-1.8V4.8A1.8 1.8 0 0 1 5.3 3Z M6 3V2h4v1M6 8.5l1.5 1.5L10.5 7',
  // qa-parts' SparkGlyph: something new is wanted here.
  spark: 'M8 2.2 9.3 6.7 13.8 8 9.3 9.3 8 13.8 6.7 9.3 2.2 8 6.7 6.7Z M12.6 2.4v2.4M11.4 3.6h2.4',
  mask: 'M1.8 7.6h12.4 M4 7.6 5.2 3.4h5.6L12 7.6 M6.9 11a1.9 1.9 0 1 1-3.8 0 1.9 1.9 0 0 1 3.8 0Z M12.9 11a1.9 1.9 0 1 1-3.8 0 1.9 1.9 0 0 1 3.8 0Z M6.9 11h2.2',
} as const;

/** A 16-unit stroke glyph centred at (cx, cy), `size` across, 1.5px lines. */
export function glyph(cx: number, cy: number, size: number, color: string, d: string): string {
  const k = size / 16;
  return `<path d="${d}" transform="translate(${r2(cx - size / 2)} ${r2(cy - size / 2)}) scale(${r2(k)})" fill="none" stroke="${xmlEscape(color)}" stroke-width="${r2(1.5 / k)}" stroke-linecap="round" stroke-linejoin="round"/>`;
}

export function roundRect(
  x: number,
  y: number,
  w: number,
  h: number,
  rx: number,
  fill: string,
  opacity: number,
  stroke?: { color: string; opacity: number; dash?: string },
): string {
  return (
    `<rect x="${r2(x)}" y="${r2(y)}" width="${r2(Math.max(0, w))}" height="${r2(Math.max(0, h))}" rx="${r2(rx)}" fill="${xmlEscape(fill)}" fill-opacity="${opacity}"` +
    (stroke
      ? ` stroke="${xmlEscape(stroke.color)}" stroke-opacity="${stroke.opacity}"${stroke.dash ? ` stroke-dasharray="${stroke.dash}"` : ''}`
      : '') +
    '/>'
  );
}

/** "now" / "12m" / "3h" / "4d": a note's age, as the canvas's relTime. */
export function relativeAge(at: number, now = Date.now()): string {
  const s = Math.max(0, Math.round((now - at) / 1000));
  if (s < 45) return 'now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.round(h / 24)}d`;
}

/** "5 mins ago" / "2 hours ago" / "yesterday" / "354 days ago": a comment's
 *  age, as the canvas's relativeSince (apps/live lib/relative-time). */
export function relativeSince(at: number, now = Date.now()): string {
  const seconds = Math.floor((now - at) / 1000);
  if (seconds < 5) return 'just now';
  if (seconds < 60) return `${seconds} secs ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes === 1) return '1 min ago';
  if (minutes < 60) return `${minutes} mins ago`;
  const hours = Math.floor(minutes / 60);
  if (hours === 1) return '1 hour ago';
  if (hours < 24) return `${hours} hours ago`;
  const days = Math.floor(hours / 24);
  return days === 1 ? 'yesterday' : `${days} days ago`;
}

// ── Composed parts ────────────────────────────────────────────────────────

export const ACCENT_BAR_H = 32;

/** The dashed accent bar a board's one facilitator act sits in (AccentBar):
 *  py-2, rounded-xl, a dashed accent border over a 5% accent wash. */
export function accentBar(
  x: number,
  y: number,
  w: number,
  label: string,
  a: CollabAccent,
  icon?: string,
  // How many things the act covers, as a count badge in the accent.
  count?: number,
): string {
  const labelW = label.length * 5.9;
  const badgeW = count !== undefined ? 22 : 0;
  const start = x + w / 2 - (labelW + (icon ? 18 : 0) + badgeW) / 2;
  return (
    roundRect(x, y, w, ACCENT_BAR_H, 12, a.accent, 0.05, {
      color: a.accent,
      opacity: 0.45,
      dash: '4 3',
    }) +
    (icon ? glyph(start + 6, y + ACCENT_BAR_H / 2, 12, a.ink, icon) : '') +
    text(start + (icon ? 18 : 0), y + 20, label, { size: 11, weight: 600, color: a.ink }) +
    (count !== undefined
      ? roundRect(start + (icon ? 18 : 0) + labelW + 6, y + 8, 16, 16, 8, a.accent, 1) +
        text(start + (icon ? 18 : 0) + labelW + 14, y + 19.5, String(count), {
          size: 10,
          weight: 700,
          color: a.on,
          anchor: 'middle',
        })
      : '')
  );
}

export const COMPOSER_H = 64;
export const COMPOSER_BARE_H = 40;

/** The composer at a board's foot (CollabComposer): a rounded field with the
 *  round accent send button, and a line of meta under it. */
export function composer(
  x: number,
  y: number,
  w: number,
  placeholder: string,
  color: string,
  a: CollabAccent,
  // The line under the field; absent, the composer is just the field (40px).
  meta?: string,
): string {
  const h = meta ? COMPOSER_H : COMPOSER_BARE_H;
  return (
    roundRect(x, y, w, h, 16, color, 0.03, { color, opacity: 0.16 }) +
    text(x + 14, y + 25, placeholder, { size: 12, color, opacity: 0.45 }) +
    // The send button as it rests with nothing typed: the whole button at 35%
    // (disabled:opacity-35), arrow included.
    `<g opacity="0.35"><circle cx="${r2(x + w - 20)}" cy="${r2(y + 20)}" r="14" fill="${xmlEscape(a.accent)}"/>` +
    glyph(x + w - 20, y + 20, 13, a.on, GLYPH.send) +
    '</g>' +
    (meta ?? '')
  );
}

/** A small chip in the accent, with a glyph: the Idea box's Anonymous badge. */
export function accentChip(x: number, y: number, label: string, a: CollabAccent, icon?: string) {
  const w = label.length * 5.8 + (icon ? 22 : 12);
  return (
    roundRect(x, y, w, 18, 9, a.accent, 0.14) +
    (icon ? glyph(x + 10, y + 9, 11, a.ink, icon) : '') +
    text(x + (icon ? 19 : 6), y + 12.5, label, { size: 10, weight: 600, color: a.ink })
  );
}

/** The 36x42 box on the left of a board row: a vote count under its chevron
 *  (VotePill), or an idea's number (IdeaRow). */
export function countBox(x: number, y: number, value: string, color: string, chevron: boolean) {
  return (
    roundRect(x, y, 36, 42, 12, color, 0.06, { color, opacity: 0.16 }) +
    (chevron ? glyph(x + 18, y + 13, 12, color, GLYPH.up) : '') +
    text(x + 18, y + (chevron ? 31 : 25.5), value, {
      size: 13,
      weight: 700,
      color,
      anchor: 'middle',
    })
  );
}

/** Who wrote it (AuthorChip): an initial on their colour, or the mask. */
export function authorChip(x: number, cy: number, author: QaNote['author'], color: string) {
  if (!author) {
    return (
      `<circle cx="${r2(x + 7)}" cy="${r2(cy)}" r="7" fill="${xmlEscape(color)}" fill-opacity="0.1"/>` +
      glyph(x + 7, cy, 10, color, GLYPH.mask) +
      text(x + 18, cy + 3.5, 'Anonymous', { size: 10, color, opacity: 0.6 })
    );
  }
  return (
    personDisc(x + 7, cy, 7, color, {
      initials: author.name.trim().charAt(0).toUpperCase() || '?',
      fill: author.color,
    }) + text(x + 18, cy + 3.5, author.name, { size: 10, color, opacity: 0.7 })
  );
}
