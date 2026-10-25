// A background pattern a product has stopped offering. The retired value is not in the shared BackgroundPattern
// (./basics): a product that still offers it extends its own pattern type with it, and a product that retired it
// binds a map of each retired value to the shared pattern that replaces it. The binding gives that product a pattern
// guard that refuses the retired values, and a read-time migration that moves a stored tab onto the replacement, so a
// tab saved with a retired pattern still opens and draws. Each product's docs/specs/008-canvas/canvas-and-palette.md
// "Retired features" records what it retired and why the replacement was chosen.
import { isBackgroundPattern, type BackgroundPattern } from './basics';

/** Each retired pattern value and the pattern a tab that wore it wears instead (a shared one this product offers). */
export type RetiredPatternMap<R extends string> = Readonly<
  Record<R, Exclude<BackgroundPattern, R>>
>;

export type RetiredPatterns<R extends string> = {
  /** A pattern this product still offers: a shared BackgroundPattern that is not retired. */
  isOffered: (value: unknown) => value is Exclude<BackgroundPattern, R>;
  /** The tab moved off a retired pattern onto its replacement; the same tab when it wears none. */
  migrate: <T extends object>(tab: T) => T;
};

export function bindRetiredPatterns<R extends string>(
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
