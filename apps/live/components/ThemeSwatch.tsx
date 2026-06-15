import type { ThemeDefinition } from '@/lib/themes';

// The colour preview inside a theme card. Shared by the Theme accordion
// (TabSection) and the welcome / template picker (TemplatePicker) so the
// two grids can't drift. A single-colour theme shows one element-fill
// dot sitting on the backdrop; a multi-colour theme (spec/29) shows a
// row of stripes — one per palette hue — so the card reads as "many
// colours" at a glance.
//
// `size` matches the two call sites' existing dimensions: 'sm' for the
// compact 3-column palette grid, 'md' for the roomier welcome picker.
export function ThemeSwatch({
  theme,
  size = 'sm',
}: {
  theme: ThemeDefinition;
  // 'sm' compact palette grid, 'md' welcome picker, 'lg' the Basic
  // quick-pick card's hero swatch (fills a category-card-sized preview).
  size?: 'sm' | 'md' | 'lg';
}) {
  const boxH = size === 'lg' ? 'h-14' : size === 'md' ? 'h-8' : 'h-7';
  const stripeH = size === 'lg' ? 'h-7' : size === 'md' ? 'h-3.5' : 'h-3';
  const dotSize = size === 'lg' ? 'h-5 w-5' : size === 'md' ? 'h-3.5 w-3.5' : 'h-3 w-3';

  return (
    <span
      aria-hidden
      style={{ backgroundColor: theme.backgroundColor }}
      className={`flex ${boxH} w-full items-center justify-center gap-0.5 rounded-sm border border-slate-200 px-1 dark:border-slate-700`}
    >
      {theme.palette ? (
        // Saturated branch hues read as a rainbow at thumbnail size.
        theme.palette.map((entry, i) => (
          <span
            key={i}
            style={{ backgroundColor: entry.stroke }}
            className={`${stripeH} flex-1 rounded-[1px]`}
          />
        ))
      ) : theme.shapeColors ? (
        // Per-shape theme (UML): stripe its shape-kind strokes so the card
        // previews the colour coding rather than one neutral dot. Cap at
        // six so the thumbnail stays legible.
        Object.values(theme.shapeColors)
          .slice(0, 6)
          .map((entry, i) => (
            <span
              key={i}
              style={{ backgroundColor: entry.stroke ?? theme.elementStroke ?? '#334155' }}
              className={`${stripeH} flex-1 rounded-[1px]`}
            />
          ))
      ) : (
        // Border / fill colours come from the theme's element-stroke
        // (or pattern colour when the theme is the brand default).
        <span
          style={{
            backgroundColor: theme.elementFill ?? '#ffffff',
            borderColor: theme.elementStroke ?? theme.patternColor,
          }}
          className={`${dotSize} rounded-sm border`}
        />
      )}
    </span>
  );
}
