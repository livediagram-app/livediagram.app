import { lucideAppWindow } from '@livedocuments/icons/lucide';
import { lucideGlyph } from '@livedocuments/ui';

// How each competitor is drawn on the comparison pages (docs/specs/019-marketing/comparison-pages.md): a generic
// glyph of what the tool IS (a window for a slide tool), never its logo,
// since vendor trademarks are not used (docs/specs/004-interface-design/iconography.md); an accent tone; and three
// short highlight chips for its card. Tailwind classes are written out in full so the build sees them.
// competitor-look.test.ts pins one entry per ALTERNATIVES slug.

type CompetitorLook = {
  icon: ReturnType<typeof lucideGlyph>;
  // The card's header wash and the glyph's colour.
  panel: string;
  glyph: string;
  // Three short chips: what livedocuments offers that this comparison turns on.
  highlights: [string, string, string];
};

export const COMPETITOR_LOOK: Record<string, CompetitorLook> = {
  'google-slides': {
    icon: lucideGlyph(lucideAppWindow, 22),
    panel: 'from-yellow-100 to-lime-50 dark:from-yellow-500/15 dark:to-lime-500/5',
    glyph: 'text-yellow-700 dark:text-yellow-300',
    highlights: ['Slide layouts', 'Present any page', 'No account'],
  },
};
