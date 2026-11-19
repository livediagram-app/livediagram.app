// Looks (docs/specs/011-theme/canvas-and-theme-dialog.md "Looks"): shortcuts that set a tab's existing settings at
// once, its theme, finish, tab font and surround pattern, and the background its pages take (its New Page
// Background, and the pages still on the old one). Not a stored concept: picking one writes those ordinary fields,
// and a look reads as selected only while the tab still matches its four (the pages' background is not compared, so
// a page someone repaints leaves the look on).
import {
  themeGradientFill,
  withLookPageBackground,
  type BackgroundPattern,
  type Finish,
  type PageBackground,
  type PagePattern,
  type Tab,
  type ThemeGradientName,
} from '@livedocuments/document';
import { getTheme } from '@/lib/themes';
import { createTabLooks } from '@liveworkspace/workbench/lib/tab-looks';
import { withThemeApplied } from '@/lib/tab-theme-apply';
import { SEASONAL_LOOKS, type Season } from '@liveworkspace/workbench/lib/seasonal-looks';

export type TabLookId =
  | 'everyday'
  | 'boardroom'
  | 'spectrum'
  | 'editorial'
  | 'notebook'
  | 'midnight'
  | 'daydream'
  | 'studio'
  | 'seaside'
  | 'textbook'
  | 'lagoon'
  | 'garden'
  | 'sketchbook'
  | 'night-shift'
  | 'workshop'
  | 'billboard'
  | 'classroom'
  // Seasonal looks (lib/seasonal-looks.ts): shown only behind the carousel's Seasonal toggle.
  | 'countdown'
  | 'egg-hunt'
  | 'haunted'
  | 'christmas-morning'
  | 'winter-wonderland'
  | 'fireside'
  // The Mashup card's random look (lib/look-mashup.ts): never in TAB_LOOKS, so never an activeLookId answer.
  | 'mashup';

/** The background a look gives the pages (docs/specs/011-theme/canvas-and-theme-dialog.md "Looks"): one of its theme's
 *  gradients by name, or the paper when it names none, and a page pattern. */
export type LookPage = { fill?: ThemeGradientName; pattern?: PagePattern };

export type TabLook = {
  id: TabLookId;
  label: string;
  /** One line under the name on its card. */
  description: string;
  /** A built-in theme id (packages/document/src/themes-data.ts). */
  theme: string;
  finish: Finish;
  /** A font id (../packages/model-core/src/fonts.ts), or undefined for no tab font. */
  font: string | undefined;
  /** The surround's pattern, around the pages. */
  pattern: BackgroundPattern;
  /** The pattern's strength, the tab's existing backgroundOpacity (1 when omitted): a busy pattern drawn softly. */
  patternOpacity?: number;
  /** The pages' background, set as the tab's New Page Background; a look without one leaves the pages as they are. */
  page?: LookPage;
  /** A seasonal look's season (lib/seasonal-looks.ts); unset on the year-round looks. */
  season?: Season;
};

/** The looks, in the order the dialog shows them after the Mashup card: with it, three carousel pages of six.
 *  Page-centred: each but Everyday gives the pages a background, its surround a calm pattern or none, and a typeface
 *  that serves headings and body alike. Everyday stays first; the rest are in a fixed, interleaved order (never
 *  shuffled at runtime) that puts one or two of the four multi-colour looks (Rainbow, Pastel, Tropical) on every page
 *  and never sets two neighbours on a page in the same theme or finish. */
export const TAB_LOOKS: readonly TabLook[] = [
  {
    id: 'everyday',
    label: 'Everyday',
    description: 'Default colours, Flexible, the pages as they are',
    theme: 'brand',
    finish: 'flexible',
    font: undefined,
    pattern: 'grid',
  },
  {
    id: 'boardroom',
    label: 'Boardroom',
    description: 'Steel, Professional, Inter, misted pages',
    theme: 'steel',
    finish: 'professional',
    font: 'inter',
    pattern: 'blank',
    page: { fill: 'mist' },
  },
  {
    id: 'spectrum',
    label: 'Spectrum',
    description: 'Rainbow, Flexible, Poppins, white pages',
    theme: 'rainbow',
    finish: 'flexible',
    font: 'poppins',
    pattern: 'blank',
    page: {},
  },
  {
    id: 'editorial',
    label: 'Editorial',
    description: 'Cream, Professional, Lora, dawn pages',
    theme: 'cream',
    finish: 'professional',
    font: 'lora',
    pattern: 'blank',
    page: { fill: 'dawn' },
  },
  {
    id: 'notebook',
    label: 'Notebook',
    description: 'Mocha, Sketch, Nunito, ruled pages',
    theme: 'mocha',
    finish: 'sketch',
    font: 'nunito',
    pattern: 'lines',
    patternOpacity: 0.4,
    page: { pattern: 'lines' },
  },
  {
    id: 'midnight',
    label: 'Midnight',
    description: 'Midnight, Professional, Inter, ink pages',
    theme: 'midnight',
    finish: 'professional',
    font: 'inter',
    pattern: 'blank',
    page: { fill: 'ink' },
  },
  {
    id: 'daydream',
    label: 'Daydream',
    description: 'Pastel, Flexible, Nunito, pastel pages',
    theme: 'pastel',
    finish: 'flexible',
    font: 'nunito',
    pattern: 'grid',
    patternOpacity: 0.5,
    page: { fill: 'pastel' },
  },
  {
    id: 'studio',
    label: 'Studio',
    description: 'Lavender, Professional, Roboto Slab, hazy pages',
    theme: 'lavender',
    finish: 'professional',
    font: 'roboto-slab',
    pattern: 'blank',
    page: { fill: 'haze' },
  },
  {
    id: 'seaside',
    label: 'Seaside',
    description: 'Ocean, Flexible, Nunito, glowing pages',
    theme: 'ocean',
    finish: 'flexible',
    font: 'nunito',
    pattern: 'lines',
    patternOpacity: 0.4,
    page: { fill: 'glow' },
  },
  {
    id: 'textbook',
    label: 'Textbook',
    description: 'Mono, Professional, Lora, squared pages',
    theme: 'mono',
    finish: 'professional',
    font: 'lora',
    pattern: 'graph',
    patternOpacity: 0.4,
    page: { pattern: 'grid' },
  },
  {
    id: 'lagoon',
    label: 'Lagoon',
    description: 'Tropical, Flexible, Space Grotesk, bloom pages',
    theme: 'tropical',
    finish: 'flexible',
    font: 'space-grotesk',
    pattern: 'blank',
    page: { fill: 'bloom' },
  },
  {
    id: 'garden',
    label: 'Garden',
    description: 'Forest, Professional, Poppins, misted pages',
    theme: 'forest',
    finish: 'professional',
    font: 'poppins',
    pattern: 'blank',
    page: { fill: 'mist' },
  },
  {
    id: 'sketchbook',
    label: 'Sketchbook',
    description: 'Rose, Sketch, Nunito, dawn pages',
    theme: 'rose',
    finish: 'sketch',
    font: 'nunito',
    pattern: 'blank',
    page: { fill: 'dawn' },
  },
  {
    id: 'night-shift',
    label: 'Night Shift',
    description: 'Abyss, Professional, Space Grotesk, twilight pages',
    theme: 'abyss',
    finish: 'professional',
    font: 'space-grotesk',
    pattern: 'blank',
    page: { fill: 'twilight' },
  },
  {
    id: 'workshop',
    label: 'Workshop',
    description: 'Sand, Marker, dotted pages',
    theme: 'sand',
    finish: 'marker',
    font: undefined,
    pattern: 'grid',
    patternOpacity: 0.4,
    page: { pattern: 'dots' },
  },
  {
    id: 'billboard',
    label: 'Billboard',
    description: 'Sunset, Professional, Poppins, dusk pages',
    theme: 'sunset',
    finish: 'professional',
    font: 'poppins',
    pattern: 'blank',
    page: { fill: 'dusk' },
  },
  {
    id: 'classroom',
    label: 'Classroom',
    description: 'Rainbow, Flexible, Nunito, ruled pages',
    theme: 'rainbow',
    finish: 'flexible',
    font: 'nunito',
    pattern: 'lines',
    patternOpacity: 0.3,
    page: { fill: 'haze', pattern: 'lines' },
  },
];

export { LOOKS_PER_PAGE } from '@liveworkspace/workbench/lib/tab-looks';

/** The four settings a look sets, as a tab holds them. */
export type LookSettings = Pick<
  Tab,
  'theme' | 'finish' | 'font' | 'backgroundPattern' | 'backgroundOpacity'
>;

// The lookup, apply and match are the shared ones (@liveworkspace/workbench/lib/tab-looks), over every named look,
// year-round and seasonal: a tab wearing a seasonal look reads as that look too.
const shared = createTabLooks<Tab, TabLook>({
  looks: [...TAB_LOOKS, ...SEASONAL_LOOKS],
  withThemeApplied,
});
export const { tabLookById, lookMatches, activeLookId } = shared;

/** The background a look gives the pages, in its own theme's colours. */
export function lookPageBackground(
  look: Pick<TabLook, 'theme' | 'page'>,
): PageBackground | undefined {
  if (!look.page) return undefined;
  const { fill, pattern } = look.page;
  return {
    ...(fill ? { fill: themeGradientFill(getTheme(look.theme), fill) } : {}),
    ...(pattern ? { pattern } : {}),
  };
}

/** The tab with a look applied: the shared apply (theme, finish, font, pattern), then the look's page background as
 *  the tab's New Page Background, on every page still wearing the old one too (withLookPageBackground). */
export function withLookApplied(tab: Tab, look: TabLook): Tab {
  const styled = shared.withLookApplied(tab, look);
  const page = lookPageBackground(look);
  return page ? withLookPageBackground(styled, page, getTheme(look.theme)).tab : styled;
}
