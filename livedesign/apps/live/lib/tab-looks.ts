// Looks (docs/specs/011-theme/canvas-and-theme-dialog.md "Looks"): shortcuts that set four of a tab's existing
// settings at once, its theme, finish, tab font and canvas pattern. Not a stored concept: picking one writes those
// four ordinary fields, and a look reads as selected only while the tab still matches all four.
import { type BackgroundPattern, type Finish, type Tab } from '@livedesign/design';
import { createTabLooks } from '@liveworkspace/workbench/lib/tab-looks';
import { withThemeApplied, type ThemeApplyOptions } from '@/lib/tab-theme-apply';
import { SEASONAL_LOOKS, type Season } from '@liveworkspace/workbench/lib/seasonal-looks';

export type TabLookId =
  | 'everyday'
  | 'blueprint'
  | 'spectrum'
  | 'wireframe'
  | 'boardroom'
  | 'workshop'
  | 'midnight'
  | 'daydream'
  | 'editorial'
  | 'lagoon'
  | 'graph-paper'
  // Seasonal looks (lib/seasonal-looks.ts): shown only behind the carousel's Seasonal toggle.
  | 'countdown'
  | 'egg-hunt'
  | 'haunted'
  | 'christmas-morning'
  | 'winter-wonderland'
  | 'fireside'
  // The Mashup card's random look (lib/look-mashup.ts): never in TAB_LOOKS, so never an activeLookId answer.
  | 'mashup';

export type TabLook = {
  id: TabLookId;
  label: string;
  /** One line under the name on its card. */
  description: string;
  /** A built-in theme id (packages/design/src/themes-data.ts). */
  theme: string;
  finish: Finish;
  /** A font id (../packages/model-core/src/fonts.ts), or undefined for no tab font. */
  font: string | undefined;
  pattern: BackgroundPattern;
  /** The pattern's strength, the tab's existing backgroundOpacity (1 when omitted): a busy pattern drawn softly. */
  patternOpacity?: number;
  /** A seasonal look's season (lib/seasonal-looks.ts); unset on the year-round looks. */
  season?: Season;
};

/** The finishes that read as drawn by hand: a wireframe's sketch, not a logo's or a photo's finished art. */
export const HAND_DRAWN_FINISHES: readonly Finish[] = ['sketch', 'marker'];

/** Whether a look suits a logo or a photo page: no hand-drawn finish (Tab Style's look filter there). */
export const suitsFinishedArt = (look: Pick<TabLook, 'finish'>): boolean =>
  !HAND_DRAWN_FINISHES.includes(look.finish);

/** The looks, in the order the dialog shows them after the Mashup card: with it, two carousel pages of six. Suited to
 *  wireframes and presentation pages: clean faces, quiet surrounds, a low-fidelity Wireframe and a Blueprint grid.
 *  Everyday stays first; the rest are in a fixed, interleaved order (never shuffled at runtime) that puts one or two
 *  of the three multi-colour looks (Rainbow, Pastel, Tropical) on every page and never sets two neighbours on a page
 *  in the same theme or finish. */
export const TAB_LOOKS: readonly TabLook[] = [
  {
    id: 'everyday',
    label: 'Everyday',
    description: 'Default colours, Flexible, grid',
    theme: 'brand',
    finish: 'flexible',
    font: undefined,
    pattern: 'grid',
  },
  {
    id: 'blueprint',
    label: 'Blueprint',
    description: 'Sky, Professional, Roboto Mono, engineering grid',
    theme: 'sky',
    finish: 'professional',
    font: 'roboto-mono',
    pattern: 'engineering',
    patternOpacity: 0.5,
  },
  {
    id: 'spectrum',
    label: 'Spectrum',
    description: 'Rainbow, Flexible, Inter, soft grid',
    theme: 'rainbow',
    finish: 'flexible',
    font: 'inter',
    pattern: 'grid',
    patternOpacity: 0.5,
  },
  {
    id: 'wireframe',
    label: 'Wireframe',
    description: 'Mono, Sketch, a low-fidelity sketch',
    theme: 'mono',
    finish: 'sketch',
    font: undefined,
    pattern: 'blank',
  },
  {
    id: 'boardroom',
    label: 'Boardroom',
    description: 'Steel, Professional, Inter, plain',
    theme: 'steel',
    finish: 'professional',
    font: 'inter',
    pattern: 'blank',
  },
  {
    id: 'workshop',
    label: 'Workshop',
    description: 'Sand, Marker, grid',
    theme: 'sand',
    finish: 'marker',
    font: undefined,
    pattern: 'grid',
    patternOpacity: 0.6,
  },
  {
    id: 'midnight',
    label: 'Midnight',
    description: 'Midnight, Professional, Space Grotesk, plain',
    theme: 'midnight',
    finish: 'professional',
    font: 'space-grotesk',
    pattern: 'blank',
  },
  {
    id: 'daydream',
    label: 'Daydream',
    description: 'Pastel, Flexible, Nunito, soft grid',
    theme: 'pastel',
    finish: 'flexible',
    font: 'nunito',
    pattern: 'grid',
    patternOpacity: 0.6,
  },
  {
    id: 'editorial',
    label: 'Editorial',
    description: 'Cream, Professional, Lora, plain',
    theme: 'cream',
    finish: 'professional',
    font: 'lora',
    pattern: 'blank',
  },
  {
    id: 'lagoon',
    label: 'Lagoon',
    description: 'Tropical, Flexible, Space Grotesk, ruled',
    theme: 'tropical',
    finish: 'flexible',
    font: 'space-grotesk',
    pattern: 'lines',
    patternOpacity: 0.4,
  },
  {
    id: 'graph-paper',
    label: 'Graph Paper',
    description: 'Indigo, Professional, Roboto Mono, graph',
    theme: 'indigo',
    finish: 'professional',
    font: 'roboto-mono',
    pattern: 'graph',
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
const NAMED = [...TAB_LOOKS, ...SEASONAL_LOOKS];
const shared = createTabLooks<Tab, TabLook>({ looks: NAMED, withThemeApplied });
// The same apply with Element Colours on Keep as They Are: the theme recolours no element.
const keeping = createTabLooks<Tab, TabLook>({
  looks: NAMED,
  withThemeApplied: (tab, id) => withThemeApplied(tab, id, undefined, { keepElementColours: true }),
});
export const { tabLookById, lookMatches, activeLookId } = shared;

/** The tab with a look applied (the shared apply), its elements' colours kept when `options` says so. */
export function withLookApplied(tab: Tab, look: TabLook, options: ThemeApplyOptions = {}): Tab {
  return (options.keepElementColours ? keeping : shared).withLookApplied(tab, look);
}
