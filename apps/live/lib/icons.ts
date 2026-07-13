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
//
// This module is the SYNCHRONOUS API surface only. The catalogue data
// (@livediagram/icons icon-catalog-1/2, ~36 kB of glyph geometry) loads as an async chunk
// through lib/icon-registry.ts, keeping it out of the editor's first-load
// JS. Nothing here may import those data modules statically; until the
// chunk lands, lookups fall back to PLACEHOLDER_ICON and list views come
// back empty (the consumers subscribe via useIconCatalogs and re-render
// when the data arrives).

import type { CSSProperties } from 'react';
import {
  ANIMATION_SPEED_FACTOR,
  DEFAULT_ANIMATION_SPEED,
  type AnimationSpeed,
  type IconAnimation,
} from '@livediagram/diagram';

import type { IconDef, IconPrim } from './icon-types';
import { getIconLoaded, getLoadedIconCatalog } from './icon-registry';

export type { IconDef, IconPrim };

// DataTransfer MIME for dragging a palette icon onto a shape. Shared by
// the palette (drag source) and BoxedElementView (drop target) so the
// type string can't drift. Value carried = the icon id.
export const ICON_DND_MIME = 'application/x-livediagram-icon';

// Drag-from-palette MIME: a palette tile dragged onto the canvas drops a new
// element at that point. Value carried = the ShapeKind (shapes + devices).
export const PALETTE_DND_MIME = 'application/x-livediagram-palette';

// The full catalogue (part 1 then part 2, so index 0 is still the default
// icon — the registry preserves that order when it assembles the parts).
// Empty until the async catalogue chunk loads; callers that render the list
// (the Icons picker, palette search) subscribe via useIconCatalogs so they
// re-run once the data lands. A function rather than an exported const so
// there is no stale module-level snapshot of the pre-load empty array.
export function getIconCatalog(): IconDef[] {
  return getLoadedIconCatalog();
}

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

// The inline custom properties for an icon animation: the duration
// multiplier (`--lvd-icon-anim-speed`, undefined speed = the shared 'slow'
// default) and the iteration count (`--lvd-icon-anim-iter`, repeat false =
// play once and hold; undefined / true loops). Shared by IconGlyph /
// IconPrims (line-art) and TechIconGlyph (brand marks) so the two can't
// drift.
export function iconAnimationStyle(
  speed: AnimationSpeed | undefined,
  repeat?: boolean,
): CSSProperties | undefined {
  const resolved = speed ?? DEFAULT_ANIMATION_SPEED;
  const style: Record<string, number> = {};
  if (resolved !== 'normal') style['--lvd-icon-anim-speed'] = ANIMATION_SPEED_FACTOR[resolved];
  if (repeat === false) style['--lvd-icon-anim-iter'] = 1;
  return Object.keys(style).length > 0 ? (style as CSSProperties) : undefined;
}

// The `--lvd-{prefix}-speed` / `-iter` custom properties the per-element
// animation keyframes read (progress / pie / rating). `speed` maps to its
// duration multiplier (undefined = normal); `loops` selects an infinite vs
// single iteration. Shared so the var-naming + the speed/iter mapping live in
// one place; callers spread the result into their own style object.
export function animSpeedVars(
  prefix: string,
  speed: AnimationSpeed | undefined,
  loops: boolean,
): CSSProperties {
  return {
    [`--lvd-${prefix}-speed`]: ANIMATION_SPEED_FACTOR[speed ?? DEFAULT_ANIMATION_SPEED],
    [`--lvd-${prefix}-iter`]: loops ? 'infinite' : 1,
  } as CSSProperties;
}

// Fallback when an iconId isn't in the catalogue (e.g. a diagram saved
// against a newer build) — and, since the catalogue went async, ALSO the
// interim glyph every icon shows for the moment before the catalogue chunk
// loads: a simple framed question mark so the element is still visibly an
// icon placeholder rather than empty space (or a blank that pops in late).
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

// Resolves a glyph, falling back to the placeholder for unknown ids AND
// while the catalogue chunk is still in flight — so the render path never
// branches on load state; it just re-renders (via useIconCatalogs) once the
// real glyph is available.
export function getIcon(id: string | undefined): IconDef {
  return getIconLoaded(id) ?? PLACEHOLDER_ICON;
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
// order. Unknown category id → empty; also empty until the catalogue
// chunk loads (the picker subscribes and re-runs).
export function iconsInCategory(categoryId: string): IconDef[] {
  const cat = ICON_CATEGORIES.find((c) => c.id === categoryId);
  if (!cat) return [];
  const ids = new Set(cat.iconIds);
  return getLoadedIconCatalog().filter((i) => ids.has(i.id));
}
