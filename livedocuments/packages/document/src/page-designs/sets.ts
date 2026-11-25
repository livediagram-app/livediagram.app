// The design sets (docs/specs/011-theme/page-designs.md "Design sets"): a theme, a font, a finish, a page background,
// a page design and the layouts that suit them, applied in one click. Pure data and the background each set gives.
import type { Finish } from '@liveworkspace/element-model/finish';
import type { ThemeDefinition } from '../index';
import type { PageBackground } from '../page';
import { themeGradientFill, type ThemeGradientName } from '../page-theme-fills';
import type { PageDesign } from './tuning';

export type PageDesignSet = {
  id: string;
  label: string;
  // One line on its card.
  blurb: string;
  theme: string;
  font: string;
  finish: Finish;
  // The New Page Background every page takes: the plain paper, or one of the theme's gradients.
  background: 'paper' | ThemeGradientName;
  design: PageDesign;
  // Layouts for empty pages: the first page's, then the rest in turn.
  slide: { title: string; content: readonly string[] };
  infographic: { title: string; content: readonly string[] };
};

const INFO = {
  title: 'title',
  content: ['key-stats', 'facts-grid', 'top-tips', 'process'],
} as const;

export const PAGE_DESIGN_SETS: readonly PageDesignSet[] = [
  {
    id: 'keynote-dark',
    label: 'Keynote Dark',
    blurb: 'Deep night, soft aurora light',
    theme: 'midnight',
    font: 'inter',
    finish: 'professional',
    background: 'ink',
    design: { id: 'aurora', rhythm: true },
    slide: { title: 'slide-title', content: ['slide-bullets', 'slide-two-columns'] },
    infographic: INFO,
  },
  {
    id: 'editorial',
    label: 'Editorial',
    blurb: 'Cream paper, a printed border',
    theme: 'cream',
    font: 'lora',
    finish: 'professional',
    background: 'paper',
    design: { id: 'offset-border', rhythm: true },
    slide: { title: 'slide-title', content: ['slide-two-columns', 'slide-bullets'] },
    infographic: INFO,
  },
  {
    id: 'startup-pitch',
    label: 'Startup Pitch',
    blurb: 'Bright mesh, bold numbers',
    theme: 'ocean',
    font: 'poppins',
    finish: 'flexible',
    background: 'dawn',
    design: { id: 'soft-mesh', rhythm: true, flow: true },
    slide: { title: 'slide-title', content: ['slide-three-stats', 'slide-bullets'] },
    infographic: INFO,
  },
  {
    id: 'field-notes',
    label: 'Field Notes',
    blurb: 'Contour lines, a sketched hand',
    theme: 'mocha',
    font: 'nunito',
    finish: 'sketch',
    background: 'mist',
    design: { id: 'topographic', rhythm: true },
    slide: { title: 'slide-title', content: ['slide-bullets', 'slide-three-points'] },
    infographic: INFO,
  },
  {
    id: 'blueprint',
    label: 'Blueprint',
    blurb: 'A drafting grid on steel blue',
    theme: 'steel',
    font: 'space-grotesk',
    finish: 'professional',
    background: 'ink',
    design: { id: 'blueprint', rhythm: true },
    slide: { title: 'slide-title', content: ['slide-two-columns', 'slide-three-points'] },
    infographic: INFO,
  },
  {
    id: 'gallery',
    label: 'Gallery',
    blurb: 'White walls, a Swiss grid',
    theme: 'mono',
    font: 'inter',
    finish: 'professional',
    background: 'paper',
    design: { id: 'swiss-grid', rhythm: true },
    slide: { title: 'slide-title', content: ['slide-three-points', 'slide-bullets'] },
    infographic: INFO,
  },
  {
    id: 'neon-night',
    label: 'Neon Night',
    blurb: 'Glowing circuits after dark',
    theme: 'abyss',
    font: 'space-grotesk',
    finish: 'professional',
    background: 'twilight',
    design: { id: 'circuit', rhythm: true },
    slide: { title: 'slide-title', content: ['slide-three-stats', 'slide-two-columns'] },
    infographic: INFO,
  },
  {
    id: 'playground',
    label: 'Playground',
    blurb: 'Memphis shapes, all fun',
    theme: 'rainbow',
    font: 'nunito',
    finish: 'flexible',
    background: 'paper',
    design: { id: 'memphis', rhythm: true },
    slide: { title: 'slide-title', content: ['slide-bullets', 'slide-three-points'] },
    infographic: INFO,
  },
];

export const PAGE_DESIGN_SET_BY_ID = Object.fromEntries(
  PAGE_DESIGN_SETS.map((s) => [s.id, s]),
) as Record<string, PageDesignSet>;

/** The background a set gives every page, for its theme: the plain paper (none) or a theme gradient. */
export function designSetBackground(
  set: PageDesignSet,
  theme: Partial<Pick<ThemeDefinition, 'elementStroke' | 'palette'>>,
): PageBackground | undefined {
  return set.background === 'paper'
    ? undefined
    : { fill: themeGradientFill(theme, set.background) };
}

/** The layout a set gives a page of `kind` at `index` (the first page its title layout). */
export function designSetLayout(
  set: PageDesignSet,
  kind: 'slide' | 'infographic',
  index: number,
): string {
  const plan = set[kind];
  return index === 0 ? plan.title : plan.content[(index - 1) % plan.content.length]!;
}
