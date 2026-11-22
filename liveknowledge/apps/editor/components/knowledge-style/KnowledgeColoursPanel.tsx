'use client';

// Knowledgebase Style's Colours panel (docs/specs/030-knowledgebase/page-surface.md "Fine-tune"): the theme, each
// one a small page of writing in the knowledgebase's own typefaces (never the editors' theme card, which is a
// diagram on a canvas), and within it the accent the writing's headings, links, quotes, tables and code blocks
// take: the theme's own, or one picked with the one colour picker. A new theme starts on its own accent.
import { useMemo } from 'react';
import { legibleOn, type KnowledgeStyle } from '@liveknowledge/document';
import { builtMarkup, htmlProps } from '@liveworkspace/trusted-types';
import { SECTION_LABEL } from '@liveworkspace/workbench/components/dialogs/tab-style/LooksHome';
import { PagedCarousel } from '@liveworkspace/workbench/components/primitives/PagedCarousel';
import { easedStyleChange as eased } from '@liveworkspace/workbench/lib/tab-style-ease';
import { ColourSwatchButton } from '@/components/colour/ColourSwatchButton';
import { standardGroup, themeOptions } from '@/components/colour/colour-options';
import { useAppearance } from '@/hooks/ui/useAppearance';
import { useDocumentColours } from '@/hooks/ui/useDocumentColours';
import { knowledgeThemeAccent } from '@/lib/knowledge-style/knowledge-accent';
import { PANEL_HEIGHT, themeName } from '@/lib/knowledge-style/knowledge-style-words';
import { lookPagePreview } from '@/lib/knowledge-style/look-page-preview';
import { THEMES, getTheme, themePresetColors } from '@/lib/themes';
import { PAGE_GROUND } from '@/lib/view-backdrop';
import { useKnowledgeStylePanel } from './knowledge-style-context';

// The theme accent's id in the colour picker: a knowledgebase on it stores no accent of its own.
const THEME_ACCENT = 'theme';
/** How many themes one carousel page holds: three to a row, two rows, as the looks. */
const THEMES_PER_PAGE = 6;
// Every theme a picker lists: the seasonal ones are worn only through their looks.
const LISTED: readonly string[] = THEMES.filter((t) => !t.seasonal).map((t) => t.id);

const withoutAccent = (style: KnowledgeStyle): KnowledgeStyle => {
  const { accent: _accent, ...rest } = style;
  void _accent;
  return rest;
};

export function KnowledgeColoursPanel() {
  const { style, change } = useKnowledgeStylePanel();
  const { appearance } = useAppearance();
  const yours = useDocumentColours();
  // A theme is picked with its own accent: one picked within the theme before does not follow it.
  const setTheme = eased((theme: string) => change({ ...withoutAccent(style), theme }, 'Colours'));
  const themeAccent = knowledgeThemeAccent(style.theme);
  // Each theme's page, in the knowledgebase's typefaces, size and heading style; drawn when its card first mounts.
  const previewOf = useMemo(() => {
    const drawn = new Map<string, { markup: string; paper: string }>();
    return (theme: string) => {
      let preview = drawn.get(theme);
      if (!preview) {
        preview = lookPagePreview({ ...withoutAccent(style), theme }, appearance);
        drawn.set(theme, preview);
      }
      return preview;
    };
    // oxlint-disable-next-line react/exhaustive-deps -- the theme and the accent are the card's own, not the style's
  }, [style.headingFont, style.bodyFont, style.headingStyle, appearance]);
  // The swatch as the page draws the accent: held legible on the page's ground.
  const shown = legibleOn(style.accent ?? themeAccent, PAGE_GROUND[appearance], 4.5);
  return (
    <div className={`flex flex-col gap-3 pt-3 ${PANEL_HEIGHT}`}>
      <PagedCarousel
        items={LISTED}
        perPage={THEMES_PER_PAGE}
        label="Themes"
        heading={<h3 className={SECTION_LABEL}>Theme</h3>}
        gridClass="grid grid-cols-2 gap-2.5 sm:grid-cols-3"
        initialIndex={LISTED.indexOf(style.theme)}
        renderItem={(theme) => {
          const preview = previewOf(theme);
          const active = theme === style.theme;
          return (
            <button
              key={theme}
              type="button"
              aria-pressed={active}
              onClick={() => setTheme(theme)}
              className={`relative flex cursor-pointer flex-col overflow-hidden rounded-lg text-left transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 ${
                active
                  ? 'border-2 border-brand-500 bg-brand-50 dark:border-brand-400 dark:bg-brand-500/15'
                  : 'border border-slate-200 bg-white hover:border-brand-300 dark:border-slate-700 dark:bg-slate-800 dark:hover:border-brand-500/60'
              }`}
            >
              <span
                aria-hidden
                className="block h-20 w-full overflow-hidden [&>svg]:block [&>svg]:h-full [&>svg]:w-full"
                style={{ backgroundColor: preview.paper }}
                {...htmlProps(builtMarkup(preview.markup))}
              />
              <span className="px-2.5 py-1.5 text-[13px] font-semibold text-slate-800 dark:text-slate-100">
                {themeName(theme)}
              </span>
            </button>
          );
        }}
      />
      <section
        aria-labelledby="style-accent"
        className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2.5 dark:border-slate-700 dark:bg-slate-800/60"
      >
        <span className="flex min-w-0 flex-1 flex-col">
          <h3
            id="style-accent"
            className="text-[13px] font-semibold text-slate-800 dark:text-slate-100"
          >
            Accent
          </h3>
          <span className="text-[12px] text-slate-600 dark:text-slate-300">
            {style.accent
              ? 'Your colour for headings, links, quotes and tables.'
              : `${themeName(style.theme)}’s own, for headings, links, quotes and tables.`}
          </span>
        </span>
        <ColourSwatchButton
          label="Accent Colour"
          swatch={shown}
          className="h-11 w-11 sm:h-8 sm:w-8"
          value={style.accent ?? THEME_ACCENT}
          leading={[{ id: THEME_ACCENT, colour: themeAccent, label: 'Theme' }]}
          theme={themeOptions(themePresetColors(getTheme(style.theme)))}
          standard={[standardGroup('strong', 'light', 'hex')]}
          yours={yours}
          onPick={(id) =>
            change(
              id === THEME_ACCENT ? withoutAccent(style) : { ...withoutAccent(style), accent: id },
              'Colours',
            )
          }
        />
      </section>
    </div>
  );
}
