// Knowledgebase Style's words (docs/specs/030-knowledgebase/page-surface.md "Knowledgebase Style"), in one place so
// the menu row, the command, the dialog and the tests say the same thing.
import { FONTS, type KnowledgeStyle } from '@liveknowledge/document';
import { THEMES } from '@/lib/themes';

export const STYLE_TITLE = 'Knowledgebase Style';
export const STYLE_LINE = 'Pick a look for every page of this knowledgebase.';
export const TEXT_LINE = 'The typefaces, size and spacing every page is written in.';
export const COLOURS_LINE = 'The theme, and the accent the writing takes.';

// The Fine-tune panels keep the home's height on a screen wider than a phone, so the centred dialog does not move
// as a panel opens. Measured in a browser at 1440 x 900: the home's dialog is 562 px tall, and a panel under its
// back bar is that tall at 374 px (23.375rem). Both panels' own content is shorter, so the minimum is what holds.
export const PANEL_HEIGHT = 'sm:min-h-[23.375rem]';

const SIZE_WORDS = { small: 'Small', medium: 'Medium', large: 'Large' } as const;

/** A theme's name as the dialog says it: the product's own theme is Lime. */
export const themeName = (id: string): string =>
  id === 'brand' ? 'Lime' : (THEMES.find((t) => t.id === id)?.label ?? 'Lime');

const fontName = (id: string): string => FONTS.find((f) => f.id === id)?.label ?? id;

/** The Text row's line: "Inter, Medium", or "Poppins and Inter, Large". */
export function textSummary(style: KnowledgeStyle): string {
  const faces =
    style.headingFont === style.bodyFont
      ? fontName(style.bodyFont)
      : `${fontName(style.headingFont)} and ${fontName(style.bodyFont)}`;
  return `${faces}, ${SIZE_WORDS[style.textSize]}`;
}

/** The Colours row's line: "Steel theme", or "Steel theme, its own accent". */
export function coloursSummary(style: KnowledgeStyle): string {
  return `${themeName(style.theme)} theme${style.accent ? ', your accent' : ''}`;
}
