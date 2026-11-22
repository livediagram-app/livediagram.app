// The looks a knowledgebase can wear (docs/specs/030-knowledgebase/page-surface.md "Knowledgebase Style", "Looks"):
// the platform's looks (lib/tab-looks.ts, the seasonal ones with them), each cut to what suits writing, a theme
// and a typeface. A look is not stored: picking one sets the style's theme and both fonts, and a card reads as
// selected while they are the look's. Finish, pattern and page background are a canvas's and are not carried.
import { FONTS, type Finish, type KnowledgeStyle } from '@liveknowledge/document';
import {
  SEASONAL_LOOKS,
  seasonalLooksFor,
  type Season,
} from '@liveworkspace/workbench/lib/seasonal-looks';
import type { TabLookSettings } from '@liveworkspace/workbench/lib/tab-looks';
import { TAB_LOOKS } from '@/lib/tab-looks';
import { THEMES } from '@/lib/themes';

/** The typeface a look that names none is set in. */
export const EVERYDAY_FONT = 'inter';

export type KnowledgeLook = {
  id: string;
  label: string;
  // The card's line: what the look is made of ("Steel, Inter").
  description: string;
  theme: string;
  // The one typeface, headings and body alike.
  font: string;
  // Looks set no finish here; every one reads as the plain one, so the shared carousel has nothing to filter.
  finish: Finish;
  pattern: string;
  season?: Season;
};

const themeLabel = (id: string): string =>
  id === 'brand' ? 'Lime' : (THEMES.find((t) => t.id === id)?.label ?? id);
const fontLabel = (id: string): string => FONTS.find((f) => f.id === id)?.label ?? id;

function lookOf(source: {
  id: string;
  label: string;
  theme: string;
  font: string | undefined;
  season?: Season;
}): KnowledgeLook {
  const font = source.font ?? EVERYDAY_FONT;
  return {
    id: source.id,
    label: source.label,
    description: `${themeLabel(source.theme)}, ${fontLabel(font)}`,
    theme: source.theme,
    font,
    finish: 'flexible',
    pattern: 'blank',
    ...(source.season ? { season: source.season } : {}),
  };
}

/** The year-round looks, in the carousel's order: Everyday first (the product's own theme). */
export const KNOWLEDGE_LOOKS: readonly KnowledgeLook[] = TAB_LOOKS.map(lookOf);
const SEASONAL: readonly KnowledgeLook[] = SEASONAL_LOOKS.map(lookOf);
const NAMED: readonly KnowledgeLook[] = [...KNOWLEDGE_LOOKS, ...SEASONAL];

/** The seasonal looks for a date, the season on now (or next) first. */
export const knowledgeSeasonalLooksFor = (now: Date): readonly KnowledgeLook[] =>
  seasonalLooksFor(now).map(lookOf);

/** The four look settings the shared carousel asks a tab for, as a knowledgebase's style answers them: its theme,
 *  and its typeface when the headings and the body share one (a style with two faces wears no look). */
export function lookSettingsOf(style: KnowledgeStyle): TabLookSettings {
  return {
    theme: style.theme,
    ...(style.headingFont === style.bodyFont ? { font: style.bodyFont } : {}),
  };
}

/** Whether the settings are the look's: its theme and its typeface. */
export const knowledgeLookMatches = (settings: TabLookSettings, look: KnowledgeLook): boolean =>
  (settings.theme ?? 'brand') === look.theme && settings.font === look.font;

/** The named look the settings match, or undefined for a mix of the knowledgebase's own. */
export const activeKnowledgeLookId = (settings: TabLookSettings): string | undefined =>
  NAMED.find((look) => knowledgeLookMatches(settings, look))?.id;

export const knowledgeLookById = (id: string): KnowledgeLook | undefined =>
  NAMED.find((look) => look.id === id);

/** The style wearing a look: its theme and typeface; the size, spacing and heading style stay, and an accent
 *  someone picked goes, since it was picked within the theme before. */
export function withKnowledgeLook(style: KnowledgeStyle, look: KnowledgeLook): KnowledgeStyle {
  const { accent: _accent, ...rest } = style;
  void _accent;
  return { ...rest, theme: look.theme, headingFont: look.font, bodyFont: look.font };
}

// ---------- Mashup ---------------------------------------------------------------------------------------------

/** A source of uniform numbers in [0, 1): Math.random in the app, a seeded one in tests. */
export type Random = () => number;

/** How many times a roll that lands on a named look, or on the one before, is rolled again. Safe range 1..32. */
export const KNOWLEDGE_MASHUP_REROLLS = 8;

// The ingredients: every built-in theme but the seasonal ones (the product's own among them), and the typefaces the year-round looks use.
const MASHUP_THEMES: readonly string[] = THEMES.filter((t) => !t.seasonal).map((t) => t.id);
const MASHUP_FONTS: readonly string[] = [...new Set(KNOWLEDGE_LOOKS.map((l) => l.font))];

export const KNOWLEDGE_MASHUP_COMBINATIONS = MASHUP_THEMES.length * MASHUP_FONTS.length;

const pick = <T>(items: readonly T[], random: Random): T =>
  items[Math.min(items.length - 1, Math.floor(random() * items.length))]!;

/** A random look (a theme and a typeface), never a named look nor `previous`. */
export function rollKnowledgeMashup({
  previous,
  random = Math.random,
}: { previous?: KnowledgeLook; random?: Random } = {}): KnowledgeLook {
  let look = lookOf({ id: 'mashup', label: 'Mashup', theme: 'brand', font: EVERYDAY_FONT });
  for (let i = 0; i <= KNOWLEDGE_MASHUP_REROLLS; i += 1) {
    look = lookOf({
      id: 'mashup',
      label: 'Mashup',
      theme: pick(MASHUP_THEMES, random),
      font: pick(MASHUP_FONTS, random),
    });
    const settings = { theme: look.theme, font: look.font };
    const named = NAMED.some((n) => knowledgeLookMatches(settings, n));
    const same = !!previous && knowledgeLookMatches(settings, previous);
    if (!named && !same) return look;
  }
  return look;
}
