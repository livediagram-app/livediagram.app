// The Stickers palette category (spec/116): the browse groups over the sticker
// catalogue, plus the lookups the Stickers tab and the canvas need.
//
// A sticker is its own element kind (`shape: 'sticker'` carrying a
// `stickerId`), not an icon: it paints its own die-cut plate and shadow, tilts
// when you drop it, is never tinted by the theme, carries no caption, and
// never folds into another shape. This module owns the grouping and the
// lookups; the artwork itself lives in @livediagram/icons so every renderer
// draws the same sticker.
//
// Like lib/icons.ts this is a SYNCHRONOUS surface over an async catalogue
// chunk: until it lands the lists come back empty and the tab shows its
// loading note (consumers subscribe via useIconCatalogs).

import { STICKER_ASPECT, type StickerDef } from '@livediagram/icons';
import { getLoadedStickerCatalog, getStickerLoaded } from '@/lib/icon-registry';

// DataTransfer MIME for dragging a sticker out of the palette onto the canvas.
// Its OWN mime, not the icon one: an icon dropped on a shape folds into that
// shape's label, and a sticker must never do that — it lands as a sticker
// wherever you let go.
export const STICKER_DND_MIME = 'application/x-livediagram-sticker';

export type StickerCategory = {
  id: string;
  label: string;
  stickerIds: string[];
};

// The eleven groups, in palette order: the badges first (the ones that direct
// a board), then what you say back to someone, how you feel, what state a
// thing is in, where to look, and the decorative and prop sets. Groups are
// disjoint — a sticker has exactly one home, pinned by stickers.test.ts — so
// browsing never shows the same tile twice; search runs across all of them
// regardless.
export const STICKER_CATEGORIES: StickerCategory[] = [
  {
    id: 'badges',
    label: 'Badges',
    stickerIds: [
      'badge-approved',
      'badge-done',
      'badge-shipped',
      'badge-final',
      'badge-decided',
      'badge-blocked',
      'badge-rejected',
      'badge-urgent',
      'badge-priority',
      'badge-deadline',
      'badge-p0',
      'badge-at-risk',
      'badge-wip',
      'badge-on-hold',
      'badge-p1',
      'badge-in-review',
      'badge-needs-review',
      'badge-next',
      'badge-owner',
      'badge-discuss',
      'badge-question',
      'badge-new',
      'badge-idea',
      'badge-must-have',
      'badge-mvp',
      'badge-nice-to-have',
      'badge-quick-win',
      'badge-todo',
      'badge-draft',
      'badge-parked',
      'badge-later',
      'badge-out-of-scope',
    ],
  },
  {
    id: 'reactions',
    label: 'Reactions',
    stickerIds: [
      'emoji-thumbs-up',
      'emoji-thumbs-down',
      'emoji-clap',
      'emoji-raised-hands',
      'emoji-ok-hand',
      'emoji-fist-bump',
      'emoji-victory',
      'emoji-crossed-fingers',
      'emoji-pray',
      'emoji-handshake',
      'emoji-muscle',
      'emoji-wave',
      'emoji-heart',
      'emoji-fire',
      'emoji-hundred',
      'emoji-eyes',
      'emoji-star',
    ],
  },
  {
    id: 'feelings',
    label: 'Feelings',
    stickerIds: [
      'emoji-smile',
      'emoji-laughing',
      'emoji-wink',
      'emoji-sweat-smile',
      'emoji-cool',
      'emoji-heart-eyes',
      'emoji-star-struck',
      'emoji-thinking-face',
      'emoji-neutral',
      'emoji-confused',
      'emoji-worried',
      'emoji-sad',
      'emoji-loudly-crying',
      'emoji-angry',
      'emoji-surprised',
      'emoji-mind-blown',
      'emoji-pleading',
      'emoji-sleepy',
      'emoji-weary',
      'emoji-relieved',
      'emoji-nerd',
      'emoji-partying-face',
      'emoji-shrug',
      'emoji-facepalm',
      'emoji-upside-down',
    ],
  },
  {
    id: 'status',
    label: 'Status',
    stickerIds: [
      'emoji-check',
      'emoji-cross',
      'emoji-warning',
      'emoji-question',
      'emoji-exclamation',
      'emoji-stop-sign',
      'emoji-no-entry',
      'emoji-construction',
      'emoji-green-circle',
      'emoji-yellow-circle',
      'emoji-red-circle',
      'emoji-flag',
      'emoji-hourglass',
      'emoji-new',
      'emoji-soon',
      'emoji-repeat',
      'emoji-recycle',
      'emoji-lock',
      'emoji-unlock',
      'emoji-shield',
      'emoji-chart-up',
      'emoji-chart-down',
      'emoji-bell',
      'emoji-siren',
    ],
  },
  {
    id: 'direction',
    label: 'Direction',
    stickerIds: [
      'emoji-arrow-right',
      'emoji-arrow-left',
      'emoji-arrow-up',
      'emoji-arrow-down',
      'emoji-arrow-upper-right',
      'emoji-arrow-lower-right',
      'emoji-loop',
      'emoji-point-right',
      'emoji-point-left',
      'emoji-point-up',
      'emoji-point-down',
      'emoji-raised-hand',
      'emoji-pushpin',
      'emoji-pin',
      'emoji-compass',
      'emoji-magnifier',
      'emoji-play',
      'emoji-chequered-flag',
      'emoji-top',
    ],
  },
  {
    id: 'celebrate',
    label: 'Celebrate',
    stickerIds: [
      'emoji-party-popper',
      'emoji-confetti',
      'emoji-balloon',
      'emoji-cake',
      'emoji-gift',
      'emoji-clinking-glasses',
      'emoji-fireworks',
      'emoji-trophy',
      'emoji-gold-medal',
      'emoji-sports-medal',
      'emoji-crown',
      'emoji-rocket',
      'emoji-bouquet',
      'emoji-ribbon',
    ],
  },
  {
    id: 'decorate',
    label: 'Decorate',
    stickerIds: [
      'emoji-sparkles',
      'emoji-glowing-star',
      'emoji-dizzy',
      'emoji-rainbow',
      'emoji-sun',
      'emoji-cloud',
      'emoji-crescent-moon',
      'emoji-snowflake',
      'emoji-zap',
      'emoji-collision',
      'emoji-blossom',
      'emoji-sunflower',
      'emoji-rose',
      'emoji-tulip',
      'emoji-clover',
      'emoji-herb',
      'emoji-butterfly',
      'emoji-gem',
      'emoji-art-palette',
      'emoji-orange-heart',
      'emoji-yellow-heart',
      'emoji-green-heart',
      'emoji-blue-heart',
      'emoji-purple-heart',
    ],
  },
  {
    id: 'meeting',
    label: 'Meeting',
    stickerIds: [
      'emoji-alarm-clock',
      'emoji-stopwatch',
      'emoji-clock',
      'emoji-calendar',
      'emoji-memo',
      'emoji-clipboard',
      'emoji-pencil',
      'emoji-notepad',
      'emoji-speech-balloon',
      'emoji-thought-balloon',
      'emoji-megaphone',
      'emoji-microphone',
      'emoji-headphones',
      'emoji-video-camera',
      'emoji-bar-chart',
      'emoji-ballot-box',
      'emoji-brain',
      'emoji-bulb',
      'emoji-coffee',
      'emoji-tea',
    ],
  },
  {
    id: 'work',
    label: 'Work',
    stickerIds: [
      'emoji-bug',
      'emoji-wrench',
      'emoji-hammer',
      'emoji-toolbox',
      'emoji-gear',
      'emoji-key',
      'emoji-folder',
      'emoji-file-cabinet',
      'emoji-package',
      'emoji-books',
      'emoji-money-bag',
      'emoji-target',
      'emoji-laptop',
      'emoji-desktop',
      'emoji-mobile',
      'emoji-phone',
      'emoji-email',
      'emoji-link',
      'emoji-scissors',
      'emoji-floppy',
      'emoji-globe',
      'emoji-battery',
      'emoji-plug',
      'emoji-test-tube',
      'emoji-microscope',
    ],
  },
  {
    id: 'people',
    label: 'People',
    stickerIds: [
      'emoji-person',
      'emoji-people',
      'emoji-bust',
      'emoji-raising-hand',
      'emoji-bowing',
      'emoji-detective',
      'emoji-worker',
      'emoji-runner',
      'emoji-walking',
      'emoji-standing',
    ],
  },
  {
    id: 'fun',
    label: 'Fun',
    stickerIds: [
      'emoji-robot',
      'emoji-alien',
      'emoji-ghost',
      'emoji-unicorn',
      'emoji-cat',
      'emoji-dog',
      'emoji-owl',
      'emoji-turtle',
      'emoji-pizza',
      'emoji-popcorn',
      'emoji-doughnut',
      'emoji-dice',
      'emoji-game',
      'emoji-music',
      'emoji-poo',
    ],
  },
];

// The whole catalogue, in catalogue order. Empty until the async chunk lands.
export function getStickerCatalog(): StickerDef[] {
  return getLoadedStickerCatalog();
}

// One sticker by id, or undefined for an unknown id / a not-yet-loaded
// catalogue. Unlike `getIcon` there is deliberately NO placeholder: a
// question-mark plate would be a worse answer than an empty box that fills in
// when the chunk arrives.
export function getSticker(id: string | undefined): StickerDef | undefined {
  return getStickerLoaded(id);
}

// Stickers in a group (existing catalogue entries only), in catalogue order.
// Unknown group id → empty.
export function stickersInCategory(categoryId: string): StickerDef[] {
  const cat = STICKER_CATEGORIES.find((c) => c.id === categoryId);
  if (!cat) return [];
  const ids = new Set(cat.stickerIds);
  return getStickerCatalog().filter((s) => ids.has(s.id));
}

// Cross-group search over label / keywords / id, and — for a badge — the word
// on the pill, so typing "approved" finds APPROVED even though nothing else
// about the entry says it. An empty query returns everything, so a caller can
// treat "no query" and "every sticker" the same way.
export function searchStickers(query: string): StickerDef[] {
  const q = query.trim().toLowerCase();
  if (!q) return getStickerCatalog();
  return getStickerCatalog().filter(
    (s) =>
      s.label.toLowerCase().includes(q) ||
      s.keywords.includes(q) ||
      s.id.includes(q) ||
      (s.kind === 'badge' && s.text.toLowerCase().includes(q)),
  );
}

// The drop size for a sticker, off its flavour's natural aspect (spec/116):
// an emoji is square, a badge is a wide pill, and both are one shape kind, so
// the per-kind default table can't express it alone.
export function stickerDropSize(
  def: StickerDef | undefined,
  base: { width: number; height: number },
): { width: number; height: number } {
  const aspect = STICKER_ASPECT[def?.kind ?? 'emoji'];
  return { width: Math.round(base.height * aspect), height: base.height };
}
