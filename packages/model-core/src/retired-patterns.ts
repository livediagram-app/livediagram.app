// A background pattern one product has stopped offering while another still does. The pattern stays in
// BackgroundPattern (./basics), since the product that keeps it stores and draws it; the product that retires it
// binds a map of each retired pattern to the pattern that replaces it. The binding gives that product a pattern guard
// that refuses the retired ones, and a read-time migration that moves a stored tab onto the replacement, so a tab
// saved with a retired pattern still opens and draws. Each product's docs/specs/008-canvas/canvas-and-palette.md
// "Retired features" records what it retired and why the replacement was chosen.
import { isBackgroundPattern, type BackgroundPattern } from './basics';

/** Each retired pattern and the pattern a tab that wore it wears instead (never another retired one). */
export type RetiredPatternMap<R extends BackgroundPattern> = Readonly<
  Record<R, Exclude<BackgroundPattern, R>>
>;

export type RetiredPatterns<R extends BackgroundPattern> = {
  /** A pattern this product still offers: a BackgroundPattern that is not retired. */
  isOffered: (value: unknown) => value is Exclude<BackgroundPattern, R>;
  /** The tab moved off a retired pattern onto its replacement; the same tab when it wears none. */
  migrate: <T extends object>(tab: T) => T;
};

export function bindRetiredPatterns<R extends BackgroundPattern>(
  map: RetiredPatternMap<R>,
): RetiredPatterns<R> {
  const isRetired = (value: unknown): value is R =>
    typeof value === 'string' && Object.hasOwn(map, value);
  return {
    isOffered: (value: unknown): value is Exclude<BackgroundPattern, R> =>
      isBackgroundPattern(value) && !isRetired(value),
    migrate: <T extends object>(tab: T): T => {
      const from = (tab as { backgroundPattern?: unknown }).backgroundPattern;
      if (!isRetired(from)) return tab;
      const to = map[from];
      console.info('[tab-migrate] retired-pattern', { from, to });
      return { ...tab, backgroundPattern: to };
    },
  };
}
