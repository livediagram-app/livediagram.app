// Curated single-colour icon catalogue for the "icon" shape kind
// (spec/09 "Icons" accordion). Each glyph is a small set of stroke
// primitives drawn in a 0..24 viewBox, rendered with the element's
// stroke colour (fill="none") so an icon tints + themes like a line
// drawing. The geometry is deliberately Feather / Lucide-flavoured:
// simple, recognisable, single-weight outlines.
//
// `iconId` on a ShapeElement keys into this catalogue. It is a plain
// string in the data model (NOT a closed enum) so adding an icon is a
// one-file change with no schema migration; an unknown id renders the
// PLACEHOLDER glyph rather than vanishing.

import type { CSSProperties } from 'react';
import {
  ANIMATION_SPEED_FACTOR,
  type AnimationSpeed,
  type IconAnimation,
} from '@livediagram/diagram';

import type { IconDef, IconPrim } from './icon-types';
import { ICON_CATALOG_1 } from './icon-catalog-1';
import { ICON_CATALOG_2 } from './icon-catalog-2';

export type { IconDef, IconPrim };

// DataTransfer MIME for dragging a palette icon onto a shape. Shared by
// the palette (drag source) and BoxedElementView (drop target) so the
// type string can't drift. Value carried = the icon id.
export const ICON_DND_MIME = 'application/x-livediagram-icon';

// Drag-from-palette MIME: a palette tile dragged onto the canvas drops a new
// element at that point. Value carried = the ShapeKind (shapes + devices).
export const PALETTE_DND_MIME = 'application/x-livediagram-palette';

// The full catalogue, assembled from the two data modules (split so each
// data file stays well under the ~1000-line budget). Order is preserved:
// part 1 then part 2, so ICON_CATALOG[0] is still the default icon.
export const ICON_CATALOG: IconDef[] = [...ICON_CATALOG_1, ...ICON_CATALOG_2];

// The globals.css class for an `lvd-{prefix}-{anim}` keyframe set (undefined
// anim = static, no class). The shared shape behind the per-element animation
// classes — icon glyphs, rating stars, pie slices — so the `lvd-` naming
// convention lives in one place.
export function animClass(prefix: string, anim: string | null | undefined): string | undefined {
  return anim ? `lvd-${prefix}-${anim}` : undefined;
}

// Animated icons (spec/09): any icon can opt into a looping animation via the
// icon context menu (the `iconAnimation` field on the element). This maps the
// chosen IconAnimation to its globals.css class; undefined = a static glyph.
// (Previously a few icon ids were hard-wired to always animate; that's gone —
// the catalogue glyphs are static unless the element asks for motion.)
export function iconAnimationClass(anim: IconAnimation | undefined): string | undefined {
  return animClass('icon', anim);
}

// The duration multiplier for an icon animation, exposed to the `lvd-icon-*`
// keyframes as the `--lvd-icon-anim-speed` custom property. undefined speed =
// normal (factor 1, no inline style needed). Shared by IconGlyph / IconPrims
// (line-art) and TechIconGlyph (brand marks) so the two can't drift.
export function iconAnimationSpeedStyle(
  speed: AnimationSpeed | undefined,
): CSSProperties | undefined {
  if (!speed || speed === 'normal') return undefined;
  return { '--lvd-icon-anim-speed': ANIMATION_SPEED_FACTOR[speed] } as CSSProperties;
}

// Fallback when an iconId isn't in the catalogue (e.g. a diagram saved
// against a newer build): a simple framed question mark so the element
// is still visibly an icon placeholder rather than empty space.
export const PLACEHOLDER_ICON: IconDef = {
  id: '__placeholder__',
  label: 'Unknown icon',
  keywords: '',
  prims: [
    { t: 'rect', x: 3, y: 3, w: 18, h: 18, rx: 3 },
    { t: 'path', d: 'M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.8.4-1.5 1-1.5 1.9v.3' },
    { t: 'line', x1: 12, y1: 17, x2: 12.01, y2: 17 },
  ],
};

export const DEFAULT_ICON_ID = ICON_CATALOG[0]!.id;

const ICON_BY_ID = new Map(ICON_CATALOG.map((i) => [i.id, i]));

export function getIcon(id: string | undefined): IconDef {
  return (id && ICON_BY_ID.get(id)) || PLACEHOLDER_ICON;
}

// Case-insensitive search over label + keywords + id. Empty query
// returns the whole catalogue (the picker shows everything by default).
export function searchIcons(query: string): IconDef[] {
  const q = query.trim().toLowerCase();
  if (!q) return ICON_CATALOG;
  return ICON_CATALOG.filter(
    (i) => i.label.toLowerCase().includes(q) || i.keywords.includes(q) || i.id.includes(q),
  );
}

// Theme chips for the Icons accordion: a handful of categories so the
// user can narrow ~35 glyphs to the dozen related to what they're
// drawing. Kept as id-lists here (rather than a per-icon field) so the
// catalogue entries stay focused on geometry; an icon may sit in one
// category. The picker prepends an "All" chip itself.
export type IconCategory = { id: string; label: string; iconIds: string[] };

export const ICON_CATEGORIES: IconCategory[] = [
  {
    id: 'animated',
    label: 'Animated',
    iconIds: ['spinner', 'gear', 'heartbeat', 'signal'],
  },
  {
    id: 'tech',
    label: 'Tech',
    iconIds: [
      'server',
      'database',
      'cloud',
      'cpu',
      'terminal',
      'code',
      'git-branch',
      'package',
      'wifi',
      'monitor',
      'smartphone',
      'globe',
      'layers',
      'box',
      'power',
      'external-link',
      'hard-drive',
      'bluetooth',
      'battery',
      'cast',
      'command',
      'share-2',
    ],
  },
  {
    id: 'people',
    label: 'People',
    iconIds: [
      'user',
      'users',
      'heart',
      'message',
      'mail',
      'phone',
      'user-plus',
      'user-check',
      'smile',
      'award',
      'thumbs-up',
    ],
  },
  {
    id: 'security',
    label: 'Security',
    iconIds: ['shield', 'lock', 'key', 'unlock', 'eye-off'],
  },
  {
    id: 'files',
    label: 'Files',
    iconIds: [
      'folder',
      'file',
      'image',
      'clipboard',
      'book',
      'download',
      'upload',
      'file-text',
      'file-plus',
      'folder-plus',
      'save',
      'archive',
      'paperclip',
    ],
  },
  {
    id: 'charts',
    label: 'Charts',
    iconIds: [
      'bar-chart',
      'pie-chart',
      'trending-up',
      'activity',
      'dollar-sign',
      'credit-card',
      'cart',
      'briefcase',
      'trending-down',
      'percent',
      'target',
    ],
  },
  {
    id: 'arrows',
    label: 'Arrows',
    iconIds: ['arrow-right', 'arrow-left', 'arrow-up', 'arrow-down', 'send'],
  },
  {
    id: 'furniture',
    label: 'Furniture',
    iconIds: [
      'bed',
      'sofa',
      'armchair',
      'chair',
      'dining-table',
      'coffee-table',
      'tv',
      'desk',
      'wardrobe',
      'bathtub',
      'toilet',
      'sink',
      'stove',
      'fridge',
      'plant',
      'door',
      'stairs',
    ],
  },
  {
    id: 'ui',
    label: 'UI',
    iconIds: [
      'settings',
      'search',
      'bell',
      'star',
      'home',
      'link',
      'zap',
      'check-circle',
      'alert-triangle',
      'calendar',
      'clock',
      'map-pin',
      'eye',
      'edit',
      'trash',
      'filter',
      'tag',
      'flag',
      'plus',
      'check',
      'x',
      'camera',
      'tool',
      'menu',
      'more-horizontal',
      'refresh-cw',
      'info',
      'help-circle',
      'sliders',
      'bookmark',
      'share',
      'copy',
      'sun',
      'moon',
      'alert-octagon',
    ],
  },
];

// Icons in a category (existing catalogue entries only), in catalogue
// order. Unknown category id → empty.
export function iconsInCategory(categoryId: string): IconDef[] {
  const cat = ICON_CATEGORIES.find((c) => c.id === categoryId);
  if (!cat) return [];
  const ids = new Set(cat.iconIds);
  return ICON_CATALOG.filter((i) => ids.has(i.id));
}
