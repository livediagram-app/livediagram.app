// The Mashup card (docs/specs/011-theme/canvas-and-theme-dialog.md "Mashup"): a random look, rolled from curated
// ingredients. Each of a look's four settings is drawn independently: a theme from the whole built-in catalogue (every
// one has light and dark halves that meet the contrast floor), a finish, a tab font the looks use (or none), and a
// pattern with the strength a look gave it. Curated ingredients keep a mashup respectable; the mix makes it new.
import { FINISHES, FONTS, type Finish } from '@liveplanner/project';
import { PATTERNS } from '@/components/palette/palette-patterns';
import { THEMES } from '@/lib/themes';
import { TAB_LOOKS, lookMatches, type TabLook } from '@/lib/tab-looks';

/** A source of uniform numbers in [0, 1): Math.random in the app, a seeded one in tests. */
export type Random = () => number;

/** How many times a roll that lands on a named look (or the previous mashup) is rolled again. Every extra roll has
 *  at most a few-in-a-thousand chance of repeating, so 8 never runs out in practice; safe range 1..32. */
export const MASHUP_REROLLS = 8;

type PatternIngredient = Pick<TabLook, 'pattern' | 'patternOpacity'>;

// The ingredients, derived from the catalogues so a new theme or look widens the mix with no edit here. The seasonal
// themes stay out (they are the seasonal looks' own), as do the seasonal looks' fonts and patterns (TAB_LOOKS holds
// only the year-round looks).
const MASHUP_THEMES: readonly string[] = THEMES.filter((t) => !t.seasonal).map((t) => t.id);
const MASHUP_FONTS: readonly (string | undefined)[] = [...new Set(TAB_LOOKS.map((l) => l.font))];
const MASHUP_PATTERNS: readonly PatternIngredient[] = [
  ...new Map(
    TAB_LOOKS.map((l) => [
      `${l.pattern}:${l.patternOpacity ?? ''}`,
      // Full strength when the look left it: a mashup sets all of its pattern, so the tab wears what the card shows.
      { pattern: l.pattern, patternOpacity: l.patternOpacity ?? 1 },
    ]),
  ).values(),
];

/** How many distinct mashups the ingredients make (before the named looks are excluded). */
export const MASHUP_COMBINATIONS =
  MASHUP_THEMES.length * FINISHES.length * MASHUP_FONTS.length * MASHUP_PATTERNS.length;

const pick = <T>(items: readonly T[], random: Random): T =>
  items[Math.min(items.length - 1, Math.floor(random() * items.length))]!;

const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

// The card's line, worded like a look's: "Ocean, Sketch, Caveat, waves".
function describe(look: Omit<TabLook, 'id' | 'label' | 'description'>): string {
  const theme = THEMES.find((t) => t.id === look.theme)?.label ?? look.theme;
  const font = FONTS.find((f) => f.id === look.font)?.label;
  const pattern = PATTERNS.find((p) => p.id === look.pattern)?.label ?? look.pattern;
  return [theme, capitalise(look.finish), font, pattern.toLowerCase()].filter(Boolean).join(', ');
}

function rollOnce(random: Random, finish: Finish | undefined): TabLook {
  const ingredients = {
    theme: pick(MASHUP_THEMES, random),
    finish: finish ?? pick(FINISHES, random),
    font: pick(MASHUP_FONTS, random),
    ...pick(MASHUP_PATTERNS, random),
  };
  return { id: 'mashup', label: 'Mashup', description: describe(ingredients), ...ingredients };
}

// The settings a tab wears once the look is applied.
export const lookSettings = (look: TabLook) => ({
  theme: look.theme,
  finish: look.finish,
  font: look.font,
  backgroundPattern: look.pattern,
  backgroundOpacity: look.patternOpacity,
});

// A roll repeats when the tab wearing it would show a named look as selected, or when it is `previous` exactly.
function repeats(look: TabLook, previous: TabLook | undefined): boolean {
  const worn = lookSettings(look);
  if (TAB_LOOKS.some((named) => lookMatches(worn, named))) return true;
  return (
    !!previous && lookMatches(worn, previous) && look.patternOpacity === previous.patternOpacity
  );
}

/** A random look, never one of the named looks nor `previous`, within `finish` when one is given. */
export function rollMashup({
  random = Math.random,
  finish,
  previous,
}: { random?: Random; finish?: Finish; previous?: TabLook } = {}): TabLook {
  let look = rollOnce(random, finish);
  for (let i = 0; i < MASHUP_REROLLS && repeats(look, previous); i++)
    look = rollOnce(random, finish);
  return look;
}
