// A knowledgebase page's cover (docs/specs/030-knowledgebase/page-surface.md "The cover"): the band across the top of
// the page, a picture or a gradient, stored on the tab (`Tab.cover`). The shape and its reader are the platform's
// (@liveworkspace/page-background/cover, a liveplanner form's cover too); this file says which pictures a page may
// name, which gradients it offers by name, and settles a stored tab's cover on every read.
import {
  parsePageCover,
  patchPageCover,
  type PageCover,
} from '@liveworkspace/page-background/cover';
import { PAGE_GRADIENT_ANGLE } from '@liveworkspace/page-background/page-paint';
import { isPageImageId } from './page-image';
import { STEEL_GRADIENT } from './page-default-background';

export type { PageCover };
export {
  COVER_FOCUS_CENTRE,
  coverObjectPosition,
  movedCoverFocus,
  patchPageCover,
} from '@liveworkspace/page-background/cover';

/** A page background's gradient, named: the cover menu's swatches and what an agent names a gradient by. */
export type GradientPreset = { id: string; label: string; from: string; to: string };

// Light ones first, then the deep ones. A page's backgrounds and its cover offer the same set.
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

/** A page's cover as stored: what of it is valid, or none. A page's picture is a gallery id or an inline raster
 *  (an Offline knowledgebase's). */
export function parseTabCover(v: unknown): PageCover | undefined {
  return parsePageCover(v, isPageImageId);
}

/** The cover of a named gradient, or undefined for a name that is none of PAGE_GRADIENT_PRESETS (any case). */
export function coverOfGradient(name: string): PageCover | undefined {
  const key = name.trim().toLowerCase();
  const preset = PAGE_GRADIENT_PRESETS.find((p) => p.id === key);
  return preset
    ? { fill: { kind: 'gradient', from: preset.from, to: preset.to, angle: PAGE_GRADIENT_ANGLE } }
    : undefined;
}

/** The name of a cover's gradient when it is one of the presets (what an agent reads back), else undefined. */
export function gradientNameOf(cover: PageCover | undefined): string | undefined {
  const fill = cover?.fill;
  if (fill?.kind !== 'gradient') return undefined;
  const from = fill.from.toLowerCase();
  const to = fill.to.toLowerCase();
  return PAGE_GRADIENT_PRESETS.find((p) => p.from === from && p.to === to)?.label;
}

/** The cover a page shows: a picture first, else its gradient's or colour's fill. Patterns are a form's alone, so a
 *  page's cover is read without one. */
export function pageCoverOf(v: unknown): PageCover | undefined {
  const cover = parseTabCover(v);
  return cover ? patchPageCover(cover, { pattern: undefined }) : undefined;
}

/** The tab as a reader takes it: its cover settled (none when nothing of it is valid). The same tab when there is
 *  nothing to settle, so a tab without a cover costs one property read. */
export function withSettledCover<T extends object>(tab: T): T {
  if (!('cover' in tab)) return tab;
  const stored = (tab as { cover?: unknown }).cover;
  const cover = pageCoverOf(stored);
  if (cover && JSON.stringify(cover) === JSON.stringify(stored)) return tab;
  const { cover: _dropped, ...rest } = tab as T & { cover?: unknown };
  return (cover ? { ...rest, cover } : rest) as T;
}
