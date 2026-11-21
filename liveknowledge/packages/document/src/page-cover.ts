// A knowledgebase page's cover (docs/specs/030-knowledgebase/page-surface.md "The cover"): the band across the top of
// the page, stored on the tab (`Tab.cover`), one of three kinds. A picture (its reader and focus are the platform's,
// @liveworkspace/page-background/cover, a liveplanner form's cover too); a gradient or an animated background, each
// stored by its theme role (`theme-dawn`; `aurora` in `deep`), never as colours, so a cover follows the
// knowledgebase's style when it changes. The colours are the page backgrounds' own theme row and animated
// colourings (page-theme-fills.ts), which liveplanner's form cover offers too. Settled on every read.
import { parsePageCover, type PageCover } from '@liveworkspace/page-background/cover';
import { isPageImageId } from './page-image';
import { STEEL_GRADIENT } from './page-default-background';
import {
  PAGE_MOTIONS,
  PAGE_MOTION_SPEED_MAX,
  PAGE_MOTION_SPEED_MIN,
  isPageMotion,
  type PageFill,
  type PageMotion,
} from './page';
import {
  PAGE_MOTION_COLOURINGS,
  motionFill,
  themeBackgroundPresets,
  type PageMotionColouringId,
  type ThemeGradientName,
} from './page-theme-fills';
import type { ThemeDefinition } from './index';

export type { PageCover };
export {
  COVER_FOCUS_CENTRE,
  coverObjectPosition,
  movedCoverFocus,
  patchPageCover,
} from '@liveworkspace/page-background/cover';

/** A page background's gradient, named: the Background section's fixed gradients (a cover takes the theme's). */
export type GradientPreset = { id: string; label: string; from: string; to: string };

// Light ones first, then the deep ones.
export const PAGE_GRADIENT_PRESETS: readonly GradientPreset[] = [
  { id: 'sunrise', label: 'Sunrise', from: '#fde68a', to: '#fca5a5' },
  { id: 'peach', label: 'Peach', from: '#fed7aa', to: '#fecdd3' },
  { id: 'rose', label: 'Rose', from: '#ffe4e6', to: '#fbcfe8' },
  { id: 'lavender', label: 'Lavender', from: '#e9d5ff', to: '#fbcfe8' },
  { id: 'ocean', label: 'Ocean', from: '#bae6fd', to: '#c7d2fe' },
  { id: 'meadow', label: 'Meadow', from: '#bbf7d0', to: '#a5f3fc' },
  { id: 'mint', label: 'Mint', from: '#ccfbf1', to: '#d9f99d' },
  { id: 'sand', label: 'Sand', from: '#fef3c7', to: '#e7e5e4' },
  // A new slide document's slide (defaultPageBackground).
  { id: 'steel', label: 'Steel', ...STEEL_GRADIENT },
  { id: 'dusk', label: 'Dusk', from: '#1e1b4b', to: '#4c1d95' },
  { id: 'night', label: 'Night', from: '#0f172a', to: '#1e3a8a' },
  { id: 'forest', label: 'Forest', from: '#052e16', to: '#115e59' },
  { id: 'ember', label: 'Ember', from: '#7c2d12', to: '#be123c' },
];

/** The theme gradients a cover offers, by role: seven light, then seven bold and deep (page-theme-fills.ts). */
export const COVER_GRADIENTS: readonly ThemeGradientName[] = [
  'dawn',
  'mist',
  'glow',
  'haze',
  'sorbet',
  'pastel',
  'bloom',
  'bright',
  'vivid',
  'aurora',
  'ember',
  'dusk',
  'twilight',
  'ink',
];
export type CoverGradientId = `theme-${ThemeGradientName}`;
export const COVER_GRADIENT_IDS: readonly CoverGradientId[] = COVER_GRADIENTS.map(
  (g) => `theme-${g}` as const,
);
export const COVER_COLOURINGS: readonly PageMotionColouringId[] = PAGE_MOTION_COLOURINGS.map(
  (c) => c.id,
);
export { PAGE_MOTIONS as COVER_MOTIONS };

/** A page's cover: a picture (with where it sits and its credit), a theme gradient, or an animated background in a
 *  theme colouring, at a speed (1, its own pace, is left off). */
export type TabCover =
  | { imageId: string; focus?: number; credit?: string }
  | { gradient: CoverGradientId }
  | { motion: PageMotion; colouring: PageMotionColouringId; speed?: number };

export type CoverKind = 'image' | 'gradient' | 'animated';

/** The picture a cover names, if it is one. */
export const coverImageId = (cover: TabCover | undefined): string | undefined =>
  cover && 'imageId' in cover ? cover.imageId : undefined;

export const coverKindOf = (cover: TabCover): CoverKind =>
  'imageId' in cover ? 'image' : 'gradient' in cover ? 'gradient' : 'animated';

const isGradientId = (v: unknown): v is CoverGradientId =>
  typeof v === 'string' && (COVER_GRADIENT_IDS as readonly string[]).includes(v);
const isColouring = (v: unknown): v is PageMotionColouringId =>
  typeof v === 'string' && (COVER_COLOURINGS as readonly string[]).includes(v);
const isSpeed = (v: unknown): v is number =>
  typeof v === 'number' &&
  Number.isFinite(v) &&
  v >= PAGE_MOTION_SPEED_MIN &&
  v <= PAGE_MOTION_SPEED_MAX;

/** A page's cover as stored: what of it is valid, or none. A page's picture is a gallery id or an inline raster
 *  (an Offline knowledgebase's). A picture wins over a gradient, a gradient over a motion. */
export function parseTabCover(v: unknown): TabCover | undefined {
  if (!v || typeof v !== 'object') return undefined;
  const raw = v as Record<string, unknown>;
  const picture = parsePageCover(
    { imageId: raw.imageId, focus: raw.focus, credit: raw.credit },
    isPageImageId,
  );
  if (picture?.imageId) {
    const { imageId, focus, credit } = picture;
    return { imageId, ...(focus !== undefined ? { focus } : {}), ...(credit ? { credit } : {}) };
  }
  if (isGradientId(raw.gradient)) return { gradient: raw.gradient };
  if (isPageMotion(raw.motion) && isColouring(raw.colouring))
    return {
      motion: raw.motion,
      colouring: raw.colouring,
      ...(isSpeed(raw.speed) && raw.speed !== 1 ? { speed: raw.speed } : {}),
    };
  return undefined;
}

type ThemeColours = Partial<Pick<ThemeDefinition, 'elementStroke' | 'palette'>>;

/** The fill a gradient or animated cover paints, in the knowledgebase's theme: worked out each time it is drawn, so
 *  a change of style recolours every cover. Undefined for a picture. */
export function coverFill(cover: TabCover, theme: ThemeColours): PageFill | undefined {
  if ('imageId' in cover) return undefined;
  if ('gradient' in cover)
    return themeBackgroundPresets(theme).find((p) => p.id === cover.gradient)?.fill;
  return motionFill(theme, cover.motion, cover.colouring, cover.speed);
}

/** A cover's name in words, Title Case: "Theme Dawn", "Aurora in Theme Deep". */
export function coverGradientLabel(id: CoverGradientId): string {
  const name = id.slice('theme-'.length);
  return `Theme ${name.charAt(0).toUpperCase()}${name.slice(1)}`;
}

/** The tab as a reader takes it: its cover settled (none when nothing of it is valid). The same tab when there is
 *  nothing to settle, so a tab without a cover costs one property read. */
export function withSettledCover<T extends object>(tab: T): T {
  if (!('cover' in tab)) return tab;
  const stored = (tab as { cover?: unknown }).cover;
  const cover = parseTabCover(stored);
  if (cover && JSON.stringify(cover) === JSON.stringify(stored)) return tab;
  const { cover: _dropped, ...rest } = tab as T & { cover?: unknown };
  return (cover ? { ...rest, cover } : rest) as T;
}
