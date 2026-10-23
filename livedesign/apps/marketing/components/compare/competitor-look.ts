import { lucidePenTool } from '@livedesign/icons/lucide';
import { lucideGlyph } from '@livedesign/ui';

// How each competitor is drawn on the comparison pages (docs/specs/019-marketing/comparison-pages.md): a generic
// glyph of what the tool IS (a pen for a design tool), never its logo,
// since vendor trademarks are not used (docs/specs/004-interface-design/iconography.md); an accent tone; and three
// short highlight chips for its card. Tailwind classes are written out in full so the build sees them.
// competitor-look.test.ts pins one entry per ALTERNATIVES slug.

type CompetitorLook = {
  icon: ReturnType<typeof lucideGlyph>;
  // The card's header wash and the glyph's colour.
  panel: string;
  glyph: string;
  // Three short chips: what livedesign offers that this comparison turns on.
  highlights: [string, string, string];
};

export const COMPETITOR_LOOK: Record<string, CompetitorLook> = {
  figma: {
    icon: lucideGlyph(lucidePenTool, 22),
    panel: 'from-violet-100 to-rose-50 dark:from-violet-500/15 dark:to-rose-500/5',
    glyph: 'text-violet-700 dark:text-violet-300',
    highlights: ['Logo Kit export', 'Photo layers and PSD', 'No account'],
  },
};
