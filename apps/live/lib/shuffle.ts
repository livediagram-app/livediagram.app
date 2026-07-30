// Returns a new array with the pinned items (kept in their original
// relative order) at the front and every other item in random order.
//
// Used by the new-diagram / template picker to rotate which templates and
// themes greet the user on each open, so they discover options beyond the
// usual first rows, while always keeping the sensible default pinned first
// (Blank diagram for templates, Brand for themes). See
// components/TemplatePicker.tsx and spec/14-new-diagram-route.md.
//
// `rng` is injectable so tests can pin the order deterministically; it
// defaults to the shared CSPRNG-backed unit draw (see lib/random.ts).
import { randomUnit } from './random';

export function shufflePinned<T>(
  items: T[],
  isPinned: (item: T) => boolean,
  rng: () => number = randomUnit,
): T[] {
  const pinned = items.filter(isPinned);
  const rest = items.filter((item) => !isPinned(item));
  // Fisher-Yates over the non-pinned tail.
  for (let i = rest.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [rest[i], rest[j]] = [rest[j]!, rest[i]!];
  }
  return [...pinned, ...rest];
}
