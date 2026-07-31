// The Stickers palette category (spec/116): the browse groups over the colour
// emoji held in the shared icon catalogue, plus the lookups the Stickers tab
// needs.
//
// A sticker IS an icon — same `IconDef`, same `icon` shape kind, same add /
// drag / favourite / export paths — so there is no data of our own here beyond
// the grouping. The one thing that separates the two catalogues is the id
// prefix (`isStickerId`), which keeps the Icons tab to line art and this tab
// to stickers with no overlap in either direction.
//
// Like lib/icons.ts this is a SYNCHRONOUS surface over an async catalogue
// chunk: until it lands the lists come back empty and the tab shows its
// loading note (consumers subscribe via useIconCatalogs).

import { isStickerId, type IconDef } from '@livediagram/icons';
import { getLoadedIconCatalog } from '@/lib/icon-registry';

export type StickerCategory = {
  id: string;
  label: string;
  stickerIds: string[];
};

// The ten groups, in palette order: what you say back to someone, how you
// feel, what state a thing is in, where to look, and then the decorative and
// prop sets. Groups are disjoint — a sticker has exactly one home, pinned by
// stickers.test.ts — so browsing never shows the same tile twice; search runs
// across all ten regardless.
export const STICKER_CATEGORIES: StickerCategory[] = [
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

// Every sticker in the loaded catalogue, in catalogue order. Empty until the
// async chunk lands.
export function getStickerCatalog(): IconDef[] {
  return getLoadedIconCatalog().filter((i) => isStickerId(i.id));
}

// Stickers in a group (existing catalogue entries only), in catalogue order.
// Unknown group id → empty.
export function stickersInCategory(categoryId: string): IconDef[] {
  const cat = STICKER_CATEGORIES.find((c) => c.id === categoryId);
  if (!cat) return [];
  const ids = new Set(cat.stickerIds);
  return getStickerCatalog().filter((i) => ids.has(i.id));
}

// Cross-group search over label / keywords / id, matching how the Icons tab
// searches. An empty query returns the whole sticker catalogue so the caller
// can treat "no query" and "every sticker" the same way.
export function searchStickers(query: string): IconDef[] {
  const q = query.trim().toLowerCase();
  if (!q) return getStickerCatalog();
  return getStickerCatalog().filter(
    (i) => i.label.toLowerCase().includes(q) || i.keywords.includes(q) || i.id.includes(q),
  );
}
